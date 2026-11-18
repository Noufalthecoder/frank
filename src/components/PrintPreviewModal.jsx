import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  RefreshCw,
  FileDown,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import PrintableReceipt, { InvoiceDocument } from './PrintableReceipt.jsx';
import PrintErrorBanner from './PrintErrorBanner.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  PAPER_SIZES,
  getPrintPreferences,
  getPaperSpec,
  executePrint,
  exportReceiptPdf,
} from '../lib/printConfig.js';

export default function PrintPreviewModal({
  invoice,
  profile,
  onClose,
  primaryCloseLabel,
  zeroStockAlerts = [],
}) {
  const { t } = useLanguage();
  const paperLabel = (p) => (p.thermal ? t('st_thermal_receipt', { size: p.id }) : p.label);
  const statusText = (s) => (!s || s === 'Connected' ? t('st_connected') : s === 'Paper Out' ? t('st_paper_out') : s);
  const initialPrefs = getPrintPreferences();
  const [format, setFormat] = useState(initialPrefs.format || '80mm');
  const [orientation, setOrientation] = useState(initialPrefs.orientation || 'portrait');
  const [selectedPrinter, setSelectedPrinter] = useState(initialPrefs.printerName || '');
  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [printError, setPrintError] = useState('');

  const loadPrinters = async () => {
    setLoadingPrinters(true);
    try {
      if (window.api && window.api.getPrinters) {
        const list = await window.api.getPrinters();
        setPrinters(list || []);
        if (!selectedPrinter && list && list.length > 0) {
          const def = list.find((p) => p.isDefault) || list[0];
          setSelectedPrinter(def.name);
        }
      }
    } catch (_) {}
    setLoadingPrinters(false);
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  if (!invoice) return null;

  const spec = getPaperSpec(format);

  const handlePrint = async (useSystemDialog = false) => {
    setPrinting(true);
    setStatusMsg('');
    setPrintError('');
    try {
      // Check selected printer status if not using system dialog
      if (!useSystemDialog) {
        const chosen = printers.find((p) => p.name === selectedPrinter);
        if (chosen && chosen.connectionState && chosen.connectionState !== 'connected') {
          setPrintError(
            chosen.statusLabel === 'Paper Out'
              ? t('st_printer_no_paper')
              : t('st_printer_unavailable')
          );
          return;
        }
      }

      const res = await executePrint({
        format,
        orientation,
        deviceName: useSystemDialog ? '' : selectedPrinter,
        silent: !useSystemDialog && Boolean(selectedPrinter),
      });
      if (res && res.success) {
        setPrintError('');
        setStatusMsg(useSystemDialog ? t('st_print_dialog_opened') : t('st_sent_to', { printer: selectedPrinter || t('st_default_printer'), size: spec.id }));
      } else {
        setPrintError(res?.error || t('st_printer_unavailable'));
      }
    } catch (err) {
      setPrintError(err.message || t('st_printer_unavailable'));
    } finally {
      setPrinting(false);
    }
  };

  const handleExportPdf = async () => {
    setPrinting(true);
    setStatusMsg('');
    try {
      const res = await exportReceiptPdf({
        invoiceNumber: invoice.invoice_number || 'INVOICE',
        format,
        orientation,
      });
      if (res && res.success) {
        setPrintError('');
        setStatusMsg(res.path ? t('st_saved_pdf', { path: res.path }) : t('st_opened_pdf', { size: spec.id }));
      }
    } finally {
      setPrinting(false);
    }
  };

  const previewWidthClass =
    spec.id === '58mm'
      ? 'max-w-[260px]'
      : spec.id === '80mm'
      ? 'max-w-[330px]'
      : spec.id === 'A6'
      ? 'max-w-[440px]'
      : orientation === 'landscape'
      ? 'max-w-[700px]'
      : 'max-w-[580px]';

  return (
    <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="animate-modal bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                {t('st_print_preview')} · <span className="font-mono text-blue-600">#{invoice.invoice_number}</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {paperLabel(spec)} · {orientation === 'landscape' ? t('st_landscape') : t('st_portrait')} · {t('st_compat_line')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title={t('st_close')}
            aria-label={t('st_close')}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Split Live Preview (left) + Printer & Paper Controls (right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Live Bill Preview */}
          <div className="lg:col-span-7 bg-slate-100/90 p-5 overflow-y-auto flex flex-col items-center">
            <div
              className={`w-full ${previewWidthClass} bg-white rounded-lg shadow-lg border border-slate-200/90 overflow-hidden transition-all duration-200`}
            >
              <InvoiceDocument
                invoice={invoice}
                profile={profile}
                format={format}
                inlinePreview={true}
              />
            </div>
          </div>

          {/* Right: Printer & Paper Size Controls */}
          <div className="lg:col-span-5 p-5 overflow-y-auto border-t lg:border-t-0 lg:border-l border-slate-200/80 flex flex-col justify-between gap-4 bg-white">
            <div className="space-y-4">
              {/* Zero Stock Alert Banner (from POS) */}
              {zeroStockAlerts && zeroStockAlerts.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>{t('st_stock_exhausted')}</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-rose-700 font-medium">
                    {zeroStockAlerts.map((i) => (
                      <li key={i.id || i.sku}>
                        {i.name} ({i.sku})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Available Printers List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    {t('st_available_printers')}
                  </label>
                  <button
                    type="button"
                    onClick={loadPrinters}
                    disabled={loadingPrinters}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingPrinters ? 'animate-spin' : ''}`} />
                    <span>{t('st_refresh')}</span>
                  </button>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
                  {printers.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      {t('st_no_printers_modal').split(/\{b\}|\{\/b\}/).map((part, i) => (i === 1 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>))}
                    </div>
                  ) : (
                    printers.map((p) => {
                      const active = selectedPrinter === p.name;
                      const badgeCls =
                        p.connectionState === 'connected'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : p.connectionState === 'error'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200';
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => setSelectedPrinter(p.name)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                            active
                              ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600/30'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Printer
                              className={`w-4 h-4 flex-shrink-0 ${
                                active ? 'text-blue-600' : 'text-slate-400'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {p.displayName || p.name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {p.connectionType || t('st_local')} · {p.isDefault ? t('st_default') : t('st_installed')}
                                {p.portName ? ` (${p.portName})` : ''}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${badgeCls}`}
                          >
                            {statusText(p.statusLabel)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Paper Size (A1 to A6 + Thermal) */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    {t('st_paper_size_label')}
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <optgroup label={t('st_thermal_roll')}>
                      {PAPER_SIZES.filter((p) => p.thermal).map((p) => (
                        <option key={p.id} value={p.id}>
                          {paperLabel(p)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={t('st_standard_paper')}>
                      {PAPER_SIZES.filter((p) => !p.thermal).map((p) => (
                        <option key={p.id} value={p.id}>
                          {paperLabel(p)}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    {t('st_orientation')}
                  </label>
                  <select
                    value={orientation}
                    disabled={spec.thermal}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="portrait">{t('st_portrait')}</option>
                    <option value="landscape">{t('st_landscape')}</option>
                  </select>
                </div>
              </div>

              {printError && (
                <PrintErrorBanner
                  invoiceNumber={invoice.invoice_number}
                  reason={printError}
                  retrying={printing}
                  onRetry={async () => {
                    await loadPrinters();
                    await handlePrint(false);
                  }}
                  onSavePdf={handleExportPdf}
                  onDismiss={() => setPrintError('')}
                />
              )}

              {statusMsg && !printError && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="break-all">{statusMsg}</span>
                </div>
              )}
            </div>

            {/* Print Action Buttons */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={printing}
                onClick={() => handlePrint(false)}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60"
              >
                <Printer className="w-4 h-4" />
                <span>{t('st_print_now', { size: spec.id })}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={printing}
                  onClick={() => handlePrint(true)}
                  className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t('st_system_dialog')}</span>
                </button>

                {initialPrefs.enablePdfExport !== false && (
                  <button
                    type="button"
                    disabled={printing}
                    onClick={handleExportPdf}
                    className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t('st_export_pdf')}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                {primaryCloseLabel || t('st_next_customer')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden @media print DOM synced to chosen format */}
      <PrintableReceipt invoice={invoice} profile={profile} format={format} />
    </div>
  );
}
