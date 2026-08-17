import { executeBatch } from './connection.js';

export const SCHEMA_SQL = `
-- ==========================================================
-- 1. AUTHENTICATION & ACCESS CONTROL
-- ==========================================================

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  role_code TEXT NOT NULL,
  department_code TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_code) REFERENCES roles(code)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  selected_language TEXT NOT NULL CHECK(selected_language IN ('en', 'ur')),
  ip_address TEXT,
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_token TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  otp_code TEXT NOT NULL,
  selected_language TEXT NOT NULL DEFAULT 'en',
  attempts_left INTEGER NOT NULL DEFAULT 3,
  is_consumed INTEGER NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_code TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  FOREIGN KEY (role_code) REFERENCES roles(code)
);

-- ==========================================================
-- 2. CORE MASTER DATA
-- ==========================================================

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- FABRIC, ACCESSORY, PACKAGING
  payment_terms_days INTEGER NOT NULL DEFAULT 30, -- 30, 60, 90
  contact_person TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS styles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  garment_type TEXT NOT NULL DEFAULT 'JEANS',
  standard_consumption_meters REAL NOT NULL DEFAULT 1.35,
  standard_smv REAL DEFAULT 18.5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS colors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  size_label TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL
);

-- ==========================================================
-- 3. ORDERS & PROCUREMENT
-- ==========================================================

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  style_id INTEGER NOT NULL,
  color_id INTEGER NOT NULL,
  order_qty INTEGER NOT NULL,
  unit_price REAL NOT NULL DEFAULT 14.50,
  target_delivery_date DATE NOT NULL,
  fabric_requirement_spec TEXT,
  accessories_spec TEXT,
  customer_notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- DRAFT, PENDING_APPROVAL, APPROVED, IN_PRODUCTION, COMPLETED, CANCELLED
  merch_approved_by INTEGER,
  merch_approved_at DATETIME,
  ceo_approved_by INTEGER,
  ceo_approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (style_id) REFERENCES styles(id),
  FOREIGN KEY (color_id) REFERENCES colors(id),
  FOREIGN KEY (merch_approved_by) REFERENCES users(id),
  FOREIGN KEY (ceo_approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_size_breakdowns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  size_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (size_id) REFERENCES sizes(id),
  UNIQUE(order_id, size_id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_reference TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL,
  order_id INTEGER,
  item_type TEXT NOT NULL, -- FABRIC, ZIPPER, BUTTON, RIVET, LABEL, THREAD, TAG, PACKAGING
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'METERS',
  unit_price REAL NOT NULL,
  total_amount REAL NOT NULL,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  expected_delivery DATE,
  actual_delivery DATE,
  status TEXT NOT NULL DEFAULT 'ISSUED', -- ISSUED, RECEIVED, INVOICED, PAID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ==========================================================
-- 4. INVENTORY & FABRIC ROLL TRACKING (Tracked by ROLL)
-- ==========================================================

CREATE TABLE IF NOT EXISTS fabric_rolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roll_barcode TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL,
  fabric_type TEXT NOT NULL,
  shade_color TEXT NOT NULL,
  lot_batch_number TEXT NOT NULL,
  original_length_meters REAL NOT NULL,
  remaining_length_meters REAL NOT NULL,
  weight_kg_optional REAL,
  warehouse_location TEXT NOT NULL DEFAULT 'RACK-A1',
  status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, ALLOCATED, CONSUMED, REJECTED
  received_date DATE DEFAULT (DATE('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS accessories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  item_type TEXT NOT NULL, -- ZIPPER, BUTTON, RIVET, LABEL, THREAD, TAG, POLYBAG, CARTON
  spec TEXT,
  unit TEXT NOT NULL DEFAULT 'PCS',
  current_stock REAL NOT NULL DEFAULT 0,
  min_threshold REAL NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_type TEXT NOT NULL, -- IN, OUT, ISSUE, RETURN, TRANSFER, ADJUSTMENT
  item_category TEXT NOT NULL, -- FABRIC_ROLL, ACCESSORY
  item_id INTEGER,
  roll_id INTEGER,
  quantity REAL NOT NULL,
  from_location TEXT,
  to_location TEXT,
  reference_po TEXT,
  notes TEXT,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roll_id) REFERENCES fabric_rolls(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ==========================================================
-- 5. REQUEST PORTAL, APPROVALS & QR/BARCODE SYSTEM
-- ==========================================================

CREATE TABLE IF NOT EXISTS allocation_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_number TEXT UNIQUE NOT NULL,
  request_type TEXT NOT NULL, -- MATERIAL_ISSUE, CUTTING_TO_STITCHING, STITCHING_TO_WASHING, WASHING_TO_FINISHING, FINISHING_TO_PACKING, EDIT_OVERRIDE
  from_dept TEXT NOT NULL,
  to_dept TEXT NOT NULL,
  po_number TEXT NOT NULL,
  style_id INTEGER,
  color_id INTEGER,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, DISPATCHED, RECEIVED
  requested_by INTEGER NOT NULL,
  approved_by INTEGER,
  approved_at DATETIME,
  rejection_reason TEXT,
  payload_details TEXT, -- JSON string of detailed items/sizes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_data_token TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL, -- ALLOCATION, FABRIC_ROLL, CARTON, BUNDLE
  entity_id INTEGER NOT NULL,
  generated_for_dept TEXT NOT NULL,
  po_number TEXT,
  payload_json TEXT NOT NULL,
  scan_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- ORDER, ALLOCATION_REQUEST, RECORD_EDIT, MATERIAL_ISSUE
  entity_id INTEGER NOT NULL,
  request_type TEXT NOT NULL,
  requested_by INTEGER NOT NULL,
  approver_role TEXT NOT NULL, -- CEO, GENERAL_MANAGER, MERCHANDISER
  approved_by_user_id INTEGER,
  status TEXT NOT NULL, -- APPROVED, REJECTED
  comments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);

-- ==========================================================
-- 6. DEPARTMENT PRODUCTION TRACKING
-- ==========================================================

CREATE TABLE IF NOT EXISTS cutting_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_code TEXT UNIQUE NOT NULL,
  po_number TEXT NOT NULL,
  style_id INTEGER NOT NULL,
  color_id INTEGER NOT NULL,
  fabric_roll_id INTEGER NOT NULL,
  lot_batch TEXT NOT NULL,
  fabric_issued_meters REAL NOT NULL,
  fabric_consumed_meters REAL NOT NULL,
  waste_meters REAL NOT NULL,
  waste_percentage REAL NOT NULL,
  total_pieces_cut INTEGER NOT NULL,
  marker_length_meters REAL DEFAULT 0,
  plies_count INTEGER DEFAULT 0,
  cutting_master_id INTEGER NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED, LOCKED
  lock_at DATETIME NOT NULL, -- Locked after 1 hour (created_at + 1 hour)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (style_id) REFERENCES styles(id),
  FOREIGN KEY (color_id) REFERENCES colors(id),
  FOREIGN KEY (fabric_roll_id) REFERENCES fabric_rolls(id),
  FOREIGN KEY (cutting_master_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cutting_size_breakdown (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cutting_entry_id INTEGER NOT NULL,
  size_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (cutting_entry_id) REFERENCES cutting_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (size_id) REFERENCES sizes(id)
);

CREATE TABLE IF NOT EXISTS stitching_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_code TEXT UNIQUE NOT NULL,
  po_number TEXT NOT NULL,
  style_id INTEGER NOT NULL,
  color_id INTEGER NOT NULL,
  line_number TEXT DEFAULT 'LINE-1',
  received_cut_qty INTEGER NOT NULL,
  stitched_qty INTEGER NOT NULL,
  rejected_qty INTEGER NOT NULL DEFAULT 0,
  rework_qty INTEGER NOT NULL DEFAULT 0,
  completed_qty INTEGER NOT NULL,
  stitching_master_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  lock_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (style_id) REFERENCES styles(id),
  FOREIGN KEY (color_id) REFERENCES colors(id),
  FOREIGN KEY (stitching_master_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS washing_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_code TEXT UNIQUE NOT NULL,
  po_number TEXT NOT NULL,
  wash_batch_no TEXT NOT NULL,
  wash_type TEXT NOT NULL, -- STONE_WASH, ENZYME_WASH, BLEACH_WASH, ACID_WASH, RAW
  received_qty INTEGER NOT NULL,
  processed_qty INTEGER NOT NULL,
  damaged_qty INTEGER NOT NULL DEFAULT 0,
  returned_qty INTEGER NOT NULL DEFAULT 0,
  washing_master_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  lock_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (washing_master_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS finishing_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_code TEXT UNIQUE NOT NULL,
  po_number TEXT NOT NULL,
  received_qty INTEGER NOT NULL,
  thread_trimmed_qty INTEGER NOT NULL,
  pressed_qty INTEGER NOT NULL,
  labeled_qty INTEGER NOT NULL,
  rework_qty INTEGER NOT NULL DEFAULT 0,
  final_passed_qty INTEGER NOT NULL,
  finishing_master_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  lock_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (finishing_master_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS qc_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_code TEXT UNIQUE NOT NULL,
  po_number TEXT NOT NULL,
  inspection_stage TEXT NOT NULL, -- INLINE, ENDLINE, FINAL_AQL
  inspected_qty INTEGER NOT NULL,
  passed_qty INTEGER NOT NULL,
  failed_qty INTEGER NOT NULL,
  defect_type TEXT, -- STITCHING_DEFECT, SHADE_VARIATION, HOLE, MEASUREMENT_OUT, DIRTY_SPOT
  defect_qty INTEGER DEFAULT 0,
  rework_qty INTEGER DEFAULT 0,
  is_packing_hold INTEGER NOT NULL DEFAULT 0, -- 1 = BLOCKS PACKING
  qc_inspector_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  lock_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (qc_inspector_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS packing_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_code TEXT UNIQUE NOT NULL,
  po_number TEXT NOT NULL,
  carton_number TEXT NOT NULL,
  pieces_per_carton INTEGER NOT NULL,
  total_cartons INTEGER NOT NULL,
  total_pieces INTEGER NOT NULL,
  packing_status TEXT NOT NULL DEFAULT 'PACKED',
  packing_master_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  lock_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (packing_master_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS shipment_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_reference TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  po_number TEXT NOT NULL,
  container_number TEXT NOT NULL,
  total_cartons INTEGER NOT NULL,
  total_pieces INTEGER NOT NULL,
  etd DATE NOT NULL,
  eta DATE NOT NULL,
  documents_json TEXT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, DISPATCHED, IN_TRANSIT, DELIVERED
  shipment_officer_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (shipment_officer_id) REFERENCES users(id)
);

-- ==========================================================
-- 7. FINANCE & MASTER PIECE-RATE PAYROLL
-- ==========================================================

CREATE TABLE IF NOT EXISTS production_masters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  name TEXT NOT NULL,
  department_code TEXT NOT NULL,
  phone TEXT,
  contract_type TEXT NOT NULL DEFAULT 'PIECE_RATE',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS master_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_id INTEGER NOT NULL,
  department_code TEXT NOT NULL,
  style_id INTEGER,
  operation_name TEXT NOT NULL,
  rate_per_piece REAL NOT NULL,
  effective_date DATE DEFAULT (DATE('now')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (master_id) REFERENCES production_masters(id),
  FOREIGN KEY (style_id) REFERENCES styles(id)
);

CREATE TABLE IF NOT EXISTS master_production_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_id INTEGER NOT NULL,
  po_number TEXT NOT NULL,
  department_code TEXT NOT NULL,
  approved_quantity INTEGER NOT NULL,
  rate_per_piece REAL NOT NULL,
  gross_amount REAL NOT NULL,
  deductions REAL DEFAULT 0,
  net_payable REAL NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PARTIAL, PAID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (master_id) REFERENCES production_masters(id)
);

CREATE TABLE IF NOT EXISTS master_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  master_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  payment_date DATE DEFAULT (DATE('now')),
  payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
  reference_no TEXT,
  paid_by_user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (master_id) REFERENCES production_masters(id),
  FOREIGN KEY (paid_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL,
  po_reference TEXT NOT NULL,
  invoice_amount REAL NOT NULL,
  payment_terms_days INTEGER NOT NULL DEFAULT 30, -- 30, 60, 90
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_amount REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PARTIAL, PAID, OVERDUE
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS customer_receivables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  po_number TEXT NOT NULL,
  total_amount REAL NOT NULL,
  due_date DATE NOT NULL,
  received_amount REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PARTIAL, PAID, OVERDUE
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- ==========================================================
-- 8. AUDIT LOGS, NOTIFICATIONS & SYSTEM LOGS
-- ==========================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_role TEXT,
  action TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_id TEXT,
  old_data_json TEXT,
  new_data_json TEXT,
  reason TEXT,
  ip_address TEXT,
  source TEXT NOT NULL DEFAULT 'WEB_UI', -- WEB_UI, VOICE_AGENT, API, SYSTEM
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_user_id INTEGER,
  recipient_role TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'IN_APP', -- IN_APP, WHATSAPP, EMAIL
  status TEXT NOT NULL DEFAULT 'UNREAD', -- UNREAD, READ, SENT, FAILED
  reference_link TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning-fast lookups across production identifiers
CREATE INDEX IF NOT EXISTS idx_cutting_po ON cutting_entries(po_number);
CREATE INDEX IF NOT EXISTS idx_stitching_po ON stitching_entries(po_number);
CREATE INDEX IF NOT EXISTS idx_washing_po ON washing_entries(po_number);
CREATE INDEX IF NOT EXISTS idx_finishing_po ON finishing_entries(po_number);
CREATE INDEX IF NOT EXISTS idx_qc_po ON qc_entries(po_number);
CREATE INDEX IF NOT EXISTS idx_packing_po ON packing_entries(po_number);
CREATE INDEX IF NOT EXISTS idx_orders_po ON orders(po_number);
CREATE INDEX IF NOT EXISTS idx_fabric_rolls_barcode ON fabric_rolls(roll_barcode);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(recipient_user_id, status);
`;

export async function initializeSchema(): Promise<void> {
  await executeBatch(SCHEMA_SQL);
}
