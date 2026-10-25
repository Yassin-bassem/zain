import { query, queryOne, transaction } from '@/lib/db';

export interface OrderItemInput {
  variant_id: number;
  quantity: number;
  unit_price: number;
  line_discount?: number;
}

export interface CreateOrderInput {
  customer_id: number;
  notes?: string;
  order_date?: string;
  discount_amount?: number;
  items: OrderItemInput[];
}

export async function createDraftOrder(userId: number, input: CreateOrderInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error('يجب إضافة صنف واحد على الأقل للطلب.');
  }

  // Validate items
  const aggregatedItems = new Map<number, { quantity: number; unit_price: number; line_discount: number }>();

  for (const item of input.items) {
    const qty = Math.floor(Number(item.quantity));
    if (isNaN(qty) || qty <= 0) {
      throw new Error('الكمية المطلوبة لكل صنف يجب أن تكون رقماً صحيحاً موجباً أكبر من صفر.');
    }
    const price = Number(item.unit_price);
    if (isNaN(price) || price < 0) {
      throw new Error('سعر الوحدة غير صالح.');
    }
    const disc = Number(item.line_discount || 0);

    if (aggregatedItems.has(item.variant_id)) {
      const prev = aggregatedItems.get(item.variant_id)!;
      prev.quantity += qty;
      prev.line_discount += disc;
    } else {
      aggregatedItems.set(item.variant_id, {
        quantity: qty,
        unit_price: price,
        line_discount: disc,
      });
    }
  }

  return await transaction(async (tx) => {
    let subtotal = 0;
    let totalPieces = 0;

    for (const [, val] of aggregatedItems) {
      subtotal += val.quantity * val.unit_price - val.line_discount;
      totalPieces += val.quantity;
    }

    const orderDiscount = Number(input.discount_amount || 0);
    const totalAmount = Math.max(0, subtotal - orderDiscount);

    // Human readable order number e.g. ORD-2610-0042
    const dateStr = new Date().toISOString().slice(2, 7).replace('-', '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateStr}-${randSuffix}`;

    const orderRows = await tx.query<{ id: number }>(
      `INSERT INTO sales_orders (
         order_number, customer_id, status, order_date, notes,
         subtotal, discount_amount, total_amount, total_pieces, created_by
       ) VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        orderNumber,
        input.customer_id,
        input.order_date || new Date().toISOString().slice(0, 10),
        input.notes || null,
        subtotal,
        orderDiscount,
        totalAmount,
        totalPieces,
        userId,
      ]
    );

    const orderId = orderRows[0].id;

    for (const [variantId, item] of aggregatedItems) {
      const lineTotal = item.quantity * item.unit_price - item.line_discount;
      await tx.execute(
        `INSERT INTO sales_order_items (
           order_id, variant_id, quantity, unit_price, line_discount, line_total
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, variantId, item.quantity, item.unit_price, item.line_discount, lineTotal]
      );
    }

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CREATE_DRAFT_ORDER', 'sales_order', $2, $3)`,
      [
        userId,
        String(orderId),
        JSON.stringify({ orderNumber, totalPieces, totalAmount }),
      ]
    );

    return { orderId, orderNumber, totalAmount, totalPieces };
  });
}

export async function confirmOrder(userId: number, orderId: number, locationId?: number) {
  return await transaction(async (tx) => {
    // 1. Fetch and lock order
    const order = await tx.queryOne<{
      id: number;
      order_number: string;
      status: string;
      customer_id: number;
    }>(
      `SELECT id, order_number, status, customer_id 
       FROM sales_orders 
       WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (!order) {
      throw new Error('طلب المبيعات غير موجود.');
    }

    if (order.status !== 'draft') {
      throw new Error(`لا يمكن تأكيد الطلب لأنه في حالة (${order.status}). التأكيد متاح فقط للمسودات.`);
    }

    // 2. Fetch order items
    const items = await tx.query<{
      id: number;
      variant_id: number;
      quantity: number;
      model_code: string;
      model_name: string;
      color_name: string;
      size_name: string;
      sku: string;
    }>(
      `SELECT soi.id, soi.variant_id, soi.quantity,
              p.model_code, p.model_name, c.name AS color_name, sz.name AS size_name, pv.sku
       FROM sales_order_items soi
       JOIN product_variants pv ON soi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       JOIN colors c ON pv.color_id = c.id
       JOIN sizes sz ON pv.size_id = sz.id
       WHERE soi.order_id = $1`,
      [orderId]
    );

    if (items.length === 0) {
      throw new Error('لا توجد بنود في هذا الطلب لتأكيده.');
    }

    // Determine location
    let targetLocId = locationId;
    if (!targetLocId) {
      const mainLoc = await tx.queryOne<{ id: number }>(
        "SELECT id FROM inventory_locations WHERE location_code = 'MAIN'"
      );
      targetLocId = mainLoc!.id;
    }

    // 3. Check inventory and lock balance rows FOR UPDATE
    const shortages: string[] = [];

    for (const item of items) {
      const balance = await tx.queryOne<{
        id: number;
        on_hand_quantity: number;
        reserved_quantity: number;
      }>(
        `SELECT id, on_hand_quantity, reserved_quantity
         FROM inventory_balances
         WHERE variant_id = $1 AND location_id = $2
         FOR UPDATE`,
        [item.variant_id, targetLocId]
      );

      const onHand = balance ? Number(balance.on_hand_quantity) : 0;
      const reserved = balance ? Number(balance.reserved_quantity) : 0;
      const available = onHand - reserved;

      if (available < item.quantity) {
        shortages.push(
          `الموديل [${item.model_code} - ${item.model_name}] لون: ${item.color_name}، مقاس: ${item.size_name} (المتاح: ${available} قطعة، المطلوب: ${item.quantity} قطعة)`
        );
      }
    }

    if (shortages.length > 0) {
      throw new Error(
        `تعذر تأكيد الطلب نظراً لنقص الكميات المتاحة في المخزن:\n• ${shortages.join('\n• ')}`
      );
    }

    // 4. All variants have sufficient available stock -> execute reservation
    for (const item of items) {
      await tx.execute(
        `UPDATE inventory_balances
         SET reserved_quantity = reserved_quantity + $1, updated_at = CURRENT_TIMESTAMP
         WHERE variant_id = $2 AND location_id = $3`,
        [item.quantity, item.variant_id, targetLocId]
      );

      await tx.execute(
        `INSERT INTO stock_reservations (order_id, order_item_id, variant_id, location_id, quantity, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [orderId, item.id, item.variant_id, targetLocId, item.quantity]
      );
    }

    // 5. Update order status
    await tx.execute(
      `UPDATE sales_orders
       SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [orderId]
    );

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CONFIRM_SALES_ORDER', 'sales_order', $2, $3)`,
      [
        userId,
        String(orderId),
        JSON.stringify({
          orderNumber: order.order_number,
          reservedItemsCount: items.length,
          note: 'تم حجز كافة الأصناف بنجاح داخل معاملة ذرية متزامنة',
        }),
      ]
    );

    return { success: true, orderNumber: order.order_number };
  });
}

export async function cancelOrder(userId: number, orderId: number) {
  return await transaction(async (tx) => {
    const order = await tx.queryOne<{
      id: number;
      order_number: string;
      status: string;
    }>(
      `SELECT id, order_number, status 
       FROM sales_orders 
       WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (!order) throw new Error('طلب المبيعات غير موجود.');

    if (order.status === 'shipped') {
      throw new Error('لا يمكن إلغاء طلب تم شحنه بالفعل. استخدم نموذج المرتجعات إذا أعاد العميل البضاعة.');
    }

    if (order.status === 'canceled') {
      throw new Error('الطلب ملغي بالفعل.');
    }

    // If order was confirmed, picking, or packed -> release active reservations
    const reservations = await tx.query<{
      id: number;
      variant_id: number;
      location_id: number;
      quantity: number;
    }>(
      `SELECT id, variant_id, location_id, quantity
       FROM stock_reservations
       WHERE order_id = $1 AND status = 'active'
       FOR UPDATE`,
      [orderId]
    );

    for (const res of reservations) {
      await tx.execute(
        `UPDATE inventory_balances
         SET reserved_quantity = GREATEST(0, reserved_quantity - $1), updated_at = CURRENT_TIMESTAMP
         WHERE variant_id = $2 AND location_id = $3`,
        [res.quantity, res.variant_id, res.location_id]
      );

      await tx.execute(
        `UPDATE stock_reservations
         SET status = 'released', released_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [res.id]
      );
    }

    // Set order status
    await tx.execute(
      `UPDATE sales_orders
       SET status = 'canceled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [orderId]
    );

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CANCEL_SALES_ORDER', 'sales_order', $2, $3)`,
      [
        userId,
        String(orderId),
        JSON.stringify({
          orderNumber: order.order_number,
          releasedReservationsCount: reservations.length,
          note: 'تم إلغاء الطلب وفك حجز المخزون بالكامل دون المساس بالرصيد الفعلي',
        }),
      ]
    );

    return { success: true, releasedCount: reservations.length };
  });
}

export async function startPicking(userId: number, orderId: number) {
  return await transaction(async (tx) => {
    const order = await tx.queryOne<{ id: number; order_number: string; status: string }>(
      'SELECT id, order_number, status FROM sales_orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    if (!order) throw new Error('الطلب غير موجود.');
    if (order.status !== 'confirmed') {
      throw new Error('لا يمكن بدء التجهيز إلا للطلبات المؤكدة المحجوزة.');
    }

    await tx.execute(
      `UPDATE sales_orders SET status = 'picking', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [orderId]
    );

    const batchNumber = `PICK-${Date.now().toString().slice(-6)}`;
    const batch = await tx.query<{ id: number }>(
      `INSERT INTO pick_batches (batch_number, order_id, assigned_to, status)
       VALUES ($1, $2, $3, 'in_progress') RETURNING id`,
      [batchNumber, orderId, userId]
    );

    // Insert items
    const items = await tx.query<{ id: number; quantity: number }>(
      'SELECT id, quantity FROM sales_order_items WHERE order_id = $1',
      [orderId]
    );

    for (const item of items) {
      await tx.execute(
        `INSERT INTO pick_batch_items (batch_id, order_item_id, requested_quantity, picked_quantity)
         VALUES ($1, $2, $3, $3)`,
        [batch[0].id, item.id, item.quantity]
      );
      await tx.execute(
        `UPDATE sales_order_items SET picked_quantity = $1 WHERE id = $2`,
        [item.quantity, item.id]
      );
    }

    return { success: true, batchNumber };
  });
}

export async function packOrder(userId: number, orderId: number) {
  return await transaction(async (tx) => {
    const order = await tx.queryOne<{ id: number; order_number: string; status: string }>(
      'SELECT id, order_number, status FROM sales_orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    if (!order) throw new Error('الطلب غير موجود.');
    if (order.status !== 'picking' && order.status !== 'confirmed') {
      throw new Error('لا يمكن التغليف إلا بعد تجهيز البضاعة.');
    }

    await tx.execute(
      `UPDATE sales_orders SET status = 'packed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [orderId]
    );

    return { success: true };
  });
}

export async function shipOrder(
  userId: number,
  orderId: number,
  partialItems?: Array<{ variant_id: number; quantity: number }>
) {
  return await transaction(async (tx) => {
    // Lock order
    const order = await tx.queryOne<{
      id: number;
      order_number: string;
      status: string;
      customer_id: number;
    }>(
      `SELECT id, order_number, status, customer_id
       FROM sales_orders
       WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (!order) throw new Error('الطلب غير موجود.');

    if (order.status === 'shipped') {
      throw new Error('هذا الطلب تم شحنه وتسليمه بالفعل، ولا يمكن شحنه مرة ثانية.');
    }

    if (order.status === 'canceled') {
      throw new Error('لا يمكن شحن طلب ملغي.');
    }

    if (!['packed', 'picking', 'confirmed'].includes(order.status)) {
      throw new Error(`حالة الطلب (${order.status}) لا تسمح بالشحن.`);
    }

    // Fetch active reservations
    const reservations = await tx.query<{
      id: number;
      order_item_id: number;
      variant_id: number;
      location_id: number;
      quantity: number;
      model_code: string;
      model_name: string;
    }>(
      `SELECT sr.id, sr.order_item_id, sr.variant_id, sr.location_id, sr.quantity,
              p.model_code, p.model_name
       FROM stock_reservations sr
       JOIN product_variants pv ON sr.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE sr.order_id = $1 AND sr.status = 'active'
       FOR UPDATE`,
      [orderId]
    );

    if (reservations.length === 0) {
      throw new Error('لا توجد حجوزات مخزنية نشطة لهذا الطلب لتسليمها.');
    }

    const partialMap = partialItems
      ? new Map<number, number>(partialItems.map((i) => [i.variant_id, i.quantity]))
      : null;

    // Deduct physical stock and fulfill reservations
    for (const res of reservations) {
      let shipQty = res.quantity;
      if (partialMap) {
        const requestedQty = partialMap.get(res.variant_id);
        if (requestedQty === undefined) {
          continue; // not shipping this item in this batch
        }
        shipQty = Math.min(res.quantity, Math.max(0, requestedQty));
      }

      if (shipQty <= 0) {
        continue;
      }

      const balance = await tx.queryOne<{
        id: number;
        on_hand_quantity: number;
        reserved_quantity: number;
      }>(
        `SELECT id, on_hand_quantity, reserved_quantity
         FROM inventory_balances
         WHERE variant_id = $1 AND location_id = $2
         FOR UPDATE`,
        [res.variant_id, res.location_id]
      );

      if (!balance || Number(balance.on_hand_quantity) < shipQty) {
        throw new Error(
          `رصيد المخزن الفعلي للصنف [${res.model_code} - ${res.model_name}] غير كافٍ لإتمام عملية الشحن.`
        );
      }

      // Deduct on_hand and release reserved by shipQty
      await tx.execute(
        `UPDATE inventory_balances
         SET on_hand_quantity = on_hand_quantity - $1,
             reserved_quantity = GREATEST(0, reserved_quantity - $1),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [shipQty, balance.id]
      );

      // If fully shipped reservation -> status = fulfilled, else reduce quantity
      if (shipQty >= res.quantity) {
        await tx.execute(
          `UPDATE stock_reservations
           SET status = 'fulfilled'
           WHERE id = $1`,
          [res.id]
        );
      } else {
        await tx.execute(
          `UPDATE stock_reservations
           SET quantity = quantity - $1
           WHERE id = $2`,
          [shipQty, res.id]
        );
      }

      // Record immutable stock movement (negative delta)
      await tx.execute(
        `INSERT INTO stock_movements (
           variant_id, location_id, movement_type, quantity_delta,
           reference_type, reference_id, reason, created_by
         ) VALUES ($1, $2, 'SHIPMENT', $3, 'SALES_ORDER', $4, $5, $6)`,
        [
          res.variant_id,
          res.location_id,
          -shipQty,
          order.order_number,
          `شحن وتسليم طلب المبيعات ${order.order_number}`,
          userId,
        ]
      );

      // Update shipped_quantity on order item
      await tx.execute(
        `UPDATE sales_order_items
         SET shipped_quantity = shipped_quantity + $1
         WHERE id = $2`,
        [shipQty, res.order_item_id]
      );
    }

    // Check if any order item is still not fully shipped
    const remainingItems = await tx.queryOne<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM sales_order_items WHERE order_id = $1 AND shipped_quantity < quantity`,
      [orderId]
    );
    const hasRemaining = Number(remainingItems?.count || 0) > 0;

    const finalStatus = hasRemaining ? 'confirmed' : 'shipped';
    await tx.execute(
      `UPDATE sales_orders
       SET status = $1, shipped_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [finalStatus, orderId]
    );

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'SHIP_SALES_ORDER', 'sales_order', $2, $3)`,
      [
        userId,
        String(orderId),
        JSON.stringify({
          orderNumber: order.order_number,
          finalStatus,
          note: hasRemaining ? 'شحن جزئي للطلب' : 'تم شحن وتسليم كامل الطلب',
        }),
      ]
    );

    return { success: true, orderNumber: order.order_number, status: finalStatus };
  });
}

export async function getOrderDetails(orderId: number) {
  const order = await queryOne<{
    id: number;
    order_number: string;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    customer_address: string | null;
    status: string;
    order_date: string;
    notes: string | null;
    subtotal: number;
    discount_amount: number;
    total_amount: number;
    total_pieces: number;
    created_by_name: string | null;
    created_at: string;
    confirmed_at: string | null;
    shipped_at: string | null;
  }>(
    `SELECT so.*, 
            c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
            u.full_name AS created_by_name
     FROM sales_orders so
     JOIN customers c ON so.customer_id = c.id
     LEFT JOIN users u ON so.created_by = u.id
     WHERE so.id = $1`,
    [orderId]
  );

  if (!order) return null;

  const items = await query<{
    id: number;
    variant_id: number;
    model_code: string;
    model_name: string;
    color_name: string;
    size_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    line_discount: number;
    line_total: number;
    picked_quantity: number;
    shipped_quantity: number;
    checked_quantity: number;
    packed_quantity: number;
    on_hand_quantity: number;
    available_quantity: number;
    shelf_code: string | null;
    shelf_quantity: number;
    qr_code_uid: string | null;
  }>(
    `SELECT soi.*,
            COALESCE(soi.checked_quantity, 0) AS checked_quantity,
            COALESCE(soi.packed_quantity, 0) AS packed_quantity,
            p.model_code, p.model_name,
            col.name AS color_name, sz.name AS size_name, pv.sku,
            pv.qr_code_uid,
            (
              SELECT ws.shelf_code
              FROM variant_shelves vs
              JOIN warehouse_shelves ws ON vs.shelf_id = ws.id
              WHERE vs.variant_id = pv.id
              ORDER BY vs.is_primary DESC, vs.id ASC
              LIMIT 1
            ) AS shelf_code,
            COALESCE((
              SELECT vs.quantity
              FROM variant_shelves vs
              WHERE vs.variant_id = pv.id
              ORDER BY vs.is_primary DESC, vs.id ASC
              LIMIT 1
            ), 0) AS shelf_quantity,
            COALESCE(ib.on_hand_quantity, 0) AS on_hand_quantity,
            (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) AS available_quantity
     FROM sales_order_items soi
     JOIN product_variants pv ON soi.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     JOIN colors col ON pv.color_id = col.id
     JOIN sizes sz ON pv.size_id = sz.id
     LEFT JOIN inventory_locations loc ON loc.location_code = 'MAIN'
     LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id AND ib.location_id = loc.id
     WHERE soi.order_id = $1
     ORDER BY p.model_code ASC, col.name ASC, sz.sort_order ASC`,
    [orderId]
  );

  return { order, items };
}
