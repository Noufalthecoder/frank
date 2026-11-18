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

import { useAppDialog } from '../components/AppDialogContext.jsx';

export default function Racks({ embedded = false }) {
  const { showConfirm, showAlert } = useAppDialog();
  const [racks, setRacks] = useState([]);
  const [selectedRackCode, setSelectedRackCode] = useState('R01');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBinCode, setSelectedBinCode] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [editRack, setEditRack] = useState(null);
  const [editError, setEditError] = useState('');
  const [pickItemId, setPickItemId] = useState('');
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

  const binOptions = () =>
    racks.map((r) => (
      <optgroup key={r.code} label={`${r.code} – ${r.name}`}>
        {(r.bins || []).map((b) => (
          <option key={b.bin_code} value={b.bin_code}>
            {b.bin_code}
          </option>
        ))}
      </optgroup>
    ));

  const moveItem = async (itemId, binCode) => {
    if (!window.api || !window.api.moveItemToBin) return;
    const res = await window.api.moveItemToBin(itemId, binCode);
    if (res && res.success === false) {
      await showAlert({ title: 'Could not move product', message: res.error, tone: 'danger' });
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
      setEditError(res.error || 'Could not update rack.');
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
      setFormError('Please fill both Rack Code and Rack Name.');
      return;
    }
    if (!window.api || !window.api.addRack) {
      setFormError('Database API unavailable. Please reload the app.');
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
        setFormError(res.error || 'Could not create rack.');
        return;
      }
      setShowAddModal(false);
      setNewRack({ code: '', name: '', zone: 'Fasteners', levels: 4, slots_per_level: 4 });
      setSelectedRackCode(res?.code || code);
      await loadRacks();
    } catch (err) {
      setFormError(err.message || 'Failed to create rack.');
    }
  };

  const handleDeleteRack = async (code) => {
    const ok = await showConfirm({
      title: 'Delete Rack',
      message: `Delete Rack ${code} and all its bins?`,
      confirmLabel: 'Delete Rack',
      tone: 'danger',
    });
    if (!ok) return;
    if (window.api && window.api.deleteRack) {
      const res = await window.api.deleteRack(code);
      if (res && res.success === false) {
        await showAlert({ title: 'Cannot delete rack', message: res.error, tone: 'danger' });
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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Racks & Bins</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage rack layout and bin-wise stock</p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rack</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Racks & Shelf Bin Layout</h2>
            <p className="text-xs text-slate-400">Configure physical shelves, aisles, and bin codes</p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rack</span>
          </button>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Left: Rack List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Rack List ({racks.length})
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
                    <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                      ({r.binsCount || (r.levels * r.slots_per_level)} bins)
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
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Unassigned ({unassignedItems.length})
              </p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                {unassignedItems.map((item) => (
                  <div key={item.id} className="p-2 bg-amber-50/50 border border-amber-200/70 rounded-lg">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[10px] font-mono text-slate-400 mb-1">
                      {item.sku}{item.bin_id ? ` · bad bin ${item.bin_id}` : ''}
                    </p>
                    <select
                      defaultValue=""
                      onChange={(e) => e.target.value && moveItem(item.id, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] font-mono text-slate-700"
                    >
                      <option value="">Assign to bin…</option>
                      {binOptions()}
                    </select>
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
                    Rack {currentRack.code} – {currentRack.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Zone: <span className="font-medium text-slate-600">{currentRack.zone || 'Fasteners'}</span> · {currentRack.levels} Levels · {currentRack.slots_per_level} Slots per level
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
                    title="Edit Rack"
                    className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded border border-slate-200 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRack(currentRack.code)}
                    title="Delete Rack"
                    className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded border border-slate-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Levels Grid */}
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
                              <p className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wider group-hover:text-blue-700">
                                {bin.bin_code}
                              </p>
                              <p className={`text-lg font-bold mt-1 ${hasStock ? 'text-emerald-900' : 'text-slate-400'}`}>
                                {Number(bin.quantity).toLocaleString('en-IN')}
                              </p>
                              <p className={`text-[9px] font-medium ${hasStock ? 'text-emerald-600' : 'text-slate-400'}`}>
                                {(bin.items || []).length > 0 ? `${bin.items.length} SKU${bin.items.length > 1 ? 's' : ''}` : 'Empty bin'}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No racks found. Click "Add Rack" to create your first shelf.
            </div>
          )}
        </div>
      </div>

      {/* Add Rack Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add New Rack</h3>
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rack Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. R06"
                    value={newRack.code}
                    onChange={(e) => {
                      setFormError('');
                      setNewRack({ ...newRack, code: e.target.value });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rack Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paints & Chemicals"
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
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Zone</label>
                <input
                  type="text"
                  placeholder="e.g. Hardware / Chemical"
                  value={newRack.zone}
                  onChange={(e) => setNewRack({ ...newRack, zone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Levels (Shelves)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newRack.levels}
                    onChange={(e) => setNewRack({ ...newRack, levels: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Slots per Level</label>
                  <input
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  Create Rack & Bins
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rack Modal */}
      {editRack && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Edit Rack {editRack.code}</h3>
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rack Name *</label>
                  <input
                    type="text"
                    required
                    value={editRack.name}
                    onChange={(e) => setEditRack({ ...editRack, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Zone</label>
                  <input
                    type="text"
                    value={editRack.zone}
                    onChange={(e) => setEditRack({ ...editRack, zone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Levels (Shelves)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editRack.levels}
                    onChange={(e) => setEditRack({ ...editRack, levels: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Slots per Level</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editRack.slots_per_level}
                    onChange={(e) => setEditRack({ ...editRack, slots_per_level: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">Shrinking removes bins, so any bin that would be removed must be empty.</p>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditRack(null)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bin Detail Modal */}
      {selectedBin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-mono">{selectedBin.bin_code}</h3>
                <p className="text-[11px] text-slate-400">Level {selectedBin.level_no} · Slot {selectedBin.slot_no}</p>
              </div>
              <button onClick={() => setSelectedBinCode(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
              <p className="text-slate-500">Current Occupancy:</p>
              <p className="text-xl font-bold text-slate-900">{Number(selectedBin.quantity).toLocaleString('en-IN')} units</p>
              <p className={`text-[11px] font-medium ${Number(selectedBin.quantity) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {Number(selectedBin.quantity) > 0 ? 'Status: Stocked & Active' : 'Status: Empty Bin'}
              </p>
            </div>

            {selectedBin.items && selectedBin.items.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-[11px] font-bold text-slate-600 uppercase">Products in this bin</p>
                {selectedBin.items.map((item) => (
                  <div key={item.id || item.sku} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">{item.sku}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="font-bold text-emerald-700">
                        {item.quantity} {item.unit || 'PCS'}
                      </span>
                      <select
                        value=""
                        onChange={(e) => e.target.value !== '' && moveItem(item.id, e.target.value === '__none__' ? '' : e.target.value)}
                        title="Move product"
                        className="w-16 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] text-slate-600"
                      >
                        <option value="">Move…</option>
                        <option value="__none__">Unassign</option>
                        {binOptions()}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 text-center py-2">
                No products in {selectedBin.bin_code} yet.
              </p>
            )}

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-600 uppercase">Add product to this bin</p>
              <div className="flex gap-2">
                <select
                  value={pickItemId}
                  onChange={(e) => setPickItemId(e.target.value)}
                  className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                >
                  <option value="">Select a product…</option>
                  {allItems
                    .filter((i) => String(i.bin_id || '').toUpperCase() !== selectedBin.bin_code.toUpperCase())
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.sku}){i.bin_id ? ` · ${i.bin_id}` : ' · unassigned'}
                      </option>
                    ))}
                </select>
                <button
                  disabled={!pickItemId}
                  onClick={() => moveItem(Number(pickItemId), selectedBin.bin_code)}
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            <button
              onClick={() => setSelectedBinCode(null)}
              className="w-full py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
