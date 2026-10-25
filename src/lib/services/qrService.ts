import QRCode from 'qrcode';
import { query, queryOne, transaction } from '@/lib/db';

export interface PrintableLabel {
  variant_id: number;
  product_id: number;
  model_code: string;
  model_name: string;
  color_name: string;
  size_name: string;
  sku: string;
  qr_code_uid: string;
  shelf_code: string | null;
  default_price: number;
  qr_data_url: string;
  on_hand_quantity: number;
}

export interface ResolvedVariant {
  id: number;
  product_id: number;
  model_code: string;
  model_name: string;
  color_name: string;
  size_name: string;
  sku: string;
  qr_code_uid: string;
  shelf_code: string | null;
  on_hand_quantity: number;
  available_quantity: number;
}

export function generateStableVariantUid(sku: string, variantId?: number): string {
  const cleanSku = sku.trim().toUpperCase().replace(/\s+/g, '-');
  const suffix = variantId ? String(variantId) : Math.random().toString(36).substring(2, 7).toUpperCase();
  return `VAR-${cleanSku}-${suffix}`;
}

export async function generateQrDataUrl(text: string): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: 256,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

export async function generateQrSvg(text: string): Promise<string> {
  return await QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export async function ensureVariantQrCode(variantId: number): Promise<string> {
  const variant = await queryOne<{ id: number; sku: string; qr_code_uid: string | null }>(
    `SELECT id, sku, qr_code_uid FROM product_variants WHERE id = $1`,
    [variantId]
  );
  if (!variant) throw new Error('المتغير غير موجود.');

  if (variant.qr_code_uid && variant.qr_code_uid.trim()) {
    return variant.qr_code_uid.trim();
  }

  const newUid = generateStableVariantUid(variant.sku, variant.id);
  await query(
    `UPDATE product_variants SET qr_code_uid = $1 WHERE id = $2`,
    [newUid, variantId]
  );
  return newUid;
}

export async function backfillAllVariantQrCodes(): Promise<number> {
  const variants = await query<{ id: number; sku: string }>(
    `SELECT id, sku FROM product_variants WHERE qr_code_uid IS NULL OR qr_code_uid = ''`
  );

  for (const v of variants) {
    const uid = generateStableVariantUid(v.sku, v.id);
    await query(
      `UPDATE product_variants SET qr_code_uid = $1 WHERE id = $2`,
      [uid, v.id]
    );
  }

  return variants.length;
}

export async function resolveVariantByScannedCode(
  rawCode: string,
  dbClient?: any
): Promise<ResolvedVariant | null> {
  if (!rawCode || !rawCode.trim()) return null;
  const code = rawCode.trim();

  const qOne = dbClient?.queryOne ? dbClient.queryOne.bind(dbClient) : queryOne;

  // Search by qr_code_uid first, then fallback to sku
  const variant: any = await qOne(
    `SELECT pv.id, pv.product_id, pv.sku, pv.qr_code_uid,
            p.model_code, p.model_name,
            c.name as color_name, sz.name as size_name,
            (
              SELECT ws.shelf_code
              FROM variant_shelves vs
              JOIN warehouse_shelves ws ON vs.shelf_id = ws.id
              WHERE vs.variant_id = pv.id
              ORDER BY vs.is_primary DESC, vs.id ASC
              LIMIT 1
            ) as shelf_code,
            COALESCE(ib.on_hand_quantity, 0) as on_hand_quantity,
            (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) as available_quantity
     FROM product_variants pv
     JOIN products p ON pv.product_id = p.id
     JOIN colors c ON pv.color_id = c.id
     JOIN sizes sz ON pv.size_id = sz.id
     LEFT JOIN inventory_locations loc ON loc.location_code = 'MAIN'
     LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id AND ib.location_id = loc.id
     WHERE pv.active = true AND (pv.qr_code_uid = $1 OR pv.sku = $1 OR pv.qr_code_uid ILIKE $1 OR pv.sku ILIKE $1)
     LIMIT 1`,
    [code]
  );

  if (!variant) return null;

  return {
    id: variant.id,
    product_id: variant.product_id,
    model_code: variant.model_code,
    model_name: variant.model_name,
    color_name: variant.color_name,
    size_name: variant.size_name,
    sku: variant.sku,
    qr_code_uid: variant.qr_code_uid || variant.sku,
    shelf_code: variant.shelf_code,
    on_hand_quantity: Number(variant.on_hand_quantity || 0),
    available_quantity: Number(variant.available_quantity || 0),
  };
}

export const resolveScannedCode = resolveVariantByScannedCode;

export async function getPrintableLabels(filter: {
  modelCode?: string;
  variantId?: number;
  categoryId?: number;
  search?: string;
  limit?: number;
} = {}): Promise<PrintableLabel[]> {
  const whereClauses: string[] = ['pv.active = true', 'p.active = true'];
  const params: any[] = [];
  let pIdx = 1;

  if (filter.variantId) {
    whereClauses.push(`pv.id = $${pIdx}`);
    params.push(filter.variantId);
    pIdx++;
  }

  if (filter.modelCode) {
    whereClauses.push(`p.model_code ILIKE $${pIdx}`);
    params.push(filter.modelCode.trim());
    pIdx++;
  }

  if (filter.categoryId) {
    whereClauses.push(`p.category_id = $${pIdx}`);
    params.push(filter.categoryId);
    pIdx++;
  }

  if (filter.search?.trim()) {
    whereClauses.push(`(
      p.model_code ILIKE $${pIdx} OR
      p.model_name ILIKE $${pIdx} OR
      pv.sku ILIKE $${pIdx} OR
      pv.qr_code_uid ILIKE $${pIdx} OR
      c.name ILIKE $${pIdx} OR
      sz.name ILIKE $${pIdx}
    )`);
    params.push(`%${filter.search.trim()}%`);
    pIdx++;
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
  const limit = filter.limit || 100;

  const rows = await query<any>(
    `SELECT pv.id as variant_id, pv.product_id, pv.sku, pv.qr_code_uid,
            p.model_code, p.model_name, p.default_price,
            c.name as color_name, sz.name as size_name,
            (
              SELECT ws.shelf_code
              FROM variant_shelves vs
              JOIN warehouse_shelves ws ON vs.shelf_id = ws.id
              WHERE vs.variant_id = pv.id
              ORDER BY vs.is_primary DESC, vs.id ASC
              LIMIT 1
            ) as shelf_code,
            COALESCE((
              SELECT COALESCE(SUM(ib.on_hand_quantity), 0)
              FROM inventory_balances ib
              WHERE ib.variant_id = pv.id
            ), 0) as on_hand_quantity
     FROM product_variants pv
     JOIN products p ON pv.product_id = p.id
     JOIN colors c ON pv.color_id = c.id
     JOIN sizes sz ON pv.size_id = sz.id
     ${whereSql}
     ORDER BY p.model_code ASC, c.name ASC, sz.sort_order ASC
     LIMIT ${limit}`,
    params
  );

  const labels: PrintableLabel[] = [];

  for (const r of rows) {
    let qrUid = r.qr_code_uid;
    if (!qrUid || !qrUid.trim()) {
      qrUid = generateStableVariantUid(r.sku, r.variant_id);
      await query(`UPDATE product_variants SET qr_code_uid = $1 WHERE id = $2`, [qrUid, r.variant_id]);
    }

    const dataUrl = await generateQrDataUrl(qrUid);

    labels.push({
      variant_id: r.variant_id,
      product_id: r.product_id,
      model_code: r.model_code,
      model_name: r.model_name,
      color_name: r.color_name,
      size_name: r.size_name,
      sku: r.sku,
      qr_code_uid: qrUid,
      shelf_code: r.shelf_code,
      default_price: Number(r.default_price || 0),
      qr_data_url: dataUrl,
      on_hand_quantity: Number(r.on_hand_quantity || 0),
    });
  }

  return labels;
}
