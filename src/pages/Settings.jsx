import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Store,
  Grid3X3,
  Users,
  Printer,
  Sliders,
  Database,
  Layers,
  CheckCircle2,
  Download,
  Upload,
  RefreshCw,
  Trash2
} from 'lucide-react';
import Racks from './Racks.jsx';
import PrintPreviewModal from '../components/PrintPreviewModal.jsx';
import {
  PAPER_SIZES,
  getPrintPreferences,
  savePrintPreferences,
} from '../lib/printConfig.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAppDialog } from '../components/AppDialogContext.jsx';

export default function Settings() {
  const { lang, setLang, t } = useLanguage();
  const { showAlert, showConfirm } = useAppDialog();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'racks'
      ? 'Racks & Bins'
      : tabParam === 'print'
      ? 'Billing & Print'
      : 'Shop Profile';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [dbPath, setDbPath] = useState('%APPDATA%\\Invenbill\\billing.db');
  const [dbStatusMsg, setDbStatusMsg] = useState('');
  const [printPrefs, setPrintPrefs] = useState(getPrintPreferences());
  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [showTestPreview, setShowTestPreview] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const loadPrinters = async () => {
    setLoadingPrinters(true);
    try {
      if (window.api && window.api.getPrinters) {
        const list = await window.api.getPrinters();
        setPrinters(list || []);
        if (!printPrefs.printerName && list && list.length > 0) {
          const def = list.find((p) => p.isDefault) || list[0];
          setPrintPrefs((prev) => ({ ...prev, printerName: def.name }));
        }
      }
    } catch (_) {}
    setLoadingPrinters(false);
  };

  useEffect(() => {
    if (tabParam === 'racks') setActiveTab('Racks & Bins');
    else if (tabParam === 'print') setActiveTab('Billing & Print');
  }, [tabParam]);

  const [profile, setProfile] = useState({
    shop_name: 'T. S. P Enterprises',
    tagline: 'Hardware, Tools & Fasteners',
    phone: '+91 98765 43210',
    email: 'tspenterprises@gmail.com',
    gstin: '',
    address_line1: 'Beach Road',
    address_line2: 'Tharuvaikulam',
    city: 'Thoothukudi',
    pincode: '628105',
    invoice_footer: 'Thank you for your business! Goods once sold cannot be returned without bill.',
  });

  useEffect(() => {
    loadProfile();
    loadPrinters();
    if (window.api && window.api.getDatabasePath) {
      window.api.getDatabasePath().then((p) => { if (p) setDbPath(p); });
    }
  }, []);

  const loadProfile = async () => {
    if (window.api && window.api.getShopProfile) {
      const p = await window.api.getShopProfile();
      if (p) setProfile(p);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (window.api && window.api.updateShopProfile) {
      await window.api.updateShopProfile(profile);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      window.dispatchEvent(new CustomEvent('shop-profile-updated', { detail: profile }));
    }
  };

  const handlePrintPrefsChange = (updates) => {
    const next = { ...printPrefs, ...updates };
    if ('afterPayment' in updates) {
      next.autoPrint = updates.afterPayment === 'auto';
    } else if ('autoPrint' in updates) {
      next.afterPayment = updates.autoPrint ? 'auto' : 'preview';
    }
    setPrintPrefs(next);
  };

  const handleSavePrinterSettings = () => {
    const saved = savePrintPreferences(printPrefs);
    setPrintPrefs(saved);
    showToast('Printer settings saved.');
  };

  const sampleTestInvoice = {
    invoice_number: 'TEST-0001',
    date_time: new Date().toISOString().replace('T', ' ').slice(0, 19),
    customer_name: 'Walk-in Customer',
    customer_phone: '+91 98765 43210',
    payment_mode: 'Cash',
    subtotal: 490,
    discount: 10,
    total: 480,
    items: [
      { sku: 'CS-10', name: 'Combination Spanner 10mm', quantity: 2, unit: 'PCS', base_unit: 'PCS', rate: 85, total: 170 },
      { sku: 'GI-BW-20G', name: 'GI Binding Wire 20 Gauge', quantity: 500, unit: 'g', base_unit: 'kg', stock_deduction_qty: 0.5, rate: 120, total: 60 },
      { sku: 'HM-500', name: 'Ball Peen Hammer 500g', quantity: 1, unit: 'PCS', base_unit: 'PCS', rate: 260, total: 260 },
    ],
  };

  const handleBackup = async () => {
    if (window.api && window.api.backupDatabase) {
      const res = await window.api.backupDatabase();
      if (res && res.success) {
        setDbStatusMsg(`Backup saved to: ${res.path}`);
      }
    }
  };

  const handleRestore = async () => {
    const ok = await showConfirm({
      title: 'Restore Database Backup',
      message: 'Restore database from a .db backup file?\n\nYour current database will be backed up automatically before replacing.',
      confirmLabel: 'Choose Backup File',
      tone: 'warning',
    });
    if (!ok) return;
    if (window.api && window.api.restoreDatabase) {
      const res = await window.api.restoreDatabase();
      if (res && res.success) {
        setDbStatusMsg(`Restored successfully from: ${res.path}`);
        window.dispatchEvent(new CustomEvent('stock-updated'));
        loadProfile();
      } else if (res && res.error) {
        await showAlert({
          title: 'Restore Failed',
          message: res.error,
          tone: 'danger',
        });
      }
    }
  };

  const handleLoadDemoData = async () => {
    const ok = await showConfirm({
      title: 'Load Sample Demo Data',
      message: 'Load 30 sample hardware items, 5 racks, sample vendors, and sample bills?',
      confirmLabel: 'Load Demo Data',
      tone: 'primary',
    });
    if (!ok) return;
    if (window.api && window.api.seedDemoData) {
      await window.api.seedDemoData();
      setDbStatusMsg('Sample hardware demo data loaded!');
      window.dispatchEvent(new CustomEvent('stock-updated'));
    }
  };

  const handleResetDatabase = async () => {
    const ok = await showConfirm({
      title: 'Reset Database',
      message: 'WARNING: This will permanently erase all items, racks, bills, vendors, and expenses (keeping your Shop Profile). Continue?',
      confirmLabel: 'Erase All Data',
      tone: 'danger',
    });
    if (!ok) return;
    if (window.api && window.api.resetDatabase) {
      await window.api.resetDatabase();
      setDbStatusMsg('Database cleared cleanly. Ready for fresh store setup.');
      window.dispatchEvent(new CustomEvent('stock-updated'));
    }
  };

  return (
    <div className="space-y-5">
      {/* Floating Top-Right Toast (2s) */}
      {toast && (
        <div className="animate-toast fixed top-4 right-5 z-[100] flex items-center gap-2 bg-white text-slate-800 border border-slate-200/90 shadow-xl shadow-slate-900/10 px-4 py-2.5 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-slate-900 tracking-[-0.025em]">{t('set_title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            {t('set_subtitle')}
          </p>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Left Side: Settings Navigation Tabs */}
        <div className="surface-card rounded-2xl p-3 space-y-1">
          {[
            { id: 'Shop Profile', label: t('set_tab_profile'), icon: Store },
            { id: 'Racks & Bins', label: t('set_tab_racks'), icon: Grid3X3 },
            { id: 'Users & Roles', label: t('set_tab_users'), icon: Users },
            { id: 'Billing & Print', label: t('set_tab_print'), icon: Printer },
            { id: 'Preferences', label: t('set_tab_prefs'), icon: Sliders },
            { id: 'Database', label: t('set_tab_db'), icon: Database },
          ].map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Side: Form Panel */}
        <div className="md:col-span-3 surface-card rounded-2xl p-6 space-y-6">
          {activeTab === 'Shop Profile' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Shop Profile</h2>
                  <p className="text-xs text-slate-400">Basic information used in invoices and reports</p>
                </div>
                {savedSuccess && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Saved!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2-column form fields (2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Shop Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={profile.shop_name}
                        onChange={(e) => setProfile({ ...profile, shop_name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tagline</label>
                      <input
                        type="text"
                        value={profile.tagline || ''}
                        onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone *</label>
                      <input
                        type="text"
                        required
                        value={profile.phone || ''}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={profile.email || ''}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Address Line 1</label>
                      <input
                        type="text"
                        value={profile.address_line1 || ''}
                        onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Address Line 2</label>
                      <input
                        type="text"
                        value={profile.address_line2 || ''}
                        onChange={(e) => setProfile({ ...profile, address_line2: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={profile.city || ''}
                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pincode</label>
                      <input
                        type="text"
                        value={profile.pincode || ''}
                        onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      GST Number / GSTIN <span className="text-slate-400 font-normal">(Optional — shown on bill only if entered)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 33ABCDE1234F1Z5"
                      value={profile.gstin || ''}
                      onChange={(e) => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Invoice Footer Note</label>
                    <textarea
                      rows={2}
                      value={profile.invoice_footer || ''}
                      onChange={(e) => setProfile({ ...profile, invoice_footer: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Right: Shop Logo Card */}
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-700">Shop Header Preview</label>
                  <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center space-y-2 bg-slate-50/50">
                    <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-sm shadow-blue-200">
                      <Layers className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{profile.shop_name || 'T. S. P Enterprises'}</p>
                      <p className="text-[10px] text-slate-400">
                        {profile.address_line1 || 'Beach Road'} · {profile.address_line2 || 'Tharuvaikulam'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm shadow-blue-200 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'Racks & Bins' && (
            <Racks embedded={true} />
          )}

          {activeTab === 'Users & Roles' && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Users & Access Control</h2>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">Franklin (You)</p>
                    <p className="text-slate-400">{profile.email || 'tspenterprises@gmail.com'}</p>
                  </div>
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-full border border-blue-200">
                    ADMIN
                  </span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">Counter Staff 1</p>
                    <p className="text-slate-400">POS Billing & Catalog View</p>
                  </div>
                  <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-full border border-slate-200">
                    STAFF
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Billing & Print' && (
            <div className="space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Printer Configuration</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure default printer, paper size (80mm / 58mm Thermal & A1–A6), and automatic or manual print workflow
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadPrinters}
                  disabled={loadingPrinters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingPrinters ? 'animate-spin' : ''}`} />
                  <span>Refresh Printers</span>
                </button>
              </div>

              {/* Available Printers */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">Available printers</label>
                <div className="space-y-2">
                  {printers.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                      No printers detected. Connect a USB or Network printer and click <strong>Refresh Printers</strong>.
                    </div>
                  ) : (
                    printers.map((p) => {
                      const isSelected = printPrefs.printerName === p.name || (!printPrefs.printerName && p.isDefault);
                      const statusCls =
                        p.connectionState === 'connected'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : p.connectionState === 'error'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200';
                      const dotCls =
                        p.connectionState === 'connected'
                          ? 'bg-emerald-500'
                          : p.connectionState === 'error'
                          ? 'bg-rose-500'
                          : 'bg-amber-500';
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => handlePrintPrefsChange({ printerName: p.name })}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/25 shadow-2xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50/80'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}
                            >
                              <Printer className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {p.displayName || p.name}
                                </p>
                                {p.isDefault && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                    Windows Default
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {p.connectionType || 'Local'} · Installed
                                {p.portName ? ` · ${p.portName}` : ''}
                                {p.isSimulated ? ' (Browser Preview)' : ''}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border flex-shrink-0 ${statusCls}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                            {p.statusLabel || 'Connected'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Format, Orientation & After-Payment Behavior */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Default invoice format</label>
                  <select
                    value={printPrefs.format}
                    onChange={(e) => handlePrintPrefsChange({ format: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <optgroup label="Thermal Roll">
                      {PAPER_SIZES.filter((p) => p.thermal).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="ISO Paper Sizes (A1 – A6)">
                      {PAPER_SIZES.filter((p) => !p.thermal).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">Default orientation</label>
                  <select
                    value={printPrefs.orientation || 'portrait'}
                    onChange={(e) => handlePrintPrefsChange({ orientation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1.5">After successful payment</label>
                  <select
                    value={printPrefs.afterPayment || (printPrefs.autoPrint ? 'auto' : 'preview')}
                    onChange={(e) => handlePrintPrefsChange({ afterPayment: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="auto">Automatically print (direct to default printer, ready for next customer)</option>
                    <option value="preview">Open print preview (choose A1–A6 / thermal, printer, or system dialog)</option>
                    <option value="none">Do not print automatically (save invoice only)</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2.5 pt-1 text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(printPrefs.autoPrint)}
                    onChange={(e) => handlePrintPrefsChange({ autoPrint: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">Print automatically after successful payment</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printPrefs.openPreviewOnManual !== false}
                    onChange={(e) => handlePrintPrefsChange({ openPreviewOnManual: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">Open print preview when manually requested</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printPrefs.allowHistoryReprint !== false}
                    onChange={(e) => handlePrintPrefsChange({ allowHistoryReprint: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">Allow reprinting invoices from Sales History</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printPrefs.enablePdfExport !== false}
                    onChange={(e) => handlePrintPrefsChange({ enablePdfExport: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">Enable A1–A6 PDF export</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    savePrintPreferences(printPrefs);
                    setShowTestPreview(true);
                  }}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-2 transition-colors"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Print Test Page</span>
                </button>

                <button
                  type="button"
                  onClick={handleSavePrinterSettings}
                  className="w-full py-2.5 px-4 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs font-bold shadow-sm shadow-blue-600/20 active:scale-[0.99] transition-all"
                >
                  Save Printer Settings
                </button>
              </div>
            </div>
          )}

          {activeTab === 'Preferences' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">{t('set_prefs_title')}</h2>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="p-3.5 bg-blue-50/60 rounded-lg border border-blue-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{t('set_lang_title')}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{t('set_lang_desc')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        lang === 'en'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('ta')}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        lang === 'ta'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      தமிழ் (Tamil)
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{t('set_tax_title')}</p>
                    <p className="text-[11px] text-slate-400">{t('set_tax_desc')}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full border border-emerald-200 text-[10px]">
                    {t('set_tax_badge')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{t('set_currency_title')}</p>
                    <p className="text-[11px] text-slate-400">{t('set_currency_desc')}</p>
                  </div>
                  <span className="font-bold text-slate-800">INR (₹)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Database' && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Database Maintenance & Backup</h2>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
                <p className="text-slate-500 font-medium">Local SQLite Database Storage:</p>
                <p className="font-mono bg-white p-2 rounded border border-slate-200 text-slate-800 break-all select-all">
                  {dbPath}
                </p>
                <p className="text-slate-400 text-[11px]">
                  All inventory, bills, racks, vendors, and expenses are stored offline in this single SQLite file.
                </p>
              </div>

              {dbStatusMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="break-all">{dbStatusMsg}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={handleBackup}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Backup Database (.db)</span>
                </button>

                <button
                  onClick={handleRestore}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-800 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>Restore From Backup (.db)</span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <p className="text-xs font-bold text-slate-700">Evaluation & Setup Tools</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleLoadDemoData}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Load Sample Hardware Data</span>
                  </button>

                  <button
                    onClick={handleResetDatabase}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All Data (Start Fresh)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Test Page Print Preview Modal */}
      {showTestPreview && (
        <PrintPreviewModal
          invoice={sampleTestInvoice}
          profile={profile}
          primaryCloseLabel="Close Preview"
          onClose={() => setShowTestPreview(false)}
        />
      )}
    </div>
  );
}
