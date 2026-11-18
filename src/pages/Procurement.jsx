import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Eye,
  Trash2,
  X,
  Truck,
  CheckCircle2,
  PackageCheck,
  UserPlus,
  Download
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Procurement() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('Purchase Orders');
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showNewPoModal, setShowNewPoModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [toast, setToast] = useState('');

  const [poForm, setPoForm] = useState({
    po_number: '',
    vendor_name: '',
    order_date: new Date().toISOString().split('T')[0],
    amount: '',
    status: 'Open',
    items: [],
  });
  const [lineSku, setLineSku] = useState('');
  const [lineQty, setLineQty] = useState('10');
  const [lineRate, setLineRate] = useState('');

  const [vendorForm, setVendorForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    city: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const loadData = async () => {
    if (!window.api) return;
    const [pos, v, items] = await Promise.all([
      window.api.getPurchaseOrders ? window.api.getPurchaseOrders() : [],
      window.api.getVendors ? window.api.getVendors() : [],
      window.api.getItems ? window.api.getItems() : [],
    ]);
    setOrders(pos || []);
    setVendors(v || []);
    setCatalogItems(items || []);
    if (v && v.length > 0 && !poForm.vendor_name) {
      setPoForm((prev) => ({ ...prev, vendor_name: v[0].name }));
    }
  };

  const addLineToPo = () => {
    if (!lineSku) return;
    const prod = catalogItems.find((i) => i.sku === lineSku);
    if (!prod) return;
    const qty = Math.max(1, parseFloat(lineQty) || 1);
    const rate = parseFloat(lineRate) || Number(prod.cost_price) || Number(prod.selling_price) || 0;
    const nextItems = [
      ...poForm.items,
      { sku: prod.sku, name: prod.name, quantity: qty, rate },
    ];
    const calcAmount = nextItems.reduce((sum, i) => sum + i.quantity * i.rate, 0);
    setPoForm((prev) => ({
      ...prev,
      items: nextItems,
      amount: calcAmount.toFixed(2),
    }));
    setLineSku('');
    setLineQty('10');
    setLineRate('');
  };

  const removeLineFromPo = (idx) => {
    const nextItems = poForm.items.filter((_, i) => i !== idx);
    const calcAmount = nextItems.reduce((sum, i) => sum + i.quantity * i.rate, 0);
    setPoForm((prev) => ({
      ...prev,
      items: nextItems,
      amount: nextItems.length > 0 ? calcAmount.toFixed(2) : prev.amount,
    }));
  };

  const handleCreatePo = async (e) => {
    e.preventDefault();
    if (!poForm.vendor_name) {
      alert('Please select or add a vendor first.');
      return;
    }
    if (!poForm.amount) {
      alert('Please enter total amount or add line items.');
      return;
    }
    if (window.api && window.api.createPurchaseOrder) {
      await window.api.createPurchaseOrder({
        ...poForm,
        amount: parseFloat(poForm.amount) || 0,
      });
      setShowNewPoModal(false);
      setPoForm({
        po_number: '',
        vendor_name: vendors[0]?.name || '',
        order_date: new Date().toISOString().split('T')[0],
        amount: '',
        status: 'Open',
        items: [],
      });
      showToast('Purchase Order created.');
      loadData();
    }
  };

  const handleStatusChange = async (po, newStatus) => {
    if (newStatus === 'Received') {
      const lines = parsePoItems(po);
      const confirmMsg =
        lines.length > 0
          ? `Mark ${po.po_number} as Received?\n\nThis will automatically add ${lines.length} product line(s) into your catalog stock.`
          : `Mark ${po.po_number} as Received?`;
      if (!confirm(confirmMsg)) return;
    }
    if (window.api && window.api.updatePurchaseOrderStatus) {
      await window.api.updatePurchaseOrderStatus(po.id, newStatus);
      showToast(`${po.po_number} updated to ${newStatus}${newStatus === 'Received' ? ' & stock synced' : ''}.`);
      await loadData();
      window.dispatchEvent(new CustomEvent('stock-updated'));
    }
  };

  const handleDeletePo = async (po) => {
    if (!confirm(`Delete Purchase Order ${po.po_number}?`)) return;
    if (window.api && window.api.deletePurchaseOrder) {
      await window.api.deletePurchaseOrder(po.id);
      showToast(`${po.po_number} deleted.`);
      loadData();
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) {
      alert('Vendor Name is required.');
      return;
    }
    if (window.api && window.api.addVendor) {
      await window.api.addVendor({
        name: vendorForm.name.trim(),
        contact_person: vendorForm.contact_person.trim(),
        phone: vendorForm.phone.trim(),
        email: vendorForm.email.trim(),
        city: vendorForm.city.trim(),
      });
      setShowAddVendorModal(false);
      setVendorForm({ name: '', contact_person: '', phone: '', email: '', city: '' });
      showToast('Vendor added to directory.');
      loadData();
    }
  };

  const handleDeleteVendor = async (v) => {
    if (!confirm(`Remove vendor "${v.name}"?`)) return;
    if (window.api && window.api.deleteVendor) {
      await window.api.deleteVendor(v.id);
      showToast(`Vendor "${v.name}" removed.`);
      loadData();
    }
  };

  const parsePoItems = (po) => {
    if (!po) return [];
    if (Array.isArray(po.items)) return po.items;
    try {
      return JSON.parse(po.items_json || '[]');
    } catch (_) {
      return [];
    }
  };

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch =
      (o.po_number || '').toLowerCase().includes(q) ||
      (o.vendor_name || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openOrders = orders.filter((o) => o.status === 'Open');

  const handleExportCsv = () => {
    const esc = (val) => {
      const s = String(val ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const today = new Date().toISOString().split('T')[0];

    if (activeTab === 'Vendors') {
      const headers = ['Vendor Name', 'Contact Person', 'Phone', 'Email', 'City'];
      const rows = vendors.map((v) => [
        esc(v.name || ''),
        esc(v.contact_person || ''),
        esc(v.phone || ''),
        esc(v.email || ''),
        esc(v.city || ''),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendors_${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${vendors.length} vendor${vendors.length === 1 ? '' : 's'} to CSV.`);
    } else {
      const source = activeTab === 'Goods Receipt (GRN)' ? openOrders : filteredOrders;
      const headers = ['PO Number', 'Vendor', 'Order Date', 'Status', 'Amount'];
      const rows = source.map((o) => [
        esc(o.po_number || ''),
        esc(o.vendor_name || ''),
        esc(o.order_date || ''),
        esc(o.status || ''),
        Number(o.amount || 0).toFixed(2),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `purchase_orders_${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${source.length} purchase order${source.length === 1 ? '' : 's'} to CSV.`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Floating Top-Right Toast Notification (2s) */}
      {toast && (
        <div className="animate-toast fixed top-4 right-5 z-[100] flex items-center gap-2 bg-white text-slate-800 border border-slate-200/90 shadow-xl shadow-slate-900/10 px-4 py-2.5 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-slate-900 tracking-[-0.025em]">{t('vend_title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            {t('vend_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('cat_export_csv')}</span>
          </button>
          <button
            onClick={() => setShowAddVendorModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('vend_add_vendor')}</span>
          </button>
          <button
            onClick={() => {
              if (vendors.length > 0 && !poForm.vendor_name) {
                setPoForm((prev) => ({ ...prev, vendor_name: vendors[0].name }));
              }
              setShowNewPoModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('vend_new_po')}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold text-slate-500">
        {[
          { id: 'Purchase Orders', label: t('vend_tab_po') },
          { id: 'Goods Receipt (GRN)', label: t('vend_tab_grn') },
          { id: 'Vendors', label: t('vend_tab_vendors') },
        ].map(({ id: tab, label }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 transition-colors relative flex items-center gap-1.5 ${
              activeTab === tab
                ? 'text-blue-600 font-bold'
                : 'hover:text-slate-800'
            }`}
          >
            <span>{label}</span>
            {tab === 'Goods Receipt (GRN)' && openOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                {openOrders.length}
              </span>
            )}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'Purchase Orders' && (
        <>
          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by PO no. or vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">Status: All</option>
              <option value="Open">Open</option>
              <option value="Received">Received</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">PO No.</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {po.po_number}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {po.vendor_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{po.order_date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹ {Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          po.status === 'Open'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : po.status === 'Received'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {po.status === 'Open' && (
                          <button
                            onClick={() => handleStatusChange(po, 'Received')}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold hover:bg-emerald-100 transition-colors"
                            title="Receive Goods & Auto-Restock"
                          >
                            Receive
                          </button>
                        )}
                        {po.status === 'Received' && (
                          <button
                            onClick={() => handleStatusChange(po, 'Closed')}
                            className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[11px] font-semibold hover:bg-slate-200 transition-colors"
                          >
                            Close
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedPo(po)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="View PO Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePo(po)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded"
                          title="Delete PO"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No purchase orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'Goods Receipt (GRN)' && (
        <div className="space-y-4">
          {openOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500 space-y-2">
              <PackageCheck className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-semibold text-slate-700">All Incoming Deliveries Received</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                There are no open purchase orders awaiting goods receipt. Create a New PO to order stock from vendors.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openOrders.map((po) => {
                const lines = parsePoItems(po);
                return (
                  <div key={po.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono font-bold text-sm text-slate-900">{po.po_number}</span>
                        <p className="text-xs font-semibold text-blue-600 mt-0.5">{po.vendor_name}</p>
                        <p className="text-[11px] text-slate-400">Ordered: {po.order_date}</p>
                      </div>
                      <span className="text-sm font-black text-slate-900">
                        ₹ {Number(po.amount).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {lines.length > 0 && (
                      <div className="bg-slate-50 rounded-lg border border-slate-100 p-2.5 space-y-1 text-[11px]">
                        {lines.map((l, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="text-slate-700 font-medium">{l.name} ({l.sku})</span>
                            <span className="font-bold text-emerald-700">+{l.quantity} units</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => handleStatusChange(po, 'Received')}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>Receive Goods & Update Stock</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Vendors' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th className="py-3 px-4">Vendor Name</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">City</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{v.name}</td>
                  <td className="py-3 px-4 text-slate-600">{v.contact_person || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{v.phone || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{v.city || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDeleteVendor(v)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title="Delete Vendor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    No vendors yet. Click "Add Vendor" to register a supplier.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New PO Modal (with Dynamic Vendors + Itemized Restock Lines) */}
      {showNewPoModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Create Purchase Order</h3>
              <button onClick={() => setShowNewPoModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vendor *</label>
                  <select
                    required
                    value={poForm.vendor_name}
                    onChange={(e) => setPoForm({ ...poForm, vendor_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  >
                    {vendors.length === 0 && <option value="">Add a vendor first</option>}
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Order Date</label>
                  <input
                    type="date"
                    value={poForm.order_date}
                    onChange={(e) => setPoForm({ ...poForm, order_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Optional Itemized Restock Builder */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <p className="text-[11px] font-bold text-slate-700">Order Items (auto-restocked on GRN Receive)</p>
                <div className="grid grid-cols-12 gap-2">
                  <select
                    value={lineSku}
                    onChange={(e) => {
                      const sku = e.target.value;
                      setLineSku(sku);
                      const p = catalogItems.find((i) => i.sku === sku);
                      if (p) setLineRate(String(p.cost_price || p.selling_price || 0));
                    }}
                    className="col-span-6 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800"
                  >
                    <option value="">Select product...</option>
                    {catalogItems.map((i) => (
                      <option key={i.id} value={i.sku}>
                        {i.name} ({i.sku})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={lineQty}
                    onChange={(e) => setLineQty(e.target.value)}
                    className="col-span-2 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Rate"
                    value={lineRate}
                    onChange={(e) => setLineRate(e.target.value)}
                    className="col-span-2 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={addLineToPo}
                    className="col-span-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>

                {poForm.items.length > 0 && (
                  <div className="divide-y divide-slate-200 max-h-32 overflow-y-auto pt-1">
                    {poForm.items.map((l, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-700">
                          {l.name} ({l.quantity} × ₹{l.rate})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">₹ {(l.quantity * l.rate).toFixed(2)}</span>
                          <button type="button" onClick={() => removeLineFromPo(idx)} className="text-rose-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Total Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 48500"
                  value={poForm.amount}
                  onChange={(e) => setPoForm({ ...poForm, amount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewPoModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  Generate PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddVendorModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Vendor</h3>
              <button onClick={() => setShowAddVendorModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVendor} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Vendor / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sri Murugan Hardware Traders"
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. S. Karthik"
                    value={vendorForm.contact_person}
                    onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="vendor@example.com"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Thoothukudi"
                    value={vendorForm.city}
                    onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddVendorModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Detail Modal */}
      {selectedPo && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-mono">{selectedPo.po_number}</h3>
                <p className="text-xs text-slate-500">{selectedPo.vendor_name} · {selectedPo.order_date}</p>
              </div>
              <button onClick={() => setSelectedPo(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-slate-800">{selectedPo.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-black text-blue-600">₹ {Number(selectedPo.amount).toLocaleString('en-IN')}</span>
              </div>
              {parsePoItems(selectedPo).length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <p className="font-bold text-slate-700 text-[11px] uppercase">Ordered Items</p>
                  {parsePoItems(selectedPo).map((l, idx) => (
                    <div key={idx} className="flex justify-between bg-slate-50 p-2 rounded">
                      <span>{l.name} ({l.sku})</span>
                      <span className="font-bold">{l.quantity} × ₹{l.rate}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedPo(null)}
              className="w-full py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
