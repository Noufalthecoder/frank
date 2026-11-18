import { localDateStr } from '../lib/dateUtils.js';
import Pagination, { usePagination } from '../components/Pagination.jsx';
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
import { getBilingualSearchFields } from '../i18n/productTamil.js';
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
  const { t, tName, tCategory } = useLanguage();
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
  const [receivingPo, setReceivingPo] = useState(null);
  const [receiveQtys, setReceiveQtys] = useState({});

  const [poForm, setPoForm] = useState({
    po_number: '',
    vendor_name: '',
    order_date: localDateStr(),
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
      order_date: localDateStr(),
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
      order_date: po.order_date || localDateStr(),
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
      await showAlert({ title: t('pr_name_req_t'), message: t('pr_name_req_m'), tone: 'warning' });
      return;
    }
    if (isNaN(cost) || cost < 0 || isNaN(sell) || sell <= 0) {
      await showAlert({ title: t('pr_price_req_t'), message: t('pr_price_req_m'), tone: 'warning' });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      await showAlert({ title: t('pr_qty_req_t'), message: t('pr_qty_req_m'), tone: 'warning' });
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
        bin_id: '', // unassigned — place it from Settings → Racks & Bins
        image_url: '',
        status: 'Available',
      });
      if (!res || res.success === false) {
        await showAlert({
          title: t('pr_create_fail_t'),
          message: res?.error || t('pr_create_fail_m'),
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
      showToast(t('pr_toast_created', { name, id: res.id }));
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
        title: t('pr_vendor_req_t'),
        message: t('pr_vendor_req_m'),
        tone: 'warning',
      });
      return;
    }
    if (!poForm.amount) {
      await showAlert({
        title: t('pr_amount_req_t'),
        message: t('pr_amount_req_m'),
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
          ? t('pr_toast_po_updated_sync', { po: editingPo.po_number })
          : t('pr_toast_po_updated', { po: editingPo.po_number })
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
        order_date: localDateStr(),
        amount: '',
        status: 'Request',
        items: [],
      });
      showToast(
        nextStatus === 'Received' && poForm.items.length > 0
          ? t('pr_toast_po_created_sync')
          : t('pr_toast_po_created')
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
      if (lines.length > 0) {
        // Open receive dialog so the actually-received quantity can be confirmed/edited per line
        const init = {};
        lines.forEach((l) => { init[l.sku] = l.quantity; });
        setReceiveQtys(init);
        setReceivingPo(po);
        return;
      }
      const ok = await showConfirm({
        title: t('pr_confirm_grn_t'),
        message: t('pr_confirm_recv', { po: po.po_number }),
        confirmLabel: t('pr_receive_restock'),
        tone: 'success',
      });
      if (!ok) return;
    }
    await applyStatus(po, newStatus);
  };

  const applyStatus = async (po, newStatus, received) => {
    if (!(window.api && window.api.updatePurchaseOrderStatus)) return;
    const res = await window.api.updatePurchaseOrderStatus(po.id, newStatus, received);
    if (res && res.success === false) {
      showToast(t('pr_toast_failed', { error: res.error || t('pr_toast_failed_default') }));
      return;
    }
    if (newStatus === 'Received') {
      const n = res && res.updates ? res.updates.length : 0;
      const warn = res && res.missing && res.missing.length ? t('pr_toast_not_in_catalog', { items: res.missing.join(', ') }) : '';
      showToast(t('pr_toast_recv_items', { po: po.po_number, n, warn }));
    } else {
      showToast(t('pr_toast_status', { po: po.po_number, status: statusLabel(newStatus) }));
    }
    await loadData();
    window.dispatchEvent(new CustomEvent('stock-updated'));
  };

  const confirmReceive = async () => {
    const po = receivingPo;
    setReceivingPo(null);
    await applyStatus(po, 'Received', receiveQtys);
  };

  const handleDeletePo = async (po) => {
    const ok = await showConfirm({
      title: t('pr_del_po_t'),
      message: t('pr_del_po_m', { po: po.po_number }),
      confirmLabel: t('pr_delete'),
      tone: 'danger',
    });
    if (!ok) return;
    if (window.api && window.api.deletePurchaseOrder) {
      await window.api.deletePurchaseOrder(po.id);
      showToast(t('pr_toast_deleted', { po: po.po_number }));
      loadData();
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) {
      await showAlert({
        title: t('pr_vname_req_t'),
        message: t('pr_vname_req_m'),
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
      showToast(t('pr_toast_vendor_added'));
      loadData();
    }
  };

  const handleDeleteVendor = async (v) => {
    const ok = await showConfirm({
      title: t('pr_rm_vendor_t'),
      message: t('pr_rm_vendor_m', { name: v.name }),
      confirmLabel: t('pr_remove'),
      tone: 'danger',
    });
    if (!ok) return;
    if (window.api && window.api.deleteVendor) {
      await window.api.deleteVendor(v.id);
      showToast(t('pr_toast_vendor_removed', { name: v.name }));
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

  const statusLabel = (s) => (s === 'Received' ? t('pr_st_received') : t('pr_st_request'));

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

  const poPg = usePagination(filteredOrders.length, { storageKey: 'purchase-orders', defaultSize: 10 });
  const vendorPg = usePagination(vendors.length, { storageKey: 'vendors', defaultSize: 10 });
  const resetPoPage = poPg.reset;
  useEffect(() => {
    resetPoPage();
  }, [search, statusFilter, resetPoPage]);

  const pickerTotalMatches = fuzzyFilter(catalogItems, productPickerQuery, (i) =>
    getBilingualSearchFields(i)
  );
  const pickerVisibleItems = pickerTotalMatches.slice(0, 10);
  const selectedPickerProduct = catalogItems.find((i) => String(i.id) === String(lineProductId));

  const openOrders = orders.filter((o) => normalizePoStatus(o.status) === 'Request');

  const getProcurementExport = () => {
    const today = localDateStr();
    if (activeTab === 'Vendors') {
      return {
        title: t('pr_x_vendors'),
        filename: `vendors_${today}`,
        headers: [t('pr_h_vendor_name'), t('pr_h_contact'), t('pr_h_phone'), t('pr_h_email'), t('pr_h_city')],
        rows: vendors.map((v) => [v.name || '', v.contact_person || '', v.phone || '', v.email || '', v.city || '']),
      };
    }
    const source = activeTab === 'Goods Receipt (GRN)' ? openOrders : filteredOrders;
    return {
      title: t('pr_x_po'),
      filename: `purchase_orders_${today}`,
      headers: [t('pr_h_po_number'), t('pr_h_vendor'), t('pr_h_order_date'), t('pr_h_status'), t('pr_h_amount')],
      rows: source.map((o) => [
        o.po_number || '', o.vendor_name || '', o.order_date || '', statusLabel(normalizePoStatus(o.status)), Number(o.amount || 0),
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
          {activeTab === 'Vendors' && (
          <button
            onClick={() => setShowAddVendorModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('vend_add_vendor')}</span>
          </button>
          )}
          {activeTab === 'Purchase Orders' && (
          <button
            onClick={openCreatePoModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 rounded-lg text-xs font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('vend_new_po')}</span>
          </button>
          )}
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
              <span className="px-1.5 py-0.5 rounded-full text-[12px] font-bold bg-blue-100 text-blue-700">
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
                placeholder={t('pr_search_ph')}
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
              <option value="All">{t('pr_status_all')}</option>
              <option value="Request">{t('pr_st_request')}</option>
              <option value="Received">{t('pr_st_received')}</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{t('pr_h_vendor')}</th>
                  <th className="py-3 px-4">{t('pr_h_date')}</th>
                  <th className="py-3 px-4">{t('pr_h_amount')}</th>
                  <th className="py-3 px-4">{t('pr_h_status')}</th>
                  <th className="py-3 px-4 text-right">{t('pr_h_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {poPg.slice(filteredOrders).map((po) => (
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
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-semibold ${
                              poStatus === 'Request'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {statusLabel(poStatus)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {normalizePoStatus(po.status) === 'Request' && (
                          <button
                            onClick={() => handleStatusChange(po, 'Received')}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[13px] font-semibold hover:bg-emerald-100 transition-colors"
                            title={t('pr_title_receive')}
                          >
                            {t('pr_receive')}
                          </button>
                        )}
                        <button
                          onClick={() => openEditPoModal(po)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title={t('pr_title_edit_po')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSelectedPo(po)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                          title={t('pr_title_view_po')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePo(po)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded"
                          title={t('pr_title_del_po')}
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
                      {t('pr_no_po')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={poPg.page} pageSize={poPg.pageSize} total={filteredOrders.length} sizes={poPg.sizes} onPage={poPg.setPage} onPageSize={poPg.setPageSize} />
        </>
      )}

      {activeTab === 'Goods Receipt (GRN)' && (
        <div className="space-y-4">
          {openOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500 space-y-2">
              <PackageCheck className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="font-semibold text-slate-700">{t('pr_grn_all_t')}</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                {t('pr_grn_all_m')}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">{t('pr_h_vendor')}</th>
                    <th className="py-3 px-4">{t('pr_h_order_date')}</th>
                    <th className="py-3 px-4">{t('pr_order_items')}</th>
                    <th className="py-3 px-4 text-right">{t('pr_h_amount')}</th>
                    <th className="py-3 px-4 text-right">{t('pr_h_action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {openOrders.map((po) => {
                    const lines = parsePoItems(po);
                    return (
                      <tr key={po.id} className="hover:bg-slate-50/80 transition-colors align-top">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{po.vendor_name}</td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{po.order_date}</td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            {lines.map((l, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-4 max-w-md">
                                <span className="text-slate-700">{l.name}</span>
                                <span className="font-semibold text-emerald-700 whitespace-nowrap tabular-nums">
                                  +{formatQty(l.quantity)} {normalizeUnit(l.unit || 'PCS')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                          ₹ {Number(po.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleStatusChange(po, 'Received')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>{t('pr_receive_update')}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Vendors' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[13px] font-semibold text-slate-500 uppercase">
                <th className="py-3 px-4">{t('pr_h_vendor_name')}</th>
                <th className="py-3 px-4">{t('pr_h_contact')}</th>
                <th className="py-3 px-4">{t('pr_h_phone')}</th>
                <th className="py-3 px-4">{t('pr_h_city')}</th>
                <th className="py-3 px-4 text-right">{t('pr_h_action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorPg.slice(vendors).map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{v.name}</td>
                  <td className="py-3 px-4 text-slate-600">{v.contact_person || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{v.phone || '—'}</td>
                  <td className="py-3 px-4 text-slate-600">{v.city || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDeleteVendor(v)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      title={t('pr_title_del_vendor')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    {t('pr_no_vendors')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination page={vendorPg.page} pageSize={vendorPg.pageSize} total={vendors.length} sizes={vendorPg.sizes} onPage={vendorPg.setPage} onPageSize={vendorPg.setPageSize} />
        </div>
      )}

      {/* Create / Edit PO Modal (Dynamic Vendors + Searchable 10-Item Product Picker + Inline Catalog Creator) */}
      {receivingPo && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-7">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">{t('pr_receive_title', { po: receivingPo.po_number })}</h3>
              <button onClick={() => setReceivingPo(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[13px] text-slate-500 mb-3">
              {t('pr_receive_hint')}
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {parsePoItems(receivingPo).map((l) => {
                const cur = catalogItems.find((i) => i.sku === l.sku);
                const qty = Number(receiveQtys[l.sku]) || 0;
                return (
                  <div key={l.sku} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{l.name} ({l.sku})</p>
                      <p className="text-[13px] text-slate-500">
                        {t('pr_ordered_qty', { qty: l.quantity })}
                        {cur ? t('pr_stock_change', { from: Number(cur.quantity) }) : t('pr_not_in_catalog_inline')}
                        {cur && <span className="font-bold text-emerald-700">{Number((Number(cur.quantity) + qty).toFixed(6))}</span>}
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={receiveQtys[l.sku] ?? ''}
                      onChange={(e) => setReceiveQtys({ ...receiveQtys, [l.sku]: e.target.value })}
                      className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-right"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setReceivingPo(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                {t('pr_cancel')}
              </button>
              <button onClick={confirmReceive} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">
                {t('pr_confirm_received_update')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewPoModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="animate-modal bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-6xl h-[90vh] flex flex-col overflow-visible p-6 gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900">
                {editingPo ? t('pr_edit_po') : t('pr_create_po')}
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

            <form onSubmit={handleCreatePo} className="flex-1 min-h-0 flex flex-col gap-4">
              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-5 gap-5">
              <section className="lg:col-span-2 min-h-0 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('pr_vendor_req_lbl')}</label>
                  <select
                    required
                    value={poForm.vendor_name}
                    onChange={(e) => setPoForm({ ...poForm, vendor_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  >
                    {vendors.length === 0 && <option value="">{t('pr_add_vendor_first')}</option>}
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('pr_h_order_date')}</label>
                  <input
                    type="date"
                    value={poForm.order_date}
                    onChange={(e) => setPoForm({ ...poForm, order_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>


                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('pr_status_req')}</label>
                  <select
                    value={poForm.status}
                    onChange={(e) => setPoForm({ ...poForm, status: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Request">{t('pr_st_request')}</option>
                    <option value="Received">{t('pr_st_received')}</option>
                  </select>
                </div>

              {/* Itemized Restock Builder */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-bold text-slate-700">{t('pr_order_items')}</p>
                  <button
                    type="button"
                    onClick={() => setShowQuickItemForm((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 text-[13px] font-semibold flex-shrink-0 transition-colors"
                  >
                    {showQuickItemForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    <span>{showQuickItemForm ? t('pr_close') : t('pr_new_product')}</span>
                  </button>
                </div>

                {/* Inline New Product Creator */}
                {showQuickItemForm && (
                  <div className="bg-white p-3 rounded-lg border border-blue-200/80 space-y-2.5">
                    <p className="text-[13px] font-bold text-slate-800">{t('pr_new_product')}</p>
                    <div className="grid grid-cols-12 gap-2">
                      <input data-rule="text" maxLength={80}
                        type="text"
                        placeholder={t('pr_ph_pname')}
                        value={quickItem.name}
                        onChange={(e) => setQuickItem({ ...quickItem, name: e.target.value })}
                        className="col-span-6 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                      />
                      <input data-rule="text" maxLength={30}
                        type="text"
                        placeholder={t('pr_ph_size')}
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
                        <option value="Fasteners">{tCategory('Fasteners')}</option>
                        <option value="Tools">{tCategory('Tools')}</option>
                        <option value="Electrical">{tCategory('Electrical')}</option>
                        <option value="Plumbing">{tCategory('Plumbing')}</option>
                        <option value="Paints & Adhesives">{tCategory('Paints & Adhesives')}</option>
                        <option value="Others">{tCategory('Others')}</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={t('pr_ph_cost')}
                        value={quickItem.cost_price}
                        onChange={(e) => setQuickItem({ ...quickItem, cost_price: e.target.value })}
                        className="col-span-3 no-spinner bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder={t('pr_ph_sell')}
                        value={quickItem.selling_price}
                        onChange={(e) => setQuickItem({ ...quickItem, selling_price: e.target.value })}
                        className="col-span-3 no-spinner bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      />
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder={t('pr_ph_qty_req')}
                        value={quickItem.order_qty}
                        onChange={(e) => setQuickItem({ ...quickItem, order_qty: e.target.value })}
                        className="col-span-2 no-spinner bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleQuickCreateCatalogItem}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[13px] font-bold transition-colors"
                      >
                        {t('pr_create_product')}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 relative" ref={productPickerRef}>
                    <label className="block text-[12px] font-semibold text-slate-500 mb-0.5">
                      {t('pr_product')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowProductPicker((prev) => !prev)}
                      className="w-full flex items-center justify-between gap-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                    >
                      <span className={`truncate ${selectedPickerProduct ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                        {selectedPickerProduct
                          ? `${tName(selectedPickerProduct.name)}${selectedPickerProduct.size ? ` (${selectedPickerProduct.size})` : ''}`
                          : t('pr_select_product')}
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
                              placeholder={t('pr_search_product')}
                              value={productPickerQuery}
                              onChange={(e) => setProductPickerQuery(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                            />
                            {productPickerQuery && (
                              <button
                                type="button"
                                onClick={() => setProductPickerQuery('')}
                                className="absolute right-2 text-slate-400 hover:text-slate-600"
                                title={t('pr_clear_search')}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Max 10 closest matching products */}
                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                          {pickerVisibleItems.length === 0 ? (
                            <div className="py-5 px-3 text-center text-[13px] text-slate-400">
                              {t('pr_no_match')}
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
                                    <p className="text-[12px] text-slate-400 truncate">
                                      {i.size ? `${tName(i.size)} · ` : ''}
                                      {tCategory(i.category || 'Hardware')}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-[13px] font-bold text-slate-700 tabular-nums">
                                      ₹ {Number(i.cost_price || i.selling_price || 0).toFixed(0)}
                                    </p>
                                    <p
                                      className={`text-[12px] font-semibold tabular-nums ${
                                        Number(i.quantity) <= 0 ? 'text-rose-600' : 'text-emerald-600'
                                      }`}
                                    >
                                      {t('pr_stock', { qty: formatQty(i.quantity), unit: u })}
                                    </p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {pickerTotalMatches.length > 10 && (
                          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[12px] text-slate-400 text-center font-medium">
                            {t('pr_showing_top', { n: pickerTotalMatches.length })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[12px] font-semibold text-slate-500 mb-0.5">{t('pr_qty')}</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder={t('pr_qty')}
                      value={lineQty}
                      onChange={(e) => setLineQty(e.target.value)}
                      className="no-spinner w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[12px] font-semibold text-slate-500 mb-0.5">{t('pr_cost_rate')}</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={t('pr_ph_rate')}
                      value={lineRate}
                      onChange={(e) => setLineRate(e.target.value)}
                      className="no-spinner w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addLineToPo}
                    className="col-span-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                  >
                    {t('pr_add')}
                  </button>
                </div>
              </div>
              </section>
              <section className="lg:col-span-3 min-h-0 flex flex-col rounded-xl border border-slate-200 overflow-hidden bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
                  <p className="text-sm font-bold text-slate-800">{t('pr_order_items')}</p>
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">{poForm.items.length}</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                        <th className="py-2.5 px-3 text-left w-10">#</th>
                        <th className="py-2.5 px-3 text-left">{t('pr_product')}</th>
                        <th className="py-2.5 px-3 text-right">{t('pr_qty')}</th>
                        <th className="py-2.5 px-3 text-right">{t('pr_cost_rate')}</th>
                        <th className="py-2.5 px-3 text-right">{t('pr_total_amount_req').replace(/\s*\*$/, '')}</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {poForm.items.map((l, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 text-slate-400 tabular-nums">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{l.name}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">{formatQty(l.quantity)} {normalizeUnit(l.unit || 'PCS')}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums">₹ {l.rate}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900 tabular-nums">₹ {(Number(l.quantity) * Number(l.rate)).toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right">
                          <button type="button" onClick={() => removeLineFromPo(idx)} className="p-1 text-rose-500 hover:text-rose-700 rounded" aria-label="Remove">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                  {poForm.items.length === 0 && (
                    <p className="py-16 text-center text-sm text-slate-400">{t('pr_order_items')} — 0</p>
                  )}
                </div>
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('pr_total_amount_req')}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={t('pr_ph_amount')}
                    value={poForm.amount}
                    onChange={(e) => setPoForm({ ...poForm, amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 no-spinner"
                  />
                </div>

                </div>
              </section>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPoModal(false);
                    setEditingPo(null);
                    setShowQuickItemForm(false);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t('pr_cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  {editingPo ? t('pr_save_po') : t('pr_generate_po')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddVendorModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t('pr_add_new_vendor')}</h3>
              <button onClick={() => setShowAddVendorModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVendor} className="space-y-3">
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('pr_vendor_company')}</label>
                <input data-rule="text" maxLength={80}
                  type="text"
                  required
                  placeholder={t('pr_ph_vendor')}
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('pr_h_contact')}</label>
                  <input data-rule="alpha" maxLength={60}
                    type="text"
                    placeholder={t('pr_ph_contact')}
                    value={vendorForm.contact_person}
                    onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('pr_h_phone')}</label>
                  <input data-rule="phone" maxLength={15}
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
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('pr_h_email')}</label>
                  <input
                    type="email"
                    placeholder="vendor@example.com"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('pr_h_city')}</label>
                  <input data-rule="alpha" maxLength={40}
                    type="text"
                    placeholder={t('pr_ph_city')}
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
                  {t('pr_cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  {t('pr_save_vendor')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Detail Modal */}
      {selectedPo && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedPo.vendor_name}</h3>
                <p className="text-xs text-slate-500">{t('pr_order_date_colon', { date: selectedPo.order_date })}</p>
              </div>
              <button onClick={() => setSelectedPo(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('pr_status_colon')}</span>
                <span className="font-bold text-slate-800">{statusLabel(normalizePoStatus(selectedPo.status))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('pr_total_colon')}</span>
                <span className="font-black text-blue-600">₹ {Number(selectedPo.amount).toLocaleString('en-IN')}</span>
              </div>
              {parsePoItems(selectedPo).length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <p className="font-bold text-slate-700 text-[13px] uppercase">{t('pr_ordered_items')}</p>
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
              {t('pr_close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
