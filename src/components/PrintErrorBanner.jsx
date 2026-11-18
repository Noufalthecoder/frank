import React from 'react';
import { AlertTriangle, RefreshCw, FileDown, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function PrintErrorBanner({
  invoiceNumber,
  reason,
  retrying = false,
  onRetry,
  onSavePdf,
  onDismiss,
}) {
  const { t } = useLanguage();
  return (
    <div className="animate-popover rounded-2xl bg-white border border-rose-200/90 shadow-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-rose-600">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <h4 className="text-xs font-extrabold text-slate-900 tracking-tight">
            {t('st_print_err_title')}
          </h4>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
            title={t('st_dismiss')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 font-medium leading-relaxed">
        {reason || t('st_printer_unavailable')}
      </p>

      <div className="grid grid-cols-2 gap-2.5 pt-0.5">
        <button
          type="button"
          disabled={retrying}
          onClick={onRetry}
          className="py-2 px-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
          <span>{retrying ? t('st_retrying') : t('st_retry')}</span>
        </button>

        <button
          type="button"
          disabled={retrying}
          onClick={onSavePdf}
          className="py-2 px-3 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <FileDown className="w-3.5 h-3.5 text-slate-600" />
          <span>{t('st_save_pdf')}</span>
        </button>
      </div>

      <p className="text-[13px] text-slate-500 font-medium pt-0.5">
        {t('st_invoice_saved_note', { no: '\u0000' }).split('\u0000').map((part, i, arr) => (
          <React.Fragment key={i}>
            {part}
            {i < arr.length - 1 && (
              <span className="font-mono font-bold text-slate-700">{invoiceNumber || '—'}</span>
            )}
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}
