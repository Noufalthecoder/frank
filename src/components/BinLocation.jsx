import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin } from 'lucide-react';
import Rack3D from './Rack3D.jsx';

const POP_W = 340;
const POP_H = 440;

/**
 * Renders a product's bin code; hovering it shows a small 3D rack with that bin highlighted.
 * `racks` is the list from window.api.getRacks().
 */
export default function BinLocation({ bin, racks = [], className = '' }) {
  const [pos, setPos] = useState(null);
  const timer = useRef(null);
  const code = String(bin || '').toUpperCase();

  const rack = code ? racks.find((r) => (r.bins || []).some((b) => b.bin_code.toUpperCase() === code)) : null;
  const binInfo = rack ? rack.bins.find((b) => b.bin_code.toUpperCase() === code) : null;

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!code) return <span className={className}>Unassigned</span>;
  if (!rack) return <span className={className} title="Bin not found in Racks & Bins">{code}</span>;

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
                  Rack {rack.code} – {rack.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  Level {binInfo.level_no} · Slot {binInfo.slot_no} · <span className="font-mono">{code}</span>
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
