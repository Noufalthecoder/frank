import React, { useState } from 'react';
import BinPicker from './BinPicker.jsx';
import {
  Search,
  ArrowLeft,
  Check,
  CheckCircle2,
  Plus,
  Minus,
  Package
} from 'lucide-react';
import { TOOL_LIBRARY } from '../data/toolLibrary.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function ToolLibraryPicker({
  existingItemsMap = {},
  availableBins = [],
  onFillManualForm,
  onBulkAddSizes,
}) {
  const { t, tName, tCategory } = useLanguage();
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [selectedTool, setSelectedTool] = useState(null);
  // Map of sizeCode -> count to add (presence in object means selected)
  const [selectedQtyMap, setSelectedQtyMap] = useState({});
  const [defaultQty, setDefaultQty] = useState('10');
  const [defaultReorder, setDefaultReorder] = useState('10');
  const [defaultBin, setDefaultBin] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const categories = ['All', 'Tools', 'Fasteners', 'Electrical', 'Plumbing', 'Paints & Adhesives'];

  const filteredTools = TOOL_LIBRARY.filter((tool) => {
    const q = query.trim().toLowerCase();
    const matchCat = catFilter === 'All' || tool.category === catFilter;
    if (!q) return matchCat;
    const matchTool =
      tool.name.toLowerCase().includes(q) ||
      tName(tool.name).toLowerCase().includes(q) ||
      tool.brand.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.sizes.some((s) => s.size.toLowerCase().includes(q));
    return matchCat && matchTool;
  });

  const openTool = (tool) => {
    setSelectedTool(tool);
    setDefaultBin(
      availableBins.some((b) => b.code === tool.defaultBin) ? tool.defaultBin : availableBins[0]?.code || ''
    );
    setSelectedQtyMap({});
  };

  const makeSku = (tool, sizeObj) => `${tool.skuPrefix}-${sizeObj.code}`.toUpperCase();

  const toggleSize = (code) => {
    setSelectedQtyMap((prev) => {
      if (prev[code] !== undefined) {
        const next = { ...prev };
        delete next[code];
        return next;
      }
      return { ...prev, [code]: Math.max(1, parseInt(defaultQty) || 1) };
    });
  };

  const adjustSizeQty = (code, delta, e) => {
    e.stopPropagation();
    setSelectedQtyMap((prev) => {
      const current = prev[code] || 0;
      const nextQty = current + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[code];
        return copy;
      }
      return { ...prev, [code]: nextQty };
    });
  };

  const setExplicitSizeQty = (code, val) => {
    const parsed = Math.max(1, parseInt(val) || 1);
    setSelectedQtyMap((prev) => ({ ...prev, [code]: parsed }));
  };

  const selectAllSizes = () => {
    if (!selectedTool) return;
    const qty = Math.max(1, parseInt(defaultQty) || 1);
    const next = {};
    selectedTool.sizes.forEach((s) => {
      next[s.code] = selectedQtyMap[s.code] || qty;
    });
    setSelectedQtyMap(next);
  };

  const selectMissingOnly = () => {
    if (!selectedTool) return;
    const qty = Math.max(1, parseInt(defaultQty) || 1);
    const next = {};
    selectedTool.sizes.forEach((s) => {
      const sku = makeSku(selectedTool, s);
      if (!existingItemsMap[sku]) {
        next[s.code] = selectedQtyMap[s.code] || qty;
      }
    });
    setSelectedQtyMap(next);
  };

  const buildItemPayload = (tool, sizeObj, customAddQty) => {
    const sku = makeSku(tool, sizeObj);
    const existing = existingItemsMap[sku];
    const addQty = customAddQty !== undefined ? customAddQty : Math.max(1, parseInt(defaultQty) || 1);
    // If item already exists in catalog, add to its existing stock; otherwise set initial stock
    const finalQty = existing ? Number(existing.quantity || 0) + addQty : addQty;

    return {
      sku,
      name: existing ? existing.name : `${tool.name} ${sizeObj.size}`,
      size: sizeObj.size,
      unit: sizeObj.unit || tool.unit || 'PCS',
      category: existing ? existing.category : tool.category,
      brand: existing ? existing.brand : tool.brand,
      selling_price: existing ? Number(existing.selling_price) : sizeObj.price,
      cost_price: existing ? Number(existing.cost_price) : sizeObj.cost,
      quantity: finalQty,
      reorder_level: existing ? Number(existing.reorder_level) : parseFloat(defaultReorder) || 10,
      bin_id: existing && existing.bin_id ? existing.bin_id : (defaultBin || '').trim().toUpperCase(),
      image_url: existing?.image_url || tool.image,
    };
  };

  const selectedCodes = Object.keys(selectedQtyMap);
  const totalUnitsToAdd = selectedCodes.reduce((sum, code) => sum + (Number(selectedQtyMap[code]) || 0), 0);

  const handleBulkSubmit = async () => {
    if (!selectedTool || selectedCodes.length === 0) return;
    setIsSaving(true);
    try {
      const itemsToInsert = selectedTool.sizes
        .filter((s) => selectedQtyMap[s.code] !== undefined)
        .map((s) => buildItemPayload(selectedTool, s, selectedQtyMap[s.code]));
      await onBulkAddSizes(itemsToInsert, totalUnitsToAdd);
    } finally {
      setIsSaving(false);
    }
  };

  // Detail View: Pick Sizes & Counts for the selected Tool
  if (selectedTool) {
    return (
      <div className="space-y-4">
        {/* Top Back Bar & Tool Preview */}
        <div className="flex items-start gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
          <div className="w-24 h-24 rounded-xl bg-white border border-slate-200 p-2 flex items-center justify-center flex-shrink-0 shadow-2xs">
            <img
              src={selectedTool.image}
              alt={selectedTool.name}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelectedTool(null)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('ct_all_tools')}</span>
              </button>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                {selectedTool.brand} · {tCategory(selectedTool.category)}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mt-1">{tName(selectedTool.name)}</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">{tName(selectedTool.description)}</p>

            {/* Quick Defaults for Newly Selected Sizes */}
            <div className="grid grid-cols-3 gap-2.5 mt-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">{t('ct_default_qty')}</label>
                <input
                  type="number"
                  min="1"
                  value={defaultQty}
                  onChange={(e) => setDefaultQty(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">{t('ct_reorder_level')}</label>
                <input
                  type="number"
                  min="0"
                  value={defaultReorder}
                  onChange={(e) => setDefaultReorder(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">{t('ct_rack_bin_short')}</label>
                <BinPicker
                  value={defaultBin}
                  onChange={setDefaultBin}
                  selectClassName="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Size Selection Controls */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">
            {t('ct_avail_sizes', { n: selectedTool.sizes.length })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectMissingOnly}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              {t('ct_select_new')}
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={selectAllSizes}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              {t('ct_select_all')}
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => setSelectedQtyMap({})}
              className="text-[11px] font-semibold text-slate-500 hover:underline"
            >
              {t('ct_clear')}
            </button>
          </div>
        </div>

        {/* Sizes Grid with Per-Size Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {selectedTool.sizes.map((s) => {
            const sku = makeSku(selectedTool, s);
            const isSelected = selectedQtyMap[s.code] !== undefined;
            const addCount = selectedQtyMap[s.code] || 0;
            const existing = existingItemsMap[sku];
            const currentStock = existing ? Number(existing.quantity || 0) : 0;

            return (
              <div
                key={s.code}
                onClick={() => toggleSize(s.code)}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 leading-tight">{tName(s.size)}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">₹ {existing ? Number(existing.selling_price) : s.price}</p>
                  </div>
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>

                {/* Selected: Per-Size Quantity Stepper | Unselected: Stock Badge & Edit */}
                {isSelected ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 pt-2 border-t border-blue-200/70 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-semibold text-blue-700">
                        {existing ? t('ct_add_colon') : t('ct_qty_colon')}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => adjustSizeQty(s.code, -1, e)}
                          className="w-6 h-6 rounded-md bg-white border border-blue-200 hover:bg-blue-100 text-blue-700 flex items-center justify-center transition-colors"
                          title={t('ct_decrease')}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={addCount}
                          onChange={(e) => setExplicitSizeQty(s.code, e.target.value)}
                          className="no-spinner w-12 text-center bg-white border border-blue-300 rounded-md py-0.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={(e) => adjustSizeQty(s.code, 1, e)}
                          className="w-6 h-6 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
                          title={t('ct_increase')}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {existing && (
                      <p className="text-[10px] font-bold text-emerald-700 text-right">
                        {t('ct_stock_change', { from: currentStock, to: currentStock + addCount })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                    {existing ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {t('ct_stock_n', { n: currentStock })}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">{t('ct_tap_to_add')}</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFillManualForm(buildItemPayload(selectedTool, s, Math.max(1, parseInt(defaultQty) || 1)));
                      }}
                      title={t('ct_customize')}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-100/70"
                    >
                      {t('ct_edit')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-500">
            {t('ct_picker_hint')}
          </p>
          <button
            type="button"
            disabled={selectedCodes.length === 0 || isSaving}
            onClick={handleBulkSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {isSaving
                ? t('ct_saving')
                : selectedCodes.length === 0
                ? t('ct_add_selected')
                : t(selectedCodes.length === 1 ? 'ct_save_sizes_one' : 'ct_save_sizes_many', {
                    n: selectedCodes.length,
                    units: totalUnitsToAdd,
                  })}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Main Grid View: Browse All 16 Tool Families
  return (
    <div className="space-y-3.5">
      {/* Search & Category Pills */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('ct_search_tools')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors border ${
                catFilter === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat === 'All' ? t('cat_all') : tCategory(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1">
        {filteredTools.map((tool) => {
          const addedCount = tool.sizes.filter((s) => Boolean(existingItemsMap[makeSku(tool, s)])).length;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => openTool(tool)}
              className="group bg-white border border-slate-200 hover:border-blue-500 hover:shadow-md rounded-xl p-2.5 text-left transition-all flex flex-col justify-between"
            >
              <div>
                <div className="h-24 w-full bg-white rounded-lg border border-slate-100 p-1.5 flex items-center justify-center overflow-hidden relative">
                  <img
                    src={tool.image}
                    alt={tName(tool.name)}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                  />
                  {addedCount > 0 && (
                    <span className="absolute top-1 right-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {addedCount}
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-900 mt-2 leading-snug group-hover:text-blue-600 line-clamp-2">
                  {tName(tool.name)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{tool.brand}</p>
              </div>
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {t('ct_n_sizes', { n: tool.sizes.length })}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-600">
                  {t('ct_pick')}
                </span>
              </div>
            </button>
          );
        })}

        {filteredTools.length === 0 && (
          <div className="col-span-4 py-10 text-center text-xs text-slate-400">
            <Package className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
            {t('ct_no_tools_a', { query })}<strong>{t('ct_create_product')}</strong>{t('ct_no_tools_b')}
          </div>
        )}
      </div>
    </div>
  );
}
