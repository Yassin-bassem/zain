import { query, queryOne, transaction } from '@/lib/db';

export interface ReceiptItemInput {
  variant_id: number;
  quantity: number;
  unit_cost?: number;
  notes?: string;
}

export interface CreateReceiptInput {
  supplier_id: number;
  receipt_date?: string;
  supplier_invoice_ref?: string;
  notes?: string;
  items: ReceiptItemInput[];
}

export async function createReceipt(userId: number, input: CreateReceiptInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error('يجب إضافة صنف واحد على الأقل في إذن الاستلام.');
  }

  const receiptNumber = `REC-${Date.now().toString().slice(-6)}`;
  let totalPieces = 0;

  for (const item of input.items) {
    const qty = Math.floor(Number(item.quantity));
    if (isNaN(qty) || qty <= 0) {
      throw new Error('كمية الاستلام يجب أن تكون رقماً موجباً أكبر من صفر.');
    }
    totalPieces += qty;
  }

  return await transaction(async (tx) => {
    const rows = await tx.query<{ id: number }>(
      `INSERT INTO purchase_receipts (
         receipt_number, supplier_id, receipt_date, supplier_invoice_ref,
         notes, status, total_pieces, created_by
       ) VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7)
       RETURNING id`,
      [
        receiptNumber,
        input.supplier_id,
        input.receipt_date || new Date().toISOString().slice(0, 10),
        input.supplier_invoice_ref || null,
        input.notes || null,
        totalPieces,
        userId,
      ]
    );

    const receiptId = rows[0].id;

    for (const item of input.items) {
      await tx.execute(
        `INSERT INTO purchase_receipt_items (receipt_id, variant_id, quantity, unit_cost, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [receiptId, item.variant_id, item.quantity, item.unit_cost || 0, item.notes || null]
      );
    }

    return { receiptId, receiptNumber, totalPieces };
  });
}

export async function confirmReceipt(userId: number, receiptId: number, locationId?: number) {
  return await transaction(async (tx) => {
    const receipt = await tx.queryOne<{
      id: number;
      receipt_number: string;
      status: string;
      supplier_id: number;
    }>(
      `SELECT id, receipt_number, status, supplier_id 
       FROM purchase_receipts 
       WHERE id = $1 FOR UPDATE`,
      [receiptId]
    );

    if (!receipt) throw new Error('إذن الاستلام غير موجود.');
    if (receipt.status === 'confirmed') {
      throw new Error('تم تأكيد إذن الاستلام مسبقاً، ولا يمكن تكرار التأكيد.');
    }

    let targetLocId = locationId;
    if (!targetLocId) {
      const mainLoc = await tx.queryOne<{ id: number }>(
        "SELECT id FROM inventory_locations WHERE location_code = 'MAIN'"
      );
      targetLocId = mainLoc!.id;
    }

    const items = await tx.query<{ id: number; variant_id: number; quantity: number }>(
      'SELECT id, variant_id, quantity FROM purchase_receipt_items WHERE receipt_id = $1',
      [receiptId]
    );

    for (const item of items) {
      // Upsert balance
      const existing = await tx.queryOne<{ id: number; on_hand_quantity: number }>(
        'SELECT id, on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2 FOR UPDATE',
        [item.variant_id, targetLocId]
      );

      if (existing) {
        await tx.execute(
          `UPDATE inventory_balances 
           SET on_hand_quantity = on_hand_quantity + $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [item.quantity, existing.id]
        );
      } else {
        await tx.execute(
          `INSERT INTO inventory_balances (variant_id, location_id, on_hand_quantity, reserved_quantity)
           VALUES ($1, $2, $3, 0)`,
          [item.variant_id, targetLocId, item.quantity]
        );
      }

      // Record immutable stock movement
      await tx.execute(
        `INSERT INTO stock_movements (
           variant_id, location_id, movement_type, quantity_delta,
           reference_type, reference_id, reason, created_by
         ) VALUES ($1, $2, 'RECEIPT', $3, 'PURCHASE_RECEIPT', $4, $5, $6)`,
        [
          item.variant_id,
          targetLocId,
          item.quantity,
          receipt.receipt_number,
          `استلام توريد بضاعة بإذن استلام رقم ${receipt.receipt_number}`,
          userId,
        ]
      );
    }

    await tx.execute(
      `UPDATE purchase_receipts 
       SET status = 'confirmed', confirmed_by = $1, confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, receiptId]
    );

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CONFIRM_PURCHASE_RECEIPT', 'purchase_receipt', $2, $3)`,
      [
        userId,
        String(receiptId),
        JSON.stringify({ receiptNumber: receipt.receipt_number, itemsCount: items.length }),
      ]
    );

    return { success: true, receiptNumber: receipt.receipt_number };
  });
}
