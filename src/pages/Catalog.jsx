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
  Camera
} from 'lucide-react';
import ToolLibraryPicker from '../components/ToolLibraryPicker.jsx';
import { TOOL_LIBRARY } from '../data/toolLibrary.js';

const PAGE_SIZE = 15;

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
};

export default function Catalog() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [availableBins, setAvailableBins] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalMode, setModalMode] = useState('library'); // 'library' | 'manual'
  const [editingItem, setEditingItem] = useState(null);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState('');
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

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
    setTimeout(() => setToast(''), 3500);
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
    const matchSearch =
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.sku.toLowerCase().includes(search.toLowerCase()) ||
      (i.size && i.size.toLowerCase().includes(search.toLowerCase()));
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchBrand = brandFilter === 'All' || i.brand === brandFilter;
    const matchStatus = statusFilter === 'All' || i.status === statusFilter;
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

  const handleSaveItem = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.sku.trim() || !form.name.trim() || form.selling_price === '') {
      setFormError('Please fill SKU, Item Name, and Selling Price.');
      return;
    }

    if (!window.api) {
      setFormError('Database API unavailable. Please reload the app.');
      return;
    }

    try {
      const payload = {
        ...form,
        sku: form.sku.trim().toUpperCase(),
        name: form.name.trim(),
        brand: (form.brand || 'Generic').trim(),
        bin_id: (form.bin_id || '').trim().toUpperCase(),
        selling_price: parseFloat(form.selling_price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        quantity: parseFloat(form.quantity) || 0,
        reorder_level: parseFloat(form.reorder_level) || 0,
      };

      const res = editingItem
        ? await window.api.updateItem({ ...payload, id: editingItem.id, status: 'Active' })
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
      unit: item.unit || 'PCS',
      category: item.category || 'Fasteners',
      brand: item.brand || 'Generic',
      selling_price: item.selling_price,
      cost_price: item.cost_price,
      quantity: item.quantity,
      reorder_level: item.reorder_level,
      bin_id: item.bin_id || 'R01-L1-S1',
      image_url: item.image_url || '',
    });
    loadRackBins();
    setShowAddModal(true);
  };

  const handleBulkAddFromLibrary = async (selectedItems) => {
    if (!window.api || !window.api.bulkImportItems) return;
    const res = await window.api.bulkImportItems(selectedItems);
    if (res && res.success) {
      setShowAddModal(false);
      await loadItems();
      window.dispatchEvent(new CustomEvent('stock-updated'));
      showToast(`Added ${res.count} tool size${res.count === 1 ? '' : 's'} to catalog.`);
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
      quantity: String(itemPayload.quantity ?? '25'),
      reorder_level: String(itemPayload.reorder_level ?? '10'),
      bin_id: itemPayload.bin_id || availableBins[0]?.code || 'R01-L1-S1',
      image_url: itemPayload.image_url || '',
    });
    setModalMode('manual');
  };

  const existingSkus = new Set(items.map((i) => String(i.sku || '').toUpperCase()));

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

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Hidden CSV File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleImportCsv}
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Product Catalog</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage items, permanent rates, shelf bins and stock</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {toast && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {toast}
            </span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            title="Import products from CSV (sku, name, size, unit, category, brand, selling_price, cost_price, quantity, reorder_level, bin_id)"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by SKU, name or size..."
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
            <option value="All">Category: All</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
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
            <option value="All">Brand: All</option>
            {uniqueBrands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Active">Status: Active</option>
            <option value="All">Status: All</option>
            <option value="Inactive">Status: Inactive</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4">Item Name</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Unit</th>
              <th className="py-3 px-4">Selling Price</th>
              <th className="py-3 px-4">Stock</th>
              <th className="py-3 px-4 text-right">Actions</th>
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
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.category} {item.brand ? `· ${item.brand}` : ''} · Shelf:{' '}
                          <span className="text-blue-600 font-medium">{item.bin_id || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{item.size || '—'}</td>
                  <td className="py-3 px-4 text-slate-600 font-medium">{item.unit}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    ₹ {Number(item.selling_price).toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                        Number(item.quantity) <= 0
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : Number(item.quantity) <= (item.reorder_level || 20)
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {Number(item.quantity).toLocaleString('en-IN')}
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
            {paginatedItems.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                  No products found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Table Footer with Real Pagination */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>
            Showing {filteredItems.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} –{' '}
            {Math.min(currentPage * PAGE_SIZE, filteredItems.length)} of {filteredItems.length} items
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className={`bg-white rounded-xl shadow-2xl border border-slate-200 w-full overflow-hidden flex flex-col max-h-[90vh] transition-all ${modalMode === 'library' && !editingItem ? 'max-w-3xl' : 'max-w-lg'}`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-slate-900">
                  {editingItem ? 'Edit Product' : 'Add Product to Catalog'}
                </h3>
                {!editingItem && (
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setModalMode('library')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                        modalMode === 'library'
                          ? 'bg-white text-blue-600 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Wrench className="w-3 h-3" />
                      <span>Tool Library ({TOOL_LIBRARY.reduce((s, t) => s + t.sizes.length, 0)} Sizes)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalMode('manual')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        modalMode === 'manual'
                          ? 'bg-white text-blue-600 shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Manual Entry
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab 1: Tool Library Visual Picker */}
            {!editingItem && modalMode === 'library' ? (
              <div className="p-5 overflow-y-auto">
                <ToolLibraryPicker
                  existingSkus={existingSkus}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">SKU / Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HB-M8-40"
                    value={form.sku}
                    onChange={(e) => {
                      setFormError('');
                      setForm({ ...form, sku: e.target.value });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hex Bolt M8 x 40mm"
                    value={form.name}
                    onChange={(e) => {
                      setFormError('');
                      setForm({ ...form, name: e.target.value });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Size / Dimension</label>
                  <input
                    type="text"
                    placeholder="e.g. M8 x 40"
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Base Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="KG">KG (Kilograms)</option>
                    <option value="BOX">BOX</option>
                    <option value="MTR">MTR (Metre)</option>
                    <option value="SET">SET</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Selling Price (₹) *</label>
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cost Price (₹)</label>
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100"
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

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="20"
                    value={form.reorder_level}
                    onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
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
