import { DbClient } from './index';

export async function runMigrations(client: DbClient): Promise<void> {
  // 1. Variant QR code identifier
  await client.execute(`
    ALTER TABLE product_variants 
    ADD COLUMN IF NOT EXISTS qr_code_uid VARCHAR(120);
  `);

  // Backfill existing variants without qr_code_uid
  await client.execute(`
    UPDATE product_variants
    SET qr_code_uid = 'VAR-' || COALESCE(sku, 'V' || id) || '-' || id
    WHERE qr_code_uid IS NULL OR qr_code_uid = '';
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_qr_uid 
    ON product_variants(qr_code_uid);
  `);

  // 2. Warehouse Shelves
  await client.execute(`
    CREATE TABLE IF NOT EXISTS warehouse_shelves (
      id SERIAL PRIMARY KEY,
      warehouse_id INT REFERENCES inventory_locations(id) ON DELETE RESTRICT,
      shelf_code VARCHAR(100) UNIQUE NOT NULL,
      aisle VARCHAR(50),
      rack VARCHAR(50),
      bin_carton VARCHAR(50),
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_warehouse_shelves_code 
    ON warehouse_shelves(shelf_code);
  `);

  // Seed default shelves for main warehouse if empty
  const shelfCountRes = await client.queryOne<{ count: string | number }>(
    `SELECT COUNT(*) as count FROM warehouse_shelves`
  );
  if (Number(shelfCountRes?.count || 0) === 0) {
    let mainLoc = await client.queryOne<{ id: number }>(
      `SELECT id FROM inventory_locations WHERE location_code = 'MAIN' LIMIT 1`
    );
    if (!mainLoc) {
      await client.execute(
        `INSERT INTO inventory_locations (name, location_code, location_type, active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (location_code) DO NOTHING`,
        ['المستودع الرئيسي', 'MAIN', 'warehouse', true]
      );
      mainLoc = await client.queryOne<{ id: number }>(
        `SELECT id FROM inventory_locations WHERE location_code = 'MAIN' LIMIT 1`
      );
    }
    const mainLocId = mainLoc?.id || 1;
    const defaultShelves = [
      { code: 'A-01-01', aisle: 'A', rack: '01', bin: '01' },
      { code: 'A-01-02', aisle: 'A', rack: '01', bin: '02' },
      { code: 'A-01-03', aisle: 'A', rack: '01', bin: '03' },
      { code: 'B-01-01', aisle: 'B', rack: '01', bin: '01' },
      { code: 'B-02-01', aisle: 'B', rack: '02', bin: '01' },
      { code: 'SHELF-DEFAULT', aisle: 'MAIN', rack: '00', bin: '00' },
    ];
    for (const sh of defaultShelves) {
      await client.execute(
        `INSERT INTO warehouse_shelves (warehouse_id, shelf_code, aisle, rack, bin_carton, active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (shelf_code) DO NOTHING`,
        [mainLocId, sh.code, sh.aisle, sh.rack, sh.bin]
      );
    }
  }

  // 3. Variant Shelves Assignment & Balances
  await client.execute(`
    CREATE TABLE IF NOT EXISTS variant_shelves (
      id SERIAL PRIMARY KEY,
      variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      shelf_id INT NOT NULL REFERENCES warehouse_shelves(id) ON DELETE CASCADE,
      quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      is_primary BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_variant_shelf UNIQUE (variant_id, shelf_id)
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_variant_shelves_variant 
    ON variant_shelves(variant_id);
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_variant_shelves_shelf 
    ON variant_shelves(shelf_id);
  `);

  // Safe migration of existing variant stock into default primary shelf
  const unassignedVariants = await client.query<{ variant_id: number; on_hand: number }>(`
    SELECT ib.variant_id, ib.on_hand_quantity as on_hand
    FROM inventory_balances ib
    LEFT JOIN variant_shelves vs ON ib.variant_id = vs.variant_id
    WHERE vs.id IS NULL AND ib.on_hand_quantity > 0
  `);

  if (unassignedVariants.length > 0) {
    const defaultShelf = await client.queryOne<{ id: number }>(
      `SELECT id FROM warehouse_shelves ORDER BY id ASC LIMIT 1`
    );
    if (defaultShelf) {
      for (const uv of unassignedVariants) {
        await client.execute(
          `INSERT INTO variant_shelves (variant_id, shelf_id, quantity, is_primary)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (variant_id, shelf_id) DO NOTHING`,
          [uv.variant_id, defaultShelf.id, uv.on_hand]
        );
      }
    }
  }

  // 4. Sales Orders Extensions (preparation, delivery, priority, employee)
  await client.execute(`
    ALTER TABLE sales_orders 
    ADD COLUMN IF NOT EXISTS preparation_status VARCHAR(50) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS assigned_employee_id INT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS delivered_by INT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS delivery_recipient_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_sales_orders_prep_status 
    ON sales_orders(preparation_status);
  `);

  // 5. Sales Order Items Extensions (checked & packed quantities)
  await client.execute(`
    ALTER TABLE sales_order_items 
    ADD COLUMN IF NOT EXISTS checked_quantity INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS packed_quantity INT NOT NULL DEFAULT 0;
  `);

  // 6. Order Review Sessions
  await client.execute(`
    CREATE TABLE IF NOT EXISTS order_review_sessions (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      reviewer_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'canceled')),
      total_required_pieces INT NOT NULL DEFAULT 0,
      total_scanned_pieces INT NOT NULL DEFAULT 0,
      notes TEXT,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP WITH TIME ZONE
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_order_review_sessions_order 
    ON order_review_sessions(order_id);
  `);

  // 7. Order Review Scans (idempotent, auditable)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS order_review_scans (
      id SERIAL PRIMARY KEY,
      session_id INT NOT NULL REFERENCES order_review_sessions(id) ON DELETE CASCADE,
      order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
      scanned_identifier VARCHAR(150) NOT NULL,
      scan_event_uid VARCHAR(100) UNIQUE NOT NULL,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status VARCHAR(50) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'excess', 'wrong', 'undone')),
      discrepancy_note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_order_review_scans_session 
    ON order_review_scans(session_id);
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_order_review_scans_order 
    ON order_review_scans(order_id);
  `);
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_order_review_scans_uid 
    ON order_review_scans(scan_event_uid);
  `);

  // 8. Order Timeline Events
  await client.execute(`
    CREATE TABLE IF NOT EXISTS order_timeline_events (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      details JSONB,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_order_timeline_order 
    ON order_timeline_events(order_id);
  `);

  // 9. Inventory Audit Sessions (الجرد)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS inventory_audit_sessions (
      id SERIAL PRIMARY KEY,
      session_number VARCHAR(100) UNIQUE NOT NULL,
      audit_mode VARCHAR(50) NOT NULL CHECK (audit_mode IN ('full', 'by_model', 'by_category', 'by_shelf', 'selected_variants', 'cycle_count')),
      warehouse_id INT NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
      status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'under_review', 'approved', 'canceled')),
      notes TEXT,
      created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      approved_by INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      approved_at TIMESTAMP WITH TIME ZONE,
      closed_at TIMESTAMP WITH TIME ZONE
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS inventory_audit_lines (
      id SERIAL PRIMARY KEY,
      session_id INT NOT NULL REFERENCES inventory_audit_sessions(id) ON DELETE CASCADE,
      variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
      shelf_id INT REFERENCES warehouse_shelves(id) ON DELETE SET NULL,
      system_physical_quantity INT NOT NULL DEFAULT 0,
      system_reserved_quantity INT NOT NULL DEFAULT 0,
      system_available_quantity INT NOT NULL DEFAULT 0,
      counted_quantity INT,
      discrepancy INT NOT NULL DEFAULT 0,
      reconciliation_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN ('pending', 'matched', 'discrepancy', 'approved', 'rejected')),
      notes TEXT,
      counted_by INT REFERENCES users(id) ON DELETE SET NULL,
      counted_at TIMESTAMP WITH TIME ZONE,
      CONSTRAINT uq_audit_session_variant UNIQUE (session_id, variant_id)
    );
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_inventory_audit_lines_session 
    ON inventory_audit_lines(session_id);
  `);

  // 10. Sales Returns Extensions (Approval, Rejection, Inspection)
  await client.execute(`
    ALTER TABLE sales_returns 
    ADD COLUMN IF NOT EXISTS approved_by INT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS rejected_by INT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS inspected_by INT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMP WITH TIME ZONE;
  `);

  // Safely update sales_returns status constraint to include draft, pending_approval, approved, rejected, canceled
  try {
    await client.execute(`ALTER TABLE sales_returns DROP CONSTRAINT IF EXISTS sales_returns_status_check;`);
    await client.execute(`
      ALTER TABLE sales_returns 
      ADD CONSTRAINT sales_returns_status_check 
      CHECK (status IN ('draft', 'pending', 'pending_approval', 'approved', 'rejected', 'inspected', 'completed', 'canceled'));
    `);
  } catch (e) {
    // If table constraint has different name or already modified
    console.warn('Note on sales_returns_status_check:', e);
  }

  // 11. Role Permissions Matrix Table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id SERIAL PRIMARY KEY,
      role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'sales', 'warehouse')),
      permission_key VARCHAR(100) NOT NULL,
      allowed BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_role_permission UNIQUE (role, permission_key)
    );
  `);

  // Seed default permission matrix according to specification
  const defaultPermissions: Array<{ role: 'admin' | 'sales' | 'warehouse'; key: string; allowed: boolean }> = [
    // Customer profiles
    { role: 'admin', key: 'customers.view', allowed: true },
    { role: 'admin', key: 'customers.manage', allowed: true },
    { role: 'sales', key: 'customers.view', allowed: true },
    { role: 'sales', key: 'customers.manage', allowed: true },
    { role: 'warehouse', key: 'customers.view', allowed: true },
    { role: 'warehouse', key: 'customers.manage', allowed: false },

    // Product & variants
    { role: 'admin', key: 'products.view', allowed: true },
    { role: 'admin', key: 'products.manage', allowed: true },
    { role: 'sales', key: 'products.view', allowed: true },
    { role: 'sales', key: 'products.manage', allowed: false },
    { role: 'warehouse', key: 'products.view', allowed: true },
    { role: 'warehouse', key: 'products.manage', allowed: false },

    // QR generation & label printing
    { role: 'admin', key: 'qr.generate', allowed: true },
    { role: 'admin', key: 'qr.print', allowed: true },
    { role: 'sales', key: 'qr.generate', allowed: false },
    { role: 'sales', key: 'qr.print', allowed: true },
    { role: 'warehouse', key: 'qr.generate', allowed: false },
    { role: 'warehouse', key: 'qr.print', allowed: true },

    // Shelves
    { role: 'admin', key: 'shelves.view', allowed: true },
    { role: 'admin', key: 'shelves.manage', allowed: true },
    { role: 'sales', key: 'shelves.view', allowed: true },
    { role: 'sales', key: 'shelves.manage', allowed: false },
    { role: 'warehouse', key: 'shelves.view', allowed: true },
    { role: 'warehouse', key: 'shelves.manage', allowed: true },

    // Orders
    { role: 'admin', key: 'orders.create', allowed: true },
    { role: 'admin', key: 'orders.confirm', allowed: true },
    { role: 'sales', key: 'orders.create', allowed: true },
    { role: 'sales', key: 'orders.confirm', allowed: true },
    { role: 'warehouse', key: 'orders.create', allowed: false },
    { role: 'warehouse', key: 'orders.confirm', allowed: false },

    // Picking & QR Review
    { role: 'admin', key: 'orders.pick', allowed: true },
    { role: 'admin', key: 'orders.review', allowed: true },
    { role: 'admin', key: 'orders.confirm_review', allowed: true },
    { role: 'sales', key: 'orders.pick', allowed: false },
    { role: 'sales', key: 'orders.review', allowed: false },
    { role: 'sales', key: 'orders.confirm_review', allowed: false },
    { role: 'warehouse', key: 'orders.pick', allowed: true },
    { role: 'warehouse', key: 'orders.review', allowed: true },
    { role: 'warehouse', key: 'orders.confirm_review', allowed: true },

    // Shipping & Delivery Confirmation
    { role: 'admin', key: 'orders.ship', allowed: true },
    { role: 'admin', key: 'orders.deliver', allowed: true },
    { role: 'sales', key: 'orders.ship', allowed: false },
    { role: 'sales', key: 'orders.deliver', allowed: true },
    { role: 'warehouse', key: 'orders.ship', allowed: true },
    { role: 'warehouse', key: 'orders.deliver', allowed: true },

    // Inventory & Audit
    { role: 'admin', key: 'inventory.view', allowed: true },
    { role: 'admin', key: 'inventory.audit_create', allowed: true },
    { role: 'admin', key: 'inventory.audit_count', allowed: true },
    { role: 'admin', key: 'inventory.audit_approve', allowed: true },
    { role: 'sales', key: 'inventory.view', allowed: true },
    { role: 'sales', key: 'inventory.audit_create', allowed: false },
    { role: 'sales', key: 'inventory.audit_count', allowed: false },
    { role: 'sales', key: 'inventory.audit_approve', allowed: false },
    { role: 'warehouse', key: 'inventory.view', allowed: true },
    { role: 'warehouse', key: 'inventory.audit_create', allowed: false },
    { role: 'warehouse', key: 'inventory.audit_count', allowed: true },
    { role: 'warehouse', key: 'inventory.audit_approve', allowed: false },

    // Returns
    { role: 'admin', key: 'returns.create', allowed: true },
    { role: 'admin', key: 'returns.approve', allowed: true },
    { role: 'admin', key: 'returns.inspect', allowed: true },
    { role: 'admin', key: 'returns.restock', allowed: true },
    { role: 'sales', key: 'returns.create', allowed: true },
    { role: 'sales', key: 'returns.approve', allowed: false },
    { role: 'sales', key: 'returns.inspect', allowed: false },
    { role: 'sales', key: 'returns.restock', allowed: false },
    { role: 'warehouse', key: 'returns.create', allowed: false },
    { role: 'warehouse', key: 'returns.approve', allowed: false },
    { role: 'warehouse', key: 'returns.inspect', allowed: true },
    { role: 'warehouse', key: 'returns.restock', allowed: true },

    // Reports & Management
    { role: 'admin', key: 'reports.view', allowed: true },
    { role: 'admin', key: 'users.manage', allowed: true },
    { role: 'sales', key: 'reports.view', allowed: true },
    { role: 'sales', key: 'users.manage', allowed: false },
    { role: 'warehouse', key: 'reports.view', allowed: true },
    { role: 'warehouse', key: 'users.manage', allowed: false },
  ];

  for (const perm of defaultPermissions) {
    await client.execute(
      `INSERT INTO role_permissions (role, permission_key, allowed)
       VALUES ($1, $2, $3)
       ON CONFLICT (role, permission_key) DO NOTHING`,
      [perm.role, perm.key, perm.allowed]
    );
  }

  // 10. Customers store_name column
  await client.execute(`
    ALTER TABLE customers 
    ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);
  `);
}
