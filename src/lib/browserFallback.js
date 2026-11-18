import { planReturn, r2 } from './returnMath.js';
import { normalizeUnit } from './units.js';

// LocalStorage-backed fallback for window.api when previewing in a regular browser.
// Inside Electron (.exe), preload.js defines window.api (backed by SQLite), so this does nothing.

const STORAGE_KEY = 'tsp_enterprises_browser_db_v4';

function formatLocalDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getCleanInitialData() {
  return {
    shop_profile: {
      id: 1,
      shop_name: 'T. S. P Enterprises',
      tagline: 'Hardware, Tools & Fasteners',
      phone: '',
      email: 'tspenterprises@gmail.com',
      gstin: '',
      address_line1: 'Beach Road',
      address_line2: 'Tharuvaikulam',
      city: 'Thoothukudi',
      pincode: '628105',
      invoice_footer: 'Thank you for your business! Goods once sold cannot be returned without bill.',
    },
    items: [],
    racks: [],
    invoices: [],
    purchase_orders: [],
    vendors: [],
    expenses: [],
    day_closings: [],
  };
}


// ---- Paging helpers (mirror electron/main.js getInvoicesPage / getPurchaseOrdersPage / getExpensesPage) ----
// Substring match, case-insensitive; wildcards are plain characters here, same as the escaped SQL LIKE.
// SQLite CAST(REAL AS TEXT) renders whole numbers as '241.0'; mirror that so searching "1.0" behaves alike.
const realText = (n) => (typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) ? n.toFixed(1) : n);
const containsCI = (hay, needle) => String(hay ?? '').toLowerCase().includes(needle);
function pageOf(all, opts) {
  const size = Math.min(200, Math.max(1, Math.floor(Number(opts.pageSize)) || 12));
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(totalPages, Math.max(1, Math.floor(Number(opts.page)) || 1));
  return { rows: all.slice((page - 1) * size, page * size), total, page, pageSize: size, totalPages };
}

const normBin = (v) => String(v || '').trim().toUpperCase();
const binExistsIn = (db, code) => (db.racks || []).some((r) => (r.bins || []).some((b) => b.bin_code.toUpperCase() === code));
const binError = (code) => `Bin "${code}" does not exist. Pick a bin from Racks & Bins or leave it unassigned.`;

function readDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);

    const initial = getCleanInitialData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  } catch (err) {
    console.warn('Resetting browser preview DB:', err);
  }
  const fallback = getCleanInitialData();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
  return fallback;
}

function writeDb(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function initBrowserApiFallback() {
  if (typeof window === 'undefined' || window.api) return;

  console.info('[Browser Preview Mode] Using localStorage fallback API (SQLite runs inside the Electron desktop app).');

  window.api = {
    getShopProfile: async () => readDb().shop_profile,
    updateShopProfile: async (p) => {
      const db = readDb();
      db.shop_profile = { ...db.shop_profile, ...p };
      writeDb(db);
      return { success: true };
    },

    getItems: async () => {
      const db = readDb();
      return [...db.items].sort((a, b) => b.id - a.id);
    },
    searchItems: async (q) => {
      const term = (q || '').toLowerCase();
      return readDb().items.filter(
        (i) =>
          i.sku.toLowerCase().includes(term) ||
          i.name.toLowerCase().includes(term) ||
          (i.size && i.size.toLowerCase().includes(term)) ||
          (i.category && i.category.toLowerCase().includes(term))
      );
    },
    getOutOfStockItems: async () => readDb().items.filter((i) => Number(i.quantity) <= 0),
    addItem: async (item) => {
      const db = readDb();
      const normalizedSku = String(item.sku || '').trim().toUpperCase();
      if (!normalizedSku) return { success: false, error: 'SKU is required.' };
      const bin = normBin(item.bin_id);
      if (bin && !binExistsIn(db, bin)) return { success: false, error: binError(bin) };
      if (db.items.some((i) => i.sku.toUpperCase() === normalizedSku)) {
        return { success: false, error: `SKU "${normalizedSku}" already exists. Use a unique SKU or edit the existing product.` };
      }
      const id = db.items.reduce((max, i) => Math.max(max, i.id || 0), 0) + 1;
      db.items.push({ ...item, id, sku: normalizedSku, bin_id: bin, status: item.status || 'Available' });
      writeDb(db);
      return { success: true, id };
    },
    updateItem: async (item) => {
      const db = readDb();
      const normalizedSku = String(item.sku || '').trim().toUpperCase();
      const bin = normBin(item.bin_id);
      if (bin && !binExistsIn(db, bin)) return { success: false, error: binError(bin) };
      if (db.items.some((i) => i.id !== item.id && i.sku.toUpperCase() === normalizedSku)) {
        return { success: false, error: `Another product already uses SKU "${normalizedSku}".` };
      }
      db.items = db.items.map((i) => (i.id === item.id ? { ...i, ...item, sku: normalizedSku, bin_id: bin } : i));
      writeDb(db);
      return { success: true };
    },
    deleteItem: async (id) => {
      const db = readDb();
      db.items = db.items.filter((i) => i.id !== id);
      writeDb(db);
      return { success: true };
    },
    bulkImportItems: async (itemsList) => {
      const db = readDb();
      let count = 0;
      const invalidBins = new Set();
      (itemsList || []).forEach((row) => {
        const sku = String(row.sku || '').trim().toUpperCase();
        const name = String(row.name || '').trim();
        if (!sku || !name) return;
        const idx = db.items.findIndex((i) => i.sku.toUpperCase() === sku);
        const normalized = {
          sku,
          name,
          size: String(row.size || '').trim(),
          unit: normalizeUnit(row.unit || 'PCS'),
          category: String(row.category || 'Others').trim(),
          brand: String(row.brand || 'Generic').trim(),
          selling_price: parseFloat(row.selling_price) || 0,
          cost_price: parseFloat(row.cost_price) || 0,
          quantity: parseFloat(row.quantity) || 0,
          reorder_level: parseFloat(row.reorder_level) || 10,
          bin_id: (() => {
            const b = normBin(row.bin_id);
            if (b && !binExistsIn(db, b)) { invalidBins.add(b); return ''; }
            return b;
          })(),
          image_url: String(row.image_url || '').trim(),
          status: 'Active',
        };
        if (idx >= 0) {
          db.items[idx] = { ...db.items[idx], ...normalized };
        } else {
          const id = db.items.reduce((max, i) => Math.max(max, i.id || 0), 0) + 1;
          db.items.push({ id, ...normalized });
        }
        count++;
      });
      writeDb(db);
      return { success: true, count, invalidBins: Array.from(invalidBins) };
    },

    getRacks: async () => {
      const db = readDb();
      const itemsByBin = new Map();
      for (const it of db.items) {
        const key = (it.bin_id || '').toUpperCase();
        if (!key) continue;
        const list = itemsByBin.get(key);
        if (list) list.push(it); else itemsByBin.set(key, [it]);
      }
      return db.racks
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((r) => {
          const bins = (r.bins || []).map((b) => {
            const binItems = itemsByBin.get(b.bin_code.toUpperCase()) || [];
            const liveQty = binItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
            return { ...b, quantity: liveQty, items: binItems };
          });
          return { ...r, binsCount: bins.length, bins };
        });
    },
    addRack: async (rack) => {
      const db = readDb();
      const code = String(rack.code || '').trim().toUpperCase();
      if (!code || !String(rack.name || '').trim()) {
        return { success: false, error: 'Rack code and name are required.' };
      }
      if (db.racks.some((r) => r.code.toUpperCase() === code)) {
        return { success: false, error: `Rack code "${code}" already exists. Try "${code}A" or the next rack number (e.g. R06).` };
      }
      const levels = Math.min(10, Math.max(1, parseInt(rack.levels) || 4));
      const slots = Math.min(10, Math.max(1, parseInt(rack.slots_per_level) || 4));
      const bins = [];
      for (let l = 1; l <= levels; l++) {
        for (let s = 1; s <= slots; s++) {
          bins.push({
            bin_code: `${code}-L${l}-S${s}`,
            rack_code: code,
            level_no: l,
            slot_no: s,
            quantity: 0,
          });
        }
      }
      const id = db.racks.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
      db.racks.push({
        id,
        code,
        name: rack.name.trim(),
        zone: (rack.zone || 'General').trim(),
        levels,
        slots_per_level: slots,
        bins,
      });
      writeDb(db);
      return { success: true, code };
    },
    deleteRack: async (code) => {
      const db = readDb();
      const rackCode = normBin(code);
      const rack = db.racks.find((r) => r.code === rackCode);
      const codes = new Set((rack?.bins || []).map((b) => b.bin_code.toUpperCase()));
      const used = db.items.filter((i) => codes.has(normBin(i.bin_id))).length;
      if (used > 0) {
        return { success: false, error: `Rack ${rackCode} still holds ${used} product(s). Move them to another bin first.` };
      }
      db.racks = db.racks.filter((r) => r.code !== rackCode);
      writeDb(db);
      return { success: true };
    },
    updateRack: async (rack) => {
      const db = readDb();
      const code = normBin(rack.code);
      const existing = db.racks.find((r) => r.code === code);
      if (!existing) return { success: false, error: `Rack ${code} not found.` };
      const name = String(rack.name || '').trim();
      if (!name) return { success: false, error: 'Rack name is required.' };
      const levels = Math.min(10, Math.max(1, parseInt(rack.levels) || existing.levels));
      const slots = Math.min(10, Math.max(1, parseInt(rack.slots_per_level) || existing.slots_per_level));
      const doomed = (existing.bins || []).filter((b) => b.level_no > levels || b.slot_no > slots).map((b) => b.bin_code.toUpperCase());
      const used = db.items.filter((i) => doomed.includes(normBin(i.bin_id))).length;
      if (used > 0) {
        return { success: false, error: `Cannot shrink: ${used} product(s) are stored in bins that would be removed. Move them first.` };
      }
      const bins = (existing.bins || []).filter((b) => b.level_no <= levels && b.slot_no <= slots);
      for (let l = 1; l <= levels; l++) {
        for (let s = 1; s <= slots; s++) {
          const bc = `${code}-L${l}-S${s}`;
          if (!bins.some((b) => b.bin_code === bc)) bins.push({ bin_code: bc, rack_code: code, level_no: l, slot_no: s, quantity: 0 });
        }
      }
      bins.sort((a, b) => a.level_no - b.level_no || a.slot_no - b.slot_no);
      Object.assign(existing, { name, zone: String(rack.zone || existing.zone || 'General').trim(), levels, slots_per_level: slots, bins });
      writeDb(db);
      return { success: true };
    },
    moveItemToBin: async (itemId, binCode) => {
      const db = readDb();
      const bin = normBin(binCode);
      if (bin && !binExistsIn(db, bin)) return { success: false, error: binError(bin) };
      const item = db.items.find((i) => i.id === itemId);
      if (!item) return { success: false, error: 'Product not found.' };
      item.bin_id = bin;
      writeDb(db);
      return { success: true };
    },

    getInvoices: async () => [...readDb().invoices].sort((a, b) => b.id - a.id),
    getInvoicesPage: async (opts = {}) => {
      opts = opts || {};
      const q = String(opts.search || '').trim().toLowerCase();
      const dateFrom = String(opts.dateFrom || '');
      const status = String(opts.status || '');
      const filtered = readDb().invoices
        .filter((i) => {
          if (q && !(containsCI(i.invoice_number, q) || containsCI(i.customer_name, q) || containsCI(i.payment_mode, q) || containsCI(realText(i.total), q))) return false;
          if (dateFrom && !(String(i.date_time ?? '') >= dateFrom)) return false;
          if (status && i.status !== status) return false;
          return true;
        })
        .sort((a, b) => b.id - a.id);
      const sumTotal = filtered.reduce((s, i) => (i.status === 'Returned' ? s : s + (Number(i.total) || 0) - (Number(i.returned_total) || 0)), 0);
      return { ...pageOf(filtered, opts), sumTotal };
    },
    createInvoice: async (inv) => {
      const db = readDb();
      const invNumber = inv.invoice_number || `INV-${String(Math.floor(100000 + Math.random() * 900000))}`;
      const id = db.invoices.reduce((max, i) => Math.max(max, i.id || 0), 0) + 1;
      db.invoices.push({
        id,
        invoice_number: invNumber,
        date_time: formatLocalDateTime(),
        customer_name: inv.customer_name || 'Walk-in Customer',
        customer_phone: inv.customer_phone || '',
        subtotal: inv.subtotal,
        discount: inv.discount || 0,
        total: inv.total,
        payment_mode: inv.payment_mode || 'Cash',
        items_count: (inv.items || []).length,
        items_json: JSON.stringify(inv.items || []),
        status: 'Completed',
      });

      const zeroStockAlerts = [];
      (inv.items || []).forEach((sold) => {
        const target = db.items.find((i) => i.sku === sold.sku || i.id === sold.id);
        if (target) {
          const deduct = Number(sold.stock_deduction_qty ?? sold.quantity ?? 0);
          target.quantity = Math.max(0, Number((Number(target.quantity) - deduct).toFixed(6)));
          if (target.quantity <= 0) {
            zeroStockAlerts.push({ id: target.id, sku: target.sku, name: target.name, quantity: target.quantity });
          }
        }
      });

      writeDb(db);
      return { success: true, id, invoice_number: invNumber, zeroStockAlerts };
    },
    getInvoiceReturns: async (invoiceId) =>
      (readDb().invoice_returns || []).filter((r) => r.invoice_id === invoiceId).sort((a, b) => b.id - a.id),
    getReturns: async () => [...(readDb().invoice_returns || [])].sort((a, b) => b.id - a.id),
    processReturn: async (payload = {}) => {
      const { invoiceId, lines: req, reason = 'other', note = '', restock = true } = payload || {};
      const db = readDb();
      db.invoice_returns = db.invoice_returns || [];
      const inv = db.invoices.find((i) => i.id === invoiceId);
      if (!inv) return { success: false, error: 'Invoice not found.' };
      if (inv.status === 'Returned') return { success: false, error: 'Invoice was already returned.' };
      const prior = db.invoice_returns.filter((r) => r.invoice_id === invoiceId);
      const plan = planReturn(inv, prior, req);
      if (plan.error) return { success: false, error: plan.error };
      const id = db.invoice_returns.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
      const returnNumber = `RET-${String(id).padStart(5, '0')}`;
      db.invoice_returns.push({
        id, return_number: returnNumber, invoice_id: inv.id, invoice_number: inv.invoice_number,
        invoice_date: inv.date_time, payment_mode: inv.payment_mode, date_time: formatLocalDateTime(),
        reason: String(reason), note: String(note || '').slice(0, 300), restocked: Boolean(restock),
        refund_amount: plan.refund, lines: plan.lines, items_json: JSON.stringify(plan.lines),
      });
      if (restock) {
        plan.lines.forEach((l) => {
          const target = db.items.find((i) => i.sku === l.sku || i.id === l.id);
          if (target) target.quantity = Number((Number(target.quantity) + l.stockQty).toFixed(6));
        });
      }
      inv.returned_total = r2(Number(inv.returned_total || 0) + plan.refund);
      inv.status = plan.fullyReturned ? 'Returned' : 'Partially Returned';
      writeDb(db);
      return {
        success: true, return_number: returnNumber, refund: plan.refund, fullyReturned: plan.fullyReturned,
        restockedUnits: restock ? plan.lines.length : 0, status: inv.status,
      };
    },

    getPurchaseOrders: async () =>
      [...readDb().purchase_orders]
        .map((p) => ({
          ...p,
          status: p.status === 'Received' || p.status === 'Closed' ? 'Received' : 'Request',
        }))
        .sort((a, b) => b.id - a.id),
    getPurchaseOrdersPage: async (opts = {}) => {
      opts = opts || {};
      const q = String(opts.search || '').trim().toLowerCase();
      const want = opts.status ? (opts.status === 'Received' || opts.status === 'Closed' ? 'Received' : 'Request') : '';
      const filtered = readDb().purchase_orders
        .map((p) => ({ ...p, status: p.status === 'Received' || p.status === 'Closed' ? 'Received' : 'Request' }))
        .filter((p) => {
          if (q && !(containsCI(p.po_number, q) || containsCI(p.vendor_name, q) || containsCI(p.order_date, q) || containsCI(realText(p.amount), q))) return false;
          if (want && p.status !== want) return false;
          return true;
        })
        .sort((a, b) => b.id - a.id);
      return pageOf(filtered, opts);
    },
    createPurchaseOrder: async (po) => {
      const db = readDb();
      const id = db.purchase_orders.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
      const poStatus = po.status === 'Received' ? 'Received' : 'Request';
      const items = Array.isArray(po.items) ? po.items : [];
      db.purchase_orders.push({
        id,
        po_number: po.po_number || `PO-${String(Math.floor(10000 + Math.random() * 90000))}`,
        vendor_name: po.vendor_name,
        order_date: po.order_date,
        amount: po.amount,
        status: poStatus,
        items_json: JSON.stringify(items),
      });
      if (poStatus === 'Received' && items.length > 0) {
        items.forEach((line) => {
          const pid = Number(line.product_id) || 0;
          const sku = String(line.sku || '').trim().toUpperCase();
          const target =
            (pid > 0 ? db.items.find((x) => x.id === pid) : null) ||
            db.items.find((x) => String(x.sku || '').trim().toUpperCase() === sku);
          if (target) {
            target.quantity = Number(Math.max(0, Number(target.quantity || 0) + Number(line.quantity || 0)).toFixed(6));
            if (target.quantity > 0 && (target.status === 'Unavailable' || target.status === 'Inactive')) {
              target.status = 'Available';
            }
          }
        });
      }
      writeDb(db);
      return { success: true };
    },
    updatePurchaseOrder: async (po) => {
      const db = readDb();
      const existing = db.purchase_orders.find((p) => p.id === po.id);
      if (!existing) return { success: false, error: 'PO not found.' };
      const prevStatus = existing.status === 'Received' || existing.status === 'Closed' ? 'Received' : 'Request';
      const nextStatus = po.status === 'Received' ? 'Received' : 'Request';
      const prevItems = JSON.parse(existing.items_json || '[]');
      const nextItems = Array.isArray(po.items) ? po.items : prevItems;

      const aggregate = (list) => {
        const m = new Map();
        (Array.isArray(list) ? list : []).forEach((l) => {
          const pid = Number(l.product_id) || 0;
          const sku = String(l.sku || '').trim().toUpperCase();
          const key = pid > 0 ? `id:${pid}` : sku ? `sku:${sku}` : '';
          if (!key) return;
          const cur = m.get(key) || { product_id: pid, sku, qty: 0 };
          cur.qty = Number((cur.qty + (Number(l.quantity) || 0)).toFixed(6));
          m.set(key, cur);
        });
        return m;
      };

      const prevMap = prevStatus === 'Received' ? aggregate(prevItems) : new Map();
      const nextMap = nextStatus === 'Received' ? aggregate(nextItems) : new Map();
      const keys = new Set([...prevMap.keys(), ...nextMap.keys()]);
      keys.forEach((key) => {
        const pEntry = prevMap.get(key);
        const nEntry = nextMap.get(key);
        const delta = Number(((nEntry?.qty || 0) - (pEntry?.qty || 0)).toFixed(6));
        if (Math.abs(delta) > 1e-9) {
          const ref = nEntry || pEntry;
          const target =
            (ref.product_id > 0 ? db.items.find((x) => x.id === ref.product_id) : null) ||
            db.items.find((x) => String(x.sku || '').trim().toUpperCase() === ref.sku);
          if (target) {
            target.quantity = Number(Math.max(0, Number(target.quantity || 0) + delta).toFixed(6));
            if (target.quantity > 0 && (target.status === 'Unavailable' || target.status === 'Inactive')) {
              target.status = 'Available';
            }
          }
        }
      });

      existing.vendor_name = po.vendor_name ?? existing.vendor_name;
      existing.order_date = po.order_date ?? existing.order_date;
      existing.amount = po.amount ?? existing.amount;
      existing.status = nextStatus;
      existing.items_json = JSON.stringify(nextItems);
      writeDb(db);
      return { success: true };
    },
    updatePurchaseOrderStatus: async (id, status, received) => {
      const db = readDb();
      const po = db.purchase_orders.find((p) => p.id === id);
      if (!po) return { success: false, error: 'PO not found.' };
      const prevStatus = po.status === 'Received' || po.status === 'Closed' ? 'Received' : 'Request';
      const nextStatus = status === 'Received' ? 'Received' : 'Request';
      const items = JSON.parse(po.items_json || '[]');
      const updates = [];
      const missing = [];
      const findTarget = (line) => {
        const pid = Number(line.product_id) || 0;
        const sku = String(line.sku || '').trim().toUpperCase();
        return (
          (pid > 0 ? db.items.find((x) => x.id === pid) : null) ||
          db.items.find((x) => String(x.sku || '').trim().toUpperCase() === sku)
        );
      };
      const bump = (target, delta) => {
        target.quantity = Number(Math.max(0, Number(target.quantity || 0) + delta).toFixed(6));
        if (target.quantity > 0 && (target.status === 'Unavailable' || target.status === 'Inactive')) {
          target.status = 'Available';
        }
      };
      if (prevStatus !== 'Received' && nextStatus === 'Received') {
        items.forEach((line) => {
          const override = received && received[line.sku] !== undefined ? Number(received[line.sku]) : NaN;
          const qty = Number.isFinite(override) && override >= 0 ? override : Number(line.quantity) || 0;
          line.received_quantity = qty;
          if (qty <= 0) return;
          const target = findTarget(line);
          if (!target) { missing.push(line.sku || line.name || '?'); return; }
          const before = Number(target.quantity || 0);
          bump(target, qty);
          updates.push({ sku: line.sku, name: line.name, added: qty, before, after: target.quantity });
        });
      } else if (prevStatus === 'Received' && nextStatus !== 'Received') {
        items.forEach((line) => {
          const stocked = line.received_quantity !== undefined && line.received_quantity !== null
            ? Number(line.received_quantity) || 0
            : Number(line.quantity) || 0;
          const target = findTarget(line);
          if (target) bump(target, -stocked);
          delete line.received_quantity;
        });
      }
      po.items_json = JSON.stringify(items);
      po.status = nextStatus;
      writeDb(db);
      return { success: true, updates, missing };
    },
    deletePurchaseOrder: async (id) => {
      const db = readDb();
      db.purchase_orders = db.purchase_orders.filter((p) => p.id !== id);
      writeDb(db);
      return { success: true };
    },
    getVendors: async () => [...readDb().vendors].sort((a, b) => a.name.localeCompare(b.name)),
    addVendor: async (v) => {
      const db = readDb();
      const id = db.vendors.reduce((max, x) => Math.max(max, x.id || 0), 0) + 1;
      db.vendors.push({ id, ...v });
      writeDb(db);
      return { success: true };
    },
    deleteVendor: async (id) => {
      const db = readDb();
      db.vendors = db.vendors.filter((v) => v.id !== id);
      writeDb(db);
      return { success: true };
    },

    getExpenses: async () => [...readDb().expenses].sort((a, b) => b.id - a.id),
    getExpensesPage: async (opts = {}) => {
      opts = opts || {};
      const q = String(opts.search || '').trim().toLowerCase();
      const category = String(opts.category || '');
      const dateFrom = String(opts.dateFrom || '');
      const filtered = readDb().expenses
        .filter((e) => {
          if (q && !(containsCI(e.category, q) || containsCI(e.description, q) || containsCI(e.payment_mode, q) || containsCI(realText(e.amount), q))) return false;
          if (category && e.category !== category) return false;
          if (dateFrom && !(String(e.date ?? '') >= dateFrom)) return false;
          return true;
        })
        .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || b.id - a.id);
      const sumAmount = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return { ...pageOf(filtered, opts), sumAmount };
    },
    addExpense: async (exp) => {
      const db = readDb();
      const id = db.expenses.reduce((max, x) => Math.max(max, x.id || 0), 0) + 1;
      db.expenses.push({ id, ...exp });
      writeDb(db);
      return { success: true };
    },
    deleteExpense: async (id) => {
      const db = readDb();
      db.expenses = db.expenses.filter((e) => e.id !== id);
      writeDb(db);
      return { success: true };
    },
    getDayClosings: async () => [...readDb().day_closings].sort((a, b) => (b.closing_date || '').localeCompare(a.closing_date || '')),
    recordDayClosing: async (dc) => {
      const db = readDb();
      db.day_closings = db.day_closings.filter((d) => d.closing_date !== dc.closing_date);
      const id = db.day_closings.reduce((max, x) => Math.max(max, x.id || 0), 0) + 1;
      db.day_closings.push({ id, ...dc });
      writeDb(db);
      return { success: true };
    },
    getDatabasePath: async () => 'Browser Preview (localStorage) — SQLite runs inside the Desktop .exe',
    backupDatabase: async () => {
      const blob = new Blob([JSON.stringify(readDb(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tsp_enterprises_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true, path: a.download };
    },
    restoreDatabase: async () => ({
      success: false,
      error: 'SQLite .db restore runs inside the Desktop .exe application.',
    }),
    seedDemoData: async () => {
      return { success: true };
    },
    resetDatabase: async () => {
      const db = readDb();
      writeDb({
        shop_profile: db.shop_profile,
        items: [],
        racks: [],
        invoices: [],
        invoice_returns: [],
        purchase_orders: [],
        vendors: [],
        expenses: [],
        day_closings: [],
      });
      return { success: true };
    },
    getPrinters: async () => [
      {
        name: 'POS-80 Thermal Printer',
        displayName: 'POS-80 Thermal Printer',
        description: 'USB · Installed (Preview — live Windows printers detected in Desktop .exe)',
        portName: 'USB001',
        connectionType: 'USB',
        connectionState: 'connected',
        statusLabel: 'Connected',
        isDefault: true,
        status: 0,
        isSimulated: true,
      },
      {
        name: 'Microsoft Print to PDF',
        displayName: 'Microsoft Print to PDF',
        description: 'Virtual · A1–A6 PDF Export',
        portName: 'PORTPROMPT:',
        connectionType: 'Virtual',
        connectionState: 'connected',
        statusLabel: 'Connected',
        isDefault: false,
        status: 0,
        isSimulated: true,
      },
    ],
    printInvoice: async () => {
      window.print();
      return { success: true };
    },
    exportInvoicePdf: async () => {
      window.print();
      return { success: true, browserFallback: true };
    },
  };
}
