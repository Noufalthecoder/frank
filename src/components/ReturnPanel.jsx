import React, { useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw, PackageCheck, Info } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAppDialog } from './AppDialogContext.jsx';
import { formatQty } from '../lib/units.js';
import {
  lineSummaries, planReturn, RETURN_REASONS, NON_RESTOCK_REASONS,
} from '../lib/returnMath.js';

const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Partial / full sales return workspace shown inside the invoice drawer.
 * Everything is validated live with the same maths the database layer uses.
 */
export default function ReturnPanel({ invoice, returns, onBack, onDone, payLabel }) {
  const { t, tName } = useLanguage();
  const { showConfirm } = useAppDialog();
  const sums = useMemo(() => lineSummaries(invoice, returns), [invoice, returns]);
  const [qty, setQty] = useState({}); // index -> string
  const [reason, setReason] = useState('customer_return');
  const [restock, setRestock] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = sums
    .map((s) => ({ index: s.index, qty: parseFloat(qty[s.index]) || 0 }))
    .filter((r) => r.qty > 0);
  const overIndex = new Set(request.filter((r) => r.qty > sums[r.index].remaining + 1e-9).map((r) => r.index));
  const plan = request.length > 0 && overIndex.size === 0 ? planReturn(invoice, returns, request) : null;
  const valid = plan && !plan.error;

  const setLine = (i, v) => setQty((q) => ({ ...q, [i]: v }));
  const toggle = (s) => setLine(s.index, parseFloat(qty[s.index]) > 0 ? '' : String(s.remaining));
  const all = () => {
    const next = {};
    sums.forEach((s) => { if (s.remaining > 0) next[s.index] = String(s.remaining); });
    setQty(next);
  };

  const pickReason = (r) => {
    setReason(r);
    setRestock(!NON_RESTOCK_REASONS.includes(r));
  };

  const submit = async () => {
    if (!valid || busy) return;
    const ok = await showConfirm({
      title: t('rt_confirm_title'),
      message: t('rt_confirm_msg', { amount: money(plan.refund), n: plan.lines.length, inv: invoice.invoice_number }),
      confirmLabel: t('rt_confirm_btn', { amount: money(plan.refund) }),
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const res = await window.api.processReturn({
        invoiceId: invoice.id,
        lines: request,
        reason,
        note,
        restock,
      });
      if (!res || res.success === false) {
        setError((res && res.error) || t('rt_failed'));
        return;
      }
      onDone(res);
    } catch (e) {
      setError(e.message || t('rt_failed'));
    } finally {
      setBusy(false);
    }
  };

  const totalUnits = valid ? plan.lines.reduce((a, l) => a + l.qty, 0) : 0;
  const stockBack = valid && restock ? plan.lines.length : 0;
  const hasDiscount = Number(invoice.discount) > 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-5">
      <div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700">
          <ArrowLeft className="w-4 h-4" /> {t('rt_back')}
        </button>
        <h4 className="text-lg font-bold text-slate-900 mt-2">{t('rt_title')}</h4>
        <p className="text-sm text-slate-500">{t('rt_subtitle')}</p>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={all} className="text-sm font-semibold text-blue-600 hover:underline">{t('rt_return_all')}</button>
        <button type="button" onClick={() => setQty({})} className="text-sm font-semibold text-slate-500 hover:underline">{t('rt_clear')}</button>
      </div>

      {/* Line picker */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              <th className="py-3 pl-3 w-8" />
              <th className="py-3 px-2 text-left">{t('rt_col_product')}</th>
              <th className="py-3 px-2 text-center">{t('rt_col_sold')}</th>
              <th className="py-3 px-2 text-center">{t('rt_col_return_qty')}</th>
              <th className="py-3 px-3 text-right">{t('rt_col_refund')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sums.map((s) => {
              const done = s.remaining <= 0;
              const q = parseFloat(qty[s.index]) || 0;
              const over = overIndex.has(s.index);
              const whole = Number.isInteger(s.sold) && s.stockPerUnit === 1;
              const line = plan && !plan.error ? plan.lines.find((l) => l.index === s.index) : null;
              return (
                <tr key={s.index} className={done ? 'bg-slate-50/70 text-slate-400' : q > 0 ? 'bg-blue-50/40' : ''}>
                  <td className="pl-3 py-3">
                    <input
                      type="checkbox"
                      checked={q > 0}
                      disabled={done}
                      onChange={() => toggle(s)}
                      className="w-4 h-4 accent-blue-600"
                      aria-label={s.name}
                    />
                  </td>
                  <td className="py-3 px-2">
                    <p className={`font-semibold ${done ? 'text-slate-400' : 'text-slate-800'}`}>{tName(s.name)}</p>
                    <p className="text-xs text-slate-400">
                      {s.sku && <span className="font-mono">{s.sku} · </span>}
                      {s.returned > 0 && <span className="text-amber-600">{t('rt_col_returned')}: {formatQty(s.returned)} · </span>}
                      ₹ {money(s.unitRefund)} / {s.unit}
                    </p>
                  </td>
                  <td className="py-3 px-2 text-center whitespace-nowrap">{formatQty(s.sold)} {s.unit}</td>
                  <td className="py-3 px-2 text-center">
                    {done ? (
                      <span className="text-xs font-semibold text-slate-400">{t('rt_fully_returned')}</span>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={s.remaining}
                          step={whole ? '1' : 'any'}
                          {...(whole ? { 'data-int': true } : {})}
                          value={qty[s.index] ?? ''}
                          placeholder="0"
                          onChange={(e) => setLine(s.index, e.target.value)}
                          className={`no-spinner w-20 text-center rounded-lg border px-2 py-1.5 font-semibold focus:outline-none focus:ring-2 ${
                            over ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-300' : 'border-slate-200 bg-white text-slate-900 focus:ring-blue-500/30 focus:border-blue-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setLine(s.index, String(s.remaining))}
                          className="px-2 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-md"
                          title={`${t('rt_max')}: ${formatQty(s.remaining)} ${s.unit}`}
                        >
                          {t('rt_max')}
                        </button>
                      </div>
                    )}
                    {over && <p className="text-[11px] text-rose-600 mt-1">{t('rt_over')} ({formatQty(s.remaining)})</p>}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold whitespace-nowrap tabular-nums">
                    {line ? `₹ ${money(line.amount)}` : q > 0 && !over ? `₹ ${money(q * s.unitRefund)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reason / restock / note */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('rt_reason')}</label>
          <select
            value={reason}
            onChange={(e) => pickReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800"
          >
            {RETURN_REASONS.map((r) => <option key={r} value={r}>{t(`rt_reason_${r}`)}</option>)}
          </select>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer select-none self-end pb-1">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="w-4 h-4 mt-1 accent-blue-600" />
          <span>
            <span className="block text-sm font-semibold text-slate-800">{t('rt_restock_toggle')}</span>
            <span className="block text-xs text-slate-500">{restock ? t('rt_restock_hint_on') : t('rt_restock_hint_off')}</span>
          </span>
        </label>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('rt_note')}</label>
        <textarea
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('rt_note_ph')}
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 resize-none"
        />
      </div>

      {/* Live summary */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('rt_summary')}</p>
        <div className="flex justify-between"><span className="text-slate-500">{t('rt_items_selected')}</span><span className="font-semibold">{valid ? plan.lines.length : 0}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">{t('rt_units')}</span><span className="font-semibold">{formatQty(totalUnits)}</span></div>
        <div className="flex justify-between">
          <span className="text-slate-500 flex items-center gap-1.5"><PackageCheck className="w-4 h-4" />{t('rt_stock_back')}</span>
          <span className={`font-semibold ${restock ? 'text-emerald-700' : 'text-slate-500'}`}>{restock ? stockBack : t('rt_no_stock_change')}</span>
        </div>
        <div className="flex justify-between pt-2 mt-1 border-t border-slate-200 text-base">
          <span className="font-bold text-slate-900">{t('rt_refund_total')}</span>
          <span className="font-bold text-rose-700 tabular-nums">₹ {money(valid ? plan.refund : 0)}</span>
        </div>
        <p className="text-xs text-slate-500">{t('rt_refund_via', { mode: payLabel(invoice.payment_mode || 'Cash') })}</p>
        {hasDiscount && (
          <p className="text-xs text-slate-400 flex items-start gap-1"><Info className="w-3.5 h-3.5 mt-px flex-shrink-0" />{t('rt_discount_note')}</p>
        )}
      </div>

      {error && <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
      {request.length === 0 && <p className="text-xs text-slate-400 -mt-2">{t('rt_nothing')}</p>}

      <div className="mt-auto sticky bottom-0 bg-white pt-4 border-t border-slate-100 flex justify-end gap-2">
        <button type="button" onClick={onBack} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200">
          {t('rt_back')}
        </button>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={submit}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4" />
          {t('rt_confirm_btn', { amount: money(valid ? plan.refund : 0) })}
        </button>
      </div>
    </div>
  );
}
