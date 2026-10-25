-- Arabic RTL Wholesale Children's Clothing Inventory & Order Management System
-- PostgreSQL Schema with strict integrity, non-negative checks, and indexes

-- 1. Users & Roles
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'sales', 'warehouse')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Colors
CREATE TABLE IF NOT EXISTS colors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(100) UNIQUE NOT NULL,
    hex_code VARCHAR(30),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sizes
CREATE TABLE IF NOT EXISTS sizes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Products (Clothing Models)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    model_code VARCHAR(100) UNIQUE NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    category_id INT REFERENCES categories(id) ON DELETE RESTRICT,
    description TEXT,
    default_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (default_price >= 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Product Variants (Unique combination of Product + Color + Size)
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color_id INT NOT NULL REFERENCES colors(id) ON DELETE RESTRICT,
    size_id INT NOT NULL REFERENCES sizes(id) ON DELETE RESTRICT,
    sku VARCHAR(120) UNIQUE NOT NULL,
    qr_code_uid VARCHAR(120) UNIQUE,
    min_stock_threshold INT NOT NULL DEFAULT 0 CHECK (min_stock_threshold >= 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_color_size UNIQUE (product_id, color_id, size_id)
);

-- 7. Customers
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    alternate_phone VARCHAR(50),
    address TEXT,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    supplier_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Inventory Locations (Default warehouse: MAIN)
CREATE TABLE IF NOT EXISTS inventory_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    location_code VARCHAR(50) UNIQUE NOT NULL,
    parent_location_id INT REFERENCES inventory_locations(id) ON DELETE SET NULL,
    location_type VARCHAR(50) NOT NULL DEFAULT 'warehouse',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Inventory Balances (Current stock balance per variant & location)
CREATE TABLE IF NOT EXISTS inventory_balances (
    id SERIAL PRIMARY KEY,
    variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    location_id INT NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    on_hand_quantity INT NOT NULL DEFAULT 0 CHECK (on_hand_quantity >= 0),
    reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_variant_location UNIQUE (variant_id, location_id),
    CONSTRAINT chk_on_hand_gte_reserved CHECK (on_hand_quantity >= reserved_quantity)
);

-- 11. Stock Movement Ledger (IMMUTABLE audit trail of physical changes)
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    location_id INT NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL CHECK (
        movement_type IN ('RECEIPT', 'OPENING_BALANCE', 'SHIPMENT', 'RETURN_SELLABLE', 'ADJUSTMENT', 'TRANSFER')
    ),
    quantity_delta INT NOT NULL,
    reference_type VARCHAR(50),
    reference_id VARCHAR(100),
    reason TEXT NOT NULL,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Purchase Receipts (Goods received from suppliers)
CREATE TABLE IF NOT EXISTS purchase_receipts (
    id SERIAL PRIMARY KEY,
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_invoice_ref VARCHAR(100),
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    total_pieces INT NOT NULL DEFAULT 0,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    confirmed_by INT REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_receipt_items (
    id SERIAL PRIMARY KEY,
    receipt_id INT NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12, 2) DEFAULT 0.00 CHECK (unit_cost >= 0),
    notes TEXT
);

-- 13. Sales Orders (Mixed Wholesale Orders)
CREATE TABLE IF NOT EXISTS sales_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (
        status IN ('draft', 'confirmed', 'picking', 'packed', 'shipped', 'canceled')
    ),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    total_pieces INT NOT NULL DEFAULT 0,
    preparation_status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'normal',
    assigned_employee_id INT REFERENCES users(id) ON DELETE SET NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    delivered_by INT REFERENCES users(id) ON DELETE SET NULL,
    delivery_recipient_name VARCHAR(150),
    delivery_notes TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (line_discount >= 0),
    line_total NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
    picked_quantity INT NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0),
    checked_quantity INT NOT NULL DEFAULT 0 CHECK (checked_quantity >= 0),
    packed_quantity INT NOT NULL DEFAULT 0 CHECK (packed_quantity >= 0),
    shipped_quantity INT NOT NULL DEFAULT 0 CHECK (shipped_quantity >= 0),
    CONSTRAINT uq_order_variant UNIQUE (order_id, variant_id)
);

-- 14. Stock Reservations (Track stock locked for confirmed orders)
CREATE TABLE IF NOT EXISTS stock_reservations (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    order_item_id INT NOT NULL REFERENCES sales_order_items(id) ON DELETE CASCADE,
    variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    location_id INT NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'fulfilled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP WITH TIME ZONE
);

-- 15. Pick Batches & Operations
CREATE TABLE IF NOT EXISTS pick_batches (
    id SERIAL PRIMARY KEY,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'discrepancy')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS pick_batch_items (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES pick_batches(id) ON DELETE CASCADE,
    order_item_id INT NOT NULL REFERENCES sales_order_items(id) ON DELETE CASCADE,
    requested_quantity INT NOT NULL CHECK (requested_quantity > 0),
    picked_quantity INT NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0),
    missing_quantity INT NOT NULL DEFAULT 0 CHECK (missing_quantity >= 0),
    notes TEXT
);

-- 16. Sales Returns (Customer returns with sellable/damaged inspection)
CREATE TABLE IF NOT EXISTS sales_returns (
    id SERIAL PRIMARY KEY,
    return_number VARCHAR(100) UNIQUE NOT NULL,
    order_id INT REFERENCES sales_orders(id) ON DELETE SET NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'pending_approval', 'approved', 'rejected', 'inspected', 'completed', 'canceled')),
    approved_by INT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by INT REFERENCES users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    inspected_by INT REFERENCES users(id) ON DELETE SET NULL,
    inspected_at TIMESTAMP WITH TIME ZONE,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_return_items (
    id SERIAL PRIMARY KEY,
    return_id INT NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
    variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    returned_quantity INT NOT NULL CHECK (returned_quantity > 0),
    disposition VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (disposition IN ('pending', 'sellable', 'damaged')),
    inspection_notes TEXT,
    restocked BOOLEAN NOT NULL DEFAULT false,
    restocked_at TIMESTAMP WITH TIME ZONE
);

-- 17. Stock Adjustments (Authorized manual adjustments)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id SERIAL PRIMARY KEY,
    adjustment_number VARCHAR(100) UNIQUE NOT NULL,
    location_id INT NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'canceled')),
    created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id SERIAL PRIMARY KEY,
    adjustment_id INT NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    previous_quantity INT NOT NULL CHECK (previous_quantity >= 0),
    new_quantity INT NOT NULL CHECK (new_quantity >= 0),
    delta INT NOT NULL,
    reason TEXT
);

-- 18. Import Batches (Tracking Excel / CSV imports and opening inventory)
CREATE TABLE IF NOT EXISTS import_batches (
    id SERIAL PRIMARY KEY,
    batch_number VARCHAR(100) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mode VARCHAR(50) NOT NULL CHECK (mode IN ('products_variants', 'opening_stock', 'stock_adjustment')),
    location_id INT REFERENCES inventory_locations(id) ON DELETE SET NULL,
    total_rows INT NOT NULL DEFAULT 0,
    valid_rows INT NOT NULL DEFAULT 0,
    invalid_rows INT NOT NULL DEFAULT 0,
    imported_rows INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'failed')),
    error_log JSONB,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    approved_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP WITH TIME ZONE
);

-- 19. Audit Logs (System-wide action tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. Warehouse Shelves & Variant Location Balances
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

-- 21. Order Review Sessions & Scans
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

-- 22. Order Timeline Events
CREATE TABLE IF NOT EXISTS order_timeline_events (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    details JSONB,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. Inventory Audit Sessions (الجرد)
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

-- 24. Role Permissions Matrix
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'sales', 'warehouse')),
    permission_key VARCHAR(100) NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_role_permission UNIQUE (role, permission_key)
);

-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_products_model_code ON products(model_code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_qr ON product_variants(qr_code_uid);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_color ON product_variants(color_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_size ON product_variants(size_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_variant ON inventory_balances(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_location ON inventory_balances(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_number ON sales_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_prep_status ON sales_orders(preparation_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_variant ON stock_reservations(variant_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_shelves_code ON warehouse_shelves(shelf_code);
CREATE INDEX IF NOT EXISTS idx_variant_shelves_variant ON variant_shelves(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_shelves_shelf ON variant_shelves(shelf_id);
CREATE INDEX IF NOT EXISTS idx_order_review_sessions_order ON order_review_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_order_review_scans_session ON order_review_scans(session_id);
CREATE INDEX IF NOT EXISTS idx_order_review_scans_uid ON order_review_scans(scan_event_uid);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_lines_session ON inventory_audit_lines(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
