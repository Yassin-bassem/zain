import { query } from '@/lib/db';
import { UserRole } from '@/lib/auth';

export interface SearchResultItem {
  id: string | number;
  category: 'products' | 'customers' | 'orders' | 'shelves' | 'returns' | 'audits';
  categoryLabel: string;
  title: string;
  subtitle: string;
  badge?: string;
  url: string;
}

export interface GlobalSearchResponse {
  query: string;
  totalResults: number;
  results: SearchResultItem[];
}

export async function performGlobalSearch(
  searchTerm: string,
  userRole: UserRole,
  limitPerCategory = 5
): Promise<GlobalSearchResponse> {
  const term = (searchTerm || '').trim();
  if (!term || term.length < 1) {
    return { query: term, totalResults: 0, results: [] };
  }

  const likePattern = `%${term}%`;
  const results: SearchResultItem[] = [];

  // 1. Products & Variants (Accessible by admin, sales, warehouse)
  try {
    const productRows = await query<any>(
      `SELECT p.id as product_id, p.model_code, p.model_name, pv.id as variant_id, pv.sku, pv.qr_code_uid,
              c.name as color_name, sz.name as size_name
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       JOIN colors c ON pv.color_id = c.id
       JOIN sizes sz ON pv.size_id = sz.id
       WHERE p.model_code ILIKE $1 
          OR p.model_name ILIKE $1 
          OR pv.sku ILIKE $1 
          OR pv.qr_code_uid ILIKE $1
       LIMIT $2`,
      [likePattern, limitPerCategory]
    );

    for (const r of productRows) {
      results.push({
        id: `variant-${r.variant_id}`,
        category: 'products',
        categoryLabel: 'المنتجات والموديلات',
        title: `${r.model_code} - ${r.model_name}`,
        subtitle: `اللون: ${r.color_name} | المقاس: ${r.size_name} | SKU: ${r.sku || r.qr_code_uid || 'N/A'}`,
        badge: 'موديل',
        url: `/products`,
      });
    }
  } catch (err) {
    console.error('Error searching products:', err);
  }

  // 2. Customers (Accessible by all 3 roles)
  try {
    const customerRows = await query<any>(
      `SELECT id, name, phone, customer_code, address
       FROM customers
       WHERE name ILIKE $1 
          OR phone ILIKE $1 
          OR customer_code ILIKE $1
       LIMIT $2`,
      [likePattern, limitPerCategory]
    );

    for (const c of customerRows) {
      results.push({
        id: `customer-${c.id}`,
        category: 'customers',
        categoryLabel: 'العملاء',
        title: `${c.name} (${c.customer_code || 'بدون كود'})`,
        subtitle: `الهاتف: ${c.phone || 'غير مسجل'} | العنوان: ${c.address || 'غير محدد'}`,
        badge: 'عميل',
        url: `/customers/${c.id}`,
      });
    }
  } catch (err) {
    console.error('Error searching customers:', err);
  }

  // 3. Orders / Invoices (Accessible by all 3 roles)
  try {
    const orderRows = await query<any>(
      `SELECT so.id, so.order_number, so.status, so.preparation_status, so.total_amount, c.name as customer_name
       FROM sales_orders so
       JOIN customers c ON so.customer_id = c.id
       WHERE so.order_number ILIKE $1 
          OR c.name ILIKE $1
       LIMIT $2`,
      [likePattern, limitPerCategory]
    );

    for (const o of orderRows) {
      results.push({
        id: `order-${o.id}`,
        category: 'orders',
        categoryLabel: 'الطلبات والفواتير',
        title: `طلب رقم: ${o.order_number}`,
        subtitle: `العميل: ${o.customer_name} | حالة التحضير: ${o.preparation_status || 'معلق'}`,
        badge: o.status,
        url: `/warehouse/preparation/${o.id}`,
      });
    }
  } catch (err) {
    console.error('Error searching orders:', err);
  }

  // 4. Warehouse Shelves (Admin & Warehouse)
  if (userRole === 'admin' || userRole === 'warehouse') {
    try {
      const shelfRows = await query<any>(
        `SELECT id, shelf_code, aisle, rack, active
         FROM warehouse_shelves
         WHERE shelf_code ILIKE $1 
            OR aisle ILIKE $1 
            OR rack ILIKE $1
         LIMIT $2`,
        [likePattern, limitPerCategory]
      );

      for (const s of shelfRows) {
        results.push({
          id: `shelf-${s.id}`,
          category: 'shelves',
          categoryLabel: 'الأرفف والمواقع',
          title: `الرف: ${s.shelf_code}`,
          subtitle: `الممر: ${s.aisle || '-'} | الاستاند: ${s.rack || '-'}`,
          badge: s.active ? 'نشط' : 'معطل',
          url: `/warehouse/shelves`,
        });
      }
    } catch (err) {
      console.error('Error searching shelves:', err);
    }
  }

  // 5. Returns (All roles according to workflow)
  try {
    const returnRows = await query<any>(
      `SELECT sr.id, sr.return_number, sr.reason, sr.status, c.name as customer_name
       FROM sales_returns sr
       JOIN customers c ON sr.customer_id = c.id
       WHERE sr.return_number ILIKE $1 
          OR sr.reason ILIKE $1 
          OR c.name ILIKE $1
       LIMIT $2`,
      [likePattern, limitPerCategory]
    );

    for (const ret of returnRows) {
      results.push({
        id: `return-${ret.id}`,
        category: 'returns',
        categoryLabel: 'المرتجعات والموافقات',
        title: `مرتجع: ${ret.return_number}`,
        subtitle: `العميل: ${ret.customer_name} | السبب: ${ret.reason}`,
        badge: ret.status,
        url: `/returns`,
      });
    }
  } catch (err) {
    console.error('Error searching returns:', err);
  }

  // 6. Inventory Audit Sessions (Admin & Warehouse)
  if (userRole === 'admin' || userRole === 'warehouse') {
    try {
      const auditRows = await query<any>(
        `SELECT id, session_number, audit_mode, status
         FROM inventory_audit_sessions
         WHERE session_number ILIKE $1
         LIMIT $2`,
        [likePattern, limitPerCategory]
      );

      for (const a of auditRows) {
        results.push({
          id: `audit-${a.id}`,
          category: 'audits',
          categoryLabel: 'جلسات الجرد',
          title: `جلسة جرد: ${a.session_number}`,
          subtitle: `النمط: ${a.audit_mode} | الحالة: ${a.status}`,
          badge: a.status,
          url: `/inventory/audit/${a.id}`,
        });
      }
    } catch (err) {
      console.error('Error searching audits:', err);
    }
  }

  return {
    query: term,
    totalResults: results.length,
    results,
  };
}
