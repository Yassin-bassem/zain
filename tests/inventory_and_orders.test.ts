import { describe, it, expect, beforeEach } from 'vitest';
import { resetDatabaseForTests, query, queryOne } from '../src/lib/db';
import { createProduct, createBulkVariants } from '../src/lib/services/productService';
import { adjustStock, getModelStockMatrix } from '../src/lib/services/inventoryService';
import { createDraftOrder, confirmOrder, cancelOrder, shipOrder } from '../src/lib/services/orderService';
import { createReceipt, confirmReceipt } from '../src/lib/services/receivingService';
import { createReturn, inspectAndRestockReturnItem } from '../src/lib/services/returnService';
import { commitImport, validateSpreadsheetRows } from '../src/lib/services/excelImportService';
import { createInitialAdmin } from '../src/lib/auth';

describe('Wholesale Clothing Inventory & Order Concurrency Suite', () => {
  let adminId: number;
  let testCustomerId: number;
  let testSupplierId: number;

  beforeEach(async () => {
    await resetDatabaseForTests();

    // Create admin user
    const admin = await createInitialAdmin({
      username: 'admin',
      full_name: 'مدير النظام',
      email: 'admin@zain-wholesale.eg',
      password: 'password123',
    });
    adminId = admin.id;

    // Create test customer
    const custRes = await query<{ id: number }>(
      `INSERT INTO customers (customer_code, name, phone)
       VALUES ('CUST-001', 'محل الأصدقاء للأطفال', '01012345678')
       RETURNING id`
    );
    testCustomerId = custRes[0].id;

    // Create test supplier
    const suppRes = await query<{ id: number }>(
      `INSERT INTO suppliers (supplier_code, name, phone)
       VALUES ('SUPP-001', 'مصنع النور للملابس الجاهزة', '01234567890')
       RETURNING id`
    );
    testSupplierId = suppRes[0].id;
  });

  it('1. Creating products and variants does not create stock automatically', async () => {
    const prod = await createProduct({
      model_code: 'K101',
      model_name: 'سالوبيت صيفي كلاسيك',
      default_price: 150,
    });

    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 2');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 2');

    await createBulkVariants({
      productId: prod.id,
      colorIds: colors.map((c) => c.id),
      sizeIds: sizes.map((s) => s.id),
    });

    const matrix = await getModelStockMatrix(prod.id);
    expect(matrix.variants.length).toBe(4);
    expect(matrix.totals.totalOnHand).toBe(0);
    expect(matrix.totals.totalReserved).toBe(0);
    expect(matrix.totals.totalAvailable).toBe(0);
  });

  it('2 & 3. Opening stock sets balances and blocks duplicate re-import', async () => {
    const validRows = [
      {
        rowNumber: 2,
        modelCode: 'K102',
        modelName: 'بيجامة قطن مطرزة',
        color: 'كحلي',
        size: '2 سنة',
        quantity: 20,
        category: 'ولادي',
        unitPrice: 190,
      },
    ];

    // First import
    const result1 = await commitImport({
      userId: adminId,
      filename: 'opening_2026.xlsx',
      mode: 'opening_stock',
      validRows,
    });
    expect(result1.importedCount).toBe(1);

    // Verify stock balance
    const variant = await queryOne<{ id: number }>(
      `SELECT pv.id FROM product_variants pv 
       JOIN products p ON pv.product_id = p.id 
       WHERE p.model_code = 'K102'`
    );
    expect(variant).toBeDefined();

    const balance = await queryOne<{ on_hand_quantity: number; reserved_quantity: number }>(
      'SELECT on_hand_quantity, reserved_quantity FROM inventory_balances WHERE variant_id = $1',
      [variant!.id]
    );
    expect(Number(balance?.on_hand_quantity)).toBe(20);
    expect(Number(balance?.reserved_quantity)).toBe(0);

    // Re-importing the same opening stock file should be BLOCKED to prevent doubling stock
    await expect(
      commitImport({
        userId: adminId,
        filename: 'opening_2026.xlsx',
        mode: 'opening_stock',
        validRows,
      })
    ).rejects.toThrow(/مسبقاً بنجاح/);

    // Verify stock is still 20, not doubled to 40
    const balanceAfter = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1',
      [variant!.id]
    );
    expect(Number(balanceAfter?.on_hand_quantity)).toBe(20);
  });

  it('4 & 5. Duplicate variants in file and negative quantities are detected and rejected', async () => {
    const rawRows = [
      {
        'كود الموديل': 'K103',
        'اسم الموديل': 'شورت جينز',
        اللون: 'أزرق',
        المقاس: '4 سنوات',
        الكمية: -5, // Negative
      },
      {
        'كود الموديل': 'K103',
        'اسم الموديل': 'شورت جينز',
        اللون: 'أزرق',
        المقاس: '4 سنوات', // Duplicate
        الكمية: 10,
      },
    ];

    const mapping = {
      model_code: 'كود الموديل',
      model_name: 'اسم الموديل',
      color: 'اللون',
      size: 'المقاس',
      quantity: 'الكمية',
    };

    const preview = await validateSpreadsheetRows(rawRows, mapping, 'opening_stock');
    expect(preview.invalidRowsCount).toBeGreaterThanOrEqual(2);
    expect(preview.errors.some((e) => e.errorMessage.includes('سالبة'))).toBe(true);
    expect(preview.errors.some((e) => e.errorMessage.includes('تكرار'))).toBe(true);
  });

  it('6 & 7. Order confirmation reserves stock; insufficient stock aborts entire order atomically', async () => {
    // Setup product with 10 on hand for variant A, and 5 for variant B
    const prod = await createProduct({ model_code: 'K104', model_name: 'تيشرت بولو' });
    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 2');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 1');

    await createBulkVariants({
      productId: prod.id,
      colorIds: [colors[0].id, colors[1].id],
      sizeIds: [sizes[0].id],
    });

    const variants = await query<{ id: number }>(
      'SELECT id FROM product_variants WHERE product_id = $1 ORDER BY id ASC',
      [prod.id]
    );
    const varA = variants[0].id;
    const varB = variants[1].id;

    // Set stock: varA = 10, varB = 5
    await adjustStock({
      userId: adminId,
      reason: 'رصيد بدائي للاختبار',
      items: [
        { variantId: varA, newQuantity: 10 },
        { variantId: varB, newQuantity: 5 },
      ],
    });

    // Case 1: Order requesting 8 of varA and 6 of varB (varB has only 5 available -> shortage!)
    const draftShortage = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [
        { variant_id: varA, quantity: 8, unit_price: 100 },
        { variant_id: varB, quantity: 6, unit_price: 100 },
      ],
    });

    await expect(confirmOrder(adminId, draftShortage.orderId)).rejects.toThrow(/نقص الكميات المتاحة/);

    // Check that varA was NOT reserved either (entire transaction aborted atomically!)
    const balA = await queryOne<{ reserved_quantity: number }>(
      'SELECT reserved_quantity FROM inventory_balances WHERE variant_id = $1',
      [varA]
    );
    expect(Number(balA?.reserved_quantity)).toBe(0);

    // Case 2: Order requesting 8 of varA and 4 of varB (Both available!)
    const draftOk = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [
        { variant_id: varA, quantity: 8, unit_price: 100 },
        { variant_id: varB, quantity: 4, unit_price: 100 },
      ],
    });

    const confirmRes = await confirmOrder(adminId, draftOk.orderId);
    expect(confirmRes.success).toBe(true);

    const balA_after = await queryOne<{ on_hand_quantity: number; reserved_quantity: number }>(
      'SELECT on_hand_quantity, reserved_quantity FROM inventory_balances WHERE variant_id = $1',
      [varA]
    );
    expect(Number(balA_after?.reserved_quantity)).toBe(8);
    expect(Number(balA_after?.on_hand_quantity)).toBe(10); // Physical stock intact until shipment!
  });

  it('9. Canceling confirmed order releases reservations without deducting physical stock', async () => {
    const prod = await createProduct({ model_code: 'K105', model_name: 'طقم بناتي' });
    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 1');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 1');

    await createBulkVariants({
      productId: prod.id,
      colorIds: [colors[0].id],
      sizeIds: [sizes[0].id],
    });

    const variant = await queryOne<{ id: number }>('SELECT id FROM product_variants WHERE product_id = $1', [prod.id]);
    await adjustStock({
      userId: adminId,
      reason: 'رصيد أولي',
      items: [{ variantId: variant!.id, newQuantity: 15 }],
    });

    const draft = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variant!.id, quantity: 5, unit_price: 200 }],
    });

    await confirmOrder(adminId, draft.orderId);

    // Cancel order
    const cancelRes = await cancelOrder(adminId, draft.orderId);
    expect(cancelRes.success).toBe(true);

    const bal = await queryOne<{ on_hand_quantity: number; reserved_quantity: number }>(
      'SELECT on_hand_quantity, reserved_quantity FROM inventory_balances WHERE variant_id = $1',
      [variant!.id]
    );
    expect(Number(bal?.reserved_quantity)).toBe(0); // Reservation released
    expect(Number(bal?.on_hand_quantity)).toBe(15); // Physical stock NOT deducted
  });

  it('10 & 11. Shipping deducts physical stock exactly once and blocks double shipment', async () => {
    const prod = await createProduct({ model_code: 'K106', model_name: 'فستان صيفي' });
    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 1');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 1');

    await createBulkVariants({
      productId: prod.id,
      colorIds: [colors[0].id],
      sizeIds: [sizes[0].id],
    });

    const variant = await queryOne<{ id: number }>('SELECT id FROM product_variants WHERE product_id = $1', [prod.id]);
    await adjustStock({
      userId: adminId,
      reason: 'رصيد أولي',
      items: [{ variantId: variant!.id, newQuantity: 20 }],
    });

    const order = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variant!.id, quantity: 7, unit_price: 250 }],
    });

    await confirmOrder(adminId, order.orderId);

    // Ship order
    const shipRes = await shipOrder(adminId, order.orderId);
    expect(shipRes.success).toBe(true);

    const bal = await queryOne<{ on_hand_quantity: number; reserved_quantity: number }>(
      'SELECT on_hand_quantity, reserved_quantity FROM inventory_balances WHERE variant_id = $1',
      [variant!.id]
    );
    expect(Number(bal?.on_hand_quantity)).toBe(13); // 20 - 7 = 13
    expect(Number(bal?.reserved_quantity)).toBe(0); // Reservation fulfilled

    // Verify stock movement ledger
    const movement = await queryOne<{ movement_type: string; quantity_delta: number }>(
      `SELECT movement_type, quantity_delta FROM stock_movements 
       WHERE variant_id = $1 AND movement_type = 'SHIPMENT'`,
      [variant!.id]
    );
    expect(movement?.movement_type).toBe('SHIPMENT');
    expect(Number(movement?.quantity_delta)).toBe(-7);

    // Repeated shipment must be rejected
    await expect(shipOrder(adminId, order.orderId)).rejects.toThrow(/تم شحنه وتسليمه بالفعل/);

    // Stock remains 13
    const balAgain = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1',
      [variant!.id]
    );
    expect(Number(balAgain?.on_hand_quantity)).toBe(13);
  });

  it('12 & 13. Sellable return restores stock; damaged return does not increase sellable stock', async () => {
    const prod = await createProduct({ model_code: 'K107', model_name: 'بلوزة بناتي' });
    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 1');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 1');

    await createBulkVariants({
      productId: prod.id,
      colorIds: [colors[0].id],
      sizeIds: [sizes[0].id],
    });

    const variant = await queryOne<{ id: number }>('SELECT id FROM product_variants WHERE product_id = $1', [prod.id]);
    await adjustStock({
      userId: adminId,
      reason: 'رصيد أولي',
      items: [{ variantId: variant!.id, newQuantity: 10 }],
    });

    // Create return with 2 items: 1 sellable, 1 damaged
    const ret = await createReturn(adminId, {
      customer_id: testCustomerId,
      reason: 'مقاس غير ملائم وتلف في خياطة إحدى القطع',
      items: [
        { variant_id: variant!.id, returned_quantity: 2, disposition: 'pending' },
        { variant_id: variant!.id, returned_quantity: 1, disposition: 'pending' },
      ],
    });

    const items = await query<{ id: number }>('SELECT id FROM sales_return_items WHERE return_id = $1 ORDER BY id ASC', [ret.returnId]);
    const sellableItemId = items[0].id;
    const damagedItemId = items[1].id;

    // Approve sellable item (2 pieces)
    await inspectAndRestockReturnItem({
      userId: adminId,
      returnId: ret.returnId,
      itemId: sellableItemId,
      disposition: 'sellable',
      inspectionNotes: 'قطعة سليمة ببطاقتها',
    });

    // Stock should increase from 10 to 12
    const balSellable = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1',
      [variant!.id]
    );
    expect(Number(balSellable?.on_hand_quantity)).toBe(12);

    // Mark second item as damaged (1 piece)
    await inspectAndRestockReturnItem({
      userId: adminId,
      returnId: ret.returnId,
      itemId: damagedItemId,
      disposition: 'damaged',
      inspectionNotes: 'تمزق بالقماش لا يصلح للبيع',
    });

    // Stock must STAY 12 (damaged does NOT increment sellable stock)
    const balDamaged = await queryOne<{ on_hand_quantity: number }>(
      'SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1',
      [variant!.id]
    );
    expect(Number(balDamaged?.on_hand_quantity)).toBe(12);
  });

  it('14. Stock adjustments require mandatory reason and authorization', async () => {
    const prod = await createProduct({ model_code: 'K108', model_name: 'بنطلون جبردين' });
    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 1');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 1');

    await createBulkVariants({
      productId: prod.id,
      colorIds: [colors[0].id],
      sizeIds: [sizes[0].id],
    });

    const variant = await queryOne<{ id: number }>('SELECT id FROM product_variants WHERE product_id = $1', [prod.id]);

    // Missing reason should fail
    await expect(
      adjustStock({
        userId: adminId,
        reason: '   ',
        items: [{ variantId: variant!.id, newQuantity: 50 }],
      })
    ).rejects.toThrow(/سبب تسوية المخزون إلزامي/);
  });

  it('8. Two concurrent orders cannot reserve the same available pieces', async () => {
    const prod = await createProduct({ model_code: 'K109', model_name: 'سويت شيرت شتوي' });
    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 1');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 1');

    await createBulkVariants({
      productId: prod.id,
      colorIds: [colors[0].id],
      sizeIds: [sizes[0].id],
    });

    const variant = await queryOne<{ id: number }>('SELECT id FROM product_variants WHERE product_id = $1', [prod.id]);
    
    // Only 5 pieces available in stock
    await adjustStock({
      userId: adminId,
      reason: 'رصيد أولي 5 قطع فقط',
      items: [{ variantId: variant!.id, newQuantity: 5 }],
    });

    // Two orders each requesting 4 pieces (total 8 > 5)
    const order1 = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variant!.id, quantity: 4, unit_price: 300 }],
    });

    const order2 = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variant!.id, quantity: 4, unit_price: 300 }],
    });

    // Run confirmations
    const results = await Promise.allSettled([
      confirmOrder(adminId, order1.orderId),
      confirmOrder(adminId, order2.orderId),
    ]);

    const successes = results.filter((r) => r.status === 'fulfilled');
    const rejections = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, and one must fail with shortage error!
    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);
  });

  it('16. Model totals equal the sum of actual variant balances', async () => {
    const prod = await createProduct({ model_code: 'K110', model_name: 'طقم ولادي خروج' });
    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 2');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 2');

    await createBulkVariants({
      productId: prod.id,
      colorIds: [colors[0].id, colors[1].id],
      sizeIds: [sizes[0].id, sizes[1].id],
    });

    const variants = await query<{ id: number }>('SELECT id FROM product_variants WHERE product_id = $1 ORDER BY id ASC', [prod.id]);
    
    // Set quantities: 10, 20, 5, 15 -> sum should be 50
    await adjustStock({
      userId: adminId,
      reason: 'رصيد اختباري للمصفوفة',
      items: [
        { variantId: variants[0].id, newQuantity: 10 },
        { variantId: variants[1].id, newQuantity: 20 },
        { variantId: variants[2].id, newQuantity: 5 },
        { variantId: variants[3].id, newQuantity: 15 },
      ],
    });

    const matrix = await getModelStockMatrix(prod.id);
    expect(matrix.totals.totalOnHand).toBe(50);
    expect(matrix.totals.totalAvailable).toBe(50);
  });

  it('19. Historical order prices remain unchanged when current product prices change', async () => {
    const prod = await createProduct({
      model_code: 'K111',
      model_name: 'فستان دانتيل',
      default_price: 200,
    });
    const colors = await query<{ id: number }>('SELECT id FROM colors LIMIT 1');
    const sizes = await query<{ id: number }>('SELECT id FROM sizes LIMIT 1');

    await createBulkVariants({
      productId: prod.id,
      colorIds: [colors[0].id],
      sizeIds: [sizes[0].id],
    });

    const variant = await queryOne<{ id: number }>('SELECT id FROM product_variants WHERE product_id = $1', [prod.id]);

    // Create order with captured price = 200
    const order = await createDraftOrder(adminId, {
      customer_id: testCustomerId,
      items: [{ variant_id: variant!.id, quantity: 2, unit_price: 200 }],
    });

    // Now update product's default price to 350
    await query('UPDATE products SET default_price = 350 WHERE id = $1', [prod.id]);

    // Historical order line price MUST still be 200
    const line = await queryOne<{ unit_price: number; line_total: number }>(
      'SELECT unit_price, line_total FROM sales_order_items WHERE order_id = $1',
      [order.orderId]
    );
    expect(Number(line?.unit_price)).toBe(200);
    expect(Number(line?.line_total)).toBe(400);
  });
});
