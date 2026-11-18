import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X } from 'lucide-react';
import Rack3D from './Rack3D.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const POP_W = 340;
const POP_H = 440;

/**
 * Renders a product's bin code; hovering it shows a small 3D rack with that bin highlighted.
 * `racks` is the list from window.api.getRacks().
 */
export default function BinLocation({ bin, racks = [], className = '' }) {
  const { t } = useLanguage();
  const [pos, setPos] = useState(null);
  const timer = useRef(null);
  const code = String(bin || '').toUpperCase();

  const rack = code ? racks.find((r) => (r.bins || []).some((b) => b.bin_code.toUpperCase() === code)) : null;
  const binInfo = rack ? rack.bins.find((b) => b.bin_code.toUpperCase() === code) : null;

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!code) return <span className={className}>{t('rk_unassigned')}</span>;
  if (!rack) return <span className={className} title={t('rk_bin_not_in_racks')}>{code}</span>;

  const open = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const left = Math.min(Math.max(8, r.left), window.innerWidth - POP_W - 8);
      const below = r.bottom + 8;
      const top = below + POP_H > window.innerHeight ? Math.max(8, r.top - POP_H - 8) : below;
      setPos({ left, top });
    }, 120);
  };
  const close = () => {
    clearTimeout(timer.current);
    setPos(null);
  };

  return (
    <>
      <span
        onMouseEnter={open}
        onMouseLeave={close}
        className={`${className} cursor-help underline decoration-dotted decoration-blue-300 underline-offset-2`}
      >
        {code}
      </span>
      {pos &&
        createPortal(
          <div
            style={{ position: 'fixed', left: pos.left, top: pos.top, width: POP_W, zIndex: 80, pointerEvents: 'none' }}
            className="bg-white rounded-xl border border-slate-200 shadow-xl p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {t('rk_rack_label', { code: rack.code, name: rack.name })}
                </p>
                <p className="text-[13px] text-slate-500">
                  {t('rk_level_slot_opt', { level: binInfo.level_no, slot: binInfo.slot_no })} · <span className="font-mono">{code}</span>
                </p>
              </div>
            </div>
            <Rack3D rack={rack} compact highlightBin={code} width={POP_W - 40} />
          </div>,
          document.body
        )}
    </>
  );
}

/** Red "locate" action button for table/card action columns. */
export function LocateButton({ item, onLocate, size = 'md' }) {
  const { t } = useLanguage();
  const has = Boolean(String(item.bin_id || '').trim());
  const pad = size === 'sm' ? 'p-1' : size === 'lg' ? 'p-1.5' : 'p-1';
  const icon = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <button
      onClick={() => has && onLocate(item)}
      disabled={!has}
      title={has ? t('rk_show_location', { bin: item.bin_id }) : t('rk_not_assigned_rack')}
      className={`${pad} rounded transition-colors ${
        has ? 'text-rose-600 bg-rose-50 hover:bg-rose-100' : 'text-slate-300 cursor-not-allowed'
      }`}
    >
      <MapPin className={icon} />
    </button>
  );
}

/** Modal that pinpoints a product's bin on a rotatable 3D rack. */
export function LocationModal({ item, racks, onClose }) {
  const { t } = useLanguage();
  const code = String(item.bin_id || '').toUpperCase();
  const rack = racks.find((r) => (r.bins || []).some((b) => b.bin_code.toUpperCase() === code));
  const bin = rack ? rack.bins.find((b) => b.bin_code.toUpperCase() === code) : null;
  return createPortal(
    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-[90]" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 truncate">{item.name}</h3>
              {rack && bin ? (
                <p className="text-xs text-slate-500">
                  {t('rk_rack_label', { code: rack.code, name: rack.name })} · {t('rk_level_slot_opt', { level: bin.level_no, slot: bin.slot_no })} ·{' '}
                  <span className="font-mono font-semibold text-rose-600">{code}</span>
                </p>
              ) : (
                <p className="text-xs text-rose-600">{t('rk_bin_missing', { bin: code })}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        {rack && <Rack3D rack={rack} highlightBin={code} width={520} />}
      </div>
    </div>,
    document.body
  );
}
