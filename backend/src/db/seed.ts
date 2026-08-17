import bcrypt from 'bcryptjs';
import { execute, executeBatch, query, queryOne } from './connection.js';
import { initializeSchema } from './schema.js';

export async function seedDatabase(forceReset: boolean = false): Promise<void> {
  if (forceReset) {
    const tableNames = [
      'order_size_breakdowns', 'cutting_size_breakdown', 'cutting_entries', 'stitching_entries',
      'washing_entries', 'finishing_entries', 'qc_entries', 'packing_entries', 'shipment_entries',
      'allocation_requests', 'qr_codes', 'inventory_transactions', 'supplier_invoices',
      'customer_receivables', 'master_production_ledger', 'master_payments', 'notifications',
      'audit_logs', 'orders', 'purchase_orders', 'fabric_rolls', 'accessories', 'master_rates',
      'production_masters', 'sizes', 'colors', 'styles', 'suppliers', 'customers',
      'auth_sessions', 'permissions', 'users', 'roles'
    ];
    for (const tbl of tableNames) {
      await execute(`DROP TABLE IF EXISTS ${tbl}`);
    }
  }

  await initializeSchema();

  const userCount = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (!forceReset && userCount && userCount.count > 0) {
    console.log('Database already seeded. Skipping seed routine.');
    return;
  }

  console.log('Seeding Zillion Exports database with production master records...');

  // 1. Roles
  const roles = [
    { code: 'CEO', name: 'Chief Executive Officer', desc: 'Full company-wide oversight, approvals, commands & AI intelligence' },
    { code: 'GENERAL_MANAGER', name: 'General Manager', desc: 'Factory operations management, delegated approvals & oversight' },
    { code: 'MERCHANDISER', name: 'Merchandising Officer', desc: 'Order intake, BOM, style specs, client specs' },
    { code: 'STORE_MASTER', name: 'Store / Inventory Master', desc: 'Fabric rolls, accessories, warehouse movements, inventory receipts' },
    { code: 'CUTTING_MASTER', name: 'Cutting Master', desc: 'Fabric consumption, lay planning, size breakdowns, cut pieces' },
    { code: 'STITCHING_MASTER', name: 'Stitching / CMT Master', desc: 'Assembly lines, CMT piece counts, stitching defect logging' },
    { code: 'WASHING_MASTER', name: 'Washing Master', desc: 'Wash recipe processing, shrinkage/shade batches' },
    { code: 'FINISHING_MASTER', name: 'Finishing Master', desc: 'Thread trimming, buttoning, pressing, barcode hangtagging' },
    { code: 'QC_MASTER', name: 'Quality Control Inspector', desc: 'Inline & final AQL inspections, defect triage, packing hold' },
    { code: 'PACKING_MASTER', name: 'Packing Master', desc: 'Carton packaging, ratio packs, barcode carton tagging' },
    { code: 'SHIPMENT_OFFICER', name: 'Shipment & Export Officer', desc: 'Container loading, dispatch logistics, export documentation' },
    { code: 'FINANCE_OFFICER', name: 'Finance & Accounts Officer', desc: 'Supplier payables, customer receivables, master piece-rates' },
  ];

  for (const r of roles) {
    await execute(
      'INSERT OR IGNORE INTO roles (code, name, description) VALUES (?, ?, ?)',
      [r.code, r.name, r.desc]
    );
  }

  // 2. Users (Hashed passwords)
  const defaultPasswordHash = bcrypt.hashSync('factory123', 8);

  const users = [
    { username: 'ceo_tariq', full_name: 'Tariq Mahmood (CEO)', email: 'ceo@zillionexports.com', phone: '+92 300 8219001', role: 'CEO', dept: 'EXECUTIVE' },
    { username: 'gm_aslam', full_name: 'Aslam Sheikh (GM)', email: 'gm@zillionexports.com', phone: '+92 300 8219002', role: 'GENERAL_MANAGER', dept: 'OPERATIONS' },
    { username: 'merch_bilal', full_name: 'Bilal Farooq (Merchandiser)', email: 'merch@zillionexports.com', phone: '+92 321 4455661', role: 'MERCHANDISER', dept: 'MERCHANDISING' },
    { username: 'store_rashid', full_name: 'Rashid Khan (Store Master)', email: 'store@zillionexports.com', phone: '+92 333 1122334', role: 'STORE_MASTER', dept: 'STORE' },
    { username: 'cutting_akram', full_name: 'Master Akram (Cutting)', email: 'cutting@zillionexports.com', phone: '+92 345 5566778', role: 'CUTTING_MASTER', dept: 'CUTTING' },
    { username: 'stitching_rafiq', full_name: 'Master Rafiq (Stitching)', email: 'stitching@zillionexports.com', phone: '+92 301 7788990', role: 'STITCHING_MASTER', dept: 'STITCHING' },
    { username: 'washing_zubair', full_name: 'Master Zubair (Washing)', email: 'washing@zillionexports.com', phone: '+92 302 9988776', role: 'WASHING_MASTER', dept: 'WASHING' },
    { username: 'finishing_imran', full_name: 'Master Imran (Finishing)', email: 'finishing@zillionexports.com', phone: '+92 303 6655443', role: 'FINISHING_MASTER', dept: 'FINISHING' },
    { username: 'qc_hamza', full_name: 'Hamza Malik (QC Lead)', email: 'qc@zillionexports.com', phone: '+92 304 3322110', role: 'QC_MASTER', dept: 'QUALITY' },
    { username: 'packing_naseem', full_name: 'Naseem Akhtar (Packing)', email: 'packing@zillionexports.com', phone: '+92 305 4433221', role: 'PACKING_MASTER', dept: 'PACKING' },
    { username: 'shipment_tahir', full_name: 'Tahir Qureshi (Export)', email: 'export@zillionexports.com', phone: '+92 306 7766554', role: 'SHIPMENT_OFFICER', dept: 'SHIPMENT' },
    { username: 'finance_salman', full_name: 'Salman Qazi (Finance)', email: 'finance@zillionexports.com', phone: '+92 307 8877665', role: 'FINANCE_OFFICER', dept: 'FINANCE' },
  ];

  for (const u of users) {
    await execute(
      `INSERT INTO users (username, password_hash, full_name, email, phone, role_code, department_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [u.username, defaultPasswordHash, u.full_name, u.email, u.phone, u.role, u.dept]
    );
  }

  // 3. Customers
  const customers = [
    { code: 'CUST-LEVI', name: "Levi Strauss Europe", country: 'Belgium', contact: 'Markus Vance', email: 'vance@levi-eu.com', phone: '+32 2 555 0192' },
    { code: 'CUST-ZARA', name: 'Zara / Inditex Group', country: 'Spain', contact: 'Elena Rodriguez', email: 'orders@inditex.es', phone: '+34 91 555 2040' },
    { code: 'CUST-DIESEL', name: 'Diesel Global S.p.A.', country: 'Italy', contact: 'Matteo Rossi', email: 'sourcing@diesel.com', phone: '+39 0424 555 800' },
  ];
  for (const c of customers) {
    await execute('INSERT INTO customers (code, name, country, contact_person, email, phone) VALUES (?, ?, ?, ?, ?, ?)', [c.code, c.name, c.country, c.contact, c.email, c.phone]);
  }

  // 4. Suppliers
  const suppliers = [
    { code: 'SUP-ALKARAM', name: 'Al-Karam Textile Mills', category: 'FABRIC', terms: 60, contact: 'Javed Iqbal', phone: '+92 21 3506 0001' },
    { code: 'SUP-NAVEENA', name: 'Naveena Denim Mills (NDM)', category: 'FABRIC', terms: 30, contact: 'Sohail Abbasi', phone: '+92 21 3505 8890' },
    { code: 'SUP-YKK', name: 'YKK Fasteners Pakistan', category: 'ACCESSORY', terms: 30, contact: 'Kamran Siddiqui', phone: '+92 21 3501 2233' },
    { code: 'SUP-COATS', name: 'Coats Pakistan Threads', category: 'ACCESSORY', terms: 90, contact: 'Shahid Mehmood', phone: '+92 21 3502 4455' },
    { code: 'SUP-PACKWELL', name: 'PackWell Corrugated Cartons', category: 'PACKAGING', terms: 30, contact: 'Irfan Haider', phone: '+92 21 3503 6677' },
  ];
  for (const s of suppliers) {
    await execute('INSERT INTO suppliers (code, name, category, payment_terms_days, contact_person, phone) VALUES (?, ?, ?, ?, ?, ?)', [s.code, s.name, s.category, s.terms, s.contact, s.phone]);
  }

  // 5. Styles, Colors & Sizes
  const styles = [
    { code: 'J-801', name: "Men's Slim Fit 12oz Denim Jeans", garment_type: 'JEANS', consumption: 1.32, smv: 17.5 },
    { code: 'J-905', name: "Men's Relaxed Tapered Indigo Jeans", garment_type: 'JEANS', consumption: 1.40, smv: 18.0 },
    { code: 'J-412', name: "Vintage Wash Classic Denim Jacket", garment_type: 'JACKET', consumption: 2.10, smv: 28.5 },
  ];
  for (const st of styles) {
    await execute('INSERT INTO styles (code, name, garment_type, standard_consumption_meters, standard_smv) VALUES (?, ?, ?, ?, ?)', [st.code, st.name, st.garment_type, st.consumption, st.smv]);
  }

  const colors = [
    { code: 'CLR-INDIGO', name: 'Dark Indigo Blue' },
    { code: 'CLR-BLACK', name: 'Deep Jet Black' },
    { code: 'CLR-LIGHTBLUE', name: 'Light Vintage Stonewash' },
  ];
  for (const clr of colors) {
    await execute('INSERT INTO colors (code, name) VALUES (?, ?)', [clr.code, clr.name]);
  }

  const sizes = [
    { label: '28', order: 1 },
    { label: '30', order: 2 },
    { label: '32', order: 3 },
    { label: '34', order: 4 },
    { label: '36', order: 5 },
    { label: '38', order: 6 },
    { label: '40', order: 7 },
  ];
  for (const sz of sizes) {
    await execute('INSERT INTO sizes (size_label, sort_order) VALUES (?, ?)', [sz.label, sz.order]);
  }

  // 6. Fabric Rolls (Tracked strictly by ROLL)
  const rolls = [
    { barcode: 'ROLL-101', supplier_id: 2, fabric: '12oz Indigo Ring Denim (NDM-12)', color: 'Dark Indigo Blue', lot: 'LOT-NDM-991', orig: 1500.0, rem: 1500.0, loc: 'RACK-A1' },
    { barcode: 'ROLL-102', supplier_id: 2, fabric: '12oz Indigo Ring Denim (NDM-12)', color: 'Dark Indigo Blue', lot: 'LOT-NDM-991', orig: 1800.0, rem: 1800.0, loc: 'RACK-A2' },
    { barcode: 'ROLL-103', supplier_id: 1, fabric: '13.5oz Raw Deep Black Denim', color: 'Deep Jet Black', lot: 'LOT-AK-440', orig: 1250.0, rem: 1250.0, loc: 'RACK-B1' },
    { barcode: 'ROLL-104', supplier_id: 1, fabric: '11.5oz Light Slub Denim', color: 'Light Vintage Stonewash', lot: 'LOT-AK-310', orig: 980.0, rem: 980.0, loc: 'RACK-C1' },
    { barcode: 'ROLL-105', supplier_id: 2, fabric: '12oz Indigo Ring Denim (NDM-12)', color: 'Dark Indigo Blue', lot: 'LOT-NDM-992', orig: 1400.0, rem: 1400.0, loc: 'RACK-A3' },
  ];
  for (const r of rolls) {
    await execute(
      `INSERT INTO fabric_rolls (roll_barcode, supplier_id, fabric_type, shade_color, lot_batch_number, original_length_meters, remaining_length_meters, warehouse_location, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')`,
      [r.barcode, r.supplier_id, r.fabric, r.color, r.lot, r.orig, r.rem, r.loc]
    );
  }

  // 7. Accessories
  const accessories = [
    { code: 'ACC-ZIP-YKK-01', name: "YKK 5# Brass Jean Zippers (18cm)", type: 'ZIPPER', spec: '18cm Antique Brass', unit: 'PCS', stock: 15000, min: 2000 },
    { code: 'ACC-BTN-RVT-01', name: 'Zillion Shank Button & Rivets Set', type: 'BUTTON', spec: 'Gunmetal 17mm', unit: 'SETS', stock: 25000, min: 3000 },
    { code: 'ACC-THRD-COATS', name: 'Coats Poly-Core Heavy Contrast Thread', type: 'THREAD', spec: 'Tex-80 Gold Brown', unit: 'CONES', stock: 350, min: 50 },
    { code: 'ACC-LBL-LEVI', name: 'Woven Care & Main Brand Labels', type: 'LABEL', spec: 'Satin Woven 45x25mm', unit: 'PCS', stock: 18000, min: 2000 },
    { code: 'ACC-CTN-EX5', name: '5-Ply Export Corrugated Master Carton', type: 'CARTON', spec: '60x40x35cm Heavy', unit: 'PCS', stock: 800, min: 100 },
  ];
  for (const a of accessories) {
    await execute(
      'INSERT INTO accessories (item_code, name, item_type, spec, unit, current_stock, min_threshold) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [a.code, a.name, a.type, a.spec, a.unit, a.stock, a.min]
    );
  }

  // 8. Orders (PO-452, PO-780, PO-910)
  const orders = [
    { po: 'PO-452', cust: 1, style: 1, color: 1, qty: 5000, price: 16.80, delivery: '2026-09-30', spec: '12oz Indigo Stretch, YKK Brass Zip, Stone Wash finish', status: 'IN_PRODUCTION' },
    { po: 'PO-780', cust: 2, style: 3, color: 3, qty: 3200, price: 28.50, delivery: '2026-10-15', spec: 'Vintage Denim Jacket, Enzyme Bleach wash, Sherpa collar prep', status: 'APPROVED' },
    { po: 'PO-910', cust: 3, style: 2, color: 2, qty: 8000, price: 17.50, delivery: '2026-11-05', spec: 'Relaxed Deep Black Denim, Overdye wash, Matte Black Hardware', status: 'PENDING_APPROVAL' },
  ];

  for (const o of orders) {
    const res = await execute(
      `INSERT INTO orders (po_number, customer_id, style_id, color_id, order_qty, unit_price, target_delivery_date, fabric_requirement_spec, status, merch_approved_by, ceo_approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 3, 1)`,
      [o.po, o.cust, o.style, o.color, o.qty, o.price, o.delivery, o.spec, o.status]
    );
    const orderId = res.lastInsertRowid;

    // Size Breakdown for orders
    if (o.po === 'PO-452') {
      const breakdown = [
        { sizeId: 1, q: 500 },
        { sizeId: 2, q: 1000 },
        { sizeId: 3, q: 1500 },
        { sizeId: 4, q: 1200 },
        { sizeId: 5, q: 500 },
        { sizeId: 6, q: 200 },
        { sizeId: 7, q: 100 },
      ];
      for (const b of breakdown) {
        await execute('INSERT INTO order_size_breakdowns (order_id, size_id, quantity) VALUES (?, ?, ?)', [orderId, b.sizeId, b.q]);
      }
    } else if (o.po === 'PO-780') {
      const breakdown = [
        { sizeId: 2, q: 600 },
        { sizeId: 3, q: 1000 },
        { sizeId: 4, q: 1000 },
        { sizeId: 5, q: 600 },
      ];
      for (const b of breakdown) {
        await execute('INSERT INTO order_size_breakdowns (order_id, size_id, quantity) VALUES (?, ?, ?)', [orderId, b.sizeId, b.q]);
      }
    } else if (o.po === 'PO-910') {
      const breakdown = [
        { sizeId: 1, q: 1000 },
        { sizeId: 2, q: 2000 },
        { sizeId: 3, q: 2500 },
        { sizeId: 4, q: 1500 },
        { sizeId: 5, q: 1000 },
      ];
      for (const b of breakdown) {
        await execute('INSERT INTO order_size_breakdowns (order_id, size_id, quantity) VALUES (?, ?, ?)', [orderId, b.sizeId, b.q]);
      }
    }
  }

  // 9. Production Masters & Master Rates
  const masters = [
    { name: 'Master Akram', dept: 'CUTTING', phone: '+92 345 5566778', user_id: 5 },
    { name: 'Master Rafiq', dept: 'STITCHING', phone: '+92 301 7788990', user_id: 6 },
    { name: 'Master Zubair', dept: 'WASHING', phone: '+92 302 9988776', user_id: 7 },
    { name: 'Master Imran', dept: 'FINISHING', phone: '+92 303 6655443', user_id: 8 },
  ];

  for (const m of masters) {
    const res = await execute(
      'INSERT INTO production_masters (name, department_code, phone, user_id) VALUES (?, ?, ?, ?)',
      [m.name, m.dept, m.phone, m.user_id]
    );
    const masterId = res.lastInsertRowid;

    if (m.dept === 'CUTTING') {
      await execute('INSERT INTO master_rates (master_id, department_code, style_id, operation_name, rate_per_piece) VALUES (?, ?, ?, ?, ?)', [masterId, 'CUTTING', 1, 'Standard Lay & Cutting', 4.50]);
      await execute('INSERT INTO master_rates (master_id, department_code, style_id, operation_name, rate_per_piece) VALUES (?, ?, ?, ?, ?)', [masterId, 'CUTTING', 3, 'Jacket Pattern Lay & Cutting', 8.00]);
    } else if (m.dept === 'STITCHING') {
      await execute('INSERT INTO master_rates (master_id, department_code, style_id, operation_name, rate_per_piece) VALUES (?, ?, ?, ?, ?)', [masterId, 'STITCHING', 1, 'Full 5-Pocket CMT Assembly', 48.00]);
      await execute('INSERT INTO master_rates (master_id, department_code, style_id, operation_name, rate_per_piece) VALUES (?, ?, ?, ?, ?)', [masterId, 'STITCHING', 3, 'Denim Jacket Assembly', 95.00]);
    } else if (m.dept === 'WASHING') {
      await execute('INSERT INTO master_rates (master_id, department_code, style_id, operation_name, rate_per_piece) VALUES (?, ?, ?, ?, ?)', [masterId, 'WASHING', 1, 'Stone Enzyme Wash & Whiskering', 26.00]);
    } else if (m.dept === 'FINISHING') {
      await execute('INSERT INTO master_rates (master_id, department_code, style_id, operation_name, rate_per_piece) VALUES (?, ?, ?, ?, ?)', [masterId, 'FINISHING', 1, 'Trimming, Pressing & Tagging', 14.00]);
    }
  }

  // 10. Supplier Invoices & Customer Receivables (Financials)
  const invoices = [
    { no: 'INV-NDM-8891', sup: 2, po: 'PO-452', amount: 32500.0, terms: 30, due: '2026-09-10', paid: 15000.0, status: 'PENDING' },
    { no: 'INV-AK-4421', sup: 1, po: 'PO-780', amount: 24800.0, terms: 60, due: '2026-09-25', paid: 0.0, status: 'PENDING' },
    { no: 'INV-YKK-3310', sup: 3, po: 'PO-452', amount: 4800.0, terms: 30, due: '2026-08-30', paid: 4800.0, status: 'PAID' },
  ];
  for (const inv of invoices) {
    await execute(
      `INSERT INTO supplier_invoices (invoice_number, supplier_id, po_reference, invoice_amount, payment_terms_days, invoice_date, due_date, paid_amount, status)
       VALUES (?, ?, ?, ?, ?, DATE('now', '-10 days'), ?, ?, ?)`,
      [inv.no, inv.sup, inv.po, inv.amount, inv.terms, inv.due, inv.paid, inv.status]
    );
  }

  const receivables = [
    { no: 'REC-LEVI-001', cust: 1, po: 'PO-452', total: 84000.0, due: '2026-10-15', rec: 25000.0, status: 'PARTIAL' },
    { no: 'REC-ZARA-002', cust: 2, po: 'PO-780', total: 91200.0, due: '2026-11-01', rec: 0.0, status: 'PENDING' },
  ];
  for (const rec of receivables) {
    await execute(
      `INSERT INTO customer_receivables (invoice_number, customer_id, po_number, total_amount, due_date, received_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rec.no, rec.cust, rec.po, rec.total, rec.due, rec.rec, rec.status]
    );
  }

  // 11. Initial Notifications
  await execute(
    `INSERT INTO notifications (recipient_user_id, recipient_role, title, message, channel, status)
     VALUES (1, 'CEO', 'System Initialized', 'Zillion Exports AI Factory Operating System is online. All departments connected.', 'IN_APP', 'UNREAD')`
  );
  await execute(
    `INSERT INTO notifications (recipient_user_id, recipient_role, title, message, channel, status)
     VALUES (5, 'CUTTING_MASTER', 'Ready for PO-452', 'Order PO-452 approved for production. You may issue fabric rolls and begin cutting.', 'IN_APP', 'UNREAD')`
  );

  // 12. Audit Log for Initialization
  await execute(
    `INSERT INTO audit_logs (user_id, user_role, action, entity_name, entity_id, reason, source)
     VALUES (1, 'CEO', 'SYSTEM_INITIALIZATION', 'SYSTEM', '1', 'Initial database seed with master garments dataset', 'SYSTEM')`
  );

  console.log('Database successfully seeded with Zillion Exports master records.');
}
