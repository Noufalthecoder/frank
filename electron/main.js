import { app, BrowserWindow, ipcMain, screen, dialog, Menu } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
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
const userDataDir = app.getPath("userData")
fs.mkdirSync(userDataDir, { recursive: true })
const dbpath = path.join(userDataDir, "billing.db")
let db = new Database(dbpath)
db.pragma('journal_mode = WAL')

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
      status TEXT NOT NULL DEFAULT 'Request',
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
  try {
    db.exec(`ALTER TABLE shop_profile ADD COLUMN gstin TEXT DEFAULT ''`);
  } catch (_) {
    // Column already exists
  }
  try {
    db.exec(`UPDATE purchase_orders SET status = 'Request' WHERE status = 'Open'`);
    db.exec(`UPDATE purchase_orders SET status = 'Received' WHERE status = 'Closed'`);
  } catch (_) {
    // Ignore if table not ready
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

  // Seed only default category labels — never seed dummy products, racks, vendors, bills, POs, or expenses
  const categories = ['Fasteners', 'Tools', 'Electrical', 'Plumbing', 'Paints & Adhesives', 'Others'];
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  categories.forEach(c => insertCat.run(c));
}

function formatLocalDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
        gstin = @gstin, address_line1 = @address_line1, address_line2 = @address_line2, city = @city, pincode = @pincode,
        invoice_footer = @invoice_footer, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);
  stmt.run({ ...profile, gstin: String(profile.gstin || '').trim().toUpperCase() });
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

// Rack / bin helpers: an item's bin must be '' (unassigned) or an existing rack bin
const normBin = (v) => String(v || '').trim().toUpperCase();
const binExists = (code) => !!db.prepare('SELECT 1 FROM rack_bins WHERE bin_code = ?').get(code);
const binError = (code) => `Bin "${code}" does not exist. Pick a bin from Racks & Bins or leave it unassigned.`;

ipcMain.handle('addItem', (event, item) => {
  try {
    const normalizedSku = String(item.sku || '').trim().toUpperCase();
    if (!normalizedSku) return { success: false, error: 'SKU is required.' };
    const bin = normBin(item.bin_id);
    if (bin && !binExists(bin)) return { success: false, error: binError(bin) };
    const stmt = db.prepare(`
      INSERT INTO items (sku, name, size, unit, category, brand, selling_price, cost_price, quantity, reorder_level, bin_id, image_url, status)
      VALUES (@sku, @name, @size, @unit, @category, @brand, @selling_price, @cost_price, @quantity, @reorder_level, @bin_id, @image_url, @status)
    `);
    const res = stmt.run({
      ...item,
      sku: normalizedSku,
      name: String(item.name || '').trim(),
      bin_id: bin,
      image_url: String(item.image_url || '').trim(),
      status: item.status || 'Available',
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
    const bin = normBin(item.bin_id);
    if (bin && !binExists(bin)) return { success: false, error: binError(bin) };
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
      bin_id: bin,
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
  const rackCode = normBin(code);
  const used = db.prepare(
    'SELECT COUNT(*) AS c FROM items WHERE UPPER(bin_id) IN (SELECT bin_code FROM rack_bins WHERE rack_code = ?)'
  ).get(rackCode).c;
  if (used > 0) {
    return { success: false, error: `Rack ${rackCode} still holds ${used} product(s). Move them to another bin first.` };
  }
  db.transaction(() => {
    db.prepare('DELETE FROM rack_bins WHERE rack_code = ?').run(rackCode);
    db.prepare('DELETE FROM racks WHERE code = ?').run(rackCode);
  })();
  return { success: true };
});

ipcMain.handle('updateRack', (event, rack) => {
  try {
    const code = normBin(rack.code);
    const existing = db.prepare('SELECT * FROM racks WHERE code = ?').get(code);
    if (!existing) return { success: false, error: `Rack ${code} not found.` };
    const name = String(rack.name || '').trim();
    if (!name) return { success: false, error: 'Rack name is required.' };
    const levels = Math.min(10, Math.max(1, parseInt(rack.levels) || existing.levels));
    const slots = Math.min(10, Math.max(1, parseInt(rack.slots_per_level) || existing.slots_per_level));

    // Bins that would disappear when shrinking must be empty
    const doomed = db.prepare(
      'SELECT bin_code FROM rack_bins WHERE rack_code = ? AND (level_no > ? OR slot_no > ?)'
    ).all(code, levels, slots).map((b) => b.bin_code);
    if (doomed.length) {
      const placeholders = doomed.map(() => '?').join(',');
      const used = db.prepare(`SELECT COUNT(*) AS c FROM items WHERE UPPER(bin_id) IN (${placeholders})`).get(...doomed).c;
      if (used > 0) {
        return { success: false, error: `Cannot shrink: ${used} product(s) are stored in bins that would be removed. Move them first.` };
      }
    }
    db.transaction(() => {
      db.prepare('UPDATE racks SET name = ?, zone = ?, levels = ?, slots_per_level = ? WHERE code = ?')
        .run(name, String(rack.zone || existing.zone || 'General').trim(), levels, slots, code);
      if (doomed.length) {
        const del = db.prepare('DELETE FROM rack_bins WHERE bin_code = ?');
        doomed.forEach((b) => del.run(b));
      }
      const insertBin = db.prepare('INSERT OR IGNORE INTO rack_bins (bin_code, rack_code, level_no, slot_no, quantity) VALUES (?, ?, ?, ?, 0)');
      for (let l = 1; l <= levels; l++) {
        for (let s = 1; s <= slots; s++) insertBin.run(`${code}-L${l}-S${s}`, code, l, s);
      }
    })();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to update rack.' };
  }
});

// Assign / move a product to a bin ('' = unassign)
ipcMain.handle('moveItemToBin', (event, itemId, binCode) => {
  try {
    const bin = normBin(binCode);
    if (bin && !binExists(bin)) return { success: false, error: binError(bin) };
    const res = db.prepare('UPDATE items SET bin_id = ? WHERE id = ?').run(bin, itemId);
    if (res.changes === 0) return { success: false, error: 'Product not found.' };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to move product.' };
  }
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
    const invalidBins = new Set();
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
          unit: String(row.unit || 'PCS').trim(),
          category: String(row.category || 'Others').trim(),
          brand: String(row.brand || 'Generic').trim(),
          selling_price: parseFloat(row.selling_price) || 0,
          cost_price: parseFloat(row.cost_price) || 0,
          quantity: parseFloat(row.quantity) || 0,
          reorder_level: parseFloat(row.reorder_level) || 10,
          bin_id: (() => {
            const b = normBin(row.bin_id);
            if (b && !binExists(b)) { invalidBins.add(b); return ''; }
            return b;
          })(),
          image_url: String(row.image_url || '').trim(),
        });
        imported++;
      }
      return imported;
    });
    const count = insertMany(itemsList || []);
    return { success: true, count, invalidBins: Array.from(invalidBins) };
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
  const nowStr = formatLocalDateTime();

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

  // Deduct stock for each item (using stock_deduction_qty in base unit for length/weight items)
  const updateStock = db.prepare('UPDATE items SET quantity = ROUND(MAX(0, quantity - ?), 6) WHERE sku = ? OR id = ?');
  const checkStock = db.prepare('SELECT id, sku, name, quantity FROM items WHERE (sku = ? OR id = ?)');

  const zeroStockAlerts = [];
  inv.items.forEach(item => {
    const deductQty = Number(item.stock_deduction_qty ?? item.quantity ?? 0);
    updateStock.run(deductQty, item.sku || '', item.id || 0);
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
    const restock = db.prepare('UPDATE items SET quantity = ROUND(quantity + ?, 6) WHERE sku = ? OR id = ?');
    const tx = db.transaction(() => {
      items.forEach(item => {
        const addBack = Number(item.stock_deduction_qty ?? item.quantity ?? 0);
        restock.run(addBack, item.sku || '', item.id || 0);
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

function applyPoStockDelta(line, deltaQty) {
  const delta = Number(deltaQty) || 0;
  if (Math.abs(delta) < 1e-9) return;
  const pid = Number(line.product_id) || 0;
  const sku = String(line.sku || '').trim().toUpperCase();
  let target = null;
  if (pid > 0) {
    target = db.prepare('SELECT id, sku, quantity, status FROM items WHERE id = ?').get(pid);
  }
  if (!target && sku) {
    target = db.prepare('SELECT id, sku, quantity, status FROM items WHERE UPPER(sku) = ?').get(sku);
  }
  if (!target) return;
  const nextQty = Number(Math.max(0, Number(target.quantity || 0) + delta).toFixed(6));
  const nextStatus = nextQty > 0 && (target.status === 'Unavailable' || target.status === 'Inactive')
    ? 'Available'
    : target.status;
  db.prepare('UPDATE items SET quantity = ?, status = ? WHERE id = ?').run(nextQty, nextStatus, target.id);
}

function aggregatePoLines(lines) {
  const map = new Map();
  (Array.isArray(lines) ? lines : []).forEach((l) => {
    const pid = Number(l.product_id) || 0;
    const sku = String(l.sku || '').trim().toUpperCase();
    const key = pid > 0 ? `id:${pid}` : sku ? `sku:${sku}` : '';
    if (!key) return;
    const prev = map.get(key) || { product_id: pid, sku, qty: 0 };
    prev.qty = Number((prev.qty + (Number(l.quantity) || 0)).toFixed(6));
    map.set(key, prev);
  });
  return map;
}

ipcMain.handle('createPurchaseOrder', (event, po) => {
  const genNum = `PO-${String(Math.floor(10000 + Math.random() * 90000))}`;
  const poStatus = po.status === 'Received' ? 'Received' : 'Request';
  const items = Array.isArray(po.items) ? po.items : [];
  const stmt = db.prepare(`
    INSERT INTO purchase_orders (po_number, vendor_name, order_date, amount, status, items_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const tx = db.transaction(() => {
    stmt.run(po.po_number || genNum, po.vendor_name, po.order_date, po.amount, poStatus, JSON.stringify(items));
    if (poStatus === 'Received' && items.length > 0) {
      items.forEach((line) => applyPoStockDelta(line, Number(line.quantity) || 0));
    }
  });
  tx();
  return { success: true };
});

ipcMain.handle('updatePurchaseOrder', (event, po) => {
  try {
    const existing = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(po.id);
    if (!existing) return { success: false, error: 'PO not found.' };
    const prevStatus = existing.status === 'Received' || existing.status === 'Closed' ? 'Received' : 'Request';
    const nextStatus = po.status === 'Received' ? 'Received' : 'Request';
    const prevItems = JSON.parse(existing.items_json || '[]');
    const nextItems = Array.isArray(po.items) ? po.items : prevItems;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE purchase_orders
        SET vendor_name = ?, order_date = ?, amount = ?, status = ?, items_json = ?
        WHERE id = ?
      `).run(
        po.vendor_name ?? existing.vendor_name,
        po.order_date ?? existing.order_date,
        po.amount ?? existing.amount,
        nextStatus,
        JSON.stringify(nextItems),
        po.id
      );

      // Compute exact per-product delta so inventory updates cleanly without double-counting
      const prevMap = prevStatus === 'Received' ? aggregatePoLines(prevItems) : new Map();
      const nextMap = nextStatus === 'Received' ? aggregatePoLines(nextItems) : new Map();
      const allKeys = new Set([...prevMap.keys(), ...nextMap.keys()]);
      allKeys.forEach((key) => {
        const prevEntry = prevMap.get(key);
        const nextEntry = nextMap.get(key);
        const delta = Number(((nextEntry?.qty || 0) - (prevEntry?.qty || 0)).toFixed(6));
        if (Math.abs(delta) > 1e-9) {
          applyPoStockDelta(nextEntry || prevEntry, delta);
        }
      });
    });
    tx();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Failed to update PO.' };
  }
});

ipcMain.handle('updatePurchaseOrderStatus', (event, { id, status }) => {
  try {
    const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    if (!po) return { success: false, error: 'PO not found.' };
    const prevStatus = po.status === 'Received' || po.status === 'Closed' ? 'Received' : 'Request';
    const nextStatus = status === 'Received' ? 'Received' : 'Request';

    const tx = db.transaction(() => {
      db.prepare('UPDATE purchase_orders SET status = ? WHERE id = ?').run(nextStatus, id);
      const items = JSON.parse(po.items_json || '[]');
      if (prevStatus !== 'Received' && nextStatus === 'Received') {
        items.forEach((line) => applyPoStockDelta(line, Number(line.quantity) || 0));
      } else if (prevStatus === 'Received' && nextStatus !== 'Received') {
        items.forEach((line) => applyPoStockDelta(line, -(Number(line.quantity) || 0)));
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

// Paper size definitions in microns (width x height) for Electron print & printToPDF (A1-A6 + Thermal)
const ELECTRON_PAGE_SIZES_MICRONS = {
  A1: { width: 594000, height: 841000 },
  A2: { width: 420000, height: 594000 },
  A3: { width: 297000, height: 420000 },
  A4: { width: 210000, height: 297000 },
  A5: { width: 148000, height: 210000 },
  A6: { width: 105000, height: 148000 },
  '80mm': { width: 80000, height: 297000 },
  '58mm': { width: 58000, height: 297000 },
};

function queryWindowsPrinterDetails() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve({});
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-Printer | Select-Object Name,PortName,PrinterStatus,WorkOffline,DriverName | ConvertTo-Json -Compress',
      ],
      { timeout: 3000, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) return resolve({});
        try {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const map = {};
          list.forEach((p) => {
            if (p && p.Name) map[String(p.Name).toLowerCase()] = p;
          });
          resolve(map);
        } catch (_) {
          resolve({});
        }
      }
    );
  });
}

function classifyConnection(portName = '', driverName = '') {
  const port = String(portName || '').toUpperCase();
  const drv = String(driverName || '').toUpperCase();
  if (port.includes('USB') || port.startsWith('COM') || port.startsWith('LPT')) return 'USB';
  if (port.startsWith('WSD') || port.startsWith('IP_') || /^\d+\.\d+\.\d+\.\d+/.test(port) || port.includes('HTTP')) return 'Network';
  if (port.includes('PORTPROMPT') || port.includes('NUL') || port.includes('FILE') || drv.includes('PDF') || drv.includes('XPS') || drv.includes('ONENOTE')) return 'Virtual';
  return 'Local';
}

function resolvePrinterStatus(winDetail, electronStatus) {
  if (winDetail) {
    const ps = String(winDetail.PrinterStatus ?? '').toLowerCase();
    const workOffline = Boolean(winDetail.WorkOffline);
    if (workOffline || ps === 'offline' || ps === '5') {
      return { connectionState: 'offline', statusLabel: 'Offline' };
    }
    if (ps === 'paused' || ps === '1') {
      return { connectionState: 'offline', statusLabel: 'Paused' };
    }
    if (ps.includes('paperout') || ps === '16') {
      return { connectionState: 'error', statusLabel: 'Paper Out' };
    }
    if (ps.includes('error') || ps.includes('jam') || ps.includes('door') || ps === '2') {
      return { connectionState: 'error', statusLabel: 'Error' };
    }
    return { connectionState: 'connected', statusLabel: 'Connected' };
  }
  // Fallback to Electron status bitmask
  const st = Number(electronStatus) || 0;
  if (st === 0) return { connectionState: 'connected', statusLabel: 'Connected' };
  if (st & 128) return { connectionState: 'offline', statusLabel: 'Offline' };
  if (st & 1) return { connectionState: 'offline', statusLabel: 'Paused' };
  if (st & 16) return { connectionState: 'error', statusLabel: 'Paper Out' };
  return { connectionState: 'error', statusLabel: 'Attention' };
}

// IPC Handlers: Native Printer Discovery (Electron + Windows Get-Printer status), Silent/System Printing & A1-A6 PDF Export
ipcMain.handle('getPrinters', async () => {
  try {
    if (!win || win.isDestroyed()) return [];
    const [printers, winMap] = await Promise.all([
      win.webContents.getPrintersAsync(),
      queryWindowsPrinterDetails(),
    ]);
    return (printers || []).map((p) => {
      const winDetail = winMap[String(p.name || '').toLowerCase()] || null;
      const portName = winDetail?.PortName || '';
      const driverName = winDetail?.DriverName || p.description || '';
      const connectionType = classifyConnection(portName, driverName);
      const { connectionState, statusLabel } = resolvePrinterStatus(winDetail, p.status);
      return {
        name: p.name,
        displayName: p.displayName || p.name,
        description: driverName,
        portName,
        connectionType,
        connectionState,
        statusLabel,
        isDefault: Boolean(p.isDefault),
        status: p.status,
      };
    });
  } catch (err) {
    return [];
  }
});

ipcMain.handle('printInvoice', async (event, opts = {}) => {
  try {
    if (!win || win.isDestroyed()) return { success: false, error: 'Window unavailable.' };
    const format = opts.format || '80mm';
    const landscape = opts.orientation === 'landscape';
    const pageSize = ELECTRON_PAGE_SIZES_MICRONS[format] || ELECTRON_PAGE_SIZES_MICRONS.A4;
    const silent = Boolean(opts.silent);

    // Pre-check printer availability before silent/direct print
    if (silent || opts.deviceName) {
      const [printers, winMap] = await Promise.all([
        win.webContents.getPrintersAsync(),
        queryWindowsPrinterDetails(),
      ]);
      const target = opts.deviceName
        ? printers.find((p) => p.name === opts.deviceName)
        : printers.find((p) => p.isDefault) || printers[0];

      if (!target) {
        return {
          success: false,
          code: 'PRINTER_UNAVAILABLE',
          error: 'The printer is unavailable or disconnected.',
        };
      }

      const winDetail = winMap[String(target.name || '').toLowerCase()] || null;
      const { connectionState, statusLabel } = resolvePrinterStatus(winDetail, target.status);
      if (connectionState !== 'connected') {
        return {
          success: false,
          code: 'PRINTER_UNAVAILABLE',
          error:
            statusLabel === 'Paper Out'
              ? 'The printer is out of paper. Load paper and retry.'
              : 'The printer is unavailable or disconnected.',
        };
      }
    }

    return await new Promise((resolve) => {
      win.webContents.print(
        {
          silent,
          printBackground: true,
          deviceName: opts.deviceName || undefined,
          landscape,
          pageSize,
          margins: { marginType: 'none' },
        },
        (success, failureReason) => {
          if (success) {
            resolve({ success: true });
          } else {
            resolve({
              success: false,
              code: 'PRINT_FAILED',
              error:
                failureReason && failureReason !== 'cancelled'
                  ? `The printer is unavailable or disconnected (${failureReason}).`
                  : 'The printer is unavailable or disconnected.',
            });
          }
        }
      );
    });
  } catch (err) {
    return {
      success: false,
      code: 'PRINT_FAILED',
      error: err.message || 'The printer is unavailable or disconnected.',
    };
  }
});

ipcMain.handle('exportInvoicePdf', async (event, opts = {}) => {
  try {
    if (!win || win.isDestroyed()) return { success: false, error: 'Window unavailable.' };
    const format = opts.format || 'A4';
    const landscape = opts.orientation === 'landscape';
    const sizeMicrons = ELECTRON_PAGE_SIZES_MICRONS[format] || ELECTRON_PAGE_SIZES_MICRONS.A4;
    // Electron printToPDF pageSize takes inches when passing custom { width, height }
    const pageSizeInches = {
      width: Number((sizeMicrons.width / 25400).toFixed(3)),
      height: Number((sizeMicrons.height / 25400).toFixed(3)),
    };

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: `Save Invoice PDF (${format})`,
      defaultPath: `${opts.invoiceNumber || 'Invoice'}_${format}.pdf`,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) return { success: false };

    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      landscape,
      pageSize: pageSizeInches,
      margins: { top: 0.2, bottom: 0.2, left: 0.2, right: 0.2 },
    });

    fs.writeFileSync(filePath, pdfData);
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message || 'PDF export failed.' };
  }
});

function createWindow() {
  Menu.setApplicationMenu(null);
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    title: "T. S. P Enterprises - Inventory & Billing",
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.removeMenu();

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
