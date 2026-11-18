import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Eye,
  Edit2,
  Trash2,
  X,
  Truck,
  CheckCircle2,
  PackageCheck,
  UserPlus,
  Download,
  ChevronDown
} from 'lucide-react';
import { UNIT_OPTIONS, normalizeUnit, formatQty } from '../lib/units.js';
import { fuzzyFilter } from '../lib/fuzzySearch.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAppDialog } from '../components/AppDialogContext.jsx';
import ExportMenu from '../components/ExportMenu.jsx';

const generateQuickSku = (name, size) => {
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
  const sizePart = String(size || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  return sizePart ? `${prefix}-${sizePart}` : `${prefix}-${String(Date.now()).slice(-4)}`;
};

export default function Procurement() {
  const { t, tName } = useLanguage();
  const { showAlert, showConfirm } = useAppDialog();
  const [activeTab, setActiveTab] = useState('Purchase Orders');
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showNewPoModal, setShowNewPoModal] = useState(false);
  const [editingPo, setEditingPo] = useState(null);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [toast, setToast] = useState('');

  const [poForm, setPoForm] = useState({
    po_number: '',
    vendor_name: '',
    order_date: new Date().toISOString().split('T')[0],
    amount: '',
    status: 'Request',
    items: [],
  });
  const [lineProductId, setLineProductId] = useState('');
  const [lineQty, setLineQty] = useState('10');
  const [lineRate, setLineRate] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerQuery, setProductPickerQuery] = useState('');
  const productPickerRef = useRef(null);
  const productPickerSearchRef = useRef(null);

  // Quick inline "Create New Catalog Item" inside the PO modal
  const [showQuickItemForm, setShowQuickItemForm] = useState(false);
  const [quickItem, setQuickItem] = useState({
    name: '',
    size: '',
    category: 'Fasteners',
    unit: 'PCS',
    cost_price: '',
    selling_price: '',
    order_qty: '10',
  });

  const [vendorForm, setVendorForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    city: '',
  });

  useEffect(() => {
    loadData();
    const onStockUpdated = () => loadData();
    const onClickOutside = (e) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target)) {
        setShowProductPicker(false);
      }
    };
    window.addEventListener('stock-updated', onStockUpdated);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('stock-updated', onStockUpdated);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  useEffect(() => {
    if (showProductPicker) {
      setTimeout(() => productPickerSearchRef.current?.focus(), 30);
    }
  }, [showProductPicker]);

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

  const openCreatePoModal = async () => {
    await loadData();
    setEditingPo(null);
    setShowQuickItemForm(false);
    setShowProductPicker(false);
    setProductPickerQuery('');
    setLineProductId('');
    setLineQty('10');
    setLineRate('');
    setPoForm({
      po_number: '',
      vendor_name: vendors[0]?.name || '',
      order_date: new Date().toISOString().split('T')[0],
      amount: '',
      status: 'Request',
      items: [],
    });
    setShowNewPoModal(true);
  };

  const openEditPoModal = async (po) => {
    await loadData();
    const parsedLines = parsePoItems(po).map((l) => {
      const matched =
        (l.product_id ? catalogItems.find((i) => i.id === Number(l.product_id)) : null) ||
        catalogItems.find((i) => String(i.sku || '').toUpperCase() === String(l.sku || '').toUpperCase());
      return {
        product_id: matched ? matched.id : l.product_id || null,
        sku: matched ? matched.sku : l.sku || '',
        name: matched ? matched.name : l.name || '',
        unit: normalizeUnit(matched?.unit || l.unit || 'PCS'),
        quantity: Number(l.quantity) || 1,
        rate: Number(l.rate) || 0,
      };
    });
    setEditingPo(po);
    setShowQuickItemForm(false);
    setShowProductPicker(false);
    setProductPickerQuery('');
    setLineProductId('');
    setLineQty('10');
    setLineRate('');
    setPoForm({
      po_number: po.po_number,
      vendor_name: po.vendor_name || vendors[0]?.name || '',
      order_date: po.order_date || new Date().toISOString().split('T')[0],
      amount: String(po.amount ?? ''),
      status: normalizePoStatus(po.status),
      items: parsedLines,
    });
    setShowNewPoModal(true);
  };

  const addLineToPo = () => {
    if (!lineProductId) return;
    const prod = catalogItems.find((i) => String(i.id) === String(lineProductId));
    if (!prod) return;
    const qty = Math.max(0.01, parseFloat(lineQty) || 1);
    const rate = parseFloat(lineRate) || Number(prod.cost_price) || Number(prod.selling_price) || 0;
    const existingIdx = poForm.items.findIndex(
      (l) => (l.product_id && Number(l.product_id) === Number(prod.id)) || String(l.sku || '').toUpperCase() === String(prod.sku || '').toUpperCase()
    );
    let nextItems;
    if (existingIdx >= 0) {
      nextItems = poForm.items.map((l, idx) =>
        idx === existingIdx
          ? {
              ...l,
              product_id: prod.id,
              sku: prod.sku,
              name: prod.name,
              unit: normalizeUnit(prod.unit || 'PCS'),
              quantity: Number((Number(l.quantity || 0) + qty).toFixed(4)),
              rate,
            }
          : l
      );
    } else {
      nextItems = [
        ...poForm.items,
        {
          product_id: prod.id,
          sku: prod.sku,
          name: prod.name,
          unit: normalizeUnit(prod.unit || 'PCS'),
          quantity: qty,
          rate,
        },
      ];
    }
    const calcAmount = nextItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.rate), 0);
    setPoForm((prev) => ({
      ...prev,
      items: nextItems,
      amount: calcAmount.toFixed(2),
    }));
    setLineProductId('');
    setLineQty('10');
    setLineRate('');
  };

  const handleQuickCreateCatalogItem = async () => {
    const name = quickItem.name.trim();
    const cost = parseFloat(quickItem.cost_price);
    const sell = parseFloat(quickItem.selling_price);
    const qty = parseFloat(quickItem.order_qty);
    if (!name) {
      await showAlert({ title: 'Product Name Required', message: 'Enter a product name to add to Catalog.', tone: 'warning' });
      return;
    }
    if (isNaN(cost) || cost < 0 || isNaN(sell) || sell <= 0) {
      await showAlert({ title: 'Price Required', message: 'Enter valid Cost Rate and Selling Price.', tone: 'warning' });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      await showAlert({ title: 'Quantity Required', message: 'Enter a valid order quantity greater than 0.', tone: 'warning' });
      return;
    }

    let sku = generateQuickSku(name, quickItem.size);
    if (catalogItems.some((i) => String(i.sku || '').toUpperCase() === sku)) {
      sku = `${sku}-${String(Date.now()).slice(-3)}`;
    }
    const unit = normalizeUnit(quickItem.unit || 'PCS');

    if (window.api && window.api.addItem) {
      const res = await window.api.addItem({
        sku,
        name,
        size: quickItem.size.trim(),
        unit,
        category: quickItem.category || 'Fasteners',
        brand: poForm.vendor_name || 'Generic',
        selling_price: sell,
        cost_price: cost,
        quantity: 0, // Stock is added automatically when this PO is marked Received
        reorder_level: 10,
        bin_id: 'R01-L1-S1',
        image_url: '',
        status: 'Available',
      });
      if (!res || res.success === false) {
        await showAlert({
          title: 'Could Not Create Product',
          message: res?.error || 'Failed to add product to Catalog.',
          tone: 'danger',
        });
        return;
      }

      const nextItems = [
        ...poForm.items,
        {
          product_id: res.id,
          sku,
          name,
          unit,
          quantity: qty,
          rate: cost,
        },
      ];
      const calcAmount = nextItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.rate), 0);
      setPoForm((prev) => ({
        ...prev,
        items: nextItems,
        amount: calcAmount.toFixed(2),
      }));
      setQuickItem({
        name: '',
        size: '',
        category: 'Fasteners',
        unit: 'PCS',
        cost_price: '',
        selling_price: '',
        order_qty: '10',
      });
      setShowQuickItemForm(false);
      await loadData();
      window.dispatchEvent(new CustomEvent('stock-updated'));
      showToast(`Created "${name}" (#${res.id}) in Catalog & added to PO.`);
    }
  };

  const removeLineFromPo = (idx) => {
    const nextItems = poForm.items.filter((_, i) => i !== idx);
    const calcAmount = nextItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.rate), 0);
    setPoForm((prev) => ({
      ...prev,
      items: nextItems,
      amount: nextItems.length > 0 ? calcAmount.toFixed(2) : prev.amount,
    }));
  };

  const handleCreatePo = async (e) => {
    e.preventDefault();
    if (!poForm.vendor_name) {
      await showAlert({
        title: 'Vendor Required',
        message: 'Please select or add a vendor first.',
        tone: 'warning',
      });
      return;
    }
    if (!poForm.amount) {
      await showAlert({
        title: 'Amount Required',
        message: 'Please enter total amount or add line items.',
        tone: 'warning',
      });
      return;
    }

    const nextStatus = poForm.status === 'Received' ? 'Received' : 'Request';
    const payload = {
      ...poForm,
      status: nextStatus,
      amount: parseFloat(poForm.amount) || 0,
    };

    if (editingPo && window.api && window.api.updatePurchaseOrder) {
      await window.api.updatePurchaseOrder({ ...payload, id: editingPo.id });
      setShowNewPoModal(false);
      setEditingPo(null);
      showToast(
        nextStatus === 'Received'
          ? `${editingPo.po_number} updated & inventory synced.`
          : `${editingPo.po_number} updated.`
      );
      await loadData();
      window.dispatchEvent(new CustomEvent('stock-updated'));
      return;
    }

    if (window.api && window.api.createPurchaseOrder) {
      await window.api.createPurchaseOrder(payload);
      setShowNewPoModal(false);
      setPoForm({
        po_number: '',
        vendor_name: vendors[0]?.name || '',
        order_date: new Date().toISOString().split('T')[0],
        amount: '',
        status: 'Request',
        items: [],
      });
      showToast(
        nextStatus === 'Received' && poForm.items.length > 0
          ? 'Purchase Order created & stock synced.'
          : 'Purchase Order created.'
      );
      await loadData();
      if (nextStatus === 'Received') {
        window.dispatchEvent(new CustomEvent('stock-updated'));
      }
    }
  };

  const handleStatusChange = async (po, newStatus) => {
    if (newStatus === 'Received') {
      const lines = parsePoItems(po);
      const confirmMsg =
        lines.length > 0
          ? `Mark ${po.po_number} as Received?\n\nThis will automatically add ${lines.length} product line(s) into your catalog stock.`
          : `Mark ${po.po_number} as Received?`;
      const ok = await showConfirm({
        title: 'Confirm Goods Receipt',
        message: confirmMsg,
        confirmLabel: 'Receive & Restock',
        tone: 'success',
      });
      if (!ok) return;
    }
    if (window.api && window.api.updatePurchaseOrderStatus) {
      await window.api.updatePurchaseOrderStatus(po.id, newStatus);
      showToast(`${po.po_number} updated to ${newStatus}${newStatus === 'Received' ? ' & stock synced' : ''}.`);
      await loadData();
      window.dispatchEvent(new CustomEvent('stock-updated'));
    }
  };

  const handleDeletePo = async (po) => {
    const ok = await showConfirm({
      title: 'Delete Purchase Order',
      message: `Delete Purchase Order ${po.po_number}?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    if (window.api && window.api.deletePurchaseOrder) {
      await window.api.deletePurchaseOrder(po.id);
      showToast(`${po.po_number} deleted.`);
      loadData();
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) {
      await showAlert({
        title: 'Vendor Name Required',
        message: 'Please enter a vendor or company name.',
        tone: 'warning',
      });
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
    const ok = await showConfirm({
      title: 'Remove Vendor',
      message: `Remove vendor "${v.name}" from your directory?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
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

  const normalizePoStatus = (status) => {
    if (status === 'Received' || status === 'Closed') return 'Received';
    return 'Request';
  };

  const statusFilteredOrders = orders.filter((o) => {
    const normalized = normalizePoStatus(o.status);
    return statusFilter === 'All' || normalized === statusFilter;
  });

  const filteredOrders = fuzzyFilter(statusFilteredOrders, search, (o) => [
    o.vendor_name,
    ...parsePoItems(o).map((l) => l.name),
    o.order_date,
    o.po_number,
  ]);

  const pickerTotalMatches = fuzzyFilter(catalogItems, productPickerQuery, (i) => [
    i.name,
    tName(i.name),
    i.size,
    i.brand,
    i.category,
    i.sku,
  ]);
  const pickerVisibleItems = pickerTotalMatches.slice(0, 10);
  const selectedPickerProduct = catalogItems.find((i) => String(i.id) === String(lineProductId));

  const openOrders = orders.filter((o) => normalizePoStatus(o.status) === 'Request');

  const getProcurementExport = () => {
    const today = new Date().toISOString().split('T')[0];
    if (activeTab === 'Vendors') {
      return {
        title: 'Vendors',
        filename: `vendors_${today}`,
        headers: ['Vendor Name', 'Contact Person', 'Phone', 'Email', 'City'],
        rows: vendors.map((v) => [v.name || '', v.contact_person || '', v.phone || '', v.email || '', v.city || '']),
      };
    }
    const source = activeTab === 'Goods Receipt (GRN)' ? openOrders : filteredOrders;
    return {
      title: 'Purchase Orders',
      filename: `purchase_orders_${today}`,
      headers: ['PO Number', 'Vendor', 'Order Date', 'Status', 'Amount'],
      rows: source.map((o) => [
        o.po_number || '', o.vendor_name || '', o.order_date || '', normalizePoStatus(o.status), Number(o.amount || 0),
      ]),
    };
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
          <ExportMenu getSpec={getProcurementExport} onDone={showToast} />
          <button
            onClick={() => setShowAddVendorModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('vend_add_vendor')}</span>
          </button>
          <button
            onClick={openCreatePoModal}
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
                placeholder="Search by vendor or product..."
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
              <option value="Request">Request</option>
              <option value="Received">Received</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
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
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {po.vendor_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{po.order_date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ₹ {Number(po.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const poStatus = normalizePoStatus(po.status);
                        return (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              poStatus === 'Request'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {poStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {normalizePoStatus(po.status) === 'Request' && (
                          <button
                            onClick={() => handleStatusChange(po, 'Received')}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold hover:bg-emerald-100 transition-colors"
                            title="Receive Goods & Auto-Restock"
                          >
                            Receive
                          </button>
                        )}
                        <button
                          onClick={() => openEditPoModal(po)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title="Edit PO & Update Items"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
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
                    <td colSpan={5} className="py-10 text-center text-slate-400">
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
                There are no requested purchase orders awaiting goods receipt. Create a New PO to order stock from vendors.
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
                        <p className="text-sm font-bold text-slate-900">{po.vendor_name}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Ordered: {po.order_date}</p>
                      </div>
                      <span className="text-sm font-black text-slate-900">
                        ₹ {Number(po.amount).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {lines.length > 0 && (
                      <div className="bg-slate-50 rounded-lg border border-slate-100 p-2.5 space-y-1 text-[11px]">
                        {lines.map((l, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span className="text-slate-700 font-medium">{l.name}</span>
                            <span className="font-bold text-emerald-700">
                              +{formatQty(l.quantity)} {normalizeUnit(l.unit || 'PCS')}
                            </span>
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

      {/* Create / Edit PO Modal (Dynamic Vendors + Searchable 10-Item Product Picker + Inline Catalog Creator) */}
      {showNewPoModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="animate-modal bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-visible p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingPo ? 'Edit Purchase Order' : 'Create Purchase Order'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowNewPoModal(false);
                  setEditingPo(null);
                  setShowQuickItemForm(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
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

              {/* Itemized Restock Builder */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-slate-700">Order Items</p>
                  <button
                    type="button"
                    onClick={() => setShowQuickItemForm((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 text-[11px] font-semibold flex-shrink-0 transition-colors"
                  >
                    {showQuickItemForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    <span>{showQuickItemForm ? 'Close' : 'New Product'}</span>
                  </button>
                </div>

                {/* Inline New Product Creator */}
                {showQuickItemForm && (
                  <div className="bg-white p-3 rounded-lg border border-blue-200/80 space-y-2.5">
                    <p className="text-[11px] font-bold text-slate-800">New Product</p>
                    <div className="grid grid-cols-12 gap-2">
                      <input
                        type="text"
                        placeholder="Product Name *"
                        value={quickItem.name}
                        onChange={(e) => setQuickItem({ ...quickItem, name: e.target.value })}
                        className="col-span-6 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                      <input
                        type="text"
                        placeholder="Size (optional)"
                        value={quickItem.size}
                        onChange={(e) => setQuickItem({ ...quickItem, size: e.target.value })}
                        className="col-span-3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      />
                      <select
                        value={quickItem.unit}
                        onChange={(e) => setQuickItem({ ...quickItem, unit: e.target.value })}
                        className="col-span-3 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      >
                        {UNIT_OPTIONS.map((grp) => (
                          <optgroup key={grp.group} label={grp.group}>
                            {grp.units.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.value}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <select
                        value={quickItem.category}
                        onChange={(e) => setQuickItem({ ...quickItem, category: e.target.value })}
                        className="col-span-4 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      >
                        <option value="Fasteners">Fasteners</option>
                        <option value="Tools">Tools</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Plumbing">Plumbing</option>
                        <option value="Paints & Adhesives">Paints & Adhesives</option>
                        <option value="Others">Others</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Cost Rate (₹) *"
                        value={quickItem.cost_price}
                        onChange={(e) => setQuickItem({ ...quickItem, cost_price: e.target.value })}
                        className="col-span-3 no-spinner bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Sell Price (₹) *"
                        value={quickItem.selling_price}
                        onChange={(e) => setQuickItem({ ...quickItem, selling_price: e.target.value })}
                        className="col-span-3 no-spinner bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      />
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="Qty *"
                        value={quickItem.order_qty}
                        onChange={(e) => setQuickItem({ ...quickItem, order_qty: e.target.value })}
                        className="col-span-2 no-spinner bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleQuickCreateCatalogItem}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                      >
                        Create Product
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6 relative" ref={productPickerRef}>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                      Product
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowProductPicker((prev) => !prev)}
                      className="w-full flex items-center justify-between gap-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                    >
                      <span className={`truncate ${selectedPickerProduct ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                        {selectedPickerProduct
                          ? `${tName(selectedPickerProduct.name)}${selectedPickerProduct.size ? ` (${selectedPickerProduct.size})` : ''}`
                          : 'Select product...'}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${
                          showProductPicker ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showProductPicker && (
                      <div className="animate-popover absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl shadow-slate-900/15 z-[80] overflow-hidden min-w-[300px]">
                        {/* Search bar inside product list */}
                        <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                          <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                            <input
                              ref={productPickerSearchRef}
                              type="text"
                              placeholder="Search product..."
                              value={productPickerQuery}
                              onChange={(e) => setProductPickerQuery(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                            />
                            {productPickerQuery && (
                              <button
                                type="button"
                                onClick={() => setProductPickerQuery('')}
                                className="absolute right-2 text-slate-400 hover:text-slate-600"
                                title="Clear search"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Max 10 closest matching products */}
                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                          {pickerVisibleItems.length === 0 ? (
                            <div className="py-5 px-3 text-center text-[11px] text-slate-400">
                              No matching products found.
                            </div>
                          ) : (
                            pickerVisibleItems.map((i) => {
                              const isPicked = String(i.id) === String(lineProductId);
                              const u = normalizeUnit(i.unit || 'PCS');
                              return (
                                <button
                                  key={i.id}
                                  type="button"
                                  onClick={() => {
                                    setLineProductId(String(i.id));
                                    setLineRate(String(i.cost_price || i.selling_price || 0));
                                    setShowProductPicker(false);
                                    setProductPickerQuery('');
                                  }}
                                  className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors ${
                                    isPicked ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold truncate">{tName(i.name)}</p>
                                    <p className="text-[10px] text-slate-400 truncate">
                                      {i.size ? `${tName(i.size)} · ` : ''}
                                      {i.category || 'Hardware'}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-[11px] font-bold text-slate-700 tabular-nums">
                                      ₹ {Number(i.cost_price || i.selling_price || 0).toFixed(0)}
                                    </p>
                                    <p
                                      className={`text-[10px] font-semibold tabular-nums ${
                                        Number(i.quantity) <= 0 ? 'text-rose-600' : 'text-emerald-600'
                                      }`}
                                    >
                                      Stock: {formatQty(i.quantity)} {u}
                                    </p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {pickerTotalMatches.length > 10 && (
                          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center font-medium">
                            Showing top 10 of {pickerTotalMatches.length} items — search to filter
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Qty</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="Qty"
                      value={lineQty}
                      onChange={(e) => setLineQty(e.target.value)}
                      className="no-spinner w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Cost Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="₹/unit"
                      value={lineRate}
                      onChange={(e) => setLineRate(e.target.value)}
                      className="no-spinner w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addLineToPo}
                    className="col-span-2 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>

                {poForm.items.length > 0 && (
                  <div className="divide-y divide-slate-200 max-h-36 overflow-y-auto pt-1">
                    {poForm.items.map((l, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-slate-700">
                          {l.name} ({formatQty(l.quantity)} {normalizeUnit(l.unit || 'PCS')} × ₹{l.rate})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">
                            ₹ {(Number(l.quantity) * Number(l.rate)).toFixed(2)}
                          </span>
                          <button type="button" onClick={() => removeLineFromPo(idx)} className="text-rose-500 hover:text-rose-700">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Total Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 48500"
                    value={poForm.amount}
                    onChange={(e) => setPoForm({ ...poForm, amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 no-spinner"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status *</label>
                  <select
                    value={poForm.status}
                    onChange={(e) => setPoForm({ ...poForm, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Request">Request</option>
                    <option value="Received">Received</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPoModal(false);
                    setEditingPo(null);
                    setShowQuickItemForm(false);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  {editingPo ? 'Save PO Changes' : 'Generate PO'}
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
                <h3 className="text-sm font-bold text-slate-900">{selectedPo.vendor_name}</h3>
                <p className="text-xs text-slate-500">Order Date: {selectedPo.order_date}</p>
              </div>
              <button onClick={() => setSelectedPo(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-slate-800">{normalizePoStatus(selectedPo.status)}</span>
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
                      <span>{l.name}</span>
                      <span className="font-bold">
                        {formatQty(l.quantity)} {normalizeUnit(l.unit || 'PCS')} × ₹{l.rate}
                      </span>
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
