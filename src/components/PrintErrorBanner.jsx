import React from 'react';
import { AlertTriangle, RefreshCw, FileDown, X } from 'lucide-react';

export default function PrintErrorBanner({
  invoiceNumber,
  reason = 'The printer is unavailable or disconnected.',
  retrying = false,
  onRetry,
  onSavePdf,
  onDismiss,
}) {
  return (
    <div className="animate-popover rounded-2xl bg-white border border-rose-200/90 shadow-lg shadow-rose-900/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-rose-600">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <h4 className="text-xs font-extrabold text-slate-900 tracking-tight">
            Unable to print invoice
          </h4>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 font-medium leading-relaxed">
        {reason}
      </p>

      <div className="grid grid-cols-2 gap-2.5 pt-0.5">
        <button
          type="button"
          disabled={retrying}
          onClick={onRetry}
          className="py-2 px-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
          <span>{retrying ? 'Retrying...' : 'Retry'}</span>
        </button>

        <button
          type="button"
          disabled={retrying}
          onClick={onSavePdf}
          className="py-2 px-3 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <FileDown className="w-3.5 h-3.5 text-slate-600" />
          <span>Save PDF</span>
        </button>
      </div>

      <p className="text-[11px] text-slate-500 font-medium pt-0.5">
        Invoice <span className="font-mono font-bold text-slate-700">{invoiceNumber || '—'}</span> is safely saved. No additional stock deduction will occur.
      </p>
    </div>
  );
}
