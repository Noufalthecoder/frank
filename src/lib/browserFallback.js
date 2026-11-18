import { normalizeUnit } from './units.js';

// LocalStorage-backed fallback for window.api when previewing in a regular browser.
// Inside Electron (.exe), preload.js defines window.api (backed by SQLite), so this does nothing.

const STORAGE_KEY = 'tsp_enterprises_browser_db_v3';

function formatLocalDateTime(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function buildDefaultRacks() {
  const specs = [
    { code: 'R01', name: 'Fasteners', zone: 'Fasteners', levels: 4, slots_per_level: 4 },
    { code: 'R02', name: 'Plumbing & Paints', zone: 'Plumbing & Paints', levels: 4, slots_per_level: 4 },
    { code: 'R03', name: 'Washers & Nuts', zone: 'Fasteners', levels: 4, slots_per_level: 4 },
    { code: 'R04', name: 'Tools', zone: 'Hardware', levels: 4, slots_per_level: 4 },
    { code: 'R05', name: 'Electrical', zone: 'Electrical', levels: 4, slots_per_level: 4 },
  ];
  return specs.map((r, idx) => {
    const bins = [];
    for (let l = 1; l <= r.levels; l++) {
      for (let s = 1; s <= r.slots_per_level; s++) {
        bins.push({
          bin_code: `${r.code}-L${l}-S${s}`,
          rack_code: r.code,
          level_no: l,
          slot_no: s,
          quantity: 0,
        });
      }
    }
    return { id: idx + 1, ...r, bins };
  });
}

function getStarterItems() {
  return [
    { id: 1, sku: 'HB-M6-20', name: 'Hex Bolt M6 x 20mm', size: 'M6 x 20', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', selling_price: 6.5, cost_price: 4.0, quantity: 650, reorder_level: 50, bin_id: 'R01-L1-S1', status: 'Active' },
    { id: 2, sku: 'HB-M8-40', name: 'Hex Bolt M8 x 40mm', size: 'M8 x 40', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', selling_price: 12.0, cost_price: 8.5, quantity: 1240, reorder_level: 50, bin_id: 'R01-L1-S4', status: 'Active' },
    { id: 3, sku: 'HB-M10-50', name: 'Hex Bolt M10 x 50mm', size: 'M10 x 50', unit: 'PCS', category: 'Fasteners', brand: 'Unbrako', selling_price: 18.0, cost_price: 12.5, quantity: 842, reorder_level: 40, bin_id: 'R01-L2-S1', status: 'Active' },
    { id: 4, sku: 'NT-M8', name: 'Hex Nut M8', size: 'M8', unit: 'PCS', category: 'Fasteners', brand: 'Generic', selling_price: 2.0, cost_price: 1.2, quantity: 4980, reorder_level: 500, bin_id: 'R02-L1-S2', status: 'Active' },
    { id: 5, sku: 'WS-M8', name: 'Flat Washer M8', size: 'M8', unit: 'PCS', category: 'Fasteners', brand: 'Generic', selling_price: 1.5, cost_price: 0.8, quantity: 5320, reorder_level: 500, bin_id: 'R03-L1-S1', status: 'Active' },
    { id: 6, sku: 'DB-10', name: 'SDS Plus Drill Bit 10mm', size: '10mm', unit: 'PCS', category: 'Tools', brand: 'Bosch', selling_price: 220.0, cost_price: 160.0, quantity: 118, reorder_level: 20, bin_id: 'R04-L1-S3', status: 'Active' },
    { id: 7, sku: 'DB-12', name: 'SDS Plus Drill Bit 12mm', size: '12mm', unit: 'PCS', category: 'Tools', brand: 'Bosch', selling_price: 280.0, cost_price: 200.0, quantity: 0, reorder_level: 15, bin_id: 'R04-L1-S4', status: 'Active' },
    { id: 8, sku: 'HM-500', name: 'Ball Peen Hammer 500g', size: '500g', unit: 'PCS', category: 'Tools', brand: 'Taparia', selling_price: 280.0, cost_price: 210.0, quantity: 45, reorder_level: 15, bin_id: 'R04-L2-S1', status: 'Active' },
    { id: 9, sku: 'DBL-4', name: 'Diamond Blade 4" Concrete', size: '4 inch', unit: 'PCS', category: 'Tools', brand: 'Bosch', selling_price: 290.0, cost_price: 210.0, quantity: 0, reorder_level: 10, bin_id: 'R04-L4-S1', status: 'Active' },
    { id: 10, sku: 'WR-15-RD', name: 'Copper House Wire 1.5 sq mm Red 90m', size: '1.5 sq mm', unit: 'BOX', category: 'Electrical', brand: 'Finolex', selling_price: 1950.0, cost_price: 1620.0, quantity: 18, reorder_level: 5, bin_id: 'R05-L1-S1', status: 'Active' },
    { id: 11, sku: 'PVC-1', name: 'PVC Pipe 1" Class 3 6kg', size: '1 inch', unit: 'm', category: 'Plumbing', brand: 'Finolex', selling_price: 85.0, cost_price: 60.0, quantity: 96, reorder_level: 30, bin_id: 'R02-L2-S1', status: 'Active' },
    { id: 12, sku: 'PBR-3', name: 'Flat Paint Brush 3"', size: '3 inch', unit: 'PCS', category: 'Paints & Adhesives', brand: 'Generic', selling_price: 55.0, cost_price: 36.0, quantity: 0, reorder_level: 10, bin_id: 'R02-L3-S4', status: 'Active' },
    { id: 13, sku: 'GI-BW-20G', name: 'GI Binding Wire 20 Gauge', size: '20 SWG', unit: 'kg', category: 'Fasteners', brand: 'Tata Agrico', selling_price: 120.0, cost_price: 90.0, quantity: 50, reorder_level: 10, bin_id: 'R01-L3-S3', status: 'Active' },
    { id: 14, sku: 'NYL-ROPE-8', name: 'Nylon Braided Rope 8mm', size: '8mm', unit: 'm', category: 'Others', brand: 'Generic', selling_price: 25.0, cost_price: 16.0, quantity: 150, reorder_level: 25, bin_id: 'R02-L4-S1', status: 'Active' },
    { id: 15, sku: 'MS-NAIL-2IN', name: 'MS Wire Nails 2" (Loose)', size: '2 inch', unit: 'kg', category: 'Fasteners', brand: 'Tata Agrico', selling_price: 110.0, cost_price: 82.0, quantity: 40, reorder_level: 10, bin_id: 'R01-L3-S4', status: 'Active' },
    { id: 16, sku: 'CU-WND-24G', name: 'Enamelled Copper Winding Wire', size: '24 SWG', unit: 'g', category: 'Electrical', brand: 'Finolex', selling_price: 1.5, cost_price: 1.05, quantity: 2000, reorder_level: 250, bin_id: 'R05-L2-S2', status: 'Active' },
  ];
}

function getCleanInitialData() {
  return {
    shop_profile: {
      id: 1,
      shop_name: 'T. S. P Enterprises',
      tagline: 'Hardware, Tools & Fasteners',
      phone: '+91 98765 43210',
      email: 'tspenterprises@gmail.com',
      address_line1: 'Beach Road',
      address_line2: 'Tharuvaikulam',
      city: 'Thoothukudi',
      pincode: '628105',
      invoice_footer: 'Thank you for your business! Goods once sold cannot be returned without bill.',
    },
    items: getStarterItems(),
    racks: buildDefaultRacks(),
    invoices: [],
    purchase_orders: [],
    vendors: [
      { id: 1, name: 'KPR Fasteners', contact_person: 'K. Ramesh', phone: '+91 94441 23456', city: 'Coimbatore' },
      { id: 2, name: 'Metro Tools Co.', contact_person: 'S. Kumar', phone: '+91 98840 54321', city: 'Chennai' },
      { id: 3, name: 'Shree Metals', contact_person: 'Anand Patel', phone: '+91 97123 45678', city: 'Ahmedabad' },
    ],
    expenses: [],
    day_closings: [],
  };
}

function getDefaultData() {
  return {
    ...getCleanInitialData(),
    invoices: [
      { id: 1, invoice_number: 'INV-001248', date_time: formatLocalDateTime(), customer_name: 'Raj Builders', customer_phone: '', subtotal: 1240, discount: 0, total: 1240, payment_mode: 'Cash', items_count: 5, items_json: '[]', status: 'Completed' },
      { id: 2, invoice_number: 'INV-001247', date_time: formatLocalDateTime(), customer_name: 'Sree Constructions', customer_phone: '', subtotal: 2500, discount: 40, total: 2460, payment_mode: 'UPI', items_count: 8, items_json: '[]', status: 'Completed' },
      { id: 3, invoice_number: 'INV-001246', date_time: formatLocalDateTime(), customer_name: 'KPN Interiors', customer_phone: '', subtotal: 940, discount: 0, total: 940, payment_mode: 'Card', items_count: 3, items_json: '[]', status: 'Completed' },
    ],
    purchase_orders: [
      { id: 1, po_number: 'PO-00284', vendor_name: 'KPR Fasteners', order_date: new Date().toISOString().slice(0, 10), amount: 48500, status: 'Open', items_json: '[]' },
      { id: 2, po_number: 'PO-00283', vendor_name: 'Metro Tools Co.', order_date: new Date().toISOString().slice(0, 10), amount: 72000, status: 'Received', items_json: '[]' },
    ],
    expenses: [
      { id: 1, category: 'Shop Rent', description: 'Monthly shop lease', amount: 60000, date: new Date().toISOString().slice(0, 10), payment_mode: 'Bank' },
      { id: 2, category: 'Electricity', description: 'TNEB commercial bill', amount: 18400, date: new Date().toISOString().slice(0, 10), payment_mode: 'UPI' },
    ],
  };
}

function readDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);

    // Migrate catalog items from previous browser storage versions without carrying over dummy invoices/expenses
    const initial = getCleanInitialData();
    const prevV1Raw = localStorage.getItem('tsp_enterprises_browser_db_v1');
    const prevV2Raw = localStorage.getItem('tsp_enterprises_browser_db_v2');
    const prevV1 = prevV1Raw ? JSON.parse(prevV1Raw) : null;
    const prevV2 = prevV2Raw ? JSON.parse(prevV2Raw) : null;

    if (prevV1 || prevV2) {
      const mergedItemsMap = new Map();
      const baseItems = (prevV1?.items && prevV1.items.length > 0) ? prevV1.items : initial.items;
      baseItems.forEach((item) => {
        if (item?.sku) mergedItemsMap.set(String(item.sku).toUpperCase(), item);
      });
      (prevV2?.items || []).forEach((item) => {
        if (item?.sku) mergedItemsMap.set(String(item.sku).toUpperCase(), item);
      });
      let nextId = 1;
      initial.items = Array.from(mergedItemsMap.values()).map((item) => ({
        ...item,
        id: nextId++,
      }));
      if (prevV2?.shop_profile || prevV1?.shop_profile) {
        initial.shop_profile = { ...initial.shop_profile, ...(prevV1?.shop_profile || {}), ...(prevV2?.shop_profile || {}) };
      }
      if (prevV2?.invoices?.length) {
        initial.invoices = prevV2.invoices;
      }
    }

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
      if (db.items.some((i) => i.sku.toUpperCase() === normalizedSku)) {
        return { success: false, error: `SKU "${normalizedSku}" already exists. Use a unique SKU or edit the existing product.` };
      }
      const id = db.items.reduce((max, i) => Math.max(max, i.id || 0), 0) + 1;
      db.items.push({ ...item, id, sku: normalizedSku, status: item.status || 'Available' });
      writeDb(db);
      return { success: true, id };
    },
    updateItem: async (item) => {
      const db = readDb();
      const normalizedSku = String(item.sku || '').trim().toUpperCase();
      if (db.items.some((i) => i.id !== item.id && i.sku.toUpperCase() === normalizedSku)) {
        return { success: false, error: `Another product already uses SKU "${normalizedSku}".` };
      }
      db.items = db.items.map((i) => (i.id === item.id ? { ...i, ...item, sku: normalizedSku } : i));
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
          bin_id: String(row.bin_id || '').trim().toUpperCase(),
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
      return { success: true, count };
    },

    getRacks: async () => {
      const db = readDb();
      return db.racks
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((r) => {
          const bins = (r.bins || []).map((b) => {
            const binItems = db.items.filter(
              (i) => (i.bin_id || '').toUpperCase() === b.bin_code.toUpperCase()
            );
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
      db.racks = db.racks.filter((r) => r.code !== code);
      writeDb(db);
      return { success: true };
    },

    getInvoices: async () => [...readDb().invoices].sort((a, b) => b.id - a.id),
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
    returnInvoice: async (id) => {
      const db = readDb();
      const inv = db.invoices.find((i) => i.id === id);
      if (!inv) return { success: false, error: 'Invoice not found.' };
      if (inv.status === 'Returned') return { success: false, error: 'Invoice already returned.' };
      const items = JSON.parse(inv.items_json || '[]');
      items.forEach((sold) => {
        const target = db.items.find((i) => i.sku === sold.sku || i.id === sold.id);
        if (target) {
          const addBack = Number(sold.stock_deduction_qty ?? sold.quantity ?? 0);
          target.quantity = Number((Number(target.quantity) + addBack).toFixed(6));
        }
      });
      inv.status = 'Returned';
      writeDb(db);
      return { success: true, restockedCount: items.length };
    },

    getPurchaseOrders: async () => [...readDb().purchase_orders].sort((a, b) => b.id - a.id),
    createPurchaseOrder: async (po) => {
      const db = readDb();
      const id = db.purchase_orders.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
      db.purchase_orders.push({
        id,
        po_number: po.po_number || `PO-${String(Math.floor(10000 + Math.random() * 90000))}`,
        vendor_name: po.vendor_name,
        order_date: po.order_date,
        amount: po.amount,
        status: po.status || 'Open',
        items_json: JSON.stringify(po.items || []),
      });
      writeDb(db);
      return { success: true };
    },
    updatePurchaseOrderStatus: async (id, status) => {
      const db = readDb();
      const po = db.purchase_orders.find((p) => p.id === id);
      if (!po) return { success: false, error: 'PO not found.' };
      if (po.status !== 'Received' && status === 'Received') {
        const items = JSON.parse(po.items_json || '[]');
        items.forEach((i) => {
          const target = db.items.find((x) => x.sku === i.sku);
          if (target) target.quantity = Number(target.quantity) + Number(i.quantity || 0);
        });
      }
      po.status = status;
      writeDb(db);
      return { success: true };
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
      writeDb(getDefaultData());
      return { success: true };
    },
    resetDatabase: async () => {
      const db = readDb();
      writeDb({
        shop_profile: db.shop_profile,
        items: [],
        racks: [],
        invoices: [],
        purchase_orders: [],
        vendors: [],
        expenses: [],
        day_closings: [],
      });
      return { success: true };
    },
  };
}
