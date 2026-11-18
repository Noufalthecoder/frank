import React, { useState } from 'react';
import {
  Search,
  ArrowLeft,
  Check,
  CheckCircle2,
  Plus,
  SlidersHorizontal,
  Package
} from 'lucide-react';
import { TOOL_LIBRARY } from '../data/toolLibrary.js';

export default function ToolLibraryPicker({
  existingSkus = new Set(),
  availableBins = [],
  onFillManualForm,
  onBulkAddSizes,
}) {
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [selectedTool, setSelectedTool] = useState(null);
  const [selectedSizeCodes, setSelectedSizeCodes] = useState([]);
  const [defaultQty, setDefaultQty] = useState('25');
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
      tool.brand.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.sizes.some((s) => s.size.toLowerCase().includes(q));
    return matchCat && matchTool;
  });

  const openTool = (tool) => {
    setSelectedTool(tool);
    setDefaultBin(tool.defaultBin || availableBins[0]?.code || 'R01-L1-S1');
    setSelectedSizeCodes([]);
  };

  const makeSku = (tool, sizeObj) => `${tool.skuPrefix}-${sizeObj.code}`.toUpperCase();

  const toggleSize = (code) => {
    setSelectedSizeCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const selectAllSizes = () => {
    if (!selectedTool) return;
    setSelectedSizeCodes(selectedTool.sizes.map((s) => s.code));
  };

  const selectMissingOnly = () => {
    if (!selectedTool) return;
    const missing = selectedTool.sizes
      .filter((s) => !existingSkus.has(makeSku(selectedTool, s)))
      .map((s) => s.code);
    setSelectedSizeCodes(missing);
  };

  const buildItemPayload = (tool, sizeObj) => ({
    sku: makeSku(tool, sizeObj),
    name: `${tool.name} ${sizeObj.size}`,
    size: sizeObj.size,
    unit: sizeObj.unit || tool.unit || 'PCS',
    category: tool.category,
    brand: tool.brand,
    selling_price: sizeObj.price,
    cost_price: sizeObj.cost,
    quantity: parseFloat(defaultQty) || 0,
    reorder_level: parseFloat(defaultReorder) || 10,
    bin_id: (defaultBin || tool.defaultBin || 'R01-L1-S1').trim().toUpperCase(),
    image_url: tool.image,
  });

  const handleBulkSubmit = async () => {
    if (!selectedTool || selectedSizeCodes.length === 0) return;
    setIsSaving(true);
    try {
      const itemsToInsert = selectedTool.sizes
        .filter((s) => selectedSizeCodes.includes(s.code))
        .map((s) => buildItemPayload(selectedTool, s));
      await onBulkAddSizes(itemsToInsert);
    } finally {
      setIsSaving(false);
    }
  };

  // Detail View: Pick Sizes for the selected Tool
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
                <span>All Tools</span>
              </button>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                {selectedTool.brand} · {selectedTool.category}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mt-1">{selectedTool.name}</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">{selectedTool.description}</p>

            {/* Quick Defaults for Selected Sizes */}
            <div className="grid grid-cols-3 gap-2.5 mt-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  value={defaultQty}
                  onChange={(e) => setDefaultQty(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Reorder Level</label>
                <input
                  type="number"
                  min="0"
                  value={defaultReorder}
                  onChange={(e) => setDefaultReorder(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Rack / Bin</label>
                <input
                  type="text"
                  list="tool-lib-bins"
                  value={defaultBin}
                  onChange={(e) => setDefaultBin(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="tool-lib-bins">
                  {availableBins.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.label}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        </div>

        {/* Size Selection Controls */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">
            Available Standard Sizes ({selectedTool.sizes.length})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectMissingOnly}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              Select New Only
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={selectAllSizes}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              Select All
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => setSelectedSizeCodes([])}
              className="text-[11px] font-semibold text-slate-500 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Sizes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
          {selectedTool.sizes.map((s) => {
            const sku = makeSku(selectedTool, s);
            const isSelected = selectedSizeCodes.includes(s.code);
            const inCatalog = existingSkus.has(sku);

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
                    <p className="text-xs font-bold text-slate-900 leading-tight">{s.size}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{sku}</p>
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

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-800">₹ {s.price}</span>
                  <div className="flex items-center gap-1.5">
                    {inCatalog && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        In Stock
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFillManualForm(buildItemPayload(selectedTool, s));
                      }}
                      title="Customize in Manual Form"
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-100/70"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-500">
            Tip: Click sizes to multi-select, or click <strong>Edit</strong> on any size to tweak prices first.
          </p>
          <button
            type="button"
            disabled={selectedSizeCodes.length === 0 || isSaving}
            onClick={handleBulkSubmit}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {isSaving
                ? 'Adding...'
                : `Add ${selectedSizeCodes.length || ''} Selected Size${selectedSizeCodes.length === 1 ? '' : 's'} to Catalog`}
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
            placeholder="Search tools, brands, or sizes (e.g. Spanner, Plier, 12mm, Bosch, Taparia)..."
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
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1">
        {filteredTools.map((tool) => {
          const addedCount = tool.sizes.filter((s) => existingSkus.has(makeSku(tool, s))).length;
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
                    alt={tool.name}
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
                  {tool.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{tool.brand}</p>
              </div>
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {tool.sizes.length} sizes
                </span>
                <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-600">
                  Pick →
                </span>
              </div>
            </button>
          );
        })}

        {filteredTools.length === 0 && (
          <div className="col-span-4 py-10 text-center text-xs text-slate-400">
            <Package className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
            No preset tools match "{query}". Switch to <strong>Manual Entry</strong> to add a custom product.
          </div>
        )}
      </div>
    </div>
  );
}
