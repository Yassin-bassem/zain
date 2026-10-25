import * as XLSX from 'xlsx';
import { query, queryOne, transaction, normalizeArabicText } from '@/lib/db';

export interface ColumnMapping {
  model_code: string;
  model_name: string;
  color: string;
  size: string;
  quantity?: string;
  category?: string;
  unit_price?: string;
}

export type ImportMode = 'products_variants' | 'opening_stock' | 'stock_adjustment';

export interface RowError {
  rowNumber: number;
  modelCode: string;
  modelName: string;
  color: string;
  size: string;
  field: string;
  errorMessage: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  duplicateRowsCount: number;
  newProductsCount: number;
  newColorsCount: number;
  newSizesCount: number;
  newVariantsCount: number;
  inventoryRowsAffected: number;
  validRows: any[];
  errors: RowError[];
  detectedNewEntities: {
    categories: string[];
    colors: string[];
    sizes: string[];
  };
}

export function normalizeDigits(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  const arabicEasternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (d) => String(arabicEasternDigits.indexOf(d)));
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    model_code: '',
    model_name: '',
    color: '',
    size: '',
    quantity: '',
    category: '',
    unit_price: '',
  };

  const aliasMap: Record<keyof ColumnMapping, string[]> = {
    model_code: ['كود الموديل', 'كود الصنف', 'كود', 'model code', 'code', 'model_code', 'item code', 'كود_الموديل', 'رمز الموديل'],
    model_name: ['اسم الموديل', 'اسم الصنف', 'اسم', 'الموديل', 'model name', 'product', 'model', 'name', 'اسم_الموديل'],
    color: ['اللون', 'لون', 'color', 'colour', 'الوان'],
    size: ['المقاس', 'مقاس', 'حجم', 'size', 'مقاسات'],
    quantity: ['الكمية', 'كمية', 'الرصيد', 'رصيد', 'qty', 'quantity', 'balance', 'عدد القطع', 'الكميه'],
    category: ['الفئة', 'فئة', 'التصنيف', 'القسم', 'category', 'نوع'],
    unit_price: ['سعر البيع', 'السعر', 'سعر', 'unit price', 'price', 'سعر القطعة'],
  };

  for (const header of headers) {
    const cleanHeader = header.trim().toLowerCase();
    for (const [field, aliases] of Object.entries(aliasMap)) {
      if (!mapping[field as keyof ColumnMapping]) {
        for (const alias of aliases) {
          if (cleanHeader === alias || cleanHeader.includes(alias)) {
            mapping[field as keyof ColumnMapping] = header;
            break;
          }
        }
      }
    }
  }

  return mapping;
}

export function parseSpreadsheetBuffer(buffer: Buffer | ArrayBuffer): {
  sheets: string[];
  readSheet: (sheetName?: string) => { headers: string[]; rows: any[] };
} {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheets = workbook.SheetNames;

  const readSheet = (sheetName?: string) => {
    const targetSheet = sheetName || sheets[0];
    const worksheet = workbook.Sheets[targetSheet];
    if (!worksheet) return { headers: [], rows: [] };

    const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
    if (rawData.length === 0) return { headers: [], rows: [] };

    const headers = (rawData[0] || []).map((h: any) => String(h || '').trim());
    const dataRows = rawData.slice(1);

    const rows = dataRows.map((row) => {
      const obj: Record<string, any> = {};
      headers.forEach((header, idx) => {
        if (header) {
          obj[header] = row[idx] !== undefined ? row[idx] : '';
        }
      });
      return obj;
    });

    return { headers, rows };
  };

  return { sheets, readSheet };
}

export async function validateSpreadsheetRows(
  rows: any[],
  mapping: ColumnMapping,
  mode: ImportMode
): Promise<ImportPreviewResult> {
  const errors: RowError[] = [];
  const validRows: any[] = [];
  const seenVariantKeys = new Set<string>();
  let duplicateRowsCount = 0;

  // Cache existing database items to verify duplicates & identify new entities
  const existingProducts = await query<{ id: number; model_code: string; model_name: string }>(
    'SELECT id, model_code, model_name FROM products'
  );
  const existingProductMap = new Map<string, typeof existingProducts[0]>();
  for (const p of existingProducts) {
    existingProductMap.set(p.model_code.toUpperCase(), p);
  }

  const existingColors = await query<{ id: number; normalized_name: string }>(
    'SELECT id, normalized_name FROM colors'
  );
  const existingColorSet = new Set(existingColors.map((c) => c.normalized_name));

  const existingSizes = await query<{ id: number; name: string }>(
    'SELECT id, name FROM sizes'
  );
  const existingSizeSet = new Set(existingSizes.map((s) => s.name.trim().toLowerCase()));

  const newProductsToCreate = new Set<string>();
  const newColorsToCreate = new Set<string>();
  const newSizesToCreate = new Set<string>();

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2; // header is row 1
    const rawCode = rawRow[mapping.model_code];
    const rawName = rawRow[mapping.model_name];
    const rawColor = rawRow[mapping.color];
    const rawSize = rawRow[mapping.size];
    const rawQty = mapping.quantity ? rawRow[mapping.quantity] : '';
    const rawCategory = mapping.category ? rawRow[mapping.category] : '';
    const rawPrice = mapping.unit_price ? rawRow[mapping.unit_price] : '';

    const modelCode = normalizeDigits(rawCode).trim().toUpperCase();
    const modelName = String(rawName || '').trim();
    const color = String(rawColor || '').trim();
    const size = String(rawSize || '').trim();
    const category = String(rawCategory || '').trim();

    // Validation checks
    let rowHasError = false;

    if (!modelCode) {
      errors.push({
        rowNumber,
        modelCode: '',
        modelName,
        color,
        size,
        field: 'كود الموديل',
        errorMessage: 'كود الموديل مفقود أو فارغ.',
      });
      rowHasError = true;
    }

    if (!modelName) {
      errors.push({
        rowNumber,
        modelCode,
        modelName: '',
        color,
        size,
        field: 'اسم الموديل',
        errorMessage: 'اسم الموديل مفقود أو فارغ.',
      });
      rowHasError = true;
    }

    if (!color) {
      errors.push({
        rowNumber,
        modelCode,
        modelName,
        color: '',
        size,
        field: 'اللون',
        errorMessage: 'اللون مفقود أو فارغ.',
      });
      rowHasError = true;
    }

    if (!size) {
      errors.push({
        rowNumber,
        modelCode,
        modelName,
        color,
        size: '',
        field: 'المقاس',
        errorMessage: 'المقاس مفقود أو فارغ.',
      });
      rowHasError = true;
    }

    // Quantity validation for opening stock and stock adjustment modes
    let parsedQty = 0;
    if (mode === 'opening_stock' || mode === 'stock_adjustment') {
      const cleanQtyStr = normalizeDigits(rawQty);
      if (cleanQtyStr === '' || isNaN(Number(cleanQtyStr))) {
        errors.push({
          rowNumber,
          modelCode,
          modelName,
          color,
          size,
          field: 'الكمية',
          errorMessage: 'الكمية غير محددة أو غير صالحة عددياً.',
        });
        rowHasError = true;
      } else {
        parsedQty = Math.floor(Number(cleanQtyStr));
        if (parsedQty < 0) {
          errors.push({
            rowNumber,
            modelCode,
            modelName,
            color,
            size,
            field: 'الكمية',
            errorMessage: 'الكمية لا يمكن أن تكون قيمة سالبة.',
          });
          rowHasError = true;
        }
      }
    }

    // Check duplicate variants in the same file
    const variantKey = `${modelCode}___${normalizeArabicText(color)}___${size.toLowerCase()}`;
    if (seenVariantKeys.has(variantKey)) {
      duplicateRowsCount++;
      errors.push({
        rowNumber,
        modelCode,
        modelName,
        color,
        size,
        field: 'تكرار المتغير',
        errorMessage: `تكرار نفس الموديل مع اللون والمقاس في صف آخر بالملف (${modelCode} - ${color} - ${size}). يرجى دمج الكمية أو إزالة الصف المكرر.`,
      });
      rowHasError = true;
    } else {
      seenVariantKeys.add(variantKey);
    }

    if (!rowHasError) {
      if (!existingProductMap.has(modelCode)) {
        newProductsToCreate.add(modelCode);
      }
      const normColor = normalizeArabicText(color);
      if (!existingColorSet.has(normColor)) {
        newColorsToCreate.add(color);
      }
      if (!existingSizeSet.has(size.toLowerCase())) {
        newSizesToCreate.add(size);
      }

      validRows.push({
        rowNumber,
        modelCode,
        modelName,
        color,
        size,
        quantity: parsedQty,
        category: category || 'عام',
        unitPrice: rawPrice ? Number(normalizeDigits(rawPrice)) || 0 : 0,
      });
    }
  });

  return {
    totalRows: rows.length,
    validRowsCount: validRows.length,
    invalidRowsCount: errors.length,
    duplicateRowsCount,
    newProductsCount: newProductsToCreate.size,
    newColorsCount: newColorsToCreate.size,
    newSizesCount: newSizesToCreate.size,
    newVariantsCount: validRows.length,
    inventoryRowsAffected: mode === 'products_variants' ? 0 : validRows.length,
    validRows,
    errors,
    detectedNewEntities: {
      categories: Array.from(new Set(validRows.map((r) => r.category).filter(Boolean))),
      colors: Array.from(newColorsToCreate),
      sizes: Array.from(newSizesToCreate),
    },
  };
}

export async function commitImport(data: {
  userId: number;
  filename: string;
  mode: ImportMode;
  locationId?: number;
  validRows: Array<{
    rowNumber: number;
    modelCode: string;
    modelName: string;
    color: string;
    size: string;
    quantity: number;
    category?: string;
    unitPrice?: number;
  }>;
  reason?: string;
}) {
  if (data.validRows.length === 0) {
    throw new Error('لا توجد صفوف صالحة للاستيراد.');
  }

  return await transaction(async (tx) => {
    // Determine location
    let targetLocId = data.locationId;
    if (!targetLocId) {
      const mainLoc = await tx.queryOne<{ id: number }>(
        "SELECT id FROM inventory_locations WHERE location_code = 'MAIN'"
      );
      targetLocId = mainLoc!.id;
    }

    const batchNumber = `IMP-${Date.now().toString().slice(-6)}`;

    // If opening stock mode: idempotency check
    if (data.mode === 'opening_stock') {
      const existingOpening = await tx.queryOne<{ count: string | number }>(
        `SELECT COUNT(*) as count FROM import_batches 
         WHERE mode = 'opening_stock' AND status = 'completed' AND filename = $1`,
        [data.filename]
      );
      if (Number(existingOpening?.count || 0) > 0) {
        throw new Error(
          `تم استيراد الرصيد الافتتاحي لهذا الملف (${data.filename}) مسبقاً بنجاح. لا يسمح بتكرار استيراد الرصيد الافتتاحي منعاً لمضاعفة المخزون.`
        );
      }
    }

    // 1. Insert batch record
    const batchRows = await tx.query<{ id: number }>(
      `INSERT INTO import_batches (
         batch_number, filename, mode, location_id, total_rows, valid_rows,
         invalid_rows, imported_rows, status, created_by, approved_by, approved_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, 'completed', $8, $8, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        batchNumber,
        data.filename,
        data.mode,
        targetLocId,
        data.validRows.length,
        data.validRows.length,
        data.validRows.length,
        data.userId,
      ]
    );
    const batchId = batchRows[0].id;

    // Cache lookup maps inside transaction
    const categoryMap = new Map<string, number>();
    const categories = await tx.query<{ id: number; name: string }>('SELECT id, name FROM categories');
    categories.forEach((c) => categoryMap.set(c.name.trim(), c.id));

    const colorMap = new Map<string, number>();
    const colors = await tx.query<{ id: number; normalized_name: string }>('SELECT id, normalized_name FROM colors');
    colors.forEach((c) => colorMap.set(c.normalized_name, c.id));

    const sizeMap = new Map<string, number>();
    const sizes = await tx.query<{ id: number; name: string }>('SELECT id, name FROM sizes');
    sizes.forEach((s) => sizeMap.set(s.name.trim().toLowerCase(), s.id));

    const productMap = new Map<string, number>();
    const products = await tx.query<{ id: number; model_code: string }>('SELECT id, model_code FROM products');
    products.forEach((p) => productMap.set(p.model_code.toUpperCase(), p.id));

    for (const row of data.validRows) {
      // Category
      const catName = (row.category || 'عام').trim();
      let catId = categoryMap.get(catName);
      if (!catId) {
        const catRes = await tx.query<{ id: number }>(
          'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
          [catName]
        );
        catId = catRes[0].id;
        categoryMap.set(catName, catId);
      }

      // Color
      const normColor = normalizeArabicText(row.color);
      let colorId = colorMap.get(normColor);
      if (!colorId) {
        const colRes = await tx.query<{ id: number }>(
          'INSERT INTO colors (name, normalized_name) VALUES ($1, $2) ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
          [row.color.trim(), normColor]
        );
        colorId = colRes[0].id;
        colorMap.set(normColor, colorId);
      }

      // Size
      const normSize = row.size.trim().toLowerCase();
      let sizeId = sizeMap.get(normSize);
      if (!sizeId) {
        const sizeRes = await tx.query<{ id: number }>(
          'INSERT INTO sizes (name, sort_order) VALUES ($1, 99) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
          [row.size.trim()]
        );
        sizeId = sizeRes[0].id;
        sizeMap.set(normSize, sizeId);
      }

      // Product
      const modelCode = row.modelCode.toUpperCase();
      let prodId = productMap.get(modelCode);
      if (!prodId) {
        const prodRes = await tx.query<{ id: number }>(
          `INSERT INTO products (model_code, model_name, category_id, default_price, active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (model_code) DO UPDATE SET model_name = EXCLUDED.model_name
           RETURNING id`,
          [modelCode, row.modelName, catId, row.unitPrice || 0]
        );
        prodId = prodRes[0].id;
        productMap.set(modelCode, prodId);
      }

      // Variant
      const sku = `${modelCode}-C${colorId}-S${sizeId}`;
      let variant = await tx.queryOne<{ id: number }>(
        'SELECT id FROM product_variants WHERE product_id = $1 AND color_id = $2 AND size_id = $3',
        [prodId, colorId, sizeId]
      );

      let variantId: number;
      if (!variant) {
        const qrUid = `VAR-${sku}-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
        const vRes = await tx.query<{ id: number }>(
          `INSERT INTO product_variants (product_id, color_id, size_id, sku, qr_code_uid, active)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING id`,
          [prodId, colorId, sizeId, sku, qrUid]
        );
        variantId = vRes[0].id;
      } else {
        variantId = variant.id;
      }

      // Mode handling for stock
      if (data.mode === 'opening_stock') {
        const existingBalance = await tx.queryOne<{ id: number; on_hand_quantity: number }>(
          'SELECT id, on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2 FOR UPDATE',
          [variantId, targetLocId]
        );

        if (existingBalance) {
          await tx.execute(
            `UPDATE inventory_balances 
             SET on_hand_quantity = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [row.quantity, existingBalance.id]
          );
        } else {
          await tx.execute(
            `INSERT INTO inventory_balances (variant_id, location_id, on_hand_quantity, reserved_quantity)
             VALUES ($1, $2, $3, 0)`,
            [variantId, targetLocId, row.quantity]
          );
        }

        // Record immutable opening balance movement
        await tx.execute(
          `INSERT INTO stock_movements (
             variant_id, location_id, movement_type, quantity_delta,
             reference_type, reference_id, reason, created_by
           ) VALUES ($1, $2, 'OPENING_BALANCE', $3, 'IMPORT_BATCH', $4, $5, $6)`,
          [
            variantId,
            targetLocId,
            row.quantity,
            batchNumber,
            `رصيد افتتاحي معتمد من ملف ${data.filename}`,
            data.userId,
          ]
        );
      } else if (data.mode === 'stock_adjustment') {
        const existingBalance = await tx.queryOne<{ id: number; on_hand_quantity: number }>(
          'SELECT id, on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2 FOR UPDATE',
          [variantId, targetLocId]
        );

        const prev = existingBalance ? Number(existingBalance.on_hand_quantity) : 0;
        const delta = row.quantity - prev;

        if (existingBalance) {
          await tx.execute(
            `UPDATE inventory_balances 
             SET on_hand_quantity = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [row.quantity, existingBalance.id]
          );
        } else {
          await tx.execute(
            `INSERT INTO inventory_balances (variant_id, location_id, on_hand_quantity, reserved_quantity)
             VALUES ($1, $2, $3, 0)`,
            [variantId, targetLocId, row.quantity]
          );
        }

        await tx.execute(
          `INSERT INTO stock_movements (
             variant_id, location_id, movement_type, quantity_delta,
             reference_type, reference_id, reason, created_by
           ) VALUES ($1, $2, 'ADJUSTMENT', $3, 'IMPORT_BATCH', $4, $5, $6)`,
          [
            variantId,
            targetLocId,
            delta,
            batchNumber,
            data.reason || `تسوية مخزنية مجمعة من ملف ${data.filename}`,
            data.userId,
          ]
        );
      }
      // Mode 'products_variants': do NOT touch inventory balances!
    }

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'IMPORT_BATCH_COMMITTED', 'import_batch', $2, $3)`,
      [
        data.userId,
        String(batchId),
        JSON.stringify({
          batchNumber,
          filename: data.filename,
          mode: data.mode,
          importedRows: data.validRows.length,
        }),
      ]
    );

    return {
      batchId,
      batchNumber,
      importedCount: data.validRows.length,
    };
  });
}

export function generateSampleExcelBuffer(): Buffer {
  const sampleData = [
    {
      'كود الموديل': 'K101',
      'اسم الموديل': 'سالوبيت صيفي مطبوع',
      'اللون': 'كحلي',
      'المقاس': '1 سنة',
      'الكمية': 12,
      'الفئة': 'ولادي',
      'سعر البيع': 180,
    },
    {
      'كود الموديل': 'K101',
      'اسم الموديل': 'سالوبيت صيفي مطبوع',
      'اللون': 'كحلي',
      'المقاس': '2 سنة',
      'الكمية': 8,
      'الفئة': 'ولادي',
      'سعر البيع': 180,
    },
    {
      'كود الموديل': 'K101',
      'اسم الموديل': 'سالوبيت صيفي مطبوع',
      'اللون': 'أبيض',
      'المقاس': '1 سنة',
      'الكمية': 6,
      'الفئة': 'ولادي',
      'سعر البيع': 180,
    },
    {
      'كود الموديل': 'B205',
      'اسم الموديل': 'فستان قطن ورود',
      'اللون': 'وردي',
      'المقاس': '3 سنوات',
      'الكمية': 15,
      'الفئة': 'بناتي',
      'سعر البيع': 220,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'نموذج_الأصناف');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function generateErrorReportExcel(errors: RowError[]): Buffer {
  const errorData = errors.map((e) => ({
    'رقم الصف بالملف': e.rowNumber,
    'كود الموديل': e.modelCode || 'فارغ',
    'اسم الموديل': e.modelName || 'فارغ',
    'اللون': e.color || 'فارغ',
    'المقاس': e.size || 'فارغ',
    'الحقل المسبب للخطأ': e.field,
    'تفاصيل وسبب الخطأ': e.errorMessage,
  }));

  const ws = XLSX.utils.json_to_sheet(errorData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'أخطاء_الاستيراد');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
