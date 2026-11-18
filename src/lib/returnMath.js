// Pure sales-return maths, shared by the Electron main process, the browser fallback and the UI,
// so refunds are computed identically everywhere.

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const r6 = (n) => Math.round((Number(n) + Number.EPSILON) * 1e6) / 1e6;

export const RETURN_REASONS = ['customer_return', 'damaged', 'wrong_item', 'price_issue', 'other'];
// Reasons where the goods are not fit for resale, so stock should not be added back by default.
export const NON_RESTOCK_REASONS = ['damaged'];

export function parseInvoiceLines(inv) {
  if (!inv) return [];
  if (Array.isArray(inv.items)) return inv.items;
  try { return JSON.parse(inv.items_json || '[]'); } catch { return []; }
}

export function parseReturnLines(ret) {
  if (!ret) return [];
  if (Array.isArray(ret.lines)) return ret.lines;
  try { return JSON.parse(ret.items_json || '[]'); } catch { return []; }
}

/** index -> quantity already returned (sold-unit quantity) */
export function returnedQtyByLine(returns) {
  const map = {};
  (returns || []).forEach((r) => parseReturnLines(r).forEach((l) => {
    map[l.index] = r6((map[l.index] || 0) + Number(l.qty || 0));
  }));
  return map;
}

/** Share of the bill-level discount applied to every line (invoice.total / sum of line totals). */
function discountRatio(inv, lines) {
  const lineSum = lines.reduce((s, l) => s + (Number(l.total) || (Number(l.quantity) * Number(l.rate)) || 0), 0);
  const total = Number(inv.total);
  if (!(lineSum > 0) || !(total >= 0)) return 1;
  return Math.min(1, total / lineSum);
}

export function lineSummaries(inv, returns) {
  const lines = parseInvoiceLines(inv);
  const done = returnedQtyByLine(returns);
  const ratio = discountRatio(inv, lines);
  return lines.map((l, index) => {
    const sold = Number(l.quantity ?? l.qty) || 0;
    const lineNet = (Number(l.total) || sold * (Number(l.rate) || 0)) * ratio; // after line + bill discount
    const returned = Math.min(sold, done[index] || 0);
    return {
      index,
      sku: l.sku || '',
      id: l.id,
      name: l.name || '',
      unit: l.unit || 'PCS',
      sold,
      returned,
      remaining: r6(sold - returned),
      unitRefund: sold > 0 ? lineNet / sold : 0,
      lineNet: r2(lineNet),
      stockPerUnit: sold > 0 ? (Number(l.stock_deduction_qty ?? sold) / sold) : 1,
      rate: Number(l.rate) || 0,
    };
  });
}

/**
 * Validate a return request and work out refund + stock-back.
 * req = [{ index, qty }]. Returns { error } or { lines, refund, stockLines, fullyReturned }.
 */
export function planReturn(inv, priorReturns, req) {
  const sums = lineSummaries(inv, priorReturns);
  const lines = [];
  for (const r of req || []) {
    const qty = r6(Number(r.qty) || 0);
    if (qty <= 0) continue;
    const s = sums[r.index];
    if (!s) return { error: 'Unknown bill line.' };
    if (qty > s.remaining + 1e-9) {
      return { error: `Only ${s.remaining} ${s.unit} of "${s.name}" can still be returned.` };
    }
    lines.push({
      index: s.index, sku: s.sku, id: s.id, name: s.name, unit: s.unit,
      qty, rate: s.rate, stockQty: r6(qty * s.stockPerUnit),
      amount: r2(qty * s.unitRefund),
    });
  }
  if (lines.length === 0) return { error: 'Select at least one item to return.' };

  const priorRefund = (priorReturns || []).reduce((a, r) => a + (Number(r.refund_amount) || 0), 0);
  let refund = r2(lines.reduce((a, l) => a + l.amount, 0));
  const willRemain = sums.some((s) => {
    const q = lines.find((l) => l.index === s.index)?.qty || 0;
    return s.remaining - q > 1e-9;
  });
  const fullyReturned = !willRemain;
  if (fullyReturned) {
    // Close the invoice out exactly: no paise left behind by per-line rounding.
    refund = r2(Number(inv.total) - priorRefund);
    const drift = r2(refund - lines.reduce((a, l) => a + l.amount, 0));
    if (drift !== 0) lines[lines.length - 1].amount = r2(lines[lines.length - 1].amount + drift);
  }
  return { lines, refund, fullyReturned };
}

/**
 * Net an invoice for reporting: reduce quantities / totals by what was returned, so sales,
 * profit and payment-mode splits all reflect the real position. Fully returned = status 'Returned'.
 */
export function netInvoice(inv, returns) {
  if (!returns || returns.length === 0 || inv.status === 'Returned') return inv;
  const lines = parseInvoiceLines(inv);
  const done = returnedQtyByLine(returns);
  const refund = returns.reduce((a, r) => a + (Number(r.refund_amount) || 0), 0);
  const netLines = lines.map((l, i) => {
    const sold = Number(l.quantity) || 0;
    const keep = sold > 0 ? Math.max(0, sold - (done[i] || 0)) / sold : 1;
    return {
      ...l,
      quantity: r6(sold * keep),
      stock_deduction_qty: r6(Number(l.stock_deduction_qty ?? sold) * keep),
      discount: r2((Number(l.discount) || 0) * keep),
      total: r2((Number(l.total) || 0) * keep),
    };
  }).filter((l) => l.quantity > 0);
  const subtotal = r2(netLines.reduce((a, l) => a + (Number(l.total) + (Number(l.discount) || 0)), 0));
  return {
    ...inv,
    items_json: JSON.stringify(netLines),
    items: netLines,
    items_count: netLines.length,
    subtotal,
    total: r2(Number(inv.total) - refund),
    discount: r2(subtotal - (Number(inv.total) - refund)),
  };
}

/** Fetch invoices already netted for returns (used by Finance and Dashboard). */
export async function loadNetInvoices() {
  const api = typeof window !== 'undefined' ? window.api : null;
  const invoices = api && api.getInvoices ? (await api.getInvoices()) || [] : [];
  const returns = api && api.getReturns ? (await api.getReturns()) || [] : [];
  const byInv = new Map();
  returns.forEach((r) => {
    const list = byInv.get(r.invoice_id);
    if (list) list.push(r); else byInv.set(r.invoice_id, [r]);
  });
  return { invoices: invoices.map((i) => netInvoice(i, byInv.get(i.id))), returns };
}
