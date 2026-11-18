import React, { useState, useEffect } from 'react';
import {
  Search,
  Download,
  Eye,
  Printer,
  X,
  CheckCircle2
} from 'lucide-react';
import PrintableReceipt from '../components/PrintableReceipt.jsx';
import { formatQty, isMeasurableUnit } from '../lib/units.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const PAGE_SIZE = 12;

export default function SalesHistory() {
  const { t, tName } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [shopProfile, setShopProfile] = useState(null);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('All Time');
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadInvoices();
    if (window.api && window.api.getShopProfile) {
      window.api.getShopProfile().then((p) => { if (p) setShopProfile(p); });
    }
    const handleStockUpdate = () => loadInvoices();
    window.addEventListener('stock-updated', handleStockUpdate);
    return () => window.removeEventListener('stock-updated', handleStockUpdate);
  }, []);

  const loadInvoices = async () => {
    if (window.api && window.api.getInvoices) {
      const res = await window.api.getInvoices();
      setInvoices(res || []);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const matchesDateRange = (dateStr) => {
    if (dateRange === 'All Time') return true;
    if (!dateStr) return false;
    const d = new Date(String(dateStr).replace(' ', 'T'));
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateRange === 'Today') return d >= todayStart;
    if (dateRange === 'Last 7 Days') return d >= new Date(todayStart.getTime() - 6 * 86400000);
    if (dateRange === 'Last 30 Days') return d >= new Date(todayStart.getTime() - 29 * 86400000);
    return true;
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchText =
      (inv.invoice_number || '').toLowerCase().includes(q) ||
      (inv.customer_name || '').toLowerCase().includes(q) ||
      (inv.payment_mode || '').toLowerCase().includes(q) ||
      String(inv.total).includes(q);
    return matchText && matchesDateRange(inv.date_time);
  });

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const parseItems = (inv) => {
    if (!inv) return [];
    if (Array.isArray(inv.items)) return inv.items;
    try {
      return JSON.parse(inv.items_json || '[]');
    } catch (_) {
      return [];
    }
  };

  const handlePrint = (inv) => {
    setPrintTarget(inv);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleExportCsv = () => {
    const headers = ['Invoice No', 'Date & Time', 'Customer', 'Phone', 'Items Count', 'Subtotal', 'Discount', 'Total', 'Payment Mode', 'Status'];
    const rows = filteredInvoices.map((inv) => [
      inv.invoice_number,
      inv.date_time || '',
      `"${(inv.customer_name || 'Walk-in Customer').replace(/"/g, '""')}"`,
      inv.customer_phone || '',
      inv.items_count || 0,
      Number(inv.subtotal || 0).toFixed(2),
      Number(inv.discount || 0).toFixed(2),
      Number(inv.total || 0).toFixed(2),
      inv.payment_mode || 'Cash',
      inv.status || 'Completed',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredInvoices.length} invoices to CSV.`);
  };

  return (
    <div className="space-y-5">
      {/* Floating Top-Right Toast Notification (2s) */}
      {toast && (
        <div className="fixed top-4 right-5 z-[100] flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 shadow-lg px-3.5 py-2.5 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t('hist_title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t('hist_subtitle')}</p>
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
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('cat_export_csv')}</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
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
            {filteredInvoices
              .filter((i) => i.status !== 'Returned')
              .reduce((sum, i) => sum + (Number(i.total) || 0), 0)
              .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
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
            {paginatedInvoices.map((inv) => {
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
                    {inv.customer_name || 'Walk-in Customer'}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-700 font-medium">
                    {inv.items_count || 1}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                      {inv.payment_mode || 'Cash'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        isReturned
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {isReturned ? 'Returned' : 'Completed'}
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
                        title="View Itemized Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handlePrint(inv)}
                        className="p-1.5 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                        title="Reprint Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedInvoices.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                  No invoices match your search or date filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer with Real Pagination */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>
            Showing {filteredInvoices.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} –{' '}
            {Math.min(currentPage * PAGE_SIZE, filteredInvoices.length)} of {filteredInvoices.length} invoices
          </span>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold shadow-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Inspection Modal with Full Item Breakdown */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    {selectedInvoice.invoice_number}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      selectedInvoice.status === 'Returned'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {selectedInvoice.status || 'Completed'}
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
                <p className="text-slate-400 text-[11px]">Customer</p>
                <p className="font-semibold text-slate-800">{selectedInvoice.customer_name || 'Walk-in Customer'}</p>
                {selectedInvoice.customer_phone && (
                  <p className="text-[11px] text-slate-500">{selectedInvoice.customer_phone}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-[11px]">Payment Mode</p>
                <p className="font-bold text-slate-800">{selectedInvoice.payment_mode || 'Cash'}</p>
              </div>
            </div>

            {/* Itemized Lines */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase">
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseItems(selectedInvoice).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        {selectedInvoice.items_count || 1} item(s) billed (summary record)
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
                            {item.sku && <p className="text-[10px] font-mono text-slate-400">{item.sku}</p>}
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
                <span>Subtotal:</span>
                <span className="font-medium text-slate-800">₹ {Number(selectedInvoice.subtotal || selectedInvoice.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Discount:</span>
                <span className="font-medium text-emerald-600">– ₹ {Number(selectedInvoice.discount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-100 font-bold text-sm text-slate-900">
                <span>Grand Total:</span>
                <span className="text-blue-600 font-black">₹ {Number(selectedInvoice.total).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => handlePrint(selectedInvoice)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Thermal / A4 Receipt for Reprinting */}
      <PrintableReceipt invoice={printTarget} profile={shopProfile} />
    </div>
  );
}
