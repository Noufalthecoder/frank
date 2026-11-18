import { app as _, ipcMain as n, dialog as b, BrowserWindow as O, screen as v } from "electron";
import { createRequire as q } from "node:module";
import { fileURLToPath as x } from "node:url";
import S from "node:path";
import y from "node:fs";
const B = q(import.meta.url), I = S.dirname(x(import.meta.url));
process.env.APP_ROOT = S.join(I, "..");
const h = process.env.VITE_DEV_SERVER_URL, Y = S.join(process.env.APP_ROOT, "dist-electron"), U = S.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = h ? S.join(process.env.APP_ROOT, "public") : U;
let N;
const g = B("better-sqlite3"), L = S.join(_.getPath("userData"), "billing.db");
let t = new g(L);
function A() {
  t.exec(`
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
  try {
    t.exec("ALTER TABLE invoices ADD COLUMN status TEXT NOT NULL DEFAULT 'Completed'");
  } catch {
  }
  try {
    t.exec("ALTER TABLE items ADD COLUMN image_url TEXT DEFAULT ''");
  } catch {
  }
  t.prepare("SELECT id FROM shop_profile WHERE id = 1").get() ? t.prepare(`
      UPDATE shop_profile 
      SET shop_name = 'T. S. P Enterprises', email = 'tspenterprises@gmail.com', address_line1 = 'Beach Road', address_line2 = 'Tharuvaikulam', city = 'Thoothukudi', pincode = '628105'
      WHERE id = 1 AND (shop_name LIKE '%StockMate%' OR shop_name LIKE '%Sekar%')
    `).run() : t.prepare(`
      INSERT INTO shop_profile (id, shop_name, tagline, phone, email, address_line1, address_line2, city, pincode)
      VALUES (1, 'T. S. P Enterprises', 'Hardware, Tools & Fasteners', '+91 98765 43210', 'tspenterprises@gmail.com', 'Beach Road', 'Tharuvaikulam', 'Thoothukudi', '628105')
    `).run();
  const e = t.prepare("SELECT count(*) as count FROM items").get().count;
  h && e === 0 && C();
}
function C() {
  const a = ["Fasteners", "Tools", "Electrical", "Plumbing", "Paints & Adhesives", "Others"], e = t.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  a.forEach((s) => e.run(s));
  const r = ["Tata Agrico", "Bosch", "Unbrako", "Taparia", "Finolex", "Asian Paints", "Pidilite", "Corroshield", "Generic"], i = t.prepare("INSERT OR IGNORE INTO brands (name) VALUES (?)");
  r.forEach((s) => i.run(s));
  const d = [
    // Fasteners
    { sku: "HB-M6-20", name: "Hex Bolt M6 x 20mm", size: "M6 x 20", unit: "PCS", category: "Fasteners", brand: "Unbrako", price: 6.5, cost: 4, qty: 650, reorder: 50, bin: "R01-L1-S1" },
    { sku: "HB-M6-30", name: "Hex Bolt M6 x 30mm", size: "M6 x 30", unit: "PCS", category: "Fasteners", brand: "Unbrako", price: 8, cost: 5.2, qty: 420, reorder: 40, bin: "R01-L1-S2" },
    { sku: "HB-M8-25", name: "Hex Bolt M8 x 25mm", size: "M8 x 25", unit: "PCS", category: "Fasteners", brand: "Unbrako", price: 9.5, cost: 6.5, qty: 580, reorder: 50, bin: "R01-L1-S3" },
    { sku: "HB-M8-40", name: "Hex Bolt M8 x 40mm", size: "M8 x 40", unit: "PCS", category: "Fasteners", brand: "Unbrako", price: 12, cost: 8.5, qty: 1240, reorder: 50, bin: "R01-L1-S4" },
    { sku: "HB-M10-50", name: "Hex Bolt M10 x 50mm", size: "M10 x 50", unit: "PCS", category: "Fasteners", brand: "Unbrako", price: 18, cost: 12.5, qty: 842, reorder: 40, bin: "R01-L2-S1" },
    { sku: "HB-M12-60", name: "Hex Bolt M12 x 60mm", size: "M12 x 60", unit: "PCS", category: "Fasteners", brand: "Unbrako", price: 26, cost: 18, qty: 310, reorder: 30, bin: "R01-L2-S2" },
    { sku: "HB-M16-75", name: "Hex Bolt M16 x 75mm", size: "M16 x 75", unit: "PCS", category: "Fasteners", brand: "Tata Agrico", price: 48, cost: 34, qty: 140, reorder: 20, bin: "R01-L2-S3" },
    { sku: "NT-M6", name: "Hex Nut M6", size: "M6", unit: "PCS", category: "Fasteners", brand: "Generic", price: 1.2, cost: 0.7, qty: 2800, reorder: 200, bin: "R02-L1-S1" },
    { sku: "NT-M8", name: "Hex Nut M8", size: "M8", unit: "PCS", category: "Fasteners", brand: "Generic", price: 2, cost: 1.2, qty: 4980, reorder: 500, bin: "R02-L1-S2" },
    { sku: "NT-M10", name: "Hex Nut M10", size: "M10", unit: "PCS", category: "Fasteners", brand: "Generic", price: 3.5, cost: 2.1, qty: 2100, reorder: 300, bin: "R02-L1-S3" },
    { sku: "NT-M12", name: "Hex Nut M12", size: "M12", unit: "PCS", category: "Fasteners", brand: "Generic", price: 5, cost: 3.2, qty: 1650, reorder: 200, bin: "R02-L1-S4" },
    { sku: "WS-M8", name: "Flat Washer M8", size: "M8", unit: "PCS", category: "Fasteners", brand: "Generic", price: 1.5, cost: 0.8, qty: 5320, reorder: 500, bin: "R03-L1-S1" },
    { sku: "WS-M10", name: "Flat Washer M10", size: "M10", unit: "PCS", category: "Fasteners", brand: "Generic", price: 2.2, cost: 1.3, qty: 3200, reorder: 400, bin: "R03-L1-S2" },
    { sku: "SP-W8", name: "Spring Washer M8", size: "M8", unit: "PCS", category: "Fasteners", brand: "Unbrako", price: 2.5, cost: 1.5, qty: 1800, reorder: 300, bin: "R03-L2-S1" },
    { sku: "DW-SC-15", name: 'Drywall Screw 1.5"', size: "1.5 inch", unit: "PCS", category: "Fasteners", brand: "Corroshield", price: 0.85, cost: 0.45, qty: 12e3, reorder: 1e3, bin: "R01-L3-S1" },
    { sku: "SD-SC-10", name: 'Self Drilling Screw 1"', size: "1 inch", unit: "PCS", category: "Fasteners", brand: "Corroshield", price: 1.4, cost: 0.8, qty: 8500, reorder: 500, bin: "R01-L3-S2" },
    // Tools
    { sku: "DB-06", name: "SDS Plus Drill Bit 6mm", size: "6mm", unit: "PCS", category: "Tools", brand: "Bosch", price: 140, cost: 95, qty: 24, reorder: 10, bin: "R04-L1-S1" },
    { sku: "DB-08", name: "SDS Plus Drill Bit 8mm", size: "8mm", unit: "PCS", category: "Tools", brand: "Bosch", price: 175, cost: 120, qty: 19, reorder: 10, bin: "R04-L1-S2" },
    { sku: "DB-10", name: "SDS Plus Drill Bit 10mm", size: "10mm", unit: "PCS", category: "Tools", brand: "Bosch", price: 220, cost: 160, qty: 118, reorder: 20, bin: "R04-L1-S3" },
    { sku: "DB-12", name: "SDS Plus Drill Bit 12mm", size: "12mm", unit: "PCS", category: "Tools", brand: "Bosch", price: 280, cost: 200, qty: 0, reorder: 15, bin: "R04-L1-S4" },
    // ZERO STOCK ALERT
    { sku: "HM-500", name: "Ball Peen Hammer 500g", size: "500g", unit: "PCS", category: "Tools", brand: "Taparia", price: 280, cost: 210, qty: 45, reorder: 15, bin: "R04-L2-S1" },
    { sku: "HM-CLAW", name: "Claw Hammer Wooden Handle", size: "16 oz", unit: "PCS", category: "Tools", brand: "Taparia", price: 350, cost: 260, qty: 14, reorder: 5, bin: "R04-L2-S2" },
    { sku: "PL-08", name: 'Combination Plier 8"', size: "8 inch", unit: "PCS", category: "Tools", brand: "Taparia", price: 240, cost: 175, qty: 38, reorder: 10, bin: "R04-L2-S3" },
    { sku: "SP-10", name: 'Adjustable Spanner 10"', size: "10 inch", unit: "PCS", category: "Tools", brand: "Taparia", price: 380, cost: 285, qty: 12, reorder: 5, bin: "R04-L2-S4" },
    { sku: "PW-12", name: 'Heavy Duty Pipe Wrench 12"', size: "12 inch", unit: "PCS", category: "Tools", brand: "Taparia", price: 520, cost: 390, qty: 8, reorder: 4, bin: "R04-L3-S1" },
    { sku: "SD-SET", name: "Screwdriver Set 6pcs", size: "6 pcs set", unit: "SET", category: "Tools", brand: "Taparia", price: 290, cost: 215, qty: 22, reorder: 8, bin: "R04-L3-S2" },
    { sku: "CD-4", name: 'Cutting Disc 4" Metal', size: "4 inch", unit: "PCS", category: "Tools", brand: "Bosch", price: 40, cost: 26, qty: 320, reorder: 50, bin: "R04-L3-S3" },
    { sku: "GW-4", name: 'Grinding Wheel 4"', size: "4 inch", unit: "PCS", category: "Tools", brand: "Bosch", price: 65, cost: 44, qty: 140, reorder: 30, bin: "R04-L3-S4" },
    { sku: "DBL-4", name: 'Diamond Blade 4" Concrete', size: "4 inch", unit: "PCS", category: "Tools", brand: "Bosch", price: 290, cost: 210, qty: 0, reorder: 10, bin: "R04-L4-S1" },
    // ZERO STOCK ALERT
    // Electrical
    { sku: "WR-15-RD", name: "Copper House Wire 1.5 sq mm Red 90m", size: "1.5 sq mm", unit: "BOX", category: "Electrical", brand: "Finolex", price: 1950, cost: 1620, qty: 18, reorder: 5, bin: "R05-L1-S1" },
    { sku: "WR-25-BL", name: "Copper House Wire 2.5 sq mm Blue 90m", size: "2.5 sq mm", unit: "BOX", category: "Electrical", brand: "Finolex", price: 2950, cost: 2480, qty: 12, reorder: 4, bin: "R05-L1-S2" },
    { sku: "SW-6A", name: "Modular Switch 6A 1-Way", size: "6A", unit: "PCS", category: "Electrical", brand: "Generic", price: 35, cost: 24, qty: 150, reorder: 30, bin: "R05-L1-S3" },
    { sku: "TP-INS", name: "PVC Insulation Tape Black", size: "Standard", unit: "PCS", category: "Electrical", brand: "Generic", price: 15, cost: 9.5, qty: 340, reorder: 50, bin: "R05-L2-S1" },
    // Plumbing
    { sku: "PVC-1", name: 'PVC Pipe 1" Class 3 6kg', size: "1 inch", unit: "MTR", category: "Plumbing", brand: "Finolex", price: 85, cost: 60, qty: 96, reorder: 30, bin: "R02-L2-S1" },
    { sku: "PVC-ELB-1", name: 'PVC Elbow 90 deg 1"', size: "1 inch", unit: "PCS", category: "Plumbing", brand: "Finolex", price: 18, cost: 11.5, qty: 180, reorder: 40, bin: "R02-L2-S2" },
    { sku: "TF-TAPE", name: "Teflon Thread Seal Tape 12mm", size: "12mm", unit: "PCS", category: "Plumbing", brand: "Generic", price: 20, cost: 11, qty: 260, reorder: 50, bin: "R02-L2-S3" },
    { sku: "PVC-SOL", name: "PVC Solvent Cement 100ml", size: "100ml", unit: "PCS", category: "Plumbing", brand: "Generic", price: 65, cost: 45, qty: 42, reorder: 15, bin: "R02-L2-S4" },
    // Paints & Adhesives
    { sku: "FEV-1K", name: "Fevicol SH Resin Adhesive 1kg", size: "1 kg", unit: "PCS", category: "Paints & Adhesives", brand: "Pidilite", price: 240, cost: 190, qty: 25, reorder: 8, bin: "R02-L3-S1" },
    { sku: "MSEAL-100", name: "M-Seal Epoxy Compound 100g", size: "100g", unit: "PCS", category: "Paints & Adhesives", brand: "Pidilite", price: 25, cost: 17.5, qty: 85, reorder: 20, bin: "R02-L3-S2" },
    { sku: "PNT-RO-1L", name: "Red Oxide Metal Primer 1 Litre", size: "1 Litre", unit: "PCS", category: "Paints & Adhesives", brand: "Asian Paints", price: 190, cost: 145, qty: 16, reorder: 5, bin: "R02-L3-S3" },
    { sku: "PBR-3", name: 'Flat Paint Brush 3"', size: "3 inch", unit: "PCS", category: "Paints & Adhesives", brand: "Generic", price: 55, cost: 36, qty: 0, reorder: 10, bin: "R02-L3-S4" }
    // ZERO STOCK ALERT
  ], m = t.prepare(`
    INSERT OR REPLACE INTO items (sku, name, size, unit, category, brand, selling_price, cost_price, quantity, reorder_level, bin_id, status)
    VALUES (@sku, @name, @size, @unit, @category, @brand, @price, @cost, @qty, @reorder, @bin, 'Active')
  `);
  d.forEach((s) => m.run(s));
  const l = [
    { code: "R01", name: "Fasteners", zone: "Fasteners", binsCount: 24 },
    { code: "R02", name: "Bolts & Nuts", zone: "Fasteners", binsCount: 12 },
    { code: "R03", name: "Washers", zone: "Fasteners", binsCount: 12 },
    { code: "R04", name: "Tools", zone: "Hardware", binsCount: 16 },
    { code: "R05", name: "Electrical", zone: "Electrical", binsCount: 20 }
  ], o = t.prepare("INSERT OR IGNORE INTO racks (code, name, zone, levels, slots_per_level) VALUES (?, ?, ?, 4, 4)"), c = t.prepare("INSERT OR IGNORE INTO rack_bins (bin_code, rack_code, level_no, slot_no, quantity) VALUES (?, ?, ?, ?, ?)");
  l.forEach((s) => {
    o.run(s.code, s.name, s.zone);
    for (let R = 1; R <= 4; R++)
      for (let E = 1; E <= 4; E++) {
        const f = `${s.code}-L${R}-S${E}`;
        c.run(f, s.code, R, E, 0);
      }
  });
  const u = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], T = new Date(Date.now() - 864e5).toISOString().split("T")[0], p = new Date(Date.now() - 1728e5).toISOString().split("T")[0], k = [
    {
      num: "INV-001248",
      date: `${u} 11:24:00`,
      cust: "Raj Builders",
      count: 2,
      sub: 1240,
      disc: 0,
      total: 1240,
      mode: "UPI",
      items: [
        { sku: "HB-M8-40", name: "Hex Bolt M8 x 40mm", quantity: 50, rate: 12, discount: 0, total: 600 },
        { sku: "DB-10", name: "SDS Plus Drill Bit 10mm", quantity: 3, rate: 213.33, discount: 0, total: 640 }
      ]
    },
    {
      num: "INV-001247",
      date: `${u} 10:56:00`,
      cust: "Sree Constructions",
      count: 2,
      sub: 2500,
      disc: 40,
      total: 2460,
      mode: "Cash",
      items: [
        { sku: "WR-15-RD", name: "Copper House Wire 1.5 sq mm Red 90m", quantity: 1, rate: 1950, discount: 0, total: 1950 },
        { sku: "HM-500", name: "Ball Peen Hammer 500g", quantity: 2, rate: 275, discount: 40, total: 510 }
      ]
    },
    {
      num: "INV-001246",
      date: `${T} 17:41:00`,
      cust: "KPN Interiors",
      count: 2,
      sub: 940,
      disc: 0,
      total: 940,
      mode: "Card",
      items: [
        { sku: "FEV-1K", name: "Fevicol SH Resin Adhesive 1kg", quantity: 3, rate: 240, discount: 0, total: 720 },
        { sku: "DB-10", name: "SDS Plus Drill Bit 10mm", quantity: 1, rate: 220, discount: 0, total: 220 }
      ]
    },
    {
      num: "INV-001245",
      date: `${T} 15:17:00`,
      cust: "Sunil Traders",
      count: 2,
      sub: 1900,
      disc: 20,
      total: 1880,
      mode: "Cash",
      items: [
        { sku: "PVC-1", name: 'PVC Pipe 1" Class 3 6kg', quantity: 20, rate: 85, discount: 20, total: 1680 },
        { sku: "TF-TAPE", name: "Teflon Thread Seal Tape 12mm", quantity: 10, rate: 20, discount: 0, total: 200 }
      ]
    },
    {
      num: "INV-001244",
      date: `${p} 11:02:00`,
      cust: "Apex Enterprises",
      count: 2,
      sub: 760,
      disc: 0,
      total: 760,
      mode: "UPI",
      items: [
        { sku: "SP-10", name: 'Adjustable Spanner 10"', quantity: 2, rate: 380, discount: 0, total: 760 }
      ]
    }
  ], D = t.prepare(`
    INSERT OR IGNORE INTO invoices (invoice_number, date_time, customer_name, subtotal, discount, total, payment_mode, items_count, items_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
  `);
  k.forEach((s) => {
    D.run(s.num, s.date, s.cust, s.sub, s.disc, s.total, s.mode, s.count, JSON.stringify(s.items));
  });
  const M = [
    { num: "PO-00284", vendor: "KPR Fasteners", date: u, amount: 48500, status: "Open", items: [{ sku: "DB-12", name: "SDS Plus Drill Bit 12mm", quantity: 50, rate: 200 }] },
    { num: "PO-00283", vendor: "Metro Tools Co.", date: T, amount: 72e3, status: "Received", items: [] },
    { num: "PO-00282", vendor: "Shree Metals", date: p, amount: 124e3, status: "Received", items: [] },
    { num: "PO-00281", vendor: "Nice Hardware", date: p, amount: 36750, status: "Closed", items: [] },
    { num: "PO-00280", vendor: "A1 Tools Distributors", date: p, amount: 58200, status: "Closed", items: [] }
  ], F = t.prepare("INSERT OR IGNORE INTO purchase_orders (po_number, vendor_name, order_date, amount, status, items_json) VALUES (?, ?, ?, ?, ?, ?)");
  if (M.forEach((s) => F.run(s.num, s.vendor, s.date, s.amount, s.status, JSON.stringify(s.items))), t.prepare("SELECT count(*) as count FROM vendors").get().count === 0) {
    const s = [
      { name: "KPR Fasteners", person: "K. Ramesh", phone: "+91 94441 23456", city: "Coimbatore" },
      { name: "Metro Tools Co.", person: "S. Kumar", phone: "+91 98840 54321", city: "Chennai" },
      { name: "Shree Metals", person: "Anand Patel", phone: "+91 97123 45678", city: "Ahmedabad" },
      { name: "Nice Hardware", person: "V. Naresh", phone: "+91 99401 11223", city: "Madurai" },
      { name: "A1 Tools Distributors", person: "Mohan Lal", phone: "+91 98200 99887", city: "Mumbai" }
    ], R = t.prepare("INSERT INTO vendors (name, contact_person, phone, city) VALUES (?, ?, ?, ?)");
    s.forEach((E) => R.run(E.name, E.person, E.phone, E.city));
  }
  if (t.prepare("SELECT count(*) as count FROM expenses").get().count === 0) {
    const s = [
      { cat: "Shop Rent", desc: "Monthly godown & shop lease", amount: 15e3, date: p, mode: "Bank" },
      { cat: "Electricity", desc: "TNEB commercial bill", amount: 4200, date: T, mode: "UPI" },
      { cat: "Transport", desc: "Freight delivery & tempo", amount: 1200, date: u, mode: "Cash" },
      { cat: "Others", desc: "Tea, stationery, packing tape", amount: 450, date: u, mode: "Cash" }
    ], R = t.prepare("INSERT INTO expenses (category, description, amount, date, payment_mode) VALUES (?, ?, ?, ?, ?)");
    s.forEach((E) => R.run(E.cat, E.desc, E.amount, E.date, E.mode));
  }
}
A();
n.handle("getShopProfile", () => t.prepare("SELECT * FROM shop_profile WHERE id = 1").get());
n.handle("updateShopProfile", (a, e) => (t.prepare(`
    UPDATE shop_profile
    SET shop_name = @shop_name, tagline = @tagline, phone = @phone, email = @email,
        address_line1 = @address_line1, address_line2 = @address_line2, city = @city, pincode = @pincode,
        invoice_footer = @invoice_footer, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(e), { success: !0 }));
n.handle("getItems", () => t.prepare("SELECT * FROM items ORDER BY id DESC").all());
n.handle("searchItems", (a, e) => {
  const r = `%${e}%`;
  return t.prepare(`
    SELECT * FROM items 
    WHERE sku LIKE ? OR name LIKE ? OR size LIKE ? OR category LIKE ?
    ORDER BY name ASC
  `).all(r, r, r, r);
});
n.handle("addItem", (a, e) => {
  try {
    const r = String(e.sku || "").trim().toUpperCase();
    if (!r) return { success: !1, error: "SKU is required." };
    const d = t.prepare(`
      INSERT INTO items (sku, name, size, unit, category, brand, selling_price, cost_price, quantity, reorder_level, bin_id, image_url, status)
      VALUES (@sku, @name, @size, @unit, @category, @brand, @selling_price, @cost_price, @quantity, @reorder_level, @bin_id, @image_url, 'Active')
    `).run({
      ...e,
      sku: r,
      name: String(e.name || "").trim(),
      bin_id: String(e.bin_id || "").trim().toUpperCase(),
      image_url: String(e.image_url || "").trim()
    });
    return { success: !0, id: Number(d.lastInsertRowid) };
  } catch (r) {
    return String(r.message || "").includes("UNIQUE") ? { success: !1, error: `SKU "${String(e.sku || "").trim().toUpperCase()}" already exists. Use a unique SKU or edit the existing product.` } : { success: !1, error: r.message || "Failed to add product." };
  }
});
n.handle("updateItem", (a, e) => {
  try {
    const r = String(e.sku || "").trim().toUpperCase();
    return t.prepare(`
      UPDATE items 
      SET sku = @sku, name = @name, size = @size, unit = @unit, category = @category, brand = @brand,
          selling_price = @selling_price, cost_price = @cost_price, quantity = @quantity,
          reorder_level = @reorder_level, bin_id = @bin_id, image_url = @image_url, status = @status
      WHERE id = @id
    `).run({
      ...e,
      sku: r,
      name: String(e.name || "").trim(),
      bin_id: String(e.bin_id || "").trim().toUpperCase(),
      image_url: String(e.image_url || "").trim()
    }), { success: !0 };
  } catch (r) {
    return String(r.message || "").includes("UNIQUE") ? { success: !1, error: `Another product already uses SKU "${String(e.sku || "").trim().toUpperCase()}".` } : { success: !1, error: r.message || "Failed to update product." };
  }
});
n.handle("deleteItem", (a, e) => (t.prepare("DELETE FROM items WHERE id = ?").run(e), { success: !0 }));
n.handle("getRacks", () => {
  const a = t.prepare("SELECT * FROM racks ORDER BY code ASC").all(), e = t.prepare("SELECT id, sku, name, quantity, unit, bin_id FROM items").all();
  return a.map((r) => {
    const d = t.prepare("SELECT * FROM rack_bins WHERE rack_code = ? ORDER BY level_no, slot_no").all(r.code).map((m) => {
      const l = e.filter((c) => (c.bin_id || "").toUpperCase() === m.bin_code.toUpperCase()), o = l.reduce((c, u) => c + (Number(u.quantity) || 0), 0);
      return { ...m, quantity: o, items: l };
    });
    return { ...r, binsCount: d.length, bins: d };
  });
});
n.handle("addRack", (a, e) => {
  try {
    const r = String(e.code || "").trim().toUpperCase(), i = String(e.name || "").trim();
    if (!r || !i)
      return { success: !1, error: "Rack code and name are required." };
    const d = Math.min(10, Math.max(1, parseInt(e.levels) || 4)), m = Math.min(10, Math.max(1, parseInt(e.slots_per_level) || 4));
    t.prepare("INSERT INTO racks (code, name, zone, levels, slots_per_level) VALUES (@code, @name, @zone, @levels, @slots_per_level)").run({
      code: r,
      name: i,
      zone: String(e.zone || "General").trim(),
      levels: d,
      slots_per_level: m
    });
    const o = t.prepare("INSERT OR IGNORE INTO rack_bins (bin_code, rack_code, level_no, slot_no, quantity) VALUES (?, ?, ?, ?, 0)");
    for (let c = 1; c <= d; c++)
      for (let u = 1; u <= m; u++)
        o.run(`${r}-L${c}-S${u}`, r, c, u);
    return { success: !0, code: r };
  } catch (r) {
    return String(r.message || "").includes("UNIQUE") ? { success: !1, error: `Rack code "${String(e.code || "").trim().toUpperCase()}" already exists. Choose a unique code (e.g. R06).` } : { success: !1, error: r.message || "Failed to create rack." };
  }
});
n.handle("deleteRack", (a, e) => (t.prepare("DELETE FROM rack_bins WHERE rack_code = ?").run(e), t.prepare("DELETE FROM racks WHERE code = ?").run(e), { success: !0 }));
n.handle("bulkImportItems", (a, e) => {
  try {
    const r = t.prepare(`
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
    return { success: !0, count: t.transaction((m) => {
      let l = 0;
      for (const o of m) {
        const c = String(o.sku || "").trim().toUpperCase(), u = String(o.name || "").trim();
        !c || !u || (r.run({
          sku: c,
          name: u,
          size: String(o.size || "").trim(),
          unit: String(o.unit || "PCS").trim().toUpperCase(),
          category: String(o.category || "Others").trim(),
          brand: String(o.brand || "Generic").trim(),
          selling_price: parseFloat(o.selling_price) || 0,
          cost_price: parseFloat(o.cost_price) || 0,
          quantity: parseFloat(o.quantity) || 0,
          reorder_level: parseFloat(o.reorder_level) || 10,
          bin_id: String(o.bin_id || "").trim().toUpperCase(),
          image_url: String(o.image_url || "").trim()
        }), l++);
      }
      return l;
    })(e || []) };
  } catch (r) {
    return { success: !1, error: r.message || "CSV import failed." };
  }
});
n.handle("getInvoices", () => t.prepare("SELECT * FROM invoices ORDER BY id DESC").all());
n.handle("createInvoice", (a, e) => {
  const r = `INV-${String(Math.floor(1e5 + Math.random() * 9e5))}`, i = e.invoice_number || r, d = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19), l = t.prepare(`
    INSERT INTO invoices (invoice_number, date_time, customer_name, customer_phone, subtotal, discount, total, payment_mode, items_count, items_json, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed')
  `).run(
    i,
    d,
    e.customer_name || "Walk-in Customer",
    e.customer_phone || "",
    e.subtotal,
    e.discount || 0,
    e.total,
    e.payment_mode || "Cash",
    e.items.length,
    JSON.stringify(e.items)
  ), o = t.prepare("UPDATE items SET quantity = MAX(0, quantity - ?) WHERE sku = ? OR id = ?"), c = t.prepare("SELECT id, sku, name, quantity FROM items WHERE (sku = ? OR id = ?)"), u = [];
  return e.items.forEach((T) => {
    o.run(T.quantity, T.sku || "", T.id || 0);
    const p = c.get(T.sku || "", T.id || 0);
    p && p.quantity <= 0 && u.push(p);
  }), { success: !0, id: Number(l.lastInsertRowid), invoice_number: i, zeroStockAlerts: u };
});
n.handle("returnInvoice", (a, e) => {
  try {
    const r = t.prepare("SELECT * FROM invoices WHERE id = ?").get(e);
    if (!r) return { success: !1, error: "Invoice not found." };
    if (r.status === "Returned") return { success: !1, error: "Invoice was already returned." };
    const i = JSON.parse(r.items_json || "[]"), d = t.prepare("UPDATE items SET quantity = quantity + ? WHERE sku = ? OR id = ?");
    return t.transaction(() => {
      i.forEach((l) => {
        d.run(Number(l.quantity) || 0, l.sku || "", l.id || 0);
      }), t.prepare("UPDATE invoices SET status = 'Returned' WHERE id = ?").run(e);
    })(), { success: !0, restockedCount: i.length };
  } catch (r) {
    return { success: !1, error: r.message || "Return failed." };
  }
});
n.handle("getOutOfStockItems", () => t.prepare("SELECT * FROM items WHERE quantity <= 0 ORDER BY name ASC").all());
n.handle("getPurchaseOrders", () => t.prepare("SELECT * FROM purchase_orders ORDER BY id DESC").all());
n.handle("createPurchaseOrder", (a, e) => {
  const r = `PO-${String(Math.floor(1e4 + Math.random() * 9e4))}`;
  return t.prepare(`
    INSERT INTO purchase_orders (po_number, vendor_name, order_date, amount, status, items_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(e.po_number || r, e.vendor_name, e.order_date, e.amount, e.status || "Open", JSON.stringify(e.items || [])), { success: !0 };
});
n.handle("updatePurchaseOrderStatus", (a, { id: e, status: r }) => {
  try {
    const i = t.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(e);
    if (!i) return { success: !1, error: "PO not found." };
    const d = i.status;
    return t.transaction(() => {
      if (t.prepare("UPDATE purchase_orders SET status = ? WHERE id = ?").run(r, e), d !== "Received" && r === "Received") {
        const l = JSON.parse(i.items_json || "[]"), o = t.prepare("UPDATE items SET quantity = quantity + ? WHERE sku = ?");
        l.forEach((c) => {
          c.sku && Number(c.quantity) > 0 && o.run(Number(c.quantity), c.sku);
        });
      }
    })(), { success: !0 };
  } catch (i) {
    return { success: !1, error: i.message };
  }
});
n.handle("deletePurchaseOrder", (a, e) => (t.prepare("DELETE FROM purchase_orders WHERE id = ?").run(e), { success: !0 }));
n.handle("getVendors", () => t.prepare("SELECT * FROM vendors ORDER BY name ASC").all());
n.handle("addVendor", (a, e) => (t.prepare("INSERT INTO vendors (name, contact_person, phone, email, city) VALUES (@name, @contact_person, @phone, @email, @city)").run({
  name: e.name || "",
  contact_person: e.contact_person || "",
  phone: e.phone || "",
  email: e.email || "",
  city: e.city || ""
}), { success: !0 }));
n.handle("deleteVendor", (a, e) => (t.prepare("DELETE FROM vendors WHERE id = ?").run(e), { success: !0 }));
n.handle("getExpenses", () => t.prepare("SELECT * FROM expenses ORDER BY date DESC, id DESC").all());
n.handle("addExpense", (a, e) => (t.prepare("INSERT INTO expenses (category, description, amount, date, payment_mode) VALUES (@category, @description, @amount, @date, @payment_mode)").run(e), { success: !0 }));
n.handle("deleteExpense", (a, e) => (t.prepare("DELETE FROM expenses WHERE id = ?").run(e), { success: !0 }));
n.handle("getDayClosings", () => t.prepare("SELECT * FROM day_closings ORDER BY closing_date DESC").all());
n.handle("recordDayClosing", (a, e) => (t.prepare(`
    INSERT OR REPLACE INTO day_closings (closing_date, opening_cash, total_cash_sales, total_expenses, system_expected_cash, counted_cash, difference, remarks)
    VALUES (@closing_date, @opening_cash, @total_cash_sales, @total_expenses, @system_expected_cash, @counted_cash, @difference, @remarks)
  `).run(e), { success: !0 }));
n.handle("getDatabasePath", () => L);
n.handle("backupDatabase", async () => {
  const { filePath: a } = await b.showSaveDialog({
    title: "Backup T. S. P Enterprises Database",
    defaultPath: `tsp_enterprises_backup_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.db`,
    filters: [{ name: "SQLite Database", extensions: ["db", "sqlite"] }]
  });
  return a ? (await t.backup(a), { success: !0, path: a }) : { success: !1 };
});
n.handle("restoreDatabase", async () => {
  const { canceled: a, filePaths: e } = await b.showOpenDialog({
    title: "Restore Database Backup (.db)",
    filters: [{ name: "SQLite Database", extensions: ["db", "sqlite"] }],
    properties: ["openFile"]
  });
  if (a || !e || e.length === 0)
    return { success: !1 };
  try {
    const r = e[0], i = `${L}.pre_restore.bak`;
    try {
      y.copyFileSync(L, i);
    } catch {
    }
    return t.close(), y.copyFileSync(r, L), t = new g(L), A(), { success: !0, path: r };
  } catch (r) {
    try {
      t = new g(L);
    } catch {
    }
    return { success: !1, error: r.message || "Restore failed." };
  }
});
n.handle("seedDemoData", () => (C(), { success: !0 }));
n.handle("resetDatabase", () => (t.transaction(() => {
  t.exec(`
      DELETE FROM items;
      DELETE FROM racks;
      DELETE FROM rack_bins;
      DELETE FROM invoices;
      DELETE FROM purchase_orders;
      DELETE FROM vendors;
      DELETE FROM expenses;
      DELETE FROM day_closings;
    `);
})(), { success: !0 }));
function P() {
  const { width: a, height: e } = v.getPrimaryDisplay().workAreaSize;
  N = new O({
    width: Math.min(1440, a),
    height: Math.min(900, e),
    minWidth: 1024,
    minHeight: 700,
    title: "T. S. P Enterprises - Inventory & Billing",
    icon: S.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: S.join(I, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), h ? N.loadURL(h) : N.loadFile(S.join(U, "index.html"));
}
_.on("window-all-closed", () => {
  process.platform !== "darwin" && (_.quit(), N = null);
});
_.on("activate", () => {
  O.getAllWindows().length === 0 && P();
});
_.whenReady().then(P);
export {
  Y as MAIN_DIST,
  U as RENDERER_DIST,
  h as VITE_DEV_SERVER_URL
};
