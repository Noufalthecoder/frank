import React, { useState, useEffect } from 'react';
import {
  Grid3X3,
  Plus,
  Edit2,
  Trash2,
  X,
  Package,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAppDialog } from '../components/AppDialogContext.jsx';
import BinPicker from '../components/BinPicker.jsx';
import Rack3D from '../components/Rack3D.jsx';

export default function Racks({ embedded = false }) {
  const { t } = useLanguage();
  const { showConfirm, showAlert } = useAppDialog();
  const [racks, setRacks] = useState([]);
  const [selectedRackCode, setSelectedRackCode] = useState('R01');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBinCode, setSelectedBinCode] = useState(null);
  const [manageBin, setManageBin] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [editRack, setEditRack] = useState(null);
  const [editError, setEditError] = useState('');
  const [pickItemId, setPickItemId] = useState('');
  const [viewMode, setViewMode] = useState('3d');
  const [formError, setFormError] = useState('');

  const [newRack, setNewRack] = useState({
    code: '',
    name: '',
    zone: 'Fasteners',
    levels: 4,
    slots_per_level: 4,
  });

  useEffect(() => {
    loadRacks();
    const handleStockUpdate = () => loadRacks();
    window.addEventListener('stock-updated', handleStockUpdate);
    return () => window.removeEventListener('stock-updated', handleStockUpdate);
  }, []);

  const loadRacks = async () => {
    if (window.api && window.api.getRacks) {
      const res = await window.api.getRacks();
      const list = res || [];
      setRacks(list);
      if (list.length > 0 && !list.some((r) => r.code === selectedRackCode)) {
        setSelectedRackCode(list[0].code);
      }
    }
    if (window.api && window.api.getItems) {
      setAllItems((await window.api.getItems()) || []);
    }
  };

  // Every real bin, grouped by rack, for assign / move dropdowns
  const allBins = racks.flatMap((r) => (r.bins || []).map((b) => ({ code: b.bin_code, rack: r })));
  const validBinCodes = new Set(allBins.map((b) => b.code.toUpperCase()));
  const unassignedItems = allItems.filter(
    (i) => !i.bin_id || !validBinCodes.has(String(i.bin_id).toUpperCase())
  );
  const selectedBin = racks.flatMap((r) => r.bins || []).find((b) => b.bin_code === selectedBinCode) || null;

  const moveItem = async (itemId, binCode) => {
    if (!window.api || !window.api.moveItemToBin) return;
    const res = await window.api.moveItemToBin(itemId, binCode);
    if (res && res.success === false) {
      await showAlert({ title: t('rk_move_fail'), message: res.error, tone: 'danger' });
      return;
    }
    setPickItemId('');
    await loadRacks();
    window.dispatchEvent(new CustomEvent('stock-updated'));
  };

  const handleSaveRack = async (e) => {
    e.preventDefault();
    setEditError('');
    const res = await window.api.updateRack({
      ...editRack,
      levels: parseInt(editRack.levels) || 1,
      slots_per_level: parseInt(editRack.slots_per_level) || 1,
    });
    if (res && res.success === false) {
      setEditError(res.error || t('rk_update_fail'));
      return;
    }
    setEditRack(null);
    await loadRacks();
    window.dispatchEvent(new CustomEvent('stock-updated'));
  };

  const currentRack = racks.find((r) => r.code === selectedRackCode) || racks[0];

  const handleAddRack = async (e) => {
    e.preventDefault();
    setFormError('');
    const code = newRack.code.trim().toUpperCase();
    const name = newRack.name.trim();
    if (!code || !name) {
      setFormError(t('rk_err_fill'));
      return;
    }
    if (!window.api || !window.api.addRack) {
      setFormError(t('rk_err_api'));
      return;
    }
    try {
      const res = await window.api.addRack({
        ...newRack,
        code,
        name,
        levels: parseInt(newRack.levels) || 4,
        slots_per_level: parseInt(newRack.slots_per_level) || 4,
      });
      if (res && res.success === false) {
        setFormError(res.error || t('rk_create_fail'));
        return;
      }
      setShowAddModal(false);
      setNewRack({ code: '', name: '', zone: 'Fasteners', levels: 4, slots_per_level: 4 });
      setSelectedRackCode(res?.code || code);
      await loadRacks();
    } catch (err) {
      setFormError(err.message || t('rk_create_fail2'));
    }
  };

  const handleDeleteRack = async (code) => {
    const ok = await showConfirm({
      title: t('rk_delete_rack'),
      message: t('rk_delete_msg', { code }),
      confirmLabel: t('rk_delete_rack'),
      tone: 'danger',
    });
    if (!ok) return;
    if (window.api && window.api.deleteRack) {
      const res = await window.api.deleteRack(code);
      if (res && res.success === false) {
        await showAlert({ title: t('rk_cannot_delete'), message: res.error, tone: 'danger' });
        return;
      }
      await loadRacks();
      window.dispatchEvent(new CustomEvent('stock-updated'));
    }
  };

  // Group bins by level
  const levelsMap = {};
  if (currentRack && currentRack.bins) {
    currentRack.bins.forEach((b) => {
      const lvl = `L${b.level_no}`;
      if (!levelsMap[lvl]) levelsMap[lvl] = [];
      levelsMap[lvl].push(b);
    });
  }

  return (
    <div className="space-y-5">
      {/* Page Header (only if not embedded) */}
      {!embedded ? (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t('rk_title')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('rk_subtitle')}</p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('rk_add_rack')}</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t('rk_title_embedded')}</h2>
            <p className="text-xs text-slate-400">{t('rk_subtitle_embedded')}</p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('rk_add_rack')}</span>
          </button>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Left: Rack List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t('rk_rack_list', { n: racks.length })}
            </span>
          </div>

          <div className="space-y-1.5">
            {racks.map((r) => {
              const isActive = r.code === selectedRackCode;
              return (
                <button
                  key={r.code}
                  onClick={() => setSelectedRackCode(r.code)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                      : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div>
                    <p className="font-bold">{r.code} – {r.name}</p>
                    <p className="text-[13px] text-slate-400 font-normal mt-0.5">
                      ({t('rk_bins_count', { n: r.binsCount || (r.levels * r.slots_per_level) })})
                    </p>
                  </div>
                  {isActive && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                </button>
              );
            })}
          </div>

          {/* Products with no valid bin */}
          {unassignedItems.length > 0 && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <p className="text-[13px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> {t('rk_unassigned')} ({unassignedItems.length})
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                {unassignedItems.map((item) => (
                  <div key={item.id} className="p-2 bg-amber-50/50 border border-amber-200/70 rounded-lg">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[12px] font-mono text-slate-400 mb-1">
                      {item.sku}{item.bin_id ? ` · ${t('rk_bad_bin', { bin: item.bin_id })}` : ''}
                    </p>
                    <BinPicker
                      racks={racks}
                      value=""
                      autoPickFirst={false}
                      rackPlaceholder={t('rk_assign_to_rack')}
                      onChange={(code) => moveItem(item.id, code)}
                      selectClassName="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-[13px] text-slate-700"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Selected Rack View with Levels */}
        <div className="md:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          {currentRack ? (
            <>
              {/* Header inside Rack details */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    {t('rk_rack_label', { code: currentRack.code, name: currentRack.name })}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {t('rk_zone')}: <span className="font-medium text-slate-600">{currentRack.zone || 'Fasteners'}</span> · {t('rk_levels_n', { n: currentRack.levels })} · {t('rk_slots_per_level_n', { n: currentRack.slots_per_level })}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <button
                    onClick={() => {
                      setEditError('');
                      setEditRack({
                        code: currentRack.code,
                        name: currentRack.name,
                        zone: currentRack.zone || '',
                        levels: currentRack.levels,
                        slots_per_level: currentRack.slots_per_level,
                      });
                    }}
                    title={t('rk_edit_rack')}
                    className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded border border-slate-200 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRack(currentRack.code)}
                    title={t('rk_delete_rack')}
                    className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* View toggle */}
              <div className="flex items-center justify-end -mt-2">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                  {[['3d', t('rk_3d_view')], ['grid', t('rk_grid')]].map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setViewMode(k)}
                      className={`px-3 py-1 rounded-md text-[13px] font-bold transition-all ${
                        viewMode === k ? 'bg-white text-blue-600 shadow-xs ring-1 ring-slate-200/60' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {viewMode === '3d' && (
                <Rack3D
                  key={currentRack.code + currentRack.levels + 'x' + currentRack.slots_per_level}
                  rack={currentRack}
                  itemsById={Object.fromEntries(allItems.map((i) => [i.id, i]))}
                  onBinClick={(bin) => {
                    setPickItemId('');
                    setSelectedBinCode(bin.bin_code);
                  }}
                />
              )}

              {/* Levels Grid */}
              {viewMode === 'grid' && (
              <div className="space-y-4">
                {Object.keys(levelsMap).sort().map((levelKey) => {
                  const bins = levelsMap[levelKey] || [];
                  return (
                    <div key={levelKey} className="flex items-center gap-4">
                      {/* Level Indicator Badge */}
                      <div className="w-10 text-center font-bold text-xs text-slate-400 bg-slate-50 py-3 rounded-lg border border-slate-200">
                        {levelKey}
                      </div>

                      {/* Bins in this level */}
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {bins.map((bin) => {
                          const hasStock = Number(bin.quantity) > 0;
                          return (
                            <button
                              key={bin.bin_code}
                              onClick={() => { setPickItemId(''); setSelectedBinCode(bin.bin_code); }}
                              className={`rounded-xl p-3 text-center hover:shadow-sm transition-all cursor-pointer group border ${
                                hasStock
                                  ? 'bg-emerald-50/60 border-emerald-200/80 hover:border-emerald-400'
                                  : 'bg-slate-50/80 border-slate-200/80 hover:border-blue-300'
                              }`}
                            >
                              <p className="text-[12px] font-mono font-medium text-slate-500 uppercase tracking-wider group-hover:text-blue-700">
                                {bin.bin_code}
                              </p>
                              <p className={`text-lg font-bold mt-1 ${hasStock ? 'text-emerald-900' : 'text-slate-400'}`}>
                                {Number(bin.quantity).toLocaleString('en-IN')}
                              </p>
                              <p className={`text-[11px] font-medium ${hasStock ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {(bin.items || []).length > 0 ? t('rk_sku_count', { n: bin.items.length }) : t('rk_empty_bin')}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              {t('rk_no_racks')}
            </div>
          )}
        </div>
      </div>

      {/* Add Rack Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">{t('rk_add_new')}</h3>
              <button
                onClick={() => {
                  setFormError('');
                  setShowAddModal(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRack} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('rk_code_label')}</label>
                  <input data-rule="code" maxLength={12}
                    type="text"
                    required
                    placeholder={t('rk_ph_code')}
                    value={newRack.code}
                    onChange={(e) => {
                      setFormError('');
                      setNewRack({ ...newRack, code: e.target.value });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('rk_name_label')}</label>
                  <input data-rule="text" maxLength={40}
                    type="text"
                    required
                    placeholder={t('rk_ph_name')}
                    value={newRack.name}
                    onChange={(e) => {
                      setFormError('');
                      setNewRack({ ...newRack, name: e.target.value });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('rk_zone')}</label>
                <input data-rule="text" maxLength={30}
                  type="text"
                  placeholder={t('rk_ph_zone')}
                  value={newRack.zone}
                  onChange={(e) => setNewRack({ ...newRack, zone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('rk_levels_shelves')}</label>
                  <input data-int
                    type="number"
                    min="1"
                    max="10"
                    value={newRack.levels}
                    onChange={(e) => setNewRack({ ...newRack, levels: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('rk_slots_per_level')}</label>
                  <input data-int
                    type="number"
                    min="1"
                    max="10"
                    value={newRack.slots_per_level}
                    onChange={(e) => setNewRack({ ...newRack, slots_per_level: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setFormError('');
                    setShowAddModal(false);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t('rk_cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  {t('rk_create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rack Modal */}
      {editRack && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">{t('rk_edit_rack_n', { code: editRack.code })}</h3>
              <button onClick={() => setEditRack(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveRack} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('rk_name_label')}</label>
                  <input data-rule="text" maxLength={40}
                    type="text"
                    required
                    value={editRack.name}
                    onChange={(e) => setEditRack({ ...editRack, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('rk_zone')}</label>
                  <input data-rule="text" maxLength={30}
                    type="text"
                    value={editRack.zone}
                    onChange={(e) => setEditRack({ ...editRack, zone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('rk_levels_shelves')}</label>
                  <input data-int
                    type="number"
                    min="1"
                    max="10"
                    value={editRack.levels}
                    onChange={(e) => setEditRack({ ...editRack, levels: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('rk_slots_per_level')}</label>
                  <input data-int
                    type="number"
                    min="1"
                    max="10"
                    value={editRack.slots_per_level}
                    onChange={(e) => setEditRack({ ...editRack, slots_per_level: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>
              <p className="text-[13px] text-slate-400">{t('rk_shrink_note')}</p>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditRack(null)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t('rk_cancel')}
                </button>
                <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700">
                  {t('rk_save_changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bin Detail Modal */}
      {selectedBin && (() => {
        const binItems = selectedBin.items || [];
        const totalUnits = binItems.reduce((n, i) => n + Number(i.quantity || 0), 0);
        const stateOf = (i) => {
          const q = Number(i.quantity || 0);
          if (q <= 0) return { label: t('rk_out_stock'), dot: 'bg-rose-500', text: 'text-rose-600', bg: 'bg-rose-50' };
          if (q <= Number(i.reorder_level || 0)) return { label: t('rk_low_stock'), dot: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
          return { label: t('rk_in_stock'), dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
        };
        const closeBin = () => { setSelectedBinCode(null); setManageBin(false); };
        return (
        <div
          className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeBin(); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[88vh]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${binItems.length ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                  <Package className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-slate-900 font-mono leading-tight">{selectedBin.bin_code}</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {t('rk_level_slot_opt', { level: selectedBin.level_no, slot: selectedBin.slot_no })}
                  </p>
                </div>
              </div>
              <button onClick={closeBin} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg" aria-label={t('rk_close')}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-2 gap-3 px-6 pt-4">
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">{t('rk_products_in_bin')}</p>
                <p className="text-2xl font-extrabold text-slate-900 leading-tight">{binItems.length}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-[12px] font-semibold text-emerald-700 uppercase tracking-wide">{t('rk_occupancy')}</p>
                <p className="text-2xl font-extrabold text-emerald-800 leading-tight">{totalUnits.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Product list */}
            <div className="px-6 py-4 overflow-y-auto flex-1 min-h-[120px]">
              {binItems.length > 0 ? (
                <ul className="space-y-2">
                  {binItems.map((item) => {
                    const st = stateOf(item);
                    return (
                      <li key={item.id || item.sku} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="flex items-center gap-3 px-3.5 py-3">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                            <p className="text-[12px] text-slate-400 font-mono truncate">
                              {item.sku}{item.category ? ` · ${item.category}` : ''}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-base font-extrabold text-slate-900 leading-tight">
                              {Number(item.quantity).toLocaleString('en-IN')}
                              <span className="text-[12px] font-semibold text-slate-400 ml-1">{item.unit || 'PCS'}</span>
                            </p>
                            <span className={`inline-block mt-0.5 px-1.5 py-px rounded text-[11px] font-bold ${st.bg} ${st.text}`}>{st.label}</span>
                          </div>
                        </div>
                        {manageBin && (
                          <div className="flex items-start gap-1.5 px-3.5 pb-3 pt-2 bg-slate-50 border-t border-slate-100">
                            <BinPicker
                              racks={racks}
                              value=""
                              autoPickFirst={false}
                              rackPlaceholder={t('rk_move_to_rack')}
                              onChange={(code) => moveItem(item.id, code)}
                              className="flex-1 min-w-0"
                              selectClassName="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-[13px] text-slate-700"
                            />
                            <button
                              onClick={() => moveItem(item.id, '')}
                              className="px-2 py-1 text-[13px] font-semibold text-slate-500 border border-slate-200 bg-white rounded-md hover:text-rose-600 hover:bg-rose-50"
                            >
                              {t('rk_unassign')}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600">{t('rk_status_empty')}</p>
                  <p className="text-[13px] text-slate-400 mt-0.5">{t('rk_no_products_in', { bin: selectedBin.bin_code })}</p>
                </div>
              )}

              {manageBin && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">{t('rk_add_product_to_bin')}</p>
                  <div className="flex gap-2">
                    <select
                      value={pickItemId}
                      onChange={(e) => setPickItemId(e.target.value)}
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                    >
                      <option value="">{t('rk_select_product')}</option>
                      {allItems
                        .filter((i) => String(i.bin_id || '').toUpperCase() !== selectedBin.bin_code.toUpperCase())
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.sku}){i.bin_id ? ` · ${i.bin_id}` : ` · ${t('rk_unassigned_lc')}`}
                          </option>
                        ))}
                    </select>
                    <button
                      disabled={!pickItemId}
                      onClick={() => moveItem(Number(pickItemId), selectedBin.bin_code)}
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40"
                    >
                      {t('rk_add')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
              <button
                onClick={() => setManageBin((v) => !v)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  manageBin ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {manageBin ? t('rk_done') : t('rk_manage_bin')}
              </button>
              <button onClick={closeBin} className="flex-1 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">
                {t('rk_close')}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
