import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Eye,
  Printer,
  X,
  CheckCircle2
} from 'lucide-react';
import { RotateCcw } from 'lucide-react';
import { useAppDialog } from '../components/AppDialogContext.jsx';
import PrintableReceipt from '../components/PrintableReceipt.jsx';
import PrintPreviewModal from '../components/PrintPreviewModal.jsx';
import PrintErrorBanner from '../components/PrintErrorBanner.jsx';
import { getPrintPreferences, executePrint, exportReceiptPdf } from '../lib/printConfig.js';
import { formatQty, isMeasurableUnit } from '../lib/units.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import ExportMenu from '../components/ExportMenu.jsx';
import Pagination, { usePagination } from '../components/Pagination.jsx';

const PAGE_SIZES = [10, 12, 25, 50, 100];

// Lower bound (local time) for the date-range filter, in the DB's 'YYYY-MM-DD HH:MM:SS' format
const dateFromFor = (range) => {
  const days = range === 'Today' ? 0 : range === 'Last 7 Days' ? 6 : range === 'Last 30 Days' ? 29 : null;
  if (days === null) return '';
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`;
};

export default function SalesHistory() {
  const { t, tName } = useLanguage();
  const { showConfirm } = useAppDialog();
  const payLabel = (m) => {
    const k = { Cash: 'pos_cash', UPI: 'pos_upi', Card: 'pos_card', Bank: 'fi_pay_bank' }[m];
    return k ? t(k) : m;
  };
  const statusLabel = (s) => (s === 'Returned' ? t('hist_returned') : s === 'Completed' ? t('hist_completed') : s);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [sumTotal, setSumTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const reqId = React.useRef(0);
  const [shopProfile, setShopProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('All Time');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [printPrefs, setPrintPrefs] = useState(getPrintPreferences());
  const [printFailure, setPrintFailure] = useState(null);
  const [retryingPrint, setRetryingPrint] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (window.api && window.api.getShopProfile) {
      window.api.getShopProfile().then((p) => { if (p) setShopProfile(p); });
    }
    const handleStockUpdate = () => setRefreshTick((n) => n + 1);
    const handlePrefsUpdate = (e) => setPrintPrefs(e.detail || getPrintPreferences());
    window.addEventListener('stock-updated', handleStockUpdate);
    window.addEventListener('print-prefs-updated', handlePrefsUpdate);
    return () => {
      window.removeEventListener('stock-updated', handleStockUpdate);
      window.removeEventListener('print-prefs-updated', handlePrefsUpdate);
    };
  }, []);

  // Server-side paging: only the visible page (plus a total) ever leaves the database
  const pagination = usePagination(total, { storageKey: 'sales-history', sizes: PAGE_SIZES, defaultSize: 12 });
  const { page, pageSize, setPage, reset: resetPage } = pagination;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    resetPage();
  }, [debouncedSearch, dateRange, resetPage]);

  useEffect(() => {
    if (!(window.api && window.api.getInvoicesPage)) return undefined;
    const id = ++reqId.current;
    setLoading(true);
    window.api
      .getInvoicesPage({ page, pageSize, search: debouncedSearch, dateFrom: dateFromFor(dateRange) })
      .then((res) => {
        if (id !== reqId.current || !res) return; // a newer request superseded this one
        setRows(res.rows || []);
        setTotal(res.total || 0);
        setSumTotal(res.sumTotal || 0);
      })
      .finally(() => id === reqId.current && setLoading(false));
    return undefined;
  }, [page, pageSize, debouncedSearch, dateRange, refreshTick]);

  const loadInvoices = async () => setRefreshTick((n) => n + 1);

  const handleReturn = async (inv) => {
    const ok = await showConfirm({
      title: t('hist_return'),
      message: t('hist_return_confirm', { n: inv.invoice_number }),
      confirmLabel: t('hist_return'),
      tone: 'danger',
    });
    if (!ok) return;
    const res = window.api && window.api.returnInvoice ? await window.api.returnInvoice(inv.id) : null;
    if (!res || res.success === false) {
      showToast((res && res.error) || 'Return failed.');
      return;
    }
    showToast(t('hist_return_done', { n: inv.invoice_number }));
    setSelectedInvoice({ ...inv, status: 'Returned' });
    await loadInvoices();
    window.dispatchEvent(new CustomEvent('stock-updated'));
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const parseItems = (inv) => {
    if (!inv) return [];
    if (Array.isArray(inv.items)) return inv.items;
    try {
      return JSON.parse(inv.items_json || '[]');
    } catch (_) {
      return [];
    }
  };

  const handlePrint = async (inv) => {
    const prefs = getPrintPreferences();
    setPrintPrefs(prefs);
    if (prefs.allowHistoryReprint === false) {
      showToast(t('fi_reprint_disabled'));
      return;
    }
    if (prefs.openPreviewOnManual !== false) {
      setSelectedInvoice(null);
      setPreviewInvoice(inv);
    } else {
      setPrintTarget(inv);
      const res = await executePrint({
        silent: false,
        deviceName: prefs.printerName || '',
        format: prefs.format || '80mm',
        orientation: prefs.orientation || 'portrait',
      });
      if (!res || !res.success) {
        setPrintFailure({
          invoice: inv,
          reason: res?.error || t('fi_printer_unavailable'),
        });
      }
    }
  };

  const getSalesExport = async () => {
    // Export covers the whole filtered result, not just the visible page
    let all = [];
    for (let p = 1; ; p++) {
      const res = await window.api.getInvoicesPage({ page: p, pageSize: 200, search: debouncedSearch, dateFrom: dateFromFor(dateRange) });
      all = all.concat(res.rows || []);
      if (p >= (res.totalPages || 1)) break;
    }
    return buildSalesExport(all);
  };

  const buildSalesExport = (list) => ({
    title: t('fi_export_title_sales'),
    filename: `sales_history_${new Date().toISOString().split('T')[0]}`,
    headers: [t('fi_exp_invoice_no'), t('fi_exp_datetime'), t('fi_exp_customer'), t('fi_exp_phone'), t('fi_exp_items'), t('fi_exp_subtotal'), t('fi_exp_discount'), t('fi_exp_total'), t('fi_exp_mode'), t('fi_exp_status')],
    rows: list.map((inv) => [
      inv.invoice_number, inv.date_time || '', inv.customer_name || t('fi_walkin'), inv.customer_phone || '',
      Number(inv.items_count || 0), Number(inv.subtotal || 0), Number(inv.discount || 0), Number(inv.total || 0),
      payLabel(inv.payment_mode || 'Cash'), statusLabel(inv.status || 'Completed'),
    ]),
  });


  return (
    <div className="space-y-5">
      {/* Floating Top-Right Toast Notification (2s) */}
      {toast && (
        <div className="animate-toast fixed top-4 right-5 z-[100] flex items-center gap-2 bg-white text-slate-800 border border-slate-200/90 shadow-xl shadow-slate-900/10 px-4 py-2.5 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Printer Error Recovery Card */}
      {printFailure && (
        <div className="fixed top-4 right-5 z-[95] w-full max-w-md">
          <PrintErrorBanner
            invoiceNumber={printFailure.invoice?.invoice_number}
            reason={printFailure.reason}
            retrying={retryingPrint}
            onRetry={async () => {
              setRetryingPrint(true);
              const prefs = getPrintPreferences();
              const res = await executePrint({
                silent: false,
                deviceName: prefs.printerName || '',
                format: prefs.format || '80mm',
                orientation: prefs.orientation || 'portrait',
              });
              setRetryingPrint(false);
              if (res && res.success) {
                setPrintFailure(null);
                showToast(t('fi_invoice_printed', { no: printFailure.invoice?.invoice_number }));
              } else {
                setPrintFailure((prev) =>
                  prev ? { ...prev, reason: res?.error || t('fi_printer_unavailable') } : null
                );
              }
            }}
            onSavePdf={async () => {
              setRetryingPrint(true);
              const prefs = getPrintPreferences();
              const res = await exportReceiptPdf({
                invoiceNumber: printFailure.invoice?.invoice_number || 'INVOICE',
                format: prefs.format === '80mm' || prefs.format === '58mm' ? 'A4' : prefs.format,
                orientation: prefs.orientation || 'portrait',
              });
              setRetryingPrint(false);
              if (res && res.success) {
                setPrintFailure(null);
                showToast(res.path ? t('fi_pdf_saved') : t('fi_pdf_opened'));
              }
            }}
            onDismiss={() => setPrintFailure(null)}
          />
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-slate-900 tracking-[-0.025em]">{t('hist_title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">{t('hist_subtitle')}</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All Time">{t('date_all')}</option>
            <option value="Today">{t('date_today')}</option>
            <option value="Last 7 Days">{t('date_7d')}</option>
            <option value="Last 30 Days">{t('date_30d')}</option>
          </select>
          <ExportMenu getSpec={getSalesExport} onDone={showToast} />
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="surface-card p-3.5 rounded-2xl flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('hist_search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500">
          {t('hist_filtered_total')}{' '}
          <span className="text-slate-900 font-bold">
            ₹{' '}
            {Number(sumTotal)
              .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="surface-card rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">{t('hist_col_inv')}</th>
              <th className="py-3 px-4">{t('hist_col_date')}</th>
              <th className="py-3 px-4">{t('hist_col_cust')}</th>
              <th className="py-3 px-4 text-center">{t('hist_col_items')}</th>
              <th className="py-3 px-4">{t('hist_col_mode')}</th>
              <th className="py-3 px-4">{t('hist_col_status')}</th>
              <th className="py-3 px-4 text-right">{t('hist_col_amount')}</th>
              <th className="py-3 px-4 text-right">{t('hist_col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {rows.map((inv) => {
              const isReturned = inv.status === 'Returned';
              return (
                <tr key={inv.id} className={`hover:bg-slate-50/80 transition-colors ${isReturned ? 'opacity-70 bg-rose-50/20' : ''}`}>
                  <td className="py-3 px-4 font-mono font-bold text-blue-600">
                    {inv.invoice_number}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {inv.date_time || '—'}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {inv.customer_name || t('fi_walkin')}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-700 font-medium">
                    {inv.items_count || 1}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[13px]">
                      {payLabel(inv.payment_mode || 'Cash')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[12px] font-bold border ${
                        isReturned
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isReturned ? t('hist_returned') : t('hist_completed')}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-right font-bold ${isReturned ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                    ₹ {Number(inv.total).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-slate-400">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="p-1.5 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                        title={t('fi_view_details')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {printPrefs.allowHistoryReprint !== false && (
                        <button
                          onClick={() => handlePrint(inv)}
                          className="p-1.5 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                          title={t('fi_reprint_receipt')}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                  {t('fi_no_invoices_match')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={total}
          sizes={PAGE_SIZES}
          onPage={setPage}
          onPageSize={pagination.setPageSize}
        />
      </div>

      {/* Invoice Inspection Modal with Full Item Breakdown */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    {selectedInvoice.invoice_number}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[12px] font-bold border ${
                      selectedInvoice.status === 'Returned'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {statusLabel(selectedInvoice.status || 'Completed')}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedInvoice.date_time}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div>
                <p className="text-slate-400 text-[13px]">{t('fi_customer')}</p>
                <p className="font-semibold text-slate-800">{selectedInvoice.customer_name || t('fi_walkin')}</p>
                {selectedInvoice.customer_phone && (
                  <p className="text-[13px] text-slate-500">{selectedInvoice.customer_phone}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[13px]">{t('fi_payment_mode')}</p>
                <p className="font-bold text-slate-800">{payLabel(selectedInvoice.payment_mode || 'Cash')}</p>
              </div>
            </div>

            {/* Itemized Lines */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[12px] font-semibold text-slate-500 uppercase">
                    <th className="py-2 px-3">{t('fi_col_product')}</th>
                    <th className="py-2 px-2 text-center">{t('fi_col_qty')}</th>
                    <th className="py-2 px-2 text-right">{t('fi_col_rate')}</th>
                    <th className="py-2 px-3 text-right">{t('fi_col_total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseItems(selectedInvoice).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        {t('fi_summary_record', { n: selectedInvoice.items_count || 1 })}
                      </td>
                    </tr>
                  ) : (
                    parseItems(selectedInvoice).map((item, idx) => {
                      const qtyVal = item.quantity || item.qty || 1;
                      const unitSuffix = item.unit ? ` ${item.unit}` : '';
                      const rateSuffix = item.base_unit && isMeasurableUnit(item.base_unit) ? ` / ${item.base_unit}` : '';
                      return (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <p className="font-semibold text-slate-800">{tName(item.name)}</p>
                            {item.sku && <p className="text-[12px] font-mono text-slate-400">{item.sku}</p>}
                          </td>
                          <td className="py-2 px-2 text-center font-medium text-slate-700 whitespace-nowrap">
                            {formatQty(qtyVal)}{unitSuffix}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-600 whitespace-nowrap">
                            ₹ {Number(item.rate || 0).toFixed(2)}{rateSuffix}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            ₹ {Number(item.total ?? (item.stock_deduction_qty || qtyVal) * (item.rate || 0)).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 text-xs pt-1">
              <div className="flex justify-between text-slate-500">
                <span>{t('fi_subtotal')}</span>
                <span className="font-medium text-slate-800">₹ {Number(selectedInvoice.subtotal || selectedInvoice.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>{t('fi_discount')}</span>
                <span className="font-medium text-emerald-600">– ₹ {Number(selectedInvoice.discount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-100 font-bold text-sm text-slate-900">
                <span>{t('fi_grand_total')}</span>
                <span className="text-blue-600 font-black">₹ {Number(selectedInvoice.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              {printPrefs.allowHistoryReprint !== false && (
                <button
                  onClick={() => handlePrint(selectedInvoice)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t('hist_print_invoice')}</span>
                </button>
              )}
              {selectedInvoice.status !== 'Returned' && (
                <button
                  onClick={() => handleReturn(selectedInvoice)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('hist_return')}</span>
                </button>
              )}
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
              >
                {t('hist_close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Print Preview Modal (A1-A6 + Thermal + Available Printers + PDF Export) */}
      {previewInvoice && (
        <PrintPreviewModal
          invoice={previewInvoice}
          profile={shopProfile}
          primaryCloseLabel={t('hist_close')}
          onClose={() => setPreviewInvoice(null)}
        />
      )}

      {/* Hidden Receipt DOM for Direct Reprinting */}
      {!previewInvoice && printTarget && (
        <PrintableReceipt invoice={printTarget} profile={shopProfile} format={printPrefs.format} />
      )}
    </div>
  );
}
