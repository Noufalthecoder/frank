import { app, BrowserWindow, ipcMain, screen, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win

const Database = require('better-sqlite3')
const dbpath = path.join(app.getPath("userData"), "billing.db")
let db = new Database(dbpath)

// Initialize Schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      shop_name TEXT NOT NULL DEFAULT 'T. S. P Enterprises',
      tagline TEXT DEFAULT 'Hardware, Tools & Fasteners',
      phone TEXT DEFAULT '+91 98765 43210',
      email TEXT DEFAULT 'tspenterprises@gmail.com',
      address_line1 TEXT DEFAULT 'Beach Road',
      address_line2 TEXT DEFAULT 'Tharuvaikulam',
      city TEXT DEFAULT 'Thoothukudi',
      pincode TEXT DEFAULT '628105',
      invoice_footer TEXT DEFAULT 'Thank you for your business! Goods once sold cannot be returned without bill.',
      logo_path TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      size TEXT,
      material TEXT,
      grade TEXT,
      finish TEXT,
      unit TEXT NOT NULL DEFAULT 'PCS',
      category TEXT NOT NULL,
      brand TEXT,
      selling_price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      quantity REAL NOT NULL DEFAULT 0,
      reorder_level REAL NOT NULL DEFAULT 10,
      bin_id TEXT,
      status TEXT NOT NULL DEFAULT 'Active'
    );

    CREATE TABLE IF NOT EXISTS racks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      zone TEXT,
      levels INTEGER NOT NULL DEFAULT 4,
      slots_per_level INTEGER NOT NULL DEFAULT 4
    );

    CREATE TABLE IF NOT EXISTS rack_bins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bin_code TEXT NOT NULL UNIQUE,
      rack_code TEXT NOT NULL,
      level_no INTEGER NOT NULL,
      slot_no INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      customer_name TEXT,
      customer_phone TEXT,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'Cash',
      items_json TEXT NOT NULL,
      items_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'Paid'
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT NOT NULL UNIQUE,
      vendor_name TEXT NOT NULL,
      order_date TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      items_json TEXT
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      city TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      payment_mode TEXT DEFAULT 'Cash'
    );

    CREATE TABLE IF NOT EXISTS day_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      closing_date TEXT NOT NULL UNIQUE,
      opening_cash REAL NOT NULL DEFAULT 0,
      total_cash_sales REAL NOT NULL DEFAULT 0,
      total_expenses REAL NOT NULL DEFAULT 0,
      system_expected_cash REAL NOT NULL,
      counted_cash REAL NOT NULL,
      difference REAL NOT NULL,
      remarks TEXT,
      closed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe schema migrations for existing DBs
  try {
    db.exec(`ALTER TABLE invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'Completed'`);
  } catch (_) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE items ADD COLUMN image_url TEXT DEFAULT ''`);
  } catch (_) {
    // Column already exists
  }

  // Ensure shop profile row exists with T. S. P Enterprises
  const profile = db.prepare('SELECT id FROM shop_profile WHERE id = 1').get();
  if (!profile) {
    db.prepare(`
      INSERT INTO shop_profile (id, shop_name, tagline, phone, email, address_line1, address_line2, city, pincode)
      VALUES (1, 'T. S. P Enterprises', 'Hardware, Tools & Fasteners', '+91 98765 43210', 'tspenterprises@gmail.com', 'Beach Road', 'Tharuvaikulam', 'Thoothukudi', '628105')
    `).run();
  } else {
    // Only migrate legacy placeholder names so user's custom Settings edits persist
    db.prepare(`
      UPDATE shop_profile 
      SET shop_name = 'T. S. P Enterprises', email = 'tspenterprises@gmail.com', address_line1 = 'Beach Road', address_line2 = 'Tharuvaikulam', city = 'Thoothukudi', pincode = '628105'
      WHERE id = 1 AND (shop_name LIKE '%StockMate%' OR shop_name LIKE '%Sekar%')
    `).run();
  }

  // Start clean with zero dummy numbers (owner can optionally load sample data in Settings -> Database)
}

function seedInitialData() {
  // Categories & Brands
  const categories = ['Fasteners', 'Tools', 'Electrical', 'Plumbing', 'Paints & Adhesives', 'Others'];
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  categories.forEach(c => insertCat.run(c));

  const brands = ['Tata Agrico', 'Bosch', 'Unbrako', 'Taparia', 'Finolex', 'Asian Paints', 'Pidilite', 'Corroshield', 'Generic'];
  const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (name) VALUES (?)');
  brands.forEach(b => insertBrand.run(b));

  // Items: 30 Realistic Hardware Products
  const sampleItems = [
    // Fasteners
    { sku: 'HB-M6-20', name: 'Hex Bolt M6 x 20mm', size: 'M6 x 20', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', price: 6.50, cost: 4.00, qty: 650, reorder: 50, bin: 'R01-L1-S1' },
    { sku: 'HB-M6-30', name: 'Hex Bolt M6 x 30mm', size: 'M6 x 30', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', price: 8.00, cost: 5.20, qty: 420, reorder: 40, bin: 'R01-L1-S2' },
    { sku: 'HB-M8-25', name: 'Hex Bolt M8 x 25mm', size: 'M8 x 25', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', price: 9.50, cost: 6.50, qty: 580, reorder: 50, bin: 'R01-L1-S3' },
    { sku: 'HB-M8-40', name: 'Hex Bolt M8 x 40mm', size: 'M8 x 40', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', price: 12.00, cost: 8.50, qty: 1240, reorder: 50, bin: 'R01-L1-S4' },
    { sku: 'HB-M10-50', name: 'Hex Bolt M10 x 50mm', size: 'M10 x 50', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', price: 18.00, cost: 12.50, qty: 842, reorder: 40, bin: 'R01-L2-S1' },
    { sku: 'HB-M12-60', name: 'Hex Bolt M12 x 60mm', size: 'M12 x 60', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', price: 26.00, cost: 18.00, qty: 310, reorder: 30, bin: 'R01-L2-S2' },
    { sku: 'HB-M16-75', name: 'Hex Bolt M16 x 75mm', size: 'M16 x 75', unit: 'PCS', category: 'Fasteners', brand: 'Tata Agrico', price: 48.00, cost: 34.00, qty: 140, reorder: 20, bin: 'R01-L2-S3' },
    { sku: 'NT-M6', name: 'Hex Nut M6', size: 'M6', unit: 'PCS', category: 'Fasteners', brand: 'Generic', price: 1.20, cost: 0.70, qty: 2800, reorder: 200, bin: 'R02-L1-S1' },
    { sku: 'NT-M8', name: 'Hex Nut M8', size: 'M8', unit: 'PCS', category: 'Fasteners', brand: 'Generic', price: 2.00, cost: 1.20, qty: 4980, reorder: 500, bin: 'R02-L1-S2' },
    { sku: 'NT-M10', name: 'Hex Nut M10', size: 'M10', unit: 'PCS', category: 'Fasteners', brand: 'Generic', price: 3.50, cost: 2.10, qty: 2100, reorder: 300, bin: 'R02-L1-S3' },
    { sku: 'NT-M12', name: 'Hex Nut M12', size: 'M12', unit: 'PCS', category: 'Fasteners', brand: 'Generic', price: 5.00, cost: 3.20, qty: 1650, reorder: 200, bin: 'R02-L1-S4' },
    { sku: 'WS-M8', name: 'Flat Washer M8', size: 'M8', unit: 'PCS', category: 'Fasteners', brand: 'Generic', price: 1.50, cost: 0.80, qty: 5320, reorder: 500, bin: 'R03-L1-S1' },
    { sku: 'WS-M10', name: 'Flat Washer M10', size: 'M10', unit: 'PCS', category: 'Fasteners', brand: 'Generic', price: 2.20, cost: 1.30, qty: 3200, reorder: 400, bin: 'R03-L1-S2' },
    { sku: 'SP-W8', name: 'Spring Washer M8', size: 'M8', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', price: 2.50, cost: 1.50, qty: 1800, reorder: 300, bin: 'R03-L2-S1' },
    { sku: 'DW-SC-15', name: 'Drywall Screw 1.5"', size: '1.5 inch', unit: 'PCS', category: 'Fasteners', brand: 'Corroshield', price: 0.85, cost: 0.45, qty: 12000, reorder: 1000, bin: 'R01-L3-S1' },
    { sku: 'SD-SC-10', name: 'Self Drilling Screw 1"', size: '1 inch', unit: 'PCS', category: 'Fasteners', brand: 'Corroshield', price: 1.40, cost: 0.80, qty: 8500, reorder: 500, bin: 'R01-L3-S2' },
    
    // Tools
    { sku: 'DB-06', name: 'SDS Plus Drill Bit 6mm', size: '6mm', unit: 'PCS', category: 'Tools', brand: 'Bosch', price: 140.00, cost: 95.00, qty: 24, reorder: 10, bin: 'R04-L1-S1' },
    { sku: 'DB-08', name: 'SDS Plus Drill Bit 8mm', size: '8mm', unit: 'PCS', category: 'Tools', brand: 'Bosch', price: 175.00, cost: 120.00, qty: 19, reorder: 10, bin: 'R04-L1-S2' },
    { sku: 'DB-10', name: 'SDS Plus Drill Bit 10mm', size: '10mm', unit: 'PCS', category: 'Tools', brand: 'Bosch', price: 220.00, cost: 160.00, qty: 118, reorder: 20, bin: 'R04-L1-S3' },
    { sku: 'DB-12', name: 'SDS Plus Drill Bit 12mm', size: '12mm', unit: 'PCS', category: 'Tools', brand: 'Bosch', price: 280.00, cost: 200.00, qty: 0, reorder: 15, bin: 'R04-L1-S4' }, // ZERO STOCK ALERT
    { sku: 'HM-500', name: 'Ball Peen Hammer 500g', size: '500g', unit: 'PCS', category: 'Tools', brand: 'Taparia', price: 280.00, cost: 210.00, qty: 45, reorder: 15, bin: 'R04-L2-S1' },
    { sku: 'HM-CLAW', name: 'Claw Hammer Wooden Handle', size: '16 oz', unit: 'PCS', category: 'Tools', brand: 'Taparia', price: 350.00, cost: 260.00, qty: 14, reorder: 5, bin: 'R04-L2-S2' },
    { sku: 'PL-08', name: 'Combination Plier 8"', size: '8 inch', unit: 'PCS', category: 'Tools', brand: 'Taparia', price: 240.00, cost: 175.00, qty: 38, reorder: 10, bin: 'R04-L2-S3' },
    { sku: 'SP-10', name: 'Adjustable Spanner 10"', size: '10 inch', unit: 'PCS', category: 'Tools', brand: 'Taparia', price: 380.00, cost: 285.00, qty: 12, reorder: 5, bin: 'R04-L2-S4' },
    { sku: 'PW-12', name: 'Heavy Duty Pipe Wrench 12"', size: '12 inch', unit: 'PCS', category: 'Tools', brand: 'Taparia', price: 520.00, cost: 390.00, qty: 8, reorder: 4, bin: 'R04-L3-S1' },
    { sku: 'SD-SET', name: 'Screwdriver Set 6pcs', size: '6 pcs set', unit: 'SET', category: 'Tools', brand: 'Taparia', price: 290.00, cost: 215.00, qty: 22, reorder: 8, bin: 'R04-L3-S2' },
    { sku: 'CD-4', name: 'Cutting Disc 4" Metal', size: '4 inch', unit: 'PCS', category: 'Tools', brand: 'Bosch', price: 40.00, cost: 26.00, qty: 320, reorder: 50, bin: 'R04-L3-S3' },
    { sku: 'GW-4', name: 'Grinding Wheel 4"', size: '4 inch', unit: 'PCS', category: 'Tools', brand: 'Bosch', price: 65.00, cost: 44.00, qty: 140, reorder: 30, bin: 'R04-L3-S4' },
    { sku: 'DBL-4', name: 'Diamond Blade 4" Concrete', size: '4 inch', unit: 'PCS', category: 'Tools', brand: 'Bosch', price: 290.00, cost: 210.00, qty: 0, reorder: 10, bin: 'R04-L4-S1' }, // ZERO STOCK ALERT
    
    // Electrical
    { sku: 'WR-15-RD', name: 'Copper House Wire 1.5 sq mm Red 90m', size: '1.5 sq mm', unit: 'BOX', category: 'Electrical', brand: 'Finolex', price: 1950.00, cost: 1620.00, qty: 18, reorder: 5, bin: 'R05-L1-S1' },
    { sku: 'WR-25-BL', name: 'Copper House Wire 2.5 sq mm Blue 90m', size: '2.5 sq mm', unit: 'BOX', category: 'Electrical', brand: 'Finolex', price: 2950.00, cost: 2480.00, qty: 12, reorder: 4, bin: 'R05-L1-S2' },
    { sku: 'SW-6A', name: 'Modular Switch 6A 1-Way', size: '6A', unit: 'PCS', category: 'Electrical', brand: 'Generic', price: 35.00, cost: 24.00, qty: 150, reorder: 30, bin: 'R05-L1-S3' },
    { sku: 'TP-INS', name: 'PVC Insulation Tape Black', size: 'Standard', unit: 'PCS', category: 'Electrical', brand: 'Generic', price: 15.00, cost: 9.50, qty: 340, reorder: 50, bin: 'R05-L2-S1' },
    
    // Plumbing
    { sku: 'PVC-1', name: 'PVC Pipe 1" Class 3 6kg', size: '1 inch', unit: 'MTR', category: 'Plumbing', brand: 'Finolex', price: 85.00, cost: 60.00, qty: 96, reorder: 30, bin: 'R02-L2-S1' },
    { sku: 'PVC-ELB-1', name: 'PVC Elbow 90 deg 1"', size: '1 inch', unit: 'PCS', category: 'Plumbing', brand: 'Finolex', price: 18.00, cost: 11.50, qty: 180, reorder: 40, bin: 'R02-L2-S2' },
    { sku: 'TF-TAPE', name: 'Teflon Thread Seal Tape 12mm', size: '12mm', unit: 'PCS', category: 'Plumbing', brand: 'Generic', price: 20.00, cost: 11.00, qty: 260, reorder: 50, bin: 'R02-L2-S3' },
    { sku: 'PVC-SOL', name: 'PVC Solvent Cement 100ml', size: '100ml', unit: 'PCS', category: 'Plumbing', brand: 'Generic', price: 65.00, cost: 45.00, qty: 42, reorder: 15, bin: 'R02-L2-S4' },

    // Paints & Adhesives
    { sku: 'FEV-1K', name: 'Fevicol SH Resin Adhesive 1kg', size: '1 kg', unit: 'PCS', category: 'Paints & Adhesives', brand: 'Pidilite', price: 240.00, cost: 190.00, qty: 25, reorder: 8, bin: 'R02-L3-S1' },
    { sku: 'MSEAL-100', name: 'M-Seal Epoxy Compound 100g', size: '100g', unit: 'PCS', category: 'Paints & Adhesives', brand: 'Pidilite', price: 25.00, cost: 17.50, qty: 85, reorder: 20, bin: 'R02-L3-S2' },
    { sku: 'PNT-RO-1L', name: 'Red Oxide Metal Primer 1 Litre', size: '1 Litre', unit: 'PCS', category: 'Paints & Adhesives', brand: 'Asian Paints', price: 190.00, cost: 145.00, qty: 16, reorder: 5, bin: 'R02-L3-S3' },
    { sku: 'PBR-3', name: 'Flat Paint Brush 3"', size: '3 inch', unit: 'PCS', category: 'Paints & Adhesives', brand: 'Generic', price: 55.00, cost: 36.00, qty: 0, reorder: 10, bin: 'R02-L3-S4' } // ZERO STOCK ALERT
  ];

  const insertItem = db.prepare(`
    INSERT OR REPLACE INTO items (sku, name, size, unit, category, brand, selling_price, cost_price, quantity, reorder_level, bin_id, status)
    VALUES (@sku, @name, @size, @unit, @category, @brand, @price, @cost, @qty, @reorder, @bin, 'Active')
  `);
  sampleItems.forEach(i => insertItem.run(i));

  // Racks & Bins
  const sampleRacks = [
    { code: 'R01', name: 'Fasteners', zone: 'Fasteners', binsCount: 24 },
    { code: 'R02', name: 'Bolts & Nuts', zone: 'Fasteners', binsCount: 12 },
    { code: 'R03', name: 'Washers', zone: 'Fasteners', binsCount: 12 },
    { code: 'R04', name: 'Tools', zone: 'Hardware', binsCount: 16 },
    { code: 'R05', name: 'Electrical', zone: 'Electrical', binsCount: 20 },
  ];
  const insertRack = db.prepare('INSERT OR IGNORE INTO racks (code, name, zone, levels, slots_per_level) VALUES (?, ?, ?, 4, 4)');
  const insertBin = db.prepare('INSERT OR IGNORE INTO rack_bins (bin_code, rack_code, level_no, slot_no, quantity) VALUES (?, ?, ?, ?, ?)');

  sampleRacks.forEach(r => {
    insertRack.run(r.code, r.name, r.zone);
    for (let l = 1; l <= 4; l++) {
      for (let s = 1; s <= 4; s++) {
        const binCode = `${r.code}-L${l}-S${s}`;
        insertBin.run(binCode, r.code, l, s, 0);
      }
    }
  });

  // Recent Invoices (with realistic dates around today)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];
  const sampleInvoices = [
    {
      num: 'INV-001248', date: `${today} 11:24:00`, cust: 'Raj Builders', count: 2, sub: 1240, disc: 0, total: 1240, mode: 'UPI',
      items: [
        { sku: 'HB-M8-40', name: 'Hex Bolt M8 x 40mm', quantity: 50, rate: 12, discount: 0, total: 600 },
        { sku: 'DB-10', name: 'SDS Plus Drill Bit 10mm', quantity: 3, rate: 213.33, discount: 0, total: 640 },
      ]
    },
    {
      num: 'INV-001247', date: `${today} 10:56:00`, cust: 'Sree Constructions', count: 2, sub: 2500, disc: 40, total: 2460, mode: 'Cash',
      items: [
        { sku: 'WR-15-RD', name: 'Copper House Wire 1.5 sq mm Red 90m', quantity: 1, rate: 1950, discount: 0, total: 1950 },
        { sku: 'HM-500', name: 'Ball Peen Hammer 500g', quantity: 2, rate: 275, discount: 40, total: 510 },
      ]
    },
    {
      num: 'INV-001246', date: `${yesterday} 17:41:00`, cust: 'KPN Interiors', count: 2, sub: 940, disc: 0, total: 940, mode: 'Card',
      items: [
        { sku: 'FEV-1K', name: 'Fevicol SH Resin Adhesive 1kg', quantity: 3, rate: 240, discount: 0, total: 720 },
        { sku: 'DB-10', name: 'SDS Plus Drill Bit 10mm', quantity: 1, rate: 220, discount: 0, total: 220 },
      ]
    },
    {
      num: 'INV-001245', date: `${yesterday} 15:17:00`, cust: 'Sunil Traders', count: 2, sub: 1900, disc: 20, total: 1880, mode: 'Cash',
      items: [
        { sku: 'PVC-1', name: 'PVC Pipe 1" Class 3 6kg', quantity: 20, rate: 85, discount: 20, total: 1680 },
        { sku: 'TF-TAPE', name: 'Teflon Thread Seal Tape 12mm', quantity: 10, rate: 20, discount: 0, total: 200 },
      ]
    },
    {
      num: 'INV-001244', date: `${twoDaysAgo} 11:02:00`, cust: 'Apex Enterprises', count: 2, sub: 760, disc: 0, total: 760, mode: 'UPI',
      items: [
        { sku: 'SP-10', name: 'Adjustable Spanner 10"', quantity: 2, rate: 380, discount: 0, total: 760 },
      ]
    },
  ];
  const insertInvoice = db.prepare(`
    INSERT OR IGNORE INTO invoices (invoice_number, date_time, customer_name, subtotal, discount, total, payment_mode, items_count, items_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
  `);
  sampleInvoices.forEach(inv => {
    insertInvoice.run(inv.num, inv.date, inv.cust, inv.sub, inv.disc, inv.total, inv.mode, inv.count, JSON.stringify(inv.items));
  });

  // Purchase Orders
  const samplePOs = [
    { num: 'PO-00284', vendor: 'KPR Fasteners', date: today, amount: 48500.00, status: 'Open', items: [{ sku: 'DB-12', name: 'SDS Plus Drill Bit 12mm', quantity: 50, rate: 200 }] },
    { num: 'PO-00283', vendor: 'Metro Tools Co.', date: yesterday, amount: 72000.00, status: 'Received', items: [] },
    { num: 'PO-00282', vendor: 'Shree Metals', date: twoDaysAgo, amount: 124000.00, status: 'Received', items: [] },
    { num: 'PO-00281', vendor: 'Nice Hardware', date: twoDaysAgo, amount: 36750.00, status: 'Closed', items: [] },
    { num: 'PO-00280', vendor: 'A1 Tools Distributors', date: twoDaysAgo, amount: 58200.00, status: 'Closed', items: [] }
  ];
  const insertPO = db.prepare('INSERT OR IGNORE INTO purchase_orders (po_number, vendor_name, order_date, amount, status, items_json) VALUES (?, ?, ?, ?, ?, ?)');
  samplePOs.forEach(p => insertPO.run(p.num, p.vendor, p.date, p.amount, p.status, JSON.stringify(p.items)));

  // Vendors
  const existingVendors = db.prepare('SELECT count(*) as count FROM vendors').get().count;
  if (existingVendors === 0) {
    const sampleVendors = [
      { name: 'KPR Fasteners', person: 'K. Ramesh', phone: '+91 94441 23456', city: 'Coimbatore' },
      { name: 'Metro Tools Co.', person: 'S. Kumar', phone: '+91 98840 54321', city: 'Chennai' },
      { name: 'Shree Metals', person: 'Anand Patel', phone: '+91 97123 45678', city: 'Ahmedabad' },
      { name: 'Nice Hardware', person: 'V. Naresh', phone: '+91 99401 11223', city: 'Madurai' },
      { name: 'A1 Tools Distributors', person: 'Mohan Lal', phone: '+91 98200 99887', city: 'Mumbai' }
    ];
    const insertVendor = db.prepare('INSERT INTO vendors (name, contact_person, phone, city) VALUES (?, ?, ?, ?)');
    sampleVendors.forEach(v => insertVendor.run(v.name, v.person, v.phone, v.city));
  }

  // Expenses
  const existingExp = db.prepare('SELECT count(*) as count FROM expenses').get().count;
  if (existingExp === 0) {
    const sampleExpenses = [
      { cat: 'Shop Rent', desc: 'Monthly godown & shop lease', amount: 15000, date: twoDaysAgo, mode: 'Bank' },
      { cat: 'Electricity', desc: 'TNEB commercial bill', amount: 4200, date: yesterday, mode: 'UPI' },
      { cat: 'Transport', desc: 'Freight delivery & tempo', amount: 1200, date: today, mode: 'Cash' },
      { cat: 'Others', desc: 'Tea, stationery, packing tape', amount: 450, date: today, mode: 'Cash' },
    ];
    const insertExpense = db.prepare('INSERT INTO expenses (category, description, amount, date, payment_mode) VALUES (?, ?, ?, ?, ?)');
    sampleExpenses.forEach(e => insertExpense.run(e.cat, e.desc, e.amount, e.date, e.mode));
  }
}

initSchema();

// IPC Handlers: Shop Profile
ipcMain.handle('getShopProfile', () => {
  return db.prepare('SELECT * FROM shop_profile WHERE id = 1').get();
});

ipcMain.handle('updateShopProfile', (event, profile) => {
  const stmt = db.prepare(`
    UPDATE shop_profile
    SET shop_name = @shop_name, tagline = @tagline, phone = @phone, email = @email,
        address_line1 = @address_line1, address_line2 = @address_line2, city = @city, pincode = @pincode,
        invoice_footer = @invoice_footer, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);
  stmt.run(profile);
  return { success: true };
});

// IPC Handlers: Items & Catalog
ipcMain.handle('getItems', () => {
  return db.prepare('SELECT * FROM items ORDER BY id DESC').all();
});

ipcMain.handle('searchItems', (event, query) => {
  const q = `%${query}%`;
  return db.prepare(`
    SELECT * FROM items 
    WHERE sku LIKE ? OR name LIKE ? OR size LIKE ? OR category LIKE ?
    ORDER BY name ASC
  `).all(q, q, q, q);
});

ipcMain.handle('addItem', (event, item) => {
  try {
    const normalizedSku = String(item.sku || '').trim().toUpperCase();
    if (!normalizedSku) return { success: false, error: 'SKU is required.' };
    const stmt = db.prepare(`
      INSERT INTO items (sku, name, size, unit, category, brand, selling_price, cost_price, quantity, reorder_level, bin_id, image_url, status)
      VALUES (@sku, @name, @size, @unit, @category, @brand, @selling_price, @cost_price, @quantity, @reorder_level, @bin_id, @image_url, 'Active')
    `);
    const res = stmt.run({
      ...item,
      sku: normalizedSku,
      name: String(item.name || '').trim(),
      bin_id: String(item.bin_id || '').trim().toUpperCase(),
      image_url: String(item.image_url || '').trim(),
    });
    return { success: true, id: Number(res.lastInsertRowid) };
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE')) {
      return { success: false, error: `SKU "${String(item.sku || '').trim().toUpperCase()}" already exists. Use a unique SKU or edit the existing product.` };
    }
    return { success: false, error: err.message || 'Failed to add product.' };
  }
});

ipcMain.handle('updateItem', (event, item) => {
  try {
    const normalizedSku = String(item.sku || '').trim().toUpperCase();
    const stmt = db.prepare(`
      UPDATE items 
      SET sku = @sku, name = @name, size = @size, unit = @unit, category = @category, brand = @brand,
          selling_price = @selling_price, cost_price = @cost_price, quantity = @quantity,
          reorder_level = @reorder_level, bin_id = @bin_id, image_url = @image_url, status = @status
      WHERE id = @id
    `);
    stmt.run({
      ...item,
      sku: normalizedSku,
      name: String(item.name || '').trim(),
      bin_id: String(item.bin_id || '').trim().toUpperCase(),
      image_url: String(item.image_url || '').trim(),
    });
    return { success: true };
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE')) {
      return { success: false, error: `Another product already uses SKU "${String(item.sku || '').trim().toUpperCase()}".` };
    }
    return { success: false, error: err.message || 'Failed to update product.' };
  }
});

ipcMain.handle('deleteItem', (event, id) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  return { success: true };
});

// IPC Handlers: Racks & Bins
ipcMain.handle('getRacks', () => {
  const racks = db.prepare('SELECT * FROM racks ORDER BY code ASC').all();
  const allItems = db.prepare('SELECT id, sku, name, quantity, unit, bin_id FROM items').all();
  return racks.map(r => {
    const bins = db.prepare('SELECT * FROM rack_bins WHERE rack_code = ? ORDER BY level_no, slot_no').all(r.code);
    const enrichedBins = bins.map(b => {
      const binItems = allItems.filter(i => (i.bin_id || '').toUpperCase() === b.bin_code.toUpperCase());
      const liveQty = binItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
      return { ...b, quantity: liveQty, items: binItems };
    });
    return { ...r, binsCount: enrichedBins.length, bins: enrichedBins };
  });
});

ipcMain.handle('addRack', (event, rack) => {
  try {
    const code = String(rack.code || '').trim().toUpperCase();
    const name = String(rack.name || '').trim();
    if (!code || !name) {
      return { success: false, error: 'Rack code and name are required.' };
    }
    const levels = Math.min(10, Math.max(1, parseInt(rack.levels) || 4));
    const slots = Math.min(10, Math.max(1, parseInt(rack.slots_per_level) || 4));
    const stmt = db.prepare('INSERT INTO racks (code, name, zone, levels, slots_per_level) VALUES (@code, @name, @zone, @levels, @slots_per_level)');
    stmt.run({
      code,
      name,
      zone: String(rack.zone || 'General').trim(),
      levels,
      slots_per_level: slots,
    });
    const insertBin = db.prepare('INSERT OR IGNORE INTO rack_bins (bin_code, rack_code, level_no, slot_no, quantity) VALUES (?, ?, ?, ?, 0)');
    for (let l = 1; l <= levels; l++) {
      for (let s = 1; s <= slots; s++) {
        insertBin.run(`${code}-L${l}-S${s}`, code, l, s);
      }
    }
    return { success: true, code };
  } catch (err) {
    if (String(err.message || '').includes('UNIQUE')) {
      return { success: false, error: `Rack code "${String(rack.code || '').trim().toUpperCase()}" already exists. Choose a unique code (e.g. R06).` };
    }
    return { success: false, error: err.message || 'Failed to create rack.' };
  }
});

ipcMain.handle('deleteRack', (event, code) => {
  db.prepare('DELETE FROM rack_bins WHERE rack_code = ?').run(code);
  db.prepare('DELETE FROM racks WHERE code = ?').run(code);
  return { success: true };
});

ipcMain.handle('bulkImportItems', (event, itemsList) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO items (sku, name, size, unit, category, brand, selling_price, cost_price, quantity, reorder_level, bin_id, image_url, status)
      VALUES (@sku, @name, @size, @unit, @category, @brand, @selling_price, @cost_price, @quantity, @reorder_level, @bin_id, @image_url, 'Active')
      ON CONFLICT(sku) DO UPDATE SET
        name = excluded.name,
        size = excluded.size,
        unit = excluded.unit,
        category = excluded.category,
        brand = excluded.brand,
        selling_price = excluded.selling_price,
        cost_price = excluded.cost_price,
        quantity = excluded.quantity,
        reorder_level = excluded.reorder_level,
        bin_id = excluded.bin_id,
        image_url = CASE WHEN excluded.image_url != '' THEN excluded.image_url ELSE items.image_url END
    `);
    const insertMany = db.transaction((rows) => {
      let imported = 0;
      for (const row of rows) {
        const sku = String(row.sku || '').trim().toUpperCase();
        const name = String(row.name || '').trim();
        if (!sku || !name) continue;
        stmt.run({
          sku,
          name,
          size: String(row.size || '').trim(),
          unit: String(row.unit || 'PCS').trim().toUpperCase(),
          category: String(row.category || 'Others').trim(),
          brand: String(row.brand || 'Generic').trim(),
          selling_price: parseFloat(row.selling_price) || 0,
          cost_price: parseFloat(row.cost_price) || 0,
          quantity: parseFloat(row.quantity) || 0,
          reorder_level: parseFloat(row.reorder_level) || 10,
          bin_id: String(row.bin_id || '').trim().toUpperCase(),
          image_url: String(row.image_url || '').trim(),
        });
        imported++;
      }
      return imported;
    });
    const count = insertMany(itemsList || []);
    return { success: true, count };
  } catch (err) {
    return { success: false, error: err.message || 'CSV import failed.' };
  }
});

// IPC Handlers: Invoices & POS
ipcMain.handle('getInvoices', () => {
  return db.prepare('SELECT * FROM invoices ORDER BY id DESC').all();
});

ipcMain.handle('createInvoice', (event, inv) => {
  const genNum = `INV-${String(Math.floor(100000 + Math.random() * 900000))}`;
  const invNumber = inv.invoice_number || genNum;
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const insert = db.prepare(`
    INSERT INTO invoices (invoice_number, date_time, customer_name, customer_phone, subtotal, discount, total, payment_mode, items_count, items_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
  `);

  const res = insert.run(
    invNumber,
    nowStr,
    inv.customer_name || 'Walk-in Customer',
    inv.customer_phone || '',
    inv.subtotal,
    inv.discount || 0,
    inv.total,
    inv.payment_mode || 'Cash',
    inv.items.length,
    JSON.stringify(inv.items)
  );

  // Deduct stock for each item & identify items that went to zero
  const updateStock = db.prepare('UPDATE items SET quantity = MAX(0, quantity - ?) WHERE sku = ? OR id = ?');
  const checkStock = db.prepare('SELECT id, sku, name, quantity FROM items WHERE (sku = ? OR id = ?)');

  const zeroStockAlerts = [];
  inv.items.forEach(item => {
    updateStock.run(item.quantity, item.sku || '', item.id || 0);
    const updated = checkStock.get(item.sku || '', item.id || 0);
    if (updated && updated.quantity <= 0) {
      zeroStockAlerts.push(updated);
    }
  });

  return { success: true, id: Number(res.lastInsertRowid), invoice_number: invNumber, zeroStockAlerts };
});

ipcMain.handle('returnInvoice', (event, id) => {
  try {
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!inv) return { success: false, error: 'Invoice not found.' };
    if (inv.status === 'Returned') return { success: false, error: 'Invoice was already returned.' };

    const items = JSON.parse(inv.items_json || '[]');
    const restock = db.prepare('UPDATE items SET quantity = quantity + ? WHERE sku = ? OR id = ?');
    const tx = db.transaction(() => {
      items.forEach(item => {
        restock.run(Number(item.quantity) || 0, item.sku || '', item.id || 0);
      });
      db.prepare(`UPDATE invoices SET status = 'Returned' WHERE id = ?`).run(id);
    });
    tx();
    return { success: true, restockedCount: items.length };
  } catch (err) {
    return { success: false, error: err.message || 'Return failed.' };
  }
});

ipcMain.handle('getOutOfStockItems', () => {
  return db.prepare('SELECT * FROM items WHERE quantity <= 0 ORDER BY name ASC').all();
});

// IPC Handlers: Procurement & Vendors
ipcMain.handle('getPurchaseOrders', () => {
  return db.prepare('SELECT * FROM purchase_orders ORDER BY id DESC').all();
});

ipcMain.handle('createPurchaseOrder', (event, po) => {
  const genNum = `PO-${String(Math.floor(10000 + Math.random() * 90000))}`;
  const stmt = db.prepare(`
    INSERT INTO purchase_orders (po_number, vendor_name, order_date, amount, status, items_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(po.po_number || genNum, po.vendor_name, po.order_date, po.amount, po.status || 'Open', JSON.stringify(po.items || []));
  return { success: true };
});

ipcMain.handle('updatePurchaseOrderStatus', (event, { id, status }) => {
  try {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!po) return { success: false, error: 'PO not found.' };
    const prevStatus = po.status;

    const tx = db.transaction(() => {
      db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run(status, id);
      // If marking Open -> Received, automatically restock PO items into inventory
      if (prevStatus !== 'Received' && status === 'Received') {
        const items = JSON.parse(po.items_json || '[]');
        const addStock = db.prepare('UPDATE items SET quantity = quantity + ? WHERE sku = ?');
        items.forEach(i => {
          if (i.sku && Number(i.quantity) > 0) {
            addStock.run(Number(i.quantity), i.sku);
          }
        });
      }
    });
    tx();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('deletePurchaseOrder', (event, id) => {
  db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('getVendors', () => {
  return db.prepare('SELECT * FROM vendors ORDER BY name ASC').all();
});

ipcMain.handle('addVendor', (event, vendor) => {
  const stmt = db.prepare('INSERT INTO vendors (name, contact_person, phone, email, city) VALUES (@name, @contact_person, @phone, @email, @city)');
  stmt.run({
    name: vendor.name || '',
    contact_person: vendor.contact_person || '',
    phone: vendor.phone || '',
    email: vendor.email || '',
    city: vendor.city || '',
  });
  return { success: true };
});

ipcMain.handle('deleteVendor', (event, id) => {
  db.prepare('DELETE FROM vendors WHERE id = ?').run(id);
  return { success: true };
});

// IPC Handlers: Expenses & Finance
ipcMain.handle('getExpenses', () => {
  return db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all();
});

ipcMain.handle('addExpense', (event, exp) => {
  const stmt = db.prepare('INSERT INTO expenses (category, description, amount, date, payment_mode) VALUES (@category, @description, @amount, @date, @payment_mode)');
  stmt.run(exp);
  return { success: true };
});

ipcMain.handle('deleteExpense', (event, id) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return { success: true };
});

ipcMain.handle('getDayClosings', () => {
  return db.prepare('SELECT * FROM day_closings ORDER BY closing_date DESC').all();
});

ipcMain.handle('recordDayClosing', (event, dc) => {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO day_closings (closing_date, opening_cash, total_cash_sales, total_expenses, system_expected_cash, counted_cash, difference, remarks)
    VALUES (@closing_date, @opening_cash, @total_cash_sales, @total_expenses, @system_expected_cash, @counted_cash, @difference, @remarks)
  `);
  stmt.run(dc);
  return { success: true };
});

// IPC Handlers: Database Management
ipcMain.handle('getDatabasePath', () => dbpath);

ipcMain.handle('backupDatabase', async () => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Backup T. S. P Enterprises Database',
    defaultPath: `tsp_enterprises_backup_${new Date().toISOString().split('T')[0]}.db`,
    filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }]
  });
  if (filePath) {
    // Use SQLite online backup API for clean consistent snapshot
    await db.backup(filePath);
    return { success: true, path: filePath };
  }
  return { success: false };
});

ipcMain.handle('restoreDatabase', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Restore Database Backup (.db)',
    filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || filePaths.length === 0) {
    return { success: false };
  }
  try {
    const sourcePath = filePaths[0];
    // Safety copy of current db before replacing
    const safetyBackup = `${dbpath}.pre_restore.bak`;
    try { fs.copyFileSync(dbpath, safetyBackup); } catch (_) {}

    db.close();
    fs.copyFileSync(sourcePath, dbpath);
    db = new Database(dbpath);
    initSchema();
    return { success: true, path: sourcePath };
  } catch (err) {
    try { db = new Database(dbpath); } catch (_) {}
    return { success: false, error: err.message || 'Restore failed.' };
  }
});

ipcMain.handle('seedDemoData', () => {
  seedInitialData();
  return { success: true };
});

ipcMain.handle('resetDatabase', () => {
  const tx = db.transaction(() => {
    db.exec(`
      DELETE FROM items;
      DELETE FROM racks;
      DELETE FROM rack_bins;
      DELETE FROM invoices;
      DELETE FROM purchase_orders;
      DELETE FROM vendors;
      DELETE FROM expenses;
      DELETE FROM day_closings;
    `);
  });
  tx();
  return { success: true };
});

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 700,
    title: "T. S. P Enterprises - Inventory & Billing",
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
