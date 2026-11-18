import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const AppDialogContext = createContext(null);

export function AppDialogProvider({ children }) {
  const { t } = useLanguage();
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const closeWith = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    if (resolve) resolve(result);
  }, []);

  const showAlert = useCallback((input) => {
    const opts = typeof input === 'string' ? { message: input } : input || {};
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        mode: 'alert',
        title: opts.title || null,
        message: opts.message || '',
        tone: opts.tone || 'info',
        confirmLabel: opts.confirmLabel || null,
      });
    });
  }, []);

  const showConfirm = useCallback((input) => {
    const opts = typeof input === 'string' ? { message: input } : input || {};
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        mode: 'confirm',
        title: opts.title || null,
        message: opts.message || '',
        tone: opts.tone || 'primary',
        confirmLabel: opts.confirmLabel || null,
        cancelLabel: opts.cancelLabel || null,
      });
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeWith(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        closeWith(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialog, closeWith]);

  const toneConfig = {
    danger: {
      iconBg: 'bg-rose-50 text-rose-600 ring-rose-200/80',
      Icon: AlertTriangle,
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm',
    },
    warning: {
      iconBg: 'bg-amber-50 text-amber-600 ring-amber-200/80',
      Icon: AlertTriangle,
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-600/20',
    },
    success: {
      iconBg: 'bg-emerald-50 text-emerald-600 ring-emerald-200/80',
      Icon: CheckCircle2,
      confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
    },
    primary: {
      iconBg: 'bg-blue-50 text-blue-600 ring-blue-200/80',
      Icon: Info,
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
    },
    info: {
      iconBg: 'bg-blue-50 text-blue-600 ring-blue-200/80',
      Icon: Info,
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
    },
  };

  const activeTone = toneConfig[dialog?.tone] || toneConfig.info;
  const ToneIcon = activeTone.Icon;

  return (
    <AppDialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {dialog && (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-[200]"
          onClick={() => closeWith(dialog.mode === 'alert' ? true : false)}
        >
          <div
            className="animate-modal bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex items-start gap-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset ${activeTone.iconBg}`}
              >
                <ToneIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{dialog.title || (dialog.mode === 'alert' ? t('st_notice') : t('st_confirm_action'))}</h3>
                  <button
                    type="button"
                    onClick={() => closeWith(false)}
                    className="p-1 -mt-1 -mr-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label={t('st_close')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line mt-1.5">
                  {dialog.message}
                </p>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2">
              {dialog.mode === 'confirm' && (
                <button
                  type="button"
                  onClick={() => closeWith(false)}
                  className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {dialog.cancelLabel || t('st_cancel')}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => closeWith(true)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${activeTone.confirmBtn}`}
              >
                {dialog.confirmLabel || (dialog.mode === 'alert' ? t('st_ok') : t('st_confirm'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error('useAppDialog must be used inside AppDialogProvider');
  }
  return ctx;
}
