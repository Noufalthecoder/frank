import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { ClipboardList, X, ChevronDown, ChevronRight, Search, Truck } from 'lucide-react';

const normStatus = (s) => (s === 'Received' || s === 'Closed' ? 'Received' : 'Request');

const parseItems = (po) => {
  if (Array.isArray(po.items)) return po.items;
  try {
    return JSON.parse(po.items_json || '[]');
  } catch (_) {
    return [];
  }
};

/** "Orders" button: opens a panel listing purchase orders, newest (last placed) first. */
export default function OrdersButton({ label, className = '' }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const list = window.api?.getPurchaseOrders ? await window.api.getPurchaseOrders() : [];
      // Order they were made: most recent first
      setOrders([...(list || [])].sort((a, b) => (b.id || 0) - (a.id || 0)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((o) => {
      const st = normStatus(o.status);
      if (filter === 'Pending' && st !== 'Request') return false;
      if (filter === 'Received' && st !== 'Received') return false;
      if (!term) return true;
      const hay = `${o.po_number} ${o.vendor_name} ${parseItems(o)
        .map((i) => `${i.name} ${i.sku}`)
        .join(' ')}`.toLowerCase();
      return hay.includes(term);
    });
  }, [orders, filter, q]);

  const pending = orders.filter((o) => normStatus(o.status) === 'Request').length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all'
        }
      >
        <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
        <span>{label || t('cat_orders')}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{t('ct_po_title')}</h3>
                <p className="text-[13px] text-slate-500">
                  {t('ct_po_summary', { total: orders.length, pending: pending ? t('ct_po_pending_part', { n: pending }) : '' })}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 px-5 py-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('ct_po_search')}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
              {['All', 'Pending', 'Received'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1.5 rounded-lg text-[13px] font-semibold border ${
                    filter === f
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {f === 'All' ? t('cat_all') : f === 'Pending' ? t('ct_pending') : t('ct_received')}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-2">
              {loading && <p className="text-xs text-slate-400 py-6 text-center">{t('ct_po_loading')}</p>}
              {!loading && visible.length === 0 && (
                <p className="text-xs text-slate-400 py-8 text-center">
                  {orders.length === 0 ? t('ct_po_none') : t('ct_po_no_match')}
                </p>
              )}
              {visible.map((o) => {
                const st = normStatus(o.status);
                const lines = parseItems(o);
                const isOpen = !!expanded[o.id];
                return (
                  <div key={o.id} className="border border-slate-200 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setExpanded({ ...expanded, [o.id]: !isOpen })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 font-mono">{o.po_number}</p>
                        <p className="text-[13px] text-slate-500 truncate">
                          {o.vendor_name} - {o.order_date}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        Rs. {Number(o.amount || 0).toLocaleString('en-IN')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[12px] font-semibold border ${
                          st === 'Request'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {st === 'Request' ? t('ct_pending') : t('ct_received')}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 space-y-1">
                        {lines.length === 0 && <p className="text-[13px] text-slate-400">{t('ct_po_no_lines')}</p>}
                        {lines.map((l, i) => (
                          <div key={i} className="flex justify-between text-[13px]">
                            <span className="text-slate-700">
                              {l.name} {l.sku ? `(${l.sku})` : ''}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {l.quantity}
                              {l.rate ? ` x Rs. ${l.rate}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end px-5 py-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate('/vendors');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                <Truck className="w-3.5 h-3.5" /> {t('ct_po_manage')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
