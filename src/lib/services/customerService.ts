import { query, queryOne, transaction } from '@/lib/db';

export interface CustomerProfileSummary {
  id: number;
  customer_code: string;
  name: string;
  phone: string;
  alternate_phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  total_orders: number;
  total_pieces_ordered: number;
  total_pieces_shipped: number;
  total_pieces_remaining: number;
  total_spent: number;
}

export interface CustomerOrderLine {
  id: number;
  variant_id: number;
  model_code: string;
  model_name: string;
  color_name: string;
  size_name: string;
  sku: string;
  quantity_ordered: number;
  quantity_reserved: number;
  quantity_picked: number;
  quantity_checked: number;
  quantity_packed: number;
  quantity_shipped: number;
  quantity_remaining: number;
  unit_price: number;
  line_total: number;
  shelf_code: string | null;
}

export interface CustomerOrderHistoryItem {
  id: number;
  order_number: string;
  order_date: string;
  status: string;
  preparation_status: string;
  priority: string;
  total_pieces: number;
  pieces_shipped: number;
  pieces_remaining: number;
  total_amount: number;
  discount_amount: number;
  subtotal: number;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  delivered_by_name: string | null;
  delivery_recipient_name: string | null;
  delivery_notes: string | null;
  items: CustomerOrderLine[];
}

export async function getCustomerProfile(customerId: number): Promise<{
  customer: CustomerProfileSummary;
  orders: CustomerOrderHistoryItem[];
  timeline: Array<{
    id: number;
    order_id: number;
    order_number: string;
    event_type: string;
    title: string;
    details: any;
    created_at: string;
    user_name: string | null;
  }>;
  returns: any[];
} | null> {
  const customer = await queryOne<{
    id: number;
    customer_code: string;
    name: string;
    phone: string;
    alternate_phone: string | null;
    address: string | null;
    notes: string | null;
    created_at: string;
  }>(
    `SELECT id, customer_code, name, phone, alternate_phone, address, notes, created_at
     FROM customers
     WHERE id = $1 AND active = true`,
    [customerId]
  );

  if (!customer) return null;

  // Fetch all orders for this customer
  const ordersRaw = await query<{
    id: number;
    order_number: string;
    order_date: string;
    status: string;
    preparation_status: string;
    priority: string;
    total_pieces: number;
    total_amount: number;
    discount_amount: number;
    subtotal: number;
    notes: string | null;
    created_at: string;
    confirmed_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    delivered_by_name: string | null;
    delivery_recipient_name: string | null;
    delivery_notes: string | null;
  }>(
    `SELECT so.id, so.order_number, so.order_date, so.status,
            COALESCE(so.preparation_status, 'pending') as preparation_status,
            COALESCE(so.priority, 'normal') as priority,
            so.total_pieces, so.total_amount, so.discount_amount, so.subtotal,
            so.notes, so.created_at, so.confirmed_at, so.shipped_at,
            so.delivered_at, so.delivery_recipient_name, so.delivery_notes,
            u.full_name as delivered_by_name
     FROM sales_orders so
     LEFT JOIN users u ON so.delivered_by = u.id
     WHERE so.customer_id = $1
     ORDER BY so.created_at DESC`,
    [customerId]
  );

  // Fetch order items with fulfillment statuses and primary shelf
  const orderIds = ordersRaw.map((o) => o.id);
  const itemsByOrderId = new Map<number, CustomerOrderLine[]>();

  if (orderIds.length > 0) {
    const itemsRaw = await query<{
      id: number;
      order_id: number;
      variant_id: number;
      quantity: number;
      picked_quantity: number;
      checked_quantity: number;
      packed_quantity: number;
      shipped_quantity: number;
      unit_price: number;
      line_total: number;
      model_code: string;
      model_name: string;
      color_name: string;
      size_name: string;
      sku: string;
      shelf_code: string | null;
      reserved_qty: number;
    }>(
      `SELECT soi.id, soi.order_id, soi.variant_id, soi.quantity,
              soi.picked_quantity,
              COALESCE(soi.checked_quantity, 0) as checked_quantity,
              COALESCE(soi.packed_quantity, 0) as packed_quantity,
              soi.shipped_quantity,
              soi.unit_price, soi.line_total,
              p.model_code, p.model_name,
              c.name as color_name, sz.name as size_name, pv.sku,
              (
                SELECT ws.shelf_code
                FROM variant_shelves vs
                JOIN warehouse_shelves ws ON vs.shelf_id = ws.id
                WHERE vs.variant_id = pv.id
                ORDER BY vs.is_primary DESC, vs.id ASC
                LIMIT 1
              ) as shelf_code,
              COALESCE((
                SELECT SUM(sr.quantity)
                FROM stock_reservations sr
                WHERE sr.order_id = soi.order_id AND sr.variant_id = soi.variant_id AND sr.status = 'active'
              ), 0) as reserved_qty
       FROM sales_order_items soi
       JOIN product_variants pv ON soi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       JOIN colors c ON pv.color_id = c.id
       JOIN sizes sz ON pv.size_id = sz.id
       WHERE soi.order_id = ANY($1::int[])
       ORDER BY p.model_code ASC, c.name ASC, sz.sort_order ASC`,
      [orderIds]
    );

    for (const it of itemsRaw) {
      const list = itemsByOrderId.get(it.order_id) || [];
      const qtyOrdered = Number(it.quantity);
      const qtyShipped = Number(it.shipped_quantity || 0);
      const qtyRemaining = Math.max(0, qtyOrdered - qtyShipped);

      list.push({
        id: it.id,
        variant_id: it.variant_id,
        model_code: it.model_code,
        model_name: it.model_name,
        color_name: it.color_name,
        size_name: it.size_name,
        sku: it.sku,
        quantity_ordered: qtyOrdered,
        quantity_reserved: Number(it.reserved_qty || 0),
        quantity_picked: Number(it.picked_quantity || 0),
        quantity_checked: Number(it.checked_quantity || 0),
        quantity_packed: Number(it.packed_quantity || 0),
        quantity_shipped: qtyShipped,
        quantity_remaining: qtyRemaining,
        unit_price: Number(it.unit_price),
        line_total: Number(it.line_total),
        shelf_code: it.shelf_code,
      });
      itemsByOrderId.set(it.order_id, list);
    }
  }

  let totalPiecesOrdered = 0;
  let totalPiecesShipped = 0;
  let totalPiecesRemaining = 0;
  let totalSpent = 0;

  const orders: CustomerOrderHistoryItem[] = ordersRaw.map((o) => {
    const items = itemsByOrderId.get(o.id) || [];
    let piecesShipped = 0;
    let piecesOrdered = 0;

    for (const it of items) {
      piecesOrdered += it.quantity_ordered;
      piecesShipped += it.quantity_shipped;
    }

    if (items.length === 0) {
      piecesOrdered = Number(o.total_pieces || 0);
      if (o.status === 'shipped') {
        piecesShipped = piecesOrdered;
      }
    }

    const piecesRemaining = Math.max(0, piecesOrdered - piecesShipped);

    if (o.status !== 'canceled') {
      totalPiecesOrdered += piecesOrdered;
      totalPiecesShipped += piecesShipped;
      totalPiecesRemaining += piecesRemaining;
      totalSpent += Number(o.total_amount || 0);
    }

    return {
      id: o.id,
      order_number: o.order_number,
      order_date: o.order_date,
      status: o.status,
      preparation_status: o.preparation_status,
      priority: o.priority,
      total_pieces: piecesOrdered,
      pieces_shipped: piecesShipped,
      pieces_remaining: piecesRemaining,
      total_amount: Number(o.total_amount),
      discount_amount: Number(o.discount_amount),
      subtotal: Number(o.subtotal),
      notes: o.notes,
      created_at: o.created_at,
      confirmed_at: o.confirmed_at,
      shipped_at: o.shipped_at,
      delivered_at: o.delivered_at,
      delivered_by_name: o.delivered_by_name,
      delivery_recipient_name: o.delivery_recipient_name,
      delivery_notes: o.delivery_notes,
      items,
    };
  });

  // Customer timeline events
  const timeline = await query<{
    id: number;
    order_id: number;
    order_number: string;
    event_type: string;
    title: string;
    details: any;
    created_at: string;
    user_name: string | null;
  }>(
    `SELECT ote.id, ote.order_id, so.order_number, ote.event_type, ote.title, ote.details, ote.created_at,
            u.full_name as user_name
     FROM order_timeline_events ote
     JOIN sales_orders so ON ote.order_id = so.id
     LEFT JOIN users u ON ote.user_id = u.id
     WHERE so.customer_id = $1
     ORDER BY ote.created_at DESC
     LIMIT 50`,
    [customerId]
  );

  // Returns for this customer
  const returns = await query(
    `SELECT sr.*, so.order_number
     FROM sales_returns sr
     LEFT JOIN sales_orders so ON sr.order_id = so.id
     WHERE sr.customer_id = $1
     ORDER BY sr.created_at DESC`,
    [customerId]
  );

  return {
    customer: {
      ...customer,
      total_orders: orders.length,
      total_pieces_ordered: totalPiecesOrdered,
      total_pieces_shipped: totalPiecesShipped,
      total_pieces_remaining: totalPiecesRemaining,
      total_spent: totalSpent,
    },
    orders,
    timeline,
    returns,
  };
}

export async function confirmOrderDelivery(
  first: any,
  second?: any,
  third?: any
) {
  let orderId: number;
  let userId: number;
  let recipient_name: string | null = null;
  let delivery_notes: string | null = null;

  if (typeof second === 'object' && second !== null) {
    userId = second.userId || first;
    orderId = second.orderId || first;
    recipient_name = second.recipientName || second.recipient_name || null;
    delivery_notes = second.notes || second.delivery_notes || null;
  } else {
    orderId = first;
    userId = second;
    recipient_name = third?.recipient_name || third?.recipientName || null;
    delivery_notes = third?.delivery_notes || third?.notes || null;
  }

  return await transaction(async (tx) => {
    const order = await tx.queryOne<{
      id: number;
      order_number: string;
      status: string;
      customer_id: number;
      shipped_at: string | null;
      delivered_at: string | null;
    }>(
      `SELECT id, order_number, status, customer_id, shipped_at, delivered_at 
       FROM sales_orders 
       WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    if (!order) throw new Error('الطلب غير موجود.');

    if (order.status !== 'shipped' && !order.shipped_at) {
      throw new Error('لا يمكن تأكيد تسليم العميل إلا بعد شحن الطلب أولاً.');
    }

    if (order.delivered_at) {
      throw new Error('تم تأكيد تسليم هذا الطلب بالفعل مسبقاً.');
    }

    const now = new Date().toISOString();

    await tx.execute(
      `UPDATE sales_orders 
       SET delivered_at = CURRENT_TIMESTAMP,
           delivered_by = $1,
           delivery_recipient_name = $2,
           delivery_notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [userId, recipient_name?.trim() || null, delivery_notes?.trim() || null, orderId]
    );

    // Record in timeline
    await tx.execute(
      `INSERT INTO order_timeline_events (order_id, event_type, title, details, user_id)
       VALUES ($1, 'DELIVERED', $2, $3, $4)`,
      [
        orderId,
        'تم تأكيد تسليم الشحنة للعميل بنجاح',
        JSON.stringify({
          recipient: recipient_name || 'العميل',
          notes: delivery_notes || null,
          confirmedAt: now,
        }),
        userId,
      ]
    );

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CONFIRM_CUSTOMER_DELIVERY', 'sales_order', $2, $3)`,
      [
        userId,
        String(orderId),
        JSON.stringify({
          orderNumber: order.order_number,
          recipient: recipient_name,
        }),
      ]
    );

    return { success: true, deliveredAt: now };
  });
}
