import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Upload,
  Download,
  Edit2,
  Trash2,
  ChevronDown,
  X,
  Package,
  Layers,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Camera,
  ArrowLeft,
  Square,
  LayoutGrid,
  Grid3X3,
  List,
  Check
} from 'lucide-react';
import ToolLibraryPicker from '../components/ToolLibraryPicker.jsx';
import { TOOL_LIBRARY } from '../data/toolLibrary.js';
import {
  UNIT_OPTIONS,
  normalizeUnit,
  getUnitGroup,
  isMeasurableUnit,
  formatQty,
} from '../lib/units.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const VIEW_MODES = [
  { id: 'large', labelKey: 'cat_view_large', icon: Square, pageSize: 12 },
  { id: 'medium', labelKey: 'cat_view_medium', icon: LayoutGrid, pageSize: 15 },
  { id: 'small', labelKey: 'cat_view_small', icon: Grid3X3, pageSize: 24 },
  { id: 'detail', labelKey: 'cat_view_detail', icon: List, pageSize: 15 },
];
const VIEW_STORAGE_KEY = 'tsp_catalog_view_mode';

const EMPTY_FORM = {
  sku: '',
  name: '',
  size: '',
  unit: 'PCS',
  category: 'Fasteners',
  brand: 'Generic',
  selling_price: '',
  cost_price: '',
  quantity: '',
  reorder_level: '20',
  bin_id: 'R01-L1-S1',
  image_url: '',
  status: 'Available',
};

const isItemAvailable = (item) =>
  Number(item.quantity) > 0 && item.status !== 'Unavailable' && item.status !== 'Inactive';

export default function Catalog() {
  const { t, tName, tCategory } = useLanguage();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [availableBins, setAvailableBins] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalMode, setModalMode] = useState('library'); // 'library' | 'manual'
  const [editingItem, setEditingItem] = useState(null);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved && VIEW_MODES.some((v) => v.id === saved)) return saved;
    } catch (_) {}
    return 'detail';
  });
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [toast, setToast] = useState('');
  const viewMenuRef = useRef(null);
  const toastTimerRef = useRef(null);

  const handleChangeViewMode = (mode) => {
    setViewMode(mode);
    setPage(1);
    setShowViewMenu(false);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch (_) {}
  };
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target)) {
        setShowViewMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 320;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        setForm((prev) => ({ ...prev, image_url: compressed }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2000);
  };

  // Form State for Add / Edit
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadItems();
    loadRackBins();
    const handleStockUpdate = () => {
      loadItems();
      loadRackBins();
    };
    window.addEventListener('stock-updated', handleStockUpdate);
    return () => window.removeEventListener('stock-updated', handleStockUpdate);
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setSearch(q);
      setCategoryFilter('All');
      setBrandFilter('All');
      setPage(1);
    }
  }, [searchParams]);

  const loadItems = async () => {
    if (window.api && window.api.getItems) {
      const res = await window.api.getItems();
      setItems(res || []);
    }
  };

  const loadRackBins = async () => {
    if (window.api && window.api.getRacks) {
      const racks = await window.api.getRacks();
      const bins = [];
      (racks || []).forEach((r) => {
        (r.bins || []).forEach((b) => {
          bins.push({ code: b.bin_code, label: `${b.bin_code} (${r.name})` });
        });
      });
      setAvailableBins(bins);
    }
  };

  const filteredItems = items.filter((i) => {
    const q = search.toLowerCase();
    const matchSearch =
      i.name.toLowerCase().includes(q) ||
      tName(i.name).toLowerCase().includes(q) ||
      i.sku.toLowerCase().includes(q) ||
      (i.size && i.size.toLowerCase().includes(q));
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchBrand = brandFilter === 'All' || i.brand === brandFilter;
    const available = isItemAvailable(i);
    const matchStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Available' && available) ||
      (statusFilter === 'Unavailable' && !available);
    return matchSearch && matchCat && matchBrand && matchStatus;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredItems.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this item?')) {
      if (window.api && window.api.deleteItem) {
        await window.api.deleteItem(id);
        loadItems();
        window.dispatchEvent(new CustomEvent('stock-updated'));
      }
    }
  };

  const generateAutoSku = (name, size) => {
    const words = String(name || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    const prefix =
      words.length >= 2
        ? words.slice(0, 3).map((w) => w[0]).join('')
        : (words[0] || 'ITM').slice(0, 3);

    const sizeToken = String(size || '')
      .trim()
      .toUpperCase()
      .replace(/"/g, 'IN')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);

    const base = sizeToken ? `${prefix}-${sizeToken}` : `${prefix}-01`;
    if (!existingSkus.has(base)) return base;

    let counter = 2;
    const stem = sizeToken ? `${prefix}-${sizeToken}` : prefix;
    while (existingSkus.has(`${stem}-${String(counter).padStart(2, '0')}`)) {
      counter++;
    }
    return `${stem}-${String(counter).padStart(2, '0')}`;
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() || form.selling_price === '') {
      setFormError('Please fill Item Name and Selling Price.');
      return;
    }

    if (!window.api) {
      setFormError('Database API unavailable. Please reload the app.');
      return;
    }

    try {
      const resolvedSku = editingItem
        ? (form.sku.trim().toUpperCase() || editingItem.sku)
        : (form.sku.trim() && !existingSkus.has(form.sku.trim().toUpperCase())
            ? form.sku.trim().toUpperCase()
            : generateAutoSku(form.name, form.size));

      const payload = {
        ...form,
        sku: resolvedSku,
        name: form.name.trim(),
        unit: normalizeUnit(form.unit),
        brand: (form.brand || 'Generic').trim(),
        bin_id: (form.bin_id || '').trim().toUpperCase(),
        selling_price: parseFloat(form.selling_price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        quantity: parseFloat(form.quantity) || 0,
        reorder_level: parseFloat(form.reorder_level) || 0,
        status: form.status === 'Unavailable' ? 'Unavailable' : 'Available',
      };

      const res = editingItem
        ? await window.api.updateItem({ ...payload, id: editingItem.id })
        : await window.api.addItem(payload);

      if (res && res.success === false) {
        setFormError(res.error || 'Could not save product.');
        return;
      }

      setShowAddModal(false);
      setEditingItem(null);
      setForm(EMPTY_FORM);
      await loadItems();
      window.dispatchEvent(new CustomEvent('stock-updated'));
      showToast(editingItem ? 'Product updated.' : `Added "${payload.name}" (${resolvedSku}).`);
    } catch (err) {
      setFormError(err.message || 'Failed to save product.');
    }
  };

  const openAdd = () => {
    setFormError('');
    setEditingItem(null);
    setModalMode('library');
    setForm({
      ...EMPTY_FORM,
      bin_id: availableBins[0]?.code || 'R01-L1-S1',
    });
    loadRackBins();
    setShowAddModal(true);
  };

  const openEdit = (item) => {
    setFormError('');
    setEditingItem(item);
    setModalMode('manual');
    setForm({
      sku: item.sku,
      name: item.name,
      size: item.size || '',
      unit: normalizeUnit(item.unit || 'PCS'),
      category: item.category || 'Fasteners',
      brand: item.brand || 'Generic',
      selling_price: item.selling_price,
      cost_price: item.cost_price,
      quantity: item.quantity,
      reorder_level: item.reorder_level,
      bin_id: item.bin_id || 'R01-L1-S1',
      image_url: item.image_url || '',
      status: item.status === 'Unavailable' || item.status === 'Inactive' ? 'Unavailable' : 'Available',
    });
    loadRackBins();
    setShowAddModal(true);
  };

  const handleBulkAddFromLibrary = async (selectedItems, totalUnits) => {
    if (!window.api || !window.api.bulkImportItems) return;
    const res = await window.api.bulkImportItems(selectedItems);
    if (res && res.success) {
      setShowAddModal(false);
      await loadItems();
      window.dispatchEvent(new CustomEvent('stock-updated'));
      showToast(
        `Saved ${res.count} size${res.count === 1 ? '' : 's'}${totalUnits ? ` (+${totalUnits} units)` : ''} to catalog.`
      );
    } else {
      alert(res?.error || 'Failed to add selected tools.');
    }
  };

  const handleFillFromLibrary = (itemPayload) => {
    setFormError('');
    setEditingItem(null);
    setForm({
      sku: itemPayload.sku,
      name: itemPayload.name,
      size: itemPayload.size || '',
      unit: itemPayload.unit || 'PCS',
      category: itemPayload.category || 'Tools',
      brand: itemPayload.brand || 'Generic',
      selling_price: String(itemPayload.selling_price ?? ''),
      cost_price: String(itemPayload.cost_price ?? ''),
      quantity: String(itemPayload.quantity ?? '10'),
      reorder_level: String(itemPayload.reorder_level ?? '10'),
      bin_id: itemPayload.bin_id || availableBins[0]?.code || 'R01-L1-S1',
      image_url: itemPayload.image_url || '',
    });
    setModalMode('manual');
  };

  const existingSkus = new Set(items.map((i) => String(i.sku || '').toUpperCase()));
  const existingItemsMap = items.reduce((acc, i) => {
    acc[String(i.sku || '').toUpperCase()] = i;
    return acc;
  }, {});

  // CSV Export
  const handleExportCsv = () => {
    const headers = ['sku', 'name', 'size', 'unit', 'category', 'brand', 'selling_price', 'cost_price', 'quantity', 'reorder_level', 'bin_id'];
    const rows = filteredItems.map((i) =>
      headers.map((h) => {
        const val = i[h] ?? '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product_catalog_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredItems.length} products to CSV.`);
  };

  // CSV Import
  const parseCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        alert('CSV file must have a header row and at least one product row.');
        return;
      }
      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
      const parsedItems = lines.slice(1).map((line) => {
        const cols = parseCsvLine(line);
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] ?? '';
        });
        return {
          sku: obj.sku || obj.code || '',
          name: obj.name || obj.item_name || obj.product || '',
          size: obj.size || obj.dimension || '',
          unit: obj.unit || 'PCS',
          category: obj.category || 'Others',
          brand: obj.brand || 'Generic',
          selling_price: parseFloat(obj.selling_price || obj.price || obj.rate) || 0,
          cost_price: parseFloat(obj.cost_price || obj.cost) || 0,
          quantity: parseFloat(obj.quantity || obj.stock || obj.qty) || 0,
          reorder_level: parseFloat(obj.reorder_level || obj.reorder) || 10,
          bin_id: obj.bin_id || obj.rack || obj.bin || '',
        };
      });

      if (window.api && window.api.bulkImportItems) {
        const res = await window.api.bulkImportItems(parsedItems);
        if (res && res.success) {
          showToast(`Imported / updated ${res.count} products from CSV.`);
          await loadItems();
          window.dispatchEvent(new CustomEvent('stock-updated'));
        } else {
          alert(res?.error || 'CSV import failed.');
        }
      }
    } catch (err) {
      alert(`Failed to read CSV: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  // Dynamic filter dropdown options
  const uniqueCategories = Array.from(new Set(['Fasteners', 'Tools', 'Electrical', 'Plumbing', 'Paints & Adhesives', 'Others', ...items.map((i) => i.category).filter(Boolean)]));
  const uniqueBrands = Array.from(new Set(items.map((i) => i.brand).filter(Boolean))).sort();

  const pageSize = (VIEW_MODES.find((v) => v.id === viewMode) || VIEW_MODES[3]).pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getStockBadgeClass = (item) =>
    !isItemAvailable(item)
      ? 'bg-rose-50 text-rose-700 border border-rose-200'
      : Number(item.quantity) <= (item.reorder_level || 20)
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

  const getStockBadgeText = (item, compact = false) => {
    if (!isItemAvailable(item)) return t('cat_unavailable');
    const u = normalizeUnit(item.unit);
    return `${formatQty(item.quantity)}${isMeasurableUnit(u) ? (compact ? u : ` ${u}`) : ''}`;
  };

  const getUnitBadgeClass = (unit) => {
    const grp = getUnitGroup(unit);
    if (grp === 'length') return 'bg-sky-50 text-sky-700 border border-sky-200';
    if (grp === 'weight') return 'bg-violet-50 text-violet-700 border border-violet-200';
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  };

  return (
    <div className="space-y-5">
      {/* Floating Top-Right Toast Notification (2s) */}
      {toast && (
        <div className="animate-toast fixed top-4 right-5 z-[100] flex items-center gap-2 bg-slate-900 text-white border border-slate-700/80 shadow-2xl shadow-slate-900/25 px-4 py-2.5 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Hidden CSV File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleImportCsv}
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-extrabold text-slate-900 tracking-[-0.025em]">{t('cat_title')}</h1>
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setStatusFilter('All'); setPage(1); }}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all tabular-nums ${
                  statusFilter === 'All'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {items.length} {t('cat_all')}
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('Available'); setPage(1); }}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all tabular-nums ${
                  statusFilter === 'Available'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {items.filter(isItemAvailable).length} {t('cat_available')}
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('Unavailable'); setPage(1); }}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all tabular-nums ${
                  statusFilter === 'Unavailable'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                {items.filter((i) => !isItemAvailable(i)).length} {t('cat_unavailable')}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">{t('cat_subtitle')}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all"
            title="Import products from CSV (sku, name, size, unit, category, brand, selling_price, cost_price, quantity, reorder_level, bin_id)"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('cat_import_csv')}</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('cat_export_csv')}</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl text-xs font-bold text-white shadow-sm shadow-blue-600/25 active:scale-[0.98] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('cat_add_item')}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="surface-card p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('cat_search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2">
          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">{t('cat_category')}: {t('cat_all')}</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{tCategory(c)}</option>
            ))}
          </select>

          {/* Brand */}
          <select
            value={brandFilter}
            onChange={(e) => {
              setBrandFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">{t('cat_brand')}: {t('cat_all')}</option>
            {uniqueBrands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Status: All / Available / Unavailable */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">{t('cat_status')}: {t('cat_all')}</option>
            <option value="Available">{t('cat_status')}: {t('cat_available')}</option>
            <option value="Unavailable">{t('cat_status')}: {t('cat_unavailable')}</option>
          </select>

          {/* View Dropdown: Large, Medium, Small Icons & Row/Detail View */}
          <div className="relative" ref={viewMenuRef}>
            {(() => {
              const currentView = VIEW_MODES.find((v) => v.id === viewMode) || VIEW_MODES[3];
              const CurrentIcon = currentView.icon;
              return (
                <button
                  type="button"
                  onClick={() => setShowViewMenu((prev) => !prev)}
                  title={`${t('cat_view_label')}: ${t(currentView.labelKey)}`}
                  aria-label={`${t('cat_view_label')}: ${t(currentView.labelKey)}`}
                  aria-haspopup="menu"
                  aria-expanded={showViewMenu}
                  className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <CurrentIcon className="w-4 h-4 text-blue-600" />
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showViewMenu ? 'rotate-180' : ''}`} />
                </button>
              );
            })()}

            {showViewMenu && (
              <div
                role="menu"
                className="animate-popover absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-2xl shadow-slate-900/12 border border-slate-200/90 py-1.5 z-40"
              >
                {VIEW_MODES.map(({ id, labelKey, icon: Icon }) => {
                  const active = viewMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleChangeViewMode(id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{t(labelKey)}</span>
                      </span>
                      {active && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Listing Container */}
      <div className="surface-card rounded-2xl overflow-hidden">
        {paginatedItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            {t('cat_no_products')}
          </div>
        ) : viewMode === 'detail' ? (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="py-3 px-4">{t('cat_col_sku')}</th>
              <th className="py-3 px-4">{t('cat_col_name')}</th>
              <th className="py-3 px-4">{t('cat_col_size')}</th>
              <th className="py-3 px-4">{t('cat_col_unit')}</th>
              <th className="py-3 px-4">{t('cat_col_price')}</th>
              <th className="py-3 px-4">{t('cat_col_stock')}</th>
              <th className="py-3 px-4 text-right">{t('cat_col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {paginatedItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <tr
                  key={item.id}
                  className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(item.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-800">{item.sku}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden p-0.5">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{tName(item.name)}</div>
                        <div className="text-[11px] text-slate-400">
                          {tCategory(item.category)} {item.brand ? `· ${item.brand}` : ''} · {t('dash_shelf')}:{' '}
                          <span className="text-blue-600 font-medium">{item.bin_id || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{item.size ? tName(item.size) : '—'}</td>
                  <td className="py-3 px-4">
                    {(() => {
                      const u = normalizeUnit(item.unit);
                      const grp = getUnitGroup(u);
                      return (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            grp === 'length'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : grp === 'weight'
                              ? 'bg-violet-50 text-violet-700 border border-violet-200'
                              : 'text-slate-600'
                          }`}
                        >
                          {u}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    ₹ {Number(item.selling_price).toFixed(2)}
                    {isMeasurableUnit(item.unit) && (
                      <span className="text-[10px] font-medium text-slate-400"> / {normalizeUnit(item.unit)}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full font-semibold text-[11px] ${getStockBadgeClass(item)}`}>
                      {getStockBadgeText(item)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2 text-slate-400">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                        title="Edit Item"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        ) : viewMode === 'large' ? (
          /* Large Icons Grid */
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {paginatedItems.map((item) => {
              const u = normalizeUnit(item.unit);
              const measurable = isMeasurableUnit(u);
              return (
                <div
                  key={item.id}
                  className="group bg-white border border-slate-200 hover:border-blue-400 rounded-xl overflow-hidden flex flex-col justify-between transition-all hover:shadow-md"
                >
                  {/* Large Image Stage */}
                  <div className="relative h-40 bg-slate-50/70 border-b border-slate-100 flex items-center justify-center p-4">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <Package className="w-12 h-12 text-slate-300" />
                    )}
                    <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-bold ${getUnitBadgeClass(u)}`}>
                      {u}
                    </span>
                    <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStockBadgeClass(item)}`}>
                      {!isItemAvailable(item) ? t('cat_unavailable') : `${formatQty(item.quantity)} ${u}`}
                    </span>
                  </div>

                  {/* Card Details */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                        {tName(item.name)}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        <span className="font-mono text-slate-500">{item.sku}</span>
                        {item.size ? ` · ${tName(item.size)}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {tCategory(item.category)}{item.brand ? ` · ${item.brand}` : ''} ·{' '}
                        <span className="text-blue-600 font-medium">{item.bin_id || 'Unassigned'}</span>
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900">
                        ₹ {Number(item.selling_price).toFixed(2)}
                        {measurable && (
                          <span className="text-[10px] font-medium text-slate-400"> / {u}</span>
                        )}
                      </span>
                      <div className="flex items-center gap-1 text-slate-400">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Item"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'medium' ? (
          /* Medium Icons Grid */
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {paginatedItems.map((item) => {
              const u = normalizeUnit(item.unit);
              const measurable = isMeasurableUnit(u);
              return (
                <div
                  key={item.id}
                  className="group bg-white border border-slate-200 hover:border-blue-400 rounded-xl overflow-hidden flex flex-col justify-between transition-all hover:shadow-sm"
                >
                  <div className="relative h-28 bg-slate-50/70 border-b border-slate-100 flex items-center justify-center p-3">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <Package className="w-9 h-9 text-slate-300" />
                    )}
                    <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${getStockBadgeClass(item)}`}>
                      {getStockBadgeText(item)}
                    </span>
                  </div>

                  <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">
                        {tName(item.name)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                        {item.sku}{item.size ? ` · ${tName(item.size)}` : ''}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                      <span className="text-xs font-black text-slate-900 truncate">
                        ₹ {Number(item.selling_price).toFixed(2)}
                        {measurable && (
                          <span className="text-[10px] font-medium text-slate-400">/{u}</span>
                        )}
                      </span>
                      <div className="flex items-center gap-0.5 text-slate-400 flex-shrink-0">
                        <button
                          onClick={() => openEdit(item)}
                          className="p-1 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit Item"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Item"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Small Icons Grid */
          <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {paginatedItems.map((item) => {
              const u = normalizeUnit(item.unit);
              const measurable = isMeasurableUnit(u);
              return (
                <div
                  key={item.id}
                  onClick={() => openEdit(item)}
                  className="group bg-white border border-slate-200 hover:border-blue-400 rounded-lg p-2.5 flex flex-col items-center text-center gap-1.5 cursor-pointer transition-all hover:shadow-xs relative"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    title="Delete Item"
                    className="opacity-0 group-hover:opacity-100 absolute top-1.5 right-1.5 p-1 rounded bg-white/90 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-1.5 flex-shrink-0">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2 w-full">
                    {tName(item.name)}
                  </p>
                  <div className="flex items-center justify-center gap-1.5 flex-wrap mt-auto pt-0.5">
                    <span className="text-[11px] font-bold text-slate-800">
                      ₹{Number(item.selling_price).toFixed(0)}
                      {measurable ? `/${u}` : ''}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${getStockBadgeClass(item)}`}>
                      {getStockBadgeText(item, true)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer with Real Pagination */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>
            Showing {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} –{' '}
            {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} items
          </span>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold shadow-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`animate-modal bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full overflow-hidden flex flex-col max-h-[90vh] transition-all ${modalMode === 'library' && !editingItem ? 'max-w-3xl' : 'max-w-lg'}`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                {!editingItem && modalMode === 'manual' && (
                  <button
                    type="button"
                    onClick={() => setModalMode('library')}
                    title="Back to Tool Library"
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h3 className="text-sm font-bold text-slate-900">
                  {editingItem
                    ? t('cat_modal_edit')
                    : modalMode === 'library'
                    ? t('cat_modal_add')
                    : t('cat_modal_create')}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {!editingItem && modalMode === 'library' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormError('');
                      setForm({
                        ...EMPTY_FORM,
                        bin_id: availableBins[0]?.code || 'R01-L1-S1',
                      });
                      setModalMode('manual');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm shadow-blue-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('cat_create_btn')}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab 1: Tool Library Visual Picker */}
            {!editingItem && modalMode === 'library' ? (
              <div className="p-5 overflow-y-auto">
                <ToolLibraryPicker
                  existingItemsMap={existingItemsMap}
                  availableBins={availableBins}
                  onFillManualForm={handleFillFromLibrary}
                  onBulkAddSizes={handleBulkAddFromLibrary}
                />
              </div>
            ) : (
            <form onSubmit={handleSaveItem} className="p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Hidden Image Upload Input */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {/* Clickable Product Icon with Camera Badge */}
              <div className="flex items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  title="Upload product image from folder"
                  className="relative w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-500 flex items-center justify-center flex-shrink-0 transition-all group cursor-pointer"
                >
                  {form.image_url ? (
                    <img
                      src={form.image_url}
                      alt={form.name || 'Product'}
                      className="w-full h-full object-contain rounded-xl p-1 bg-white"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-slate-300 group-hover:text-blue-400 transition-colors" />
                  )}
                  <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white flex items-center justify-center shadow-sm ring-2 ring-white transition-colors">
                    <Camera className="w-3.5 h-3.5" />
                  </span>
                </button>
                <div className="text-xs">
                  <p className="font-semibold text-slate-800">Product Photo</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click the camera icon to upload from your computer
                  </p>
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, image_url: '' })}
                      className="text-[11px] font-semibold text-rose-600 hover:underline mt-1"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Item Name *</label>
                  {form.name.trim() && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Code:{' '}
                      <strong className="text-slate-600">
                        {editingItem
                          ? form.sku
                          : form.sku.trim() && !existingSkus.has(form.sku.trim().toUpperCase())
                          ? form.sku.trim().toUpperCase()
                          : generateAutoSku(form.name, form.size)}
                      </strong>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hex Bolt, Ball Peen Hammer, PVC Pipe..."
                  value={form.name}
                  onChange={(e) => {
                    setFormError('');
                    setForm({ ...form, name: e.target.value, sku: editingItem ? form.sku : '' });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Size / Dimension</label>
                  <input
                    type="text"
                    placeholder="e.g. M8 x 40"
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value, sku: editingItem ? form.sku : '' })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    list="brand-suggestions"
                    placeholder="e.g. Unbrako, Bosch, Taparia"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <datalist id="brand-suggestions">
                    <option value="Unbrako" />
                    <option value="Bosch" />
                    <option value="Taparia" />
                    <option value="Tata Agrico" />
                    <option value="Finolex" />
                    <option value="Asian Paints" />
                    <option value="Pidilite" />
                    <option value="Generic" />
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Fasteners">Fasteners</option>
                    <option value="Tools">Tools</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Paints & Adhesives">Paints & Adhesives</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Measurement / Unit
                  </label>
                  <select
                    value={normalizeUnit(form.unit)}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    {UNIT_OPTIONS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.units.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {isMeasurableUnit(form.unit) && (
                <div
                  className={`rounded-lg px-3 py-2 text-[11px] font-medium border flex items-center justify-between ${
                    getUnitGroup(form.unit) === 'length'
                      ? 'bg-sky-50/70 border-sky-200 text-sky-800'
                      : 'bg-violet-50/70 border-violet-200 text-violet-800'
                  }`}
                >
                  <span>
                    {getUnitGroup(form.unit) === 'length'
                      ? `Measured by Length (${normalizeUnit(form.unit)}) — in POS Billing you can sell in m or cm and stock converts automatically.`
                      : `Measured by Weight (${normalizeUnit(form.unit)}) — in POS Billing you can sell in kg, g, or mg and stock converts automatically.`}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Selling Price (₹ / {normalizeUnit(form.unit)}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="12.00"
                    value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Cost Price (₹ / {normalizeUnit(form.unit)})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="8.50"
                    value={form.cost_price}
                    onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {editingItem ? `Stock (${normalizeUnit(form.unit)})` : `Initial Stock (${normalizeUnit(form.unit)})`}
                  </label>
                  <input
                    type="number"
                    step={isMeasurableUnit(form.unit) ? 'any' : '1'}
                    min="0"
                    placeholder={isMeasurableUnit(form.unit) ? '25.5' : '100'}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                {parseFloat(form.selling_price) > 0 && form.cost_price !== '' && (
                  <div className="col-span-3 bg-blue-50/70 border border-blue-100 rounded-lg p-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Estimated Margin:</span>
                    <span className="font-bold text-emerald-700">
                      ₹ {(parseFloat(form.selling_price) - (parseFloat(form.cost_price) || 0)).toFixed(2)} (
                      {(
                        ((parseFloat(form.selling_price) - (parseFloat(form.cost_price) || 0)) /
                          parseFloat(form.selling_price)) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rack / Shelf Bin</label>
                  <input
                    type="text"
                    list="rack-bins-list"
                    placeholder="e.g. R01-L1-S1"
                    value={form.bin_id}
                    onChange={(e) => setForm({ ...form, bin_id: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <datalist id="rack-bins-list">
                    {availableBins.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.label}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Reorder Level ({normalizeUnit(form.unit)})
                  </label>
                  <input
                    type="number"
                    step={isMeasurableUnit(form.unit) ? 'any' : '1'}
                    min="0"
                    placeholder="20"
                    value={form.reorder_level}
                    onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {t('cat_availability')}
                  </label>
                  <select
                    value={form.status === 'Unavailable' ? 'Unavailable' : 'Available'}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Available">{t('cat_available')}</option>
                    <option value="Unavailable">{t('cat_unavailable')}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  {editingItem ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
