// Unified printer configuration, A1-A6 + Thermal paper size engine,
// and Indian Rupee amount-to-words converter.

export const PRINT_PREFS_KEY = 'tsp_print_prefs';

export const PAPER_SIZES = [
  { id: '80mm', label: '80mm Thermal Receipt', category: 'Thermal', cssSize: '80mm auto', widthMm: 80, heightMm: 297, fontScale: 0.86, thermal: true },
  { id: '58mm', label: '58mm Thermal Receipt', category: 'Thermal', cssSize: '58mm auto', widthMm: 58, heightMm: 297, fontScale: 0.74, thermal: true },
  { id: 'A6', label: 'A6 (105 × 148 mm)', category: 'ISO Sheet', cssSize: 'A6', widthMm: 105, heightMm: 148, fontScale: 0.82, thermal: false },
  { id: 'A5', label: 'A5 (148 × 210 mm)', category: 'ISO Sheet', cssSize: 'A5', widthMm: 148, heightMm: 210, fontScale: 0.92, thermal: false },
  { id: 'A4', label: 'A4 (210 × 297 mm)', category: 'ISO Sheet', cssSize: 'A4', widthMm: 210, heightMm: 297, fontScale: 1.0, thermal: false },
  { id: 'A3', label: 'A3 (297 × 420 mm)', category: 'ISO Sheet', cssSize: 'A3', widthMm: 297, heightMm: 420, fontScale: 1.25, thermal: false },
  { id: 'A2', label: 'A2 (420 × 594 mm)', category: 'ISO Sheet', cssSize: 'A2', widthMm: 420, heightMm: 594, fontScale: 1.55, thermal: false },
  { id: 'A1', label: 'A1 (594 × 841 mm)', category: 'ISO Sheet', cssSize: 'A1', widthMm: 594, heightMm: 841, fontScale: 1.9, thermal: false },
];

export const DEFAULT_PRINT_PREFS = {
  printerName: '', // '' uses OS default printer
  format: '80mm',
  orientation: 'portrait', // 'portrait' | 'landscape'
  afterPayment: 'preview', // 'auto' | 'preview' | 'none'
  autoPrint: false,
  openPreviewOnManual: true,
  allowHistoryReprint: true,
  enablePdfExport: true,
};

export function normalizeFormat(fmt) {
  if (!fmt) return '80mm';
  const map = { thermal: '80mm', a4: 'A4', a5: 'A5', a6: 'A6', a3: 'A3', a2: 'A2', a1: 'A1' };
  const lower = String(fmt).toLowerCase();
  if (map[lower]) return map[lower];
  if (PAPER_SIZES.some((p) => p.id === fmt)) return fmt;
  return '80mm';
}

export function getPaperSpec(format) {
  const norm = normalizeFormat(format);
  return PAPER_SIZES.find((p) => p.id === norm) || PAPER_SIZES[0];
}

export function getPrintPreferences() {
  try {
    const raw = localStorage.getItem(PRINT_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const format = normalizeFormat(parsed.format);
      const autoPrint = Boolean(parsed.autoPrint);
      const afterPayment = parsed.afterPayment || (autoPrint ? 'auto' : 'preview');
      return {
        ...DEFAULT_PRINT_PREFS,
        ...parsed,
        format,
        afterPayment,
        autoPrint: afterPayment === 'auto',
      };
    }
  } catch (_) {}
  return { ...DEFAULT_PRINT_PREFS };
}

export function savePrintPreferences(prefs) {
  const format = normalizeFormat(prefs.format);
  const afterPayment = prefs.afterPayment || (prefs.autoPrint ? 'auto' : 'preview');
  const clean = {
    ...DEFAULT_PRINT_PREFS,
    ...prefs,
    format,
    afterPayment,
    autoPrint: afterPayment === 'auto',
  };
  try {
    localStorage.setItem(PRINT_PREFS_KEY, JSON.stringify(clean));
    window.dispatchEvent(new CustomEvent('print-prefs-updated', { detail: clean }));
  } catch (_) {}
  return clean;
}

// Dynamically inject exact @page size & margins for A1-A6 and Thermal receipts
export function applyDynamicPageSize(format, orientation = 'portrait') {
  if (typeof document === 'undefined') return;
  const spec = getPaperSpec(format);
  const styleId = 'tsp-dynamic-print-page';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const sizeRule = spec.thermal
    ? `${spec.widthMm}mm auto`
    : `${spec.cssSize} ${orientation === 'landscape' ? 'landscape' : 'portrait'}`;

  const marginRule = spec.thermal
    ? '2mm'
    : spec.id === 'A6'
    ? '5mm'
    : spec.id === 'A5'
    ? '7mm'
    : spec.id === 'A4'
    ? '10mm'
    : '14mm';

  styleEl.textContent = `@media print { @page { size: ${sizeRule}; margin: ${marginRule}; } }`;
}

// Execute print via Electron native printer API (silent or system dialog) or browser fallback
export async function executePrint({
  format = '80mm',
  orientation = 'portrait',
  deviceName = '',
  silent = false,
} = {}) {
  const spec = getPaperSpec(format);
  applyDynamicPageSize(spec.id, orientation);

  // Give React one animation frame to commit the printable receipt DOM
  await new Promise((r) => setTimeout(r, 80));

  if (window.api && window.api.printInvoice) {
    return await window.api.printInvoice({
      silent: Boolean(silent),
      deviceName: deviceName || '',
      format: spec.id,
      orientation: orientation || 'portrait',
    });
  }

  window.print();
  return { success: true };
}

export async function exportReceiptPdf({
  invoiceNumber = 'INVOICE',
  format = 'A4',
  orientation = 'portrait',
} = {}) {
  const spec = getPaperSpec(format);
  applyDynamicPageSize(spec.id, orientation);
  await new Promise((r) => setTimeout(r, 80));

  if (window.api && window.api.exportInvoicePdf) {
    return await window.api.exportInvoicePdf({
      invoiceNumber,
      format: spec.id,
      orientation: orientation || 'portrait',
    });
  }

  window.print();
  return { success: true, browserFallback: true };
}

// Convert numeric INR amount to Indian numbering words (Crore, Lakh, Thousand, Hundred)
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsToWords(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`;
}

function intToIndianWords(num) {
  if (num === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = Math.floor(num / 100);
  const rest = num % 100;

  if (crore) parts.push(`${intToIndianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));

  return parts.join(' ');
}

export function amountToIndianWords(amount) {
  const num = Math.max(0, Number(amount) || 0);
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Rupees Zero Only';
  const rupeePart = rupees > 0 ? `Rupees ${intToIndianWords(rupees)}` : '';
  const paisePart = paise > 0 ? `${rupees > 0 ? ' and ' : ''}${twoDigitsToWords(paise)} Paise` : '';
  return `${rupeePart}${paisePart} Only`;
}

export function formatBillDate(dateStr) {
  if (!dateStr) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  }
  const s = String(dateStr).trim();
  const d = new Date(/^\d{4}-\d{2}-\d{2}\s/.test(s) ? s.replace(' ', 'T') : s);
  if (isNaN(d.getTime())) return s;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
