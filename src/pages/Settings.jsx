import { localDateTimeStr } from '../lib/dateUtils.js';
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
  Trash2,
  PackagePlus
} from 'lucide-react';
import Racks from './Racks.jsx';
import PrintPreviewModal from '../components/PrintPreviewModal.jsx';
import { InvoiceDocument } from '../components/PrintableReceipt.jsx';
import {
  PAPER_SIZES,
  getPrintPreferences,
  savePrintPreferences,
} from '../lib/printConfig.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import UsersPanel from '../components/UsersPanel.jsx';
import { useAppDialog } from '../components/AppDialogContext.jsx';

export default function Settings() {
  const { lang, setLang, t } = useLanguage();
  const paperLabel = (p) => (p.thermal ? t('st_thermal_receipt', { size: p.id }) : p.label);
  const statusText = (s) => (!s || s === 'Connected' ? t('st_connected') : s === 'Paper Out' ? t('st_paper_out') : s);
  const { showAlert, showConfirm } = useAppDialog();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const TAB_BY_PARAM = {
    profile: 'Shop Profile',
    racks: 'Racks & Bins',
    users: 'Users & Roles',
    print: 'Billing & Print',
    prefs: 'Preferences',
    db: 'Database',
  };
  const initialTab = TAB_BY_PARAM[tabParam] || 'Shop Profile';
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
    setActiveTab(TAB_BY_PARAM[tabParam] || 'Shop Profile');
  }, [tabParam]);

  const [profile, setProfile] = useState({
    shop_name: 'T. S. P Enterprises',
    tagline: 'Hardware, Tools & Fasteners',
    phone: '',
    email: '',
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
    showToast(t('st_printer_saved'));
  };

  const sampleTestInvoice = {
    invoice_number: 'TEST-0001',
    date_time: localDateTimeStr(),
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
        setDbStatusMsg(t('st_backup_saved', { path: res.path }));
      }
    }
  };

  const handleRestore = async () => {
    const ok = await showConfirm({
      title: t('st_restore_title'),
      message: t('st_restore_msg'),
      confirmLabel: t('st_choose_backup'),
      tone: 'warning',
    });
    if (!ok) return;
    if (window.api && window.api.restoreDatabase) {
      const res = await window.api.restoreDatabase();
      if (res && res.success) {
        setDbStatusMsg(t('st_restored_from', { path: res.path }));
        window.dispatchEvent(new CustomEvent('stock-updated'));
        loadProfile();
      } else if (res && res.error) {
        await showAlert({
          title: t('st_restore_failed'),
          message: res.error,
          tone: 'danger',
        });
      }
    }
  };

  const handleSeedSampleData = async () => {
    const ok = await showConfirm({
      title: t('st_sample_title') || 'Load Sample Hardware Data?',
      message: t('st_sample_msg') || 'This will populate 41 hardware products, 5 racks, 5 vendors, and sample invoices to test all store flows.',
      confirmLabel: t('st_load_btn') || 'Load Sample Data',
      tone: 'primary',
    });
    if (!ok) return;
    if (window.api && window.api.seedDemoData) {
      const res = await window.api.seedDemoData();
      if (res && res.success) {
        setDbStatusMsg(t('st_sample_loaded') || 'Sample hardware data loaded successfully.');
        window.dispatchEvent(new CustomEvent('stock-updated'));
        loadProfile();
      }
    }
  };

  const handleResetDatabase = async () => {
    const ok = await showConfirm({
      title: t('st_reset_title'),
      message: t('st_reset_msg'),
      confirmLabel: t('st_erase_all'),
      tone: 'danger',
    });
    if (!ok) return;
    if (window.api && window.api.resetDatabase) {
      await window.api.resetDatabase();
      setDbStatusMsg(t('st_db_cleared'));
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

      {/* Main Split Layout */}
      <div className="items-start">
        {/* Right Side: Form Panel */}
        <div className="surface-card rounded-2xl p-6 space-y-6">
          {activeTab === 'Shop Profile' && (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{t('st_profile_title')}</h2>
                  <p className="text-xs text-slate-400">{t('st_profile_sub')}</p>
                </div>
                {savedSuccess && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('st_saved')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2-column form fields (2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                        {t('st_shop_name')}
                      </label>
                      <input data-rule="text" maxLength={80}
                        type="text"
                        required
                        value={profile.shop_name}
                        onChange={(e) => setProfile({ ...profile, shop_name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('st_tagline')}</label>
                      <input data-rule="text" maxLength={80}
                        type="text"
                        value={profile.tagline || ''}
                        onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('st_phone')}</label>
                      <input data-rule="phone" maxLength={15}
                        type="text"
                        required
                        value={profile.phone || ''}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('st_email')}</label>
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
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('st_addr1')}</label>
                      <input data-rule="text" maxLength={80}
                        type="text"
                        value={profile.address_line1 || ''}
                        onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('st_addr2')}</label>
                      <input data-rule="text" maxLength={80}
                        type="text"
                        value={profile.address_line2 || ''}
                        onChange={(e) => setProfile({ ...profile, address_line2: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('st_city')}</label>
                      <input data-rule="alpha" maxLength={40}
                        type="text"
                        value={profile.city || ''}
                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('st_pincode')}</label>
                      <input data-rule="digits" maxLength={6} inputMode="numeric"
                        type="text"
                        value={profile.pincode || ''}
                        onChange={(e) => setProfile({ ...profile, pincode: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1">
                      {t('st_gstin')} <span className="text-slate-400 font-normal">{t('st_gstin_opt')}</span>
                    </label>
                    <input data-rule="code" maxLength={15}
                      type="text"
                      placeholder={t('st_gstin_ph')}
                      value={profile.gstin || ''}
                      onChange={(e) => setProfile({ ...profile, gstin: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1">{t('st_footer_note')}</label>
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
                  <label className="block text-[13px] font-semibold text-slate-700">{t('st_header_preview')}</label>
                  <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center space-y-2 bg-slate-50/50">
                    <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-sm shadow-blue-200">
                      <Layers className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{profile.shop_name || 'T. S. P Enterprises'}</p>
                      <p className="text-[12px] text-slate-400">
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
                  {t('st_save_changes')}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'Racks & Bins' && (
            <Racks embedded={true} />
          )}

          {activeTab === 'Users & Roles' && (
            <UsersPanel showAlert={showAlert} showConfirm={showConfirm} showToast={showToast} />
          )}

          {activeTab === 'Billing & Print' && (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
            <div className="xl:col-span-3 space-y-5 min-w-0">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{t('st_printer_config')}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('st_printer_config_sub')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadPrinters}
                  disabled={loadingPrinters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingPrinters ? 'animate-spin' : ''}`} />
                  <span>{t('st_refresh_printers')}</span>
                </button>
              </div>

              {/* Available Printers */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">{t('st_available_printers_lc')}</label>
                <div className="space-y-2">
                  {printers.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                      {t('st_no_printers_settings').split(/\{b\}|\{\/b\}/).map((part, i) => (i === 1 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>))}
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
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[12px] font-semibold">
                                    {t('st_windows_default')}
                                  </span>
                                )}
                              </div>
                              <p className="text-[13px] text-slate-500 truncate mt-0.5">
                                {p.connectionType || t('st_local')} · {t('st_installed')}
                                {p.portName ? ` · ${p.portName}` : ''}
                                {p.isSimulated ? ` ${t('st_browser_preview')}` : ''}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-bold border flex-shrink-0 ${statusCls}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                            {statusText(p.statusLabel)}
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
                  <label className="block font-bold text-slate-700 mb-1.5">{t('st_default_format')}</label>
                  <select
                    value={printPrefs.format}
                    onChange={(e) => handlePrintPrefsChange({ format: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <optgroup label={t('st_thermal_roll')}>
                      {PAPER_SIZES.filter((p) => p.thermal).map((p) => (
                        <option key={p.id} value={p.id}>
                          {paperLabel(p)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={t('st_iso_sizes')}>
                      {PAPER_SIZES.filter((p) => !p.thermal).map((p) => (
                        <option key={p.id} value={p.id}>
                          {paperLabel(p)}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">{t('st_default_orientation')}</label>
                  <select
                    value={printPrefs.orientation || 'portrait'}
                    onChange={(e) => handlePrintPrefsChange({ orientation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="portrait">{t('st_portrait')}</option>
                    <option value="landscape">{t('st_landscape')}</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1.5">{t('st_after_payment')}</label>
                  <select
                    value={printPrefs.afterPayment || (printPrefs.autoPrint ? 'auto' : 'preview')}
                    onChange={(e) => handlePrintPrefsChange({ afterPayment: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="auto">{t('st_opt_auto')}</option>
                    <option value="preview">{t('st_opt_preview')}</option>
                    <option value="none">{t('st_opt_none')}</option>
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
                  <span className="text-slate-700 font-medium">{t('st_chk_auto')}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printPrefs.openPreviewOnManual !== false}
                    onChange={(e) => handlePrintPrefsChange({ openPreviewOnManual: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">{t('st_chk_preview_manual')}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printPrefs.allowHistoryReprint !== false}
                    onChange={(e) => handlePrintPrefsChange({ allowHistoryReprint: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">{t('st_chk_reprint')}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printPrefs.enablePdfExport !== false}
                    onChange={(e) => handlePrintPrefsChange({ enablePdfExport: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 font-medium">{t('st_chk_pdf')}</span>
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
                  <span>{t('st_print_test')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSavePrinterSettings}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.99] transition-all"
                >
                  {t('st_save_printer')}
                </button>
              </div>
            </div>

            {/* Live bill preview (updates as you change format / orientation) */}
            <div className="xl:col-span-2 xl:sticky xl:top-2 min-w-0">
              {(() => {
                const fmt = printPrefs.format;
                const landscape = (printPrefs.orientation || 'portrait') === 'landscape';
                const widthClass =
                  fmt === '58mm' ? 'max-w-[260px]'
                  : fmt === '80mm' ? 'max-w-[330px]'
                  : fmt === 'A6' ? 'max-w-[400px]'
                  : landscape ? 'max-w-[460px]' : 'max-w-[400px]';
                return (
                  <div className="rounded-xl border border-slate-200 bg-slate-100/90 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-slate-800">{t('st_bill_preview')}</p>
                      <span className="text-[13px] font-medium text-slate-500">
                        {fmt} · {landscape ? t('st_landscape') : t('st_portrait')}
                      </span>
                    </div>
                    <div className="max-h-[calc(100vh-190px)] overflow-y-auto flex justify-center">
                      <div className={`w-full ${widthClass} bg-white rounded-lg shadow-lg border border-slate-200/90 overflow-hidden`}>
                        <InvoiceDocument invoice={sampleTestInvoice} profile={profile} format={fmt} inlinePreview={true} />
                      </div>
                    </div>
                    <p className="text-[13px] text-slate-400 text-center mt-2.5">{t('st_sample_bill')}</p>
                  </div>
                );
              })()}
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
                    <p className="text-[13px] text-slate-500 mt-0.5">{t('set_lang_desc')}</p>
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
                    <p className="text-[13px] text-slate-400">{t('set_tax_desc')}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full border border-emerald-200 text-[12px]">
                    {t('set_tax_badge')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{t('set_currency_title')}</p>
                    <p className="text-[13px] text-slate-400">{t('set_currency_desc')}</p>
                  </div>
                  <span className="font-bold text-slate-800">INR (₹)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Database' && (
            <div className="space-y-5">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">{t('st_db_title')}</h2>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
                <p className="text-slate-500 font-medium">{t('st_db_storage')}</p>
                <p className="font-mono bg-white p-2 rounded border border-slate-200 text-slate-800 break-all select-all">
                  {dbPath}
                </p>
                <p className="text-slate-400 text-[13px]">
                  {t('st_db_note')}
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
                  <span>{t('st_backup_btn')}</span>
                </button>

                <button
                  onClick={handleRestore}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-800 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span>{t('st_restore_btn')}</span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <p className="text-xs font-bold text-slate-700">{t('st_data_tools') || 'Test & Maintenance Tools'}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSeedSampleData}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>{t('st_load_sample_data') || 'Load Sample Hardware Data'}</span>
                  </button>

                  <button
                    onClick={handleResetDatabase}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('st_clear_all')}</span>
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
          primaryCloseLabel={t('st_close_preview')}
          onClose={() => setShowTestPreview(false)}
        />
      )}
    </div>
  );
}
