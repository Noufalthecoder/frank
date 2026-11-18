import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/**
 * Two-step bin picker: choose a Rack first, then a Level/Slot inside it.
 *
 * Form mode (default): controlled by `value`. Picking a rack auto-selects its first bin.
 * Action mode (`autoPickFirst={false}`): nothing changes until a slot is chosen, then
 * `onChange(binCode)` fires once and the picker resets (used for "move to…" menus).
 */
export default function BinPicker({
  value = '',
  onChange,
  racks: racksProp,
  autoPickFirst = true,
  allowUnassigned = true,
  rackPlaceholder,
  binPlaceholder,
  className = '',
  selectClassName = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white',
}) {
  const { t } = useLanguage();
  const [loaded, setLoaded] = useState([]);
  const racks = racksProp || loaded;
  const [rackSel, setRackSel] = useState('');

  useEffect(() => {
    if (racksProp || !window.api || !window.api.getRacks) return;
    let alive = true;
    window.api.getRacks().then((r) => alive && setLoaded(r || []));
    return () => {
      alive = false;
    };
  }, [racksProp]);

  // Keep the rack dropdown in sync with the current value
  const valueUpper = String(value || '').toUpperCase();
  const ownerRack = racks.find((r) => (r.bins || []).some((b) => b.bin_code.toUpperCase() === valueUpper));
  useEffect(() => {
    if (ownerRack) setRackSel(ownerRack.code);
    else if (!value) setRackSel((prev) => (autoPickFirst ? '' : prev));
  }, [ownerRack?.code, value, autoPickFirst]);

  const unknownValue = value && !ownerRack && racks.length > 0;
  const activeRack = racks.find((r) => r.code === rackSel);

  const handleRack = (code) => {
    setRackSel(code);
    if (!autoPickFirst) return;
    if (!code) return onChange('');
    const first = racks.find((r) => r.code === code)?.bins?.[0];
    onChange(first ? first.bin_code : '');
  };

  const handleBin = (code) => {
    if (!code) return;
    onChange(code);
    if (!autoPickFirst) setRackSel('');
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <select
        value={unknownValue ? '__bad__' : rackSel}
        onChange={(e) => handleRack(e.target.value === '__bad__' ? '' : e.target.value)}
        className={selectClassName}
        aria-label={t('rk_rack')}
      >
        {allowUnassigned && <option value="">{rackPlaceholder ?? t('rk_unassigned')}</option>}
        {!allowUnassigned && <option value="" disabled>{t('rk_select_rack')}</option>}
        {unknownValue && <option value="__bad__">{t('rk_bin_not_found_opt', { bin: value })}</option>}
        {racks.map((r) => (
          <option key={r.code} value={r.code}>
            {r.code} – {r.name}
          </option>
        ))}
      </select>
      <select
        value={ownerRack ? value : ''}
        onChange={(e) => handleBin(e.target.value)}
        disabled={!activeRack}
        className={`${selectClassName} disabled:opacity-50`}
        aria-label={t('rk_level_slot')}
      >
        <option value="">{binPlaceholder ?? t('rk_select_slot')}</option>
        {(activeRack?.bins || []).map((b) => (
          <option key={b.bin_code} value={b.bin_code}>
            {t('rk_level_slot_opt', { level: b.level_no, slot: b.slot_no })} ({b.bin_code})
          </option>
        ))}
      </select>
    </div>
  );
}
