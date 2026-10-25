import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabaseForTests, query, queryOne, execute } from '../src/lib/db';
import { createProduct, createBulkVariants } from '../src/lib/services/productService';
import { adjustStock } from '../src/lib/services/inventoryService';
import { createDraftOrder, confirmOrder, shipOrder, getOrderDetails } from '../src/lib/services/orderService';
import { getCustomerProfile, confirmOrderDelivery } from '../src/lib/services/customerService';
import { getOrCreateShelf, assignVariantToShelf, getVariantShelves } from '../src/lib/services/shelfService';
import { resolveScannedCode } from '../src/lib/services/qrService';
import {
  getPreparationQueue,
  getOrderPreparationDetails,
  getOrCreateReviewSession,
  processReviewScan,
  undoReviewScan,
  confirmReviewCompletion,
} from '../src/lib/services/preparationService';
import {
  createAuditSession,
  getAuditSessionDetails,
  updateAuditLineCount,
  approveAndApplyAuditAdjustments,
} from '../src/lib/services/auditService';
import {
  createReturn,
  approveReturnRequest,
  rejectReturnRequest,
  inspectAndRestockReturnItem,
} from '../src/lib/services/returnService';
import { performGlobalSearch } from '../src/lib/services/searchService';
import { createInitialAdmin } from '../src/lib/auth';

describe('Advanced Wholesale Inventory Upgrades - Acceptance Suite', () => {
  let adminId: number;
  let testCustomerId: number;
  let testLocationId: number;
  let variantAId: number;
  let variantBId: number;
  let variantCId: number;

  beforeEach(async () => {
    await resetDatabaseForTests();

    // 1. Create Admin
    const admin = await createInitialAdmin({
      username: 'admin',
      full_name: 'مدير النظام',
      email: 'admin@zain-wholesale.eg',
      password: 'password123',
    });
    adminId = admin.id;

    // 2. Get main location
    const loc = await queryOne<{ id: number }>(
      "SELECT id FROM inventory_locations WHERE location_code = 'MAIN'"
    );
    testLocationId = loc ? loc.id : 1;

    // 3. Create test customer
    const custRes = await query<{ id: number }>(
      `INSERT INTO customers (customer_code, name, phone, address)
       VALUES ('CUST-100', 'محل طيور الجنة للأطفال', '01099887766', 'طنطا')
       RETURNING id`
    );
    testCustomerId = custRes[0].id;

    // 4. Create Product & 3 Variants
    const product = await createProduct({
      model_code: 'Z-200',
      model_name: 'طقم ولادي قطن كاجوال',
      default_price: 250,
    });

    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 2');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 2');

    await createBulkVariants({
      productId: product.id,
      colorIds: [colors[0].id, colors[1].id],
      sizeIds: [sizes[0].id],
    });

    await createBulkVariants({
      productId: product.id,
      colorIds: [colors[0].id],
      sizeIds: [sizes[1].id],
    });

    const vars = await query<{ id: number }>(
      'SELECT id FROM product_variants WHERE product_id = $1 ORDER BY id ASC',
      [product.id]
    );

    variantAId = vars[0].id;
    variantBId = vars[1].id;
    variantCId = vars[2].id;

    // Seed initial physical stock: 50 of variant A, 50 of variant B
    await adjustStock({
      userId: adminId,
      locationId: testLocationId,
      reason: 'رصيد مخزن مبدئي A و B',
      items: [
        { variantId: variantAId, newQuantity: 50 },
        { variantId: variantBId, newQuantity: 50 },
      ],
    });
  });

  // Scenario 1 & 2: Customer Profile and Shipment Quantities
  it('1 & 2. Customer profile correctly shows orders, partial shipments, and remaining quantities', async () => {
    // Create an order with 10 of A and 5 of B
    const order = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [
        { variant_id: variantAId, quantity: 10, unit_price: 250 },
        { variant_id: variantBId, quantity: 5, unit_price: 250 },
      ],
    });

    // Confirm order (reserves stock)
    await confirmOrder(adminId, order.orderId);

    // Partial shipment: ship 6 of A and 5 of B
    await shipOrder(adminId, order.orderId, [
      { variant_id: variantAId, quantity: 6 },
      { variant_id: variantBId, quantity: 5 },
    ]);

    const profile = await getCustomerProfile(testCustomerId);
    expect(profile).toBeDefined();
    expect(profile!.customer.id).toBe(testCustomerId);
    expect(profile!.customer.total_orders).toBe(1);
    expect(profile!.customer.total_pieces_ordered).toBe(15);
    expect(profile!.customer.total_pieces_shipped).toBe(11);
    expect(profile!.customer.total_pieces_remaining).toBe(4);

    const orderRow = profile!.orders[0];
    expect(orderRow.total_pieces).toBe(15);
    expect(orderRow.pieces_shipped).toBe(11);
    expect(orderRow.pieces_remaining).toBe(4);

    // Verify order lines
    const lineA = orderRow.items.find((i: any) => i.variant_id === variantAId);
    expect(lineA!.quantity_ordered).toBe(10);
    expect(lineA!.quantity_shipped).toBe(6);
    expect(lineA!.quantity_remaining).toBe(4);

    const lineB = orderRow.items.find((i: any) => i.variant_id === variantBId);
    expect(lineB!.quantity_ordered).toBe(5);
    expect(lineB!.quantity_shipped).toBe(5);
    expect(lineB!.quantity_remaining).toBe(0);

    // Confirm delivery with user and timestamp
    const deliverRes = await confirmOrderDelivery(adminId, {
      orderId: order.orderId,
      recipientName: 'الأستاذ سامح (المستلم)',
      notes: 'تم الاستلام والدفع كاش بالكامل',
    });
    expect(deliverRes.success).toBe(true);

    const updatedProfile = await getCustomerProfile(testCustomerId);
    expect(updatedProfile!.orders[0].delivered_at).toBeDefined();
    expect(updatedProfile!.orders[0].delivery_recipient_name).toBe('الأستاذ سامح (المستلم)');
  });

  // Scenario 3: Unique QR identifier for each product variant
  it('3. Each product variant has a unique QR identifier', async () => {
    const varA = await queryOne<{ qr_code_uid: string }>(
      'SELECT qr_code_uid FROM product_variants WHERE id = $1',
      [variantAId]
    );
    const varB = await queryOne<{ qr_code_uid: string }>(
      'SELECT qr_code_uid FROM product_variants WHERE id = $1',
      [variantBId]
    );
    const varC = await queryOne<{ qr_code_uid: string }>(
      'SELECT qr_code_uid FROM product_variants WHERE id = $1',
      [variantCId]
    );

    expect(varA?.qr_code_uid).toBeDefined();
    expect(varB?.qr_code_uid).toBeDefined();
    expect(varC?.qr_code_uid).toBeDefined();

    expect(varA?.qr_code_uid).not.toBe(varB?.qr_code_uid);
    expect(varB?.qr_code_uid).not.toBe(varC?.qr_code_uid);

    // Resolve via qrService
    const resolved = await resolveScannedCode(varA!.qr_code_uid);
    expect(resolved).toBeDefined();
    expect(resolved?.id).toBe(variantAId);
  });

  // Scenario 4 - 10: QR Scanning, Review session, Idempotency, and Stock Safety
  it('4, 5, 8, 9. Scanning verification: correct variant, unrelated variant, deliberate scans, and duplicate idempotency', async () => {
    const order = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variantAId, quantity: 2, unit_price: 250 }],
    });
    await confirmOrder(adminId, order.orderId);

    const reviewData = await getOrCreateReviewSession(adminId, order.orderId);
    expect(reviewData.session.id).toBeDefined();
    const sessionId = reviewData.session.id;

    const varA = await queryOne<{ qr_code_uid: string }>(
      'SELECT qr_code_uid FROM product_variants WHERE id = $1',
      [variantAId]
    );
    const varC = await queryOne<{ qr_code_uid: string }>(
      'SELECT qr_code_uid FROM product_variants WHERE id = $1',
      [variantCId]
    );

    // 4. Scan correct piece 1
    const scan1 = await processReviewScan({
      sessionId,
      orderId: order.orderId,
      userId: adminId,
      code: varA!.qr_code_uid,
      idempotencyKey: 'evt-001',
    });
    expect(scan1.outcome).toBe('correct');
    expect(scan1.variant.id).toBe(variantAId);
    expect(scan1.scanned_quantity).toBe(1);
    expect(scan1.required_quantity).toBe(2);

    // 8. Duplicate submission of same idempotencyKey (idempotency check)
    const scanDup = await processReviewScan({
      sessionId,
      orderId: order.orderId,
      userId: adminId,
      code: varA!.qr_code_uid,
      idempotencyKey: 'evt-001',
    });
    expect(scanDup.outcome).toBe('duplicate_submission');

    // 9. Two deliberate scans of two physical pieces count as two pieces
    const scan2 = await processReviewScan({
      sessionId,
      orderId: order.orderId,
      userId: adminId,
      code: varA!.qr_code_uid,
      idempotencyKey: 'evt-002',
    });
    expect(scan2.outcome).toBe('correct');
    expect(scan2.scanned_quantity).toBe(2);
    expect(scan2.remaining_quantity).toBe(0);

    // 5. Scanning unrelated variant (variant C is not in this order)
    const scanWrong = await processReviewScan({
      sessionId,
      orderId: order.orderId,
      userId: adminId,
      code: varC!.qr_code_uid,
      idempotencyKey: 'evt-003',
    });
    expect(scanWrong.outcome).toBe('wrong');
    expect(scanWrong.message).toContain('غير موجود');
  });

  it('6 & 7. Missing items prevent final review confirmation, excess items require resolution', async () => {
    const order = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variantAId, quantity: 2, unit_price: 250 }],
    });
    await confirmOrder(adminId, order.orderId);

    const reviewData = await getOrCreateReviewSession(adminId, order.orderId);
    const sessionId = reviewData.session.id;
    const varA = await queryOne<{ qr_code_uid: string }>(
      'SELECT qr_code_uid FROM product_variants WHERE id = $1',
      [variantAId]
    );

    // Scan only 1 of 2 pieces
    await processReviewScan({
      sessionId,
      orderId: order.orderId,
      userId: adminId,
      code: varA!.qr_code_uid,
      idempotencyKey: 'evt-m1',
    });

    // Attempt confirmation with missing items -> must fail!
    await expect(confirmReviewCompletion(adminId, sessionId)).rejects.toThrow(
      /أصناف ناقصة/
    );

    // Scan piece 2
    await processReviewScan({
      sessionId,
      orderId: order.orderId,
      userId: adminId,
      code: varA!.qr_code_uid,
      idempotencyKey: 'evt-m2',
    });

    // Scan piece 3 (excess!)
    const scanExcess = await processReviewScan({
      sessionId,
      orderId: order.orderId,
      userId: adminId,
      code: varA!.qr_code_uid,
      idempotencyKey: 'evt-m3',
    });
    expect(scanExcess.outcome).toBe('excess');

    // Attempt confirmation with excess items -> must fail!
    await expect(confirmReviewCompletion(adminId, sessionId)).rejects.toThrow(
      /قطع زائدة/
    );

    // Undo the excess scan
    const undone = await undoReviewScan(adminId, scanExcess.scan_id!);
    expect(undone.success).toBe(true);

    // Now confirmation must succeed!
    const confirmed = await confirmReviewCompletion(adminId, sessionId);
    expect(confirmed.success).toBe(true);
  });

  it('10. Confirming review does NOT deduct physical inventory', async () => {
    const beforeBal = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantAId, testLocationId]
    );
    expect(beforeBal?.on_hand_quantity).toBe(50);

    const order = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variantAId, quantity: 2, unit_price: 250 }],
    });
    await confirmOrder(adminId, order.orderId);

    const reviewData = await getOrCreateReviewSession(adminId, order.orderId);
    const sessionId = reviewData.session.id;
    const varA = await queryOne<{ qr_code_uid: string }>(
      'SELECT qr_code_uid FROM product_variants WHERE id = $1',
      [variantAId]
    );

    await processReviewScan({
      sessionId,
      orderId: order.orderId,
      userId: adminId,
      code: varA!.qr_code_uid,
      idempotencyKey: 'evt-cr1',
    });
    await processReviewScan({
      sessionId,
      orderId: order.orderId,
      userId: adminId,
      code: varA!.qr_code_uid,
      idempotencyKey: 'evt-cr2',
    });

    await confirmReviewCompletion(adminId, sessionId);

    // Verify physical stock is STILL 50 (physical stock is deducted ONLY upon shipping!)
    const afterBal = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantAId, testLocationId]
    );
    expect(afterBal?.on_hand_quantity).toBe(50);
  });

  // Scenario 11 & 12: Shelves, picking screen locations, and location balances
  it('11 & 12. Picking screens show shelf locations and location balances reconcile with total stock', async () => {
    // Create shelf A-01-02
    const shelf = await getOrCreateShelf(testLocationId, 'A-01-02', 'A', '01');
    expect(shelf.shelf_code).toBe('A-01-02');

    // Assign variant A to shelf with quantity 30
    await assignVariantToShelf(adminId, {
      variantId: variantAId,
      shelfId: shelf.id,
      quantity: 30,
      isPrimary: true,
    });

    // Check shelf balances
    const shelves = await getVariantShelves(variantAId);
    expect(shelves.length).toBe(1);
    expect(shelves[0].shelf_code).toBe('A-01-02');
    expect(shelves[0].quantity).toBe(30);

    // Prevent assigning quantity greater than total on-hand balance (on-hand is 50)
    await expect(
      assignVariantToShelf(adminId, {
        variantId: variantAId,
        shelfId: shelf.id,
        quantity: 60,
      })
    ).rejects.toThrow(/يتجاوز رصيد المخزن الفعلي/);

    // Order preparation details must display shelf location
    const order = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variantAId, quantity: 3, unit_price: 250 }],
    });
    await confirmOrder(adminId, order.orderId);

    const prep = await getOrderPreparationDetails(order.orderId);
    expect(prep!.shelfGroups.length).toBeGreaterThan(0);
    const shelfGroup = prep!.shelfGroups.find((g) => g.shelf_code === 'A-01-02');
    expect(shelfGroup).toBeDefined();
    expect(shelfGroup?.items[0].variant_id).toBe(variantAId);
  });

  // Scenario 13 & 14: Inventory Audits (الجرد)
  it('13 & 14. Inventory counts detect discrepancies and applying approved difference creates auditable ADJUSTMENT', async () => {
    const session = await createAuditSession(adminId, {
      auditMode: 'full',
      warehouseId: testLocationId,
      notes: 'جرد تجريبي شامل',
    });

    const details = await getAuditSessionDetails(session.sessionId);
    expect(details!.lines.length).toBeGreaterThan(0);

    const lineA = details!.lines.find((l: any) => l.variant_id === variantAId);
    expect(lineA!.system_physical_quantity).toBe(50);

    // Physically counted 47 pieces instead of 50 (discrepancy = -3)
    await updateAuditLineCount(adminId, {
      lineId: lineA!.id,
      countedQuantity: 47,
      notes: 'عجز 3 قطع بالفحص الفعلي',
    });

    const updatedDetails = await getAuditSessionDetails(session.sessionId);
    const updatedLineA = updatedDetails!.lines.find((l: any) => l.variant_id === variantAId);
    expect(updatedLineA!.counted_quantity).toBe(47);
    expect(updatedLineA!.discrepancy).toBe(-3);
    expect(updatedLineA!.reconciliation_status).toBe('discrepancy');

    // Approve and apply audit adjustment
    const approved = await approveAndApplyAuditAdjustments(adminId, session.sessionId);
    expect(approved.adjustmentsCount).toBe(1);

    // Verify stock balance was adjusted to exactly 47
    const newBal = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantAId, testLocationId]
    );
    expect(newBal?.on_hand_quantity).toBe(47);

    // Verify immutable movement record
    const movement = await queryOne<{ movement_type: string; quantity_delta: number }>(
      `SELECT movement_type, quantity_delta FROM stock_movements 
       WHERE variant_id = $1 AND reference_type = 'INVENTORY_AUDIT'
       ORDER BY id DESC LIMIT 1`,
      [variantAId]
    );
    expect(movement?.movement_type).toBe('ADJUSTMENT');
    expect(movement?.quantity_delta).toBe(-3);
  });

  // Scenario 15 - 18: Returns lifecycle & safe restocking
  it('15, 16, 17, 18. Returns lifecycle: request does not increase stock, reject does not affect stock, sellable restocks once, damaged does not restock', async () => {
    // 1. Create order & ship 5 pieces of variant B
    const order = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variantBId, quantity: 5, unit_price: 250 }],
    });
    await confirmOrder(adminId, order.orderId);
    await shipOrder(adminId, order.orderId);

    // Stock for B after shipping 5 is 45 (50 - 5)
    let balB = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantBId, testLocationId]
    );
    expect(balB?.on_hand_quantity).toBe(45);

    // 15. Create return request: request 3 pieces
    const ret1 = await createReturn(adminId, {
      customer_id: testCustomerId,
      order_id: order.orderId,
      reason: 'مقاس غير مناسب للزبون',
      items: [{ variant_id: variantBId, returned_quantity: 3 }],
    });

    // Verify stock is STILL 45 (return creation does NOT increase stock!)
    balB = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantBId, testLocationId]
    );
    expect(balB?.on_hand_quantity).toBe(45);

    // 16. Reject return request
    await rejectReturnRequest(ret1.returnId, adminId, 'تجاوز فترة الإرجاع المسموحة (أكثر من 30 يوماً)');
    balB = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantBId, testLocationId]
    );
    expect(balB?.on_hand_quantity).toBe(45); // Unchanged!

    // 17. Create second return request for 2 pieces & approve it
    const ret2 = await createReturn(adminId, {
      customer_id: testCustomerId,
      order_id: order.orderId,
      reason: 'طلب تبديل',
      items: [{ variant_id: variantBId, returned_quantity: 2 }],
    });

    await approveReturnRequest(ret2.returnId, adminId, 'موافق على الفحص والاستلام');

    // Approval alone does NOT increase stock!
    balB = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantBId, testLocationId]
    );
    expect(balB?.on_hand_quantity).toBe(45);

    const retItem = await queryOne<{ id: number }>(
      'SELECT id FROM sales_return_items WHERE return_id = $1',
      [ret2.returnId]
    );

    // 17. Inspect and restock sellable item
    const restockRes = await inspectAndRestockReturnItem({
      userId: adminId,
      returnId: ret2.returnId,
      itemId: retItem!.id,
      disposition: 'sellable',
      inspectionNotes: 'بضاعة بحالة المصنع ممتازة',
    });
    expect(restockRes.restocked).toBe(true);

    // Stock should now increase from 45 to 47!
    balB = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantBId, testLocationId]
    );
    expect(balB?.on_hand_quantity).toBe(47);

    // Repeated inspection / restock attempt must fail!
    await expect(
      inspectAndRestockReturnItem({
        userId: adminId,
        returnId: ret2.returnId,
        itemId: retItem!.id,
        disposition: 'sellable',
      })
    ).rejects.toThrow(/تم إعادة هذا البند للمخزن مسبقاً/);

    // 18. Damaged return does not increase sellable inventory
    const ret3 = await createReturn(adminId, {
      customer_id: testCustomerId,
      order_id: order.orderId,
      reason: 'عيب صناعة بالنسيج',
      items: [{ variant_id: variantBId, returned_quantity: 1 }],
    });
    await approveReturnRequest(ret3.returnId, adminId);

    const damagedItem = await queryOne<{ id: number }>(
      'SELECT id FROM sales_return_items WHERE return_id = $1',
      [ret3.returnId]
    );

    await inspectAndRestockReturnItem({
      userId: adminId,
      returnId: ret3.returnId,
      itemId: damagedItem!.id,
      disposition: 'damaged',
      inspectionNotes: 'نسيج ممزق غير صالح للبيع',
    });

    // Stock MUST REMAIN 47!
    balB = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantBId, testLocationId]
    );
    expect(balB?.on_hand_quantity).toBe(47);
  });

  // Scenario 19 & 20: Role permissions matrix
  it('19 & 20. Role permissions matrix and enforcement for all three roles', async () => {
    const adminPerm = await queryOne<{ allowed: boolean }>(
      "SELECT allowed FROM role_permissions WHERE role = 'admin' AND permission_key = 'inventory.audit_approve'"
    );
    const salesPerm = await queryOne<{ allowed: boolean }>(
      "SELECT allowed FROM role_permissions WHERE role = 'sales' AND permission_key = 'inventory.audit_approve'"
    );
    const whPerm = await queryOne<{ allowed: boolean }>(
      "SELECT allowed FROM role_permissions WHERE role = 'warehouse' AND permission_key = 'orders.pick'"
    );

    expect(adminPerm?.allowed).toBe(true);
    expect(salesPerm?.allowed).toBe(false);
    expect(whPerm?.allowed).toBe(true);
  });

  // Scenario 21: Global search respects permissions and returns correct records
  it('21. Global search respects permissions and returns correct categorized records', async () => {
    // Create shelf for search test
    await getOrCreateShelf(testLocationId, 'RACK-99', 'R', '99');

    // Admin search
    const adminSearch = await performGlobalSearch('طيور الجنة', 'admin');
    expect(adminSearch.results.some((r) => r.category === 'customers')).toBe(true);

    const shelfSearchAdmin = await performGlobalSearch('RACK-99', 'admin');
    expect(shelfSearchAdmin.results.some((r) => r.category === 'shelves')).toBe(true);

    // Sales search: shelves are NOT visible to sales role in global search
    const shelfSearchSales = await performGlobalSearch('RACK-99', 'sales');
    expect(shelfSearchSales.results.some((r) => r.category === 'shelves')).toBe(false);
  });

  // Scenario 22 & 23: Data integrity and duplicate prevention
  it('22 & 23. Existing data remains intact and repeated shipment cannot duplicate stock movements', async () => {
    const order = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variantAId, quantity: 4, unit_price: 250 }],
    });
    await confirmOrder(adminId, order.orderId);

    // Ship the order
    await shipOrder(adminId, order.orderId);

    const stockAfterShip = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantAId, testLocationId]
    );

    // Attempt repeated shipment of the exact same already-shipped order
    await expect(shipOrder(adminId, order.orderId)).rejects.toThrow();

    // Verify stock is not deducted a second time
    const stockAfterRepeat = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2',
      [variantAId, testLocationId]
    );
    expect(stockAfterRepeat?.on_hand_quantity).toBe(stockAfterShip?.on_hand_quantity);
  });
});
