import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { UNIT_OPTIONS, normalizeUnit } from '../lib/units.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const ADD = '__add_unit__';

/**
 * Unit dropdown with the standard groups plus the shop's own units.
 * "+ Add new unit…" lets the user type one (e.g. DOZEN, BUNDLE); it is saved and offered everywhere.
 */
export default function UnitSelect({ value, onChange, className = '', translateLabels = true }) {
  const { t } = useLanguage();
  const [custom, setCustom] = useState([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!(window.api && window.api.getCustomUnits)) return;
    setCustom(((await window.api.getCustomUnits()) || []).map((u) => u.name));
  };
  useEffect(() => {
    load();
    window.addEventListener('units-updated', load);
    return () => window.removeEventListener('units-updated', load);
  }, []);

  const current = normalizeUnit(value);
  const known = UNIT_OPTIONS.some((g) => g.units.some((u) => u.value === current)) || custom.includes(current);

  const save = async () => {
    setError('');
    const res = await window.api.addCustomUnit(name);
    if (!res || res.success === false) {
      setError((res && res.error) || t('un_error'));
      return;
    }
    await load();
    window.dispatchEvent(new CustomEvent('units-updated'));
    onChange(res.name);
    setAdding(false);
    setName('');
  };

  return (
    <div>
      <select
        value={current}
        onChange={(e) => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))}
        className={className}
      >
        {UNIT_OPTIONS.map((grp) => (
          <optgroup key={grp.group} label={translateLabels ? t(`ct_unit_group_${grp.group}`) : grp.group}>
            {grp.units.map((u) => (
              <option key={u.value} value={u.value}>
                {translateLabels ? t(`ct_unit_${u.value}`) : u.value}
              </option>
            ))}
          </optgroup>
        ))}
        {(custom.length > 0 || (!known && current)) && (
          <optgroup label={t('un_custom_group')}>
            {!known && current && !custom.includes(current) && <option value={current}>{current}</option>}
            {custom.map((u) => <option key={u} value={u}>{u}</option>)}
          </optgroup>
        )}
        <option value={ADD}>+ {t('un_add_new')}</option>
      </select>
      {adding && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            autoFocus
            data-rule="text"
            maxLength={14}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { setAdding(false); setName(''); setError(''); } }}
            placeholder={t('un_ph')}
            className="flex-1 min-w-0 bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
          />
          <button type="button" onClick={save} disabled={!name.trim()} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" /> {t('un_add')}
          </button>
          <button type="button" onClick={() => { setAdding(false); setName(''); setError(''); }} className="p-1.5 text-slate-400 hover:text-slate-600" aria-label={t('un_cancel')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {adding && error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
