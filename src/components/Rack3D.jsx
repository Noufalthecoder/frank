import React, { useRef, useState } from 'react';

// Pure CSS-3D shelving unit. Level 1 is the bottom shelf. Drag to rotate.
const BIN_W = 84;
const BIN_H = 58;
const BIN_D = 72;
const GAP = 12;
const SLAB = 9;
const LEVEL_H = BIN_H + 38;
const POST = 9;

const TONES = {
  empty: { front: '#e2e8f0', side: '#cbd5e1', top: '#f1f5f9', text: '#64748b' },
  ok: { front: '#34d399', side: '#10b981', top: '#6ee7b7', text: '#064e3b' },
  low: { front: '#fbbf24', side: '#f59e0b', top: '#fde68a', text: '#78350f' },
  out: { front: '#fb7185', side: '#e11d48', top: '#fda4af', text: '#881337' },
  focus: { front: '#3b82f6', side: '#1d4ed8', top: '#93c5fd', text: '#ffffff' },
};

function Cuboid({ x, y, z = 0, w, h, d, tone, front, onClick, title, hover, opacity = 1, glow = false }) {
  const face = (extra, bg) => ({
    position: 'absolute',
    background: bg,
    backfaceVisibility: 'hidden',
    ...extra,
  });
  return (
    <div
      onClick={onClick}
      title={title}
      className={hover ? 'rack3d-bin' : undefined}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        transformStyle: 'preserve-3d',
        transform: `translateZ(${z}px)`,
        opacity,
        filter: glow ? 'drop-shadow(0 0 10px rgba(59,130,246,.9))' : undefined,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={face({ width: w, height: h, transform: `translateZ(${d / 2}px)` }, tone.front)}>{front}</div>
      <div style={face({ width: w, height: h, transform: `rotateY(180deg) translateZ(${d / 2}px)` }, tone.side)} />
      <div style={face({ width: d, height: h, left: (w - d) / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)` }, tone.side)} />
      <div style={face({ width: d, height: h, left: (w - d) / 2, transform: `rotateY(-90deg) translateZ(${w / 2}px)` }, tone.side)} />
      <div style={face({ width: w, height: d, top: (h - d) / 2, transform: `rotateX(90deg) translateZ(${h / 2}px)` }, tone.top)} />
      <div style={face({ width: w, height: d, top: (h - d) / 2, transform: `rotateX(-90deg) translateZ(${h / 2}px)` }, tone.side)} />
    </div>
  );
}

const FRAME = { front: '#475569', side: '#334155', top: '#64748b' };
const SHELF = { front: '#94a3b8', side: '#64748b', top: '#cbd5e1' };

const PRESETS = {
  front: { rx: -4, ry: 0 },
  angle: { rx: -16, ry: -32 },
  side: { rx: -8, ry: -78 },
  top: { rx: -62, ry: -14 },
};

export default function Rack3D({ rack, itemsById = {}, onBinClick, highlightBin = '', compact = false, width = 300 }) {
  const [rot, setRot] = useState(compact ? { rx: -14, ry: -26 } : PRESETS.angle);
  const hl = String(highlightBin || '').toUpperCase();
  const drag = useRef(null);
  const moved = useRef(false);

  const levels = rack.levels;
  const slots = rack.slots_per_level;
  const RW = slots * (BIN_W + GAP) + GAP + POST * 2;
  const RH = levels * LEVEL_H + 12;
  const RD = BIN_D + 24;

  const statusOf = (bin) => {
    const items = bin.items || [];
    if (items.length === 0) return 'empty';
    let worst = 'ok';
    items.forEach((i) => {
      const full = itemsById[i.id] || i;
      const qty = Number(full.quantity) || 0;
      const reorder = Number(full.reorder_level);
      if (qty <= 0) worst = 'out';
      else if (worst !== 'out' && Number.isFinite(reorder) && qty <= reorder) worst = 'low';
    });
    return worst;
  };

  const onDown = (e) => {
    if (compact) return;
    drag.current = { x: e.clientX, y: e.clientY, ...rot };
    moved.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
    setRot({
      ry: Math.max(-95, Math.min(95, d.ry + dx * 0.45)),
      rx: Math.max(-80, Math.min(10, d.rx - dy * 0.35)),
    });
  };
  const onUp = () => {
    drag.current = null;
  };

  const bins = {};
  (rack.bins || []).forEach((b) => {
    bins[`${b.level_no}-${b.slot_no}`] = b;
  });

  const scale = Math.min(1, (compact ? width : 560) / RW);

  return (
    <div>
      <style>{`.rack3d-bin{transition:transform .15s} .rack3d-bin:hover{filter:brightness(1.07)}`}</style>

      {!compact && (
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-slate-400">Drag to rotate · click a box to open the bin</p>
        <div className="flex items-center gap-1">
          {Object.keys(PRESETS).map((k) => (
            <button
              key={k}
              onClick={() => setRot(PRESETS[k])}
              className="px-2 py-1 text-[11px] font-semibold capitalize text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      )}

      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden select-none touch-none"
        style={{
          height: compact ? RH * scale + 70 : RH * scale + 120,
          minHeight: compact ? 0 : 360,
          perspective: 1500,
          cursor: compact ? 'default' : drag.current ? 'grabbing' : 'grab',
        }}
      >
        {/* floor shadow */}
        <div
          className="absolute left-1/2 rounded-[50%] bg-slate-900/10 blur-md"
          style={{ width: RW * scale * 1.05, height: 50, bottom: 36, transform: 'translateX(-50%)' }}
        />

        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: RW,
            height: RH,
            marginLeft: -RW / 2,
            marginTop: -RH / 2,
            transformStyle: 'preserve-3d',
            transform: `scale(${scale}) rotateX(${rot.rx}deg) rotateY(${rot.ry}deg)`,
            transition: drag.current ? 'none' : 'transform .35s ease',
          }}
        >
          {/* corner posts */}
          {[0, 1].flatMap((ix) =>
            [-1, 1].map((iz) => (
              <Cuboid
                key={`p${ix}${iz}`}
                x={ix === 0 ? 0 : RW - POST}
                y={0}
                z={(iz * (RD - POST)) / 2}
                w={POST}
                h={RH}
                d={POST}
                tone={FRAME}
              />
            ))
          )}
          {/* roof */}
          <Cuboid x={0} y={0} z={0} w={RW} h={SLAB} d={RD} tone={SHELF} />

          {Array.from({ length: levels }, (_, li) => {
            const l = li + 1;
            const slabY = RH - 12 - (l - 1) * LEVEL_H + 2;
            return (
              <React.Fragment key={l}>
                <Cuboid x={0} y={slabY} z={0} w={RW} h={SLAB} d={RD} tone={SHELF} />
                <div
                  style={{
                    position: 'absolute',
                    left: -34,
                    top: slabY - BIN_H / 2 - 10,
                    transform: `translateZ(${RD / 2}px)`,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#64748b',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '2px 6px',
                  }}
                >
                  L{l}
                </div>
                {Array.from({ length: slots }, (_, si) => {
                  const s = si + 1;
                  const bin = bins[`${l}-${s}`];
                  if (!bin) return null;
                  const isTarget = hl && bin.bin_code.toUpperCase() === hl;
                  const status = hl ? (isTarget ? 'focus' : 'empty') : statusOf(bin);
                  const tone = TONES[status];
                  const names = (bin.items || []).map((i) => `${i.name} (${i.quantity})`).join('\n');
                  return (
                    <Cuboid
                      key={bin.bin_code}
                      hover
                      x={POST + GAP + si * (BIN_W + GAP)}
                      y={slabY - BIN_H}
                      z={0}
                      w={BIN_W}
                      h={BIN_H}
                      d={BIN_D}
                      tone={tone}
                      opacity={hl && !isTarget ? 0.45 : 1}
                      glow={isTarget}
                      title={compact ? undefined : `${bin.bin_code}${names ? '\n' + names : '\nEmpty'}`}
                      onClick={
                        compact || !onBinClick
                          ? undefined
                          : () => {
                              if (!moved.current) onBinClick(bin);
                            }
                      }
                      front={
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: tone.text,
                            fontFamily: 'ui-monospace, monospace',
                            lineHeight: 1.15,
                          }}
                        >
                          <span style={{ fontSize: 9, opacity: 0.8 }}>
                            L{l}-S{s}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800 }}>
                            {isTarget ? 'HERE' : status === 'empty' ? (hl ? '' : '—') : Number(bin.quantity).toLocaleString('en-IN')}
                          </span>
                        </div>
                      }
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {!compact && !hl && (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px] text-slate-500">
        {[
          ['ok', 'In stock'],
          ['low', 'Low stock'],
          ['out', 'Out of stock'],
          ['empty', 'Empty bin'],
        ].map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-black/10" style={{ background: TONES[k].front }} />
            {label}
          </span>
        ))}
      </div>
      )}
    </div>
  );
}
