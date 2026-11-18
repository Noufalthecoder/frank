import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  AlertTriangle,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  History,
  User,
  Phone,
  LayoutGrid,
  RefreshCw,
  ChevronDown,
  Settings as SettingsIcon
} from 'lucide-react';
import PrintableReceipt from '../components/PrintableReceipt.jsx';
import PrintPreviewModal from '../components/PrintPreviewModal.jsx';
import PrintErrorBanner from '../components/PrintErrorBanner.jsx';
import {
  getPrintPreferences,
  savePrintPreferences,
  executePrint,
  exportReceiptPdf,
} from '../lib/printConfig.js';
import {
  normalizeUnit,
  isMeasurableUnit,
  getCompatibleUnits,
  convertUnit,
  formatQty,
} from '../lib/units.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const isItemAvailable = (item) =>
  Number(item.quantity) > 0 && item.status !== 'Unavailable' && item.status !== 'Inactive';

const getBaseQty = (cartItem) => {
  const numericQty = parseFloat(cartItem.qty) || 0;
  const baseUnit = normalizeUnit(cartItem.baseUnit || cartItem.unit || 'PCS');
  const billingUnit = normalizeUnit(cartItem.billingUnit || baseUnit);
  return convertUnit(numericQty, billingUnit, baseUnit);
};

const DRAFT_BILLS_KEY = 'tsp_pos_draft_bills_v1';

const createEmptyBill = (id = `bill-${Date.now()}`) => ({
  id,
  customerName: 'Walk-in Customer',
  customerPhone: '',
  cart: [],
  billDiscountPercent: 0,
  paymentMode: 'Cash',
});

function loadInitialBills() {
  try {
    const raw = localStorage.getItem(DRAFT_BILLS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.bills) && parsed.bills.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}
  const first = createEmptyBill('bill-1');
  return { bills: [first], activeBillId: first.id };
}

export default function POSBilling() {
  const navigate = useNavigate();
  const { t, tName } = useLanguage();
  const initialDrafts = loadInitialBills();

  // Multi-Bill Tabs System (Up to 10 concurrent carts, persisted in localStorage)
  const [bills, setBills] = useState(initialDrafts.bills);
  const [activeBillId, setActiveBillId] = useState(initialDrafts.activeBillId);
  const [shopProfile, setShopProfile] = useState(null);

  // Search & Catalog
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState([]);

  // Printable Receipt Modal & Live Printer Status
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [printPrefs, setPrintPrefs] = useState(getPrintPreferences());
  const [printers, setPrinters] = useState([]);
  const [showPrinterMenu, setShowPrinterMenu] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [posToast, setPosToast] = useState('');
  const [printFailure, setPrintFailure] = useState(null); // { invoice, reason }
  const [retryingPrint, setRetryingPrint] = useState(false);
  const printerMenuRef = useRef(null);
  const posToastTimerRef = useRef(null);

  const showPosToast = (msg) => {
    setPosToast(msg);
    if (posToastTimerRef.current) clearTimeout(posToastTimerRef.current);
    posToastTimerRef.current = setTimeout(() => setPosToast(''), 2000);
  };

  const loadPrinters = async () => {
    setLoadingPrinters(true);
    try {
      if (window.api && window.api.getPrinters) {
        const list = await window.api.getPrinters();
        setPrinters(list || []);
      }
    } catch (_) {}
    setLoadingPrinters(false);
  };

  // Input Refs for Keyboard Shortcuts
  const searchInputRef = useRef(null);
  const customerInputRef = useRef(null);
  const discountInputRef = useRef(null);

  // Persist open draft bill tabs automatically across page navigation & restarts
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_BILLS_KEY, JSON.stringify({ bills, activeBillId }));
    } catch (_) {}
  }, [bills, activeBillId]);

  // Active bill helper
  const activeBill = bills.find((b) => b.id === activeBillId) || bills[0];

  // Helper to update fields of the active bill
  const updateActiveBill = (updates) => {
    setBills((prev) =>
      prev.map((b) => (b.id === activeBillId ? { ...b, ...updates } : b))
    );
  };

  useEffect(() => {
    loadCatalog();
    loadRecentInvoices();
    loadPrinters();
    if (window.api && window.api.getShopProfile) {
      window.api.getShopProfile().then((p) => { if (p) setShopProfile(p); });
    }
    const handlePrefsUpdate = (e) => {
      setPrintPrefs(e.detail || getPrintPreferences());
    };
    const handleClickOutside = (e) => {
      if (printerMenuRef.current && !printerMenuRef.current.contains(e.target)) {
        setShowPrinterMenu(false);
      }
    };
    window.addEventListener('print-prefs-updated', handlePrefsUpdate);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('print-prefs-updated', handlePrefsUpdate);
      document.removeEventListener('mousedown', handleClickOutside);
      if (posToastTimerRef.current) clearTimeout(posToastTimerRef.current);
    };
  }, []);

  const loadCatalog = async () => {
    if (window.api && window.api.getItems) {
      const items = await window.api.getItems();
      setAllItems(items || []);
    }
  };

  const loadRecentInvoices = async () => {
    if (window.api && window.api.getInvoices) {
      const invs = await window.api.getInvoices();
      setRecentInvoices((invs || []).slice(0, 10));
    }
  };

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F2: Focus Search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F4: Focus Customer Name
      else if (e.key === 'F4') {
        e.preventDefault();
        customerInputRef.current?.focus();
      }
      // F6: Focus Bill Discount
      else if (e.key === 'F6') {
        e.preventDefault();
        discountInputRef.current?.focus();
      }
      // F8: Cycle Payment Mode
      else if (e.key === 'F8') {
        e.preventDefault();
        cyclePaymentMode();
      }
      // F9: Complete Sale
      else if (e.key === 'F9') {
        e.preventDefault();
        handleGenerateBill();
      }
      // Alt + N: New Bill
      else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        addNewBill();
      }
      // Alt + 1..9: Switch Bill
      else if (e.altKey && !isNaN(parseInt(e.key)) && parseInt(e.key) >= 1 && parseInt(e.key) <= 9) {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (bills[index]) {
          setActiveBillId(bills[index].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bills, activeBillId]);

  // Search Logic
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    const q = val.toLowerCase().trim();
    const matches = allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        tName(item.name).toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.size && item.size.toLowerCase().includes(q)) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.bin_id && item.bin_id.toLowerCase().includes(q))
    );
    setSearchResults(matches.slice(0, 8));
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;

      const exact = allItems.find(
        (i) => (i.sku.toLowerCase() === q || i.name.toLowerCase() === q) && isItemAvailable(i)
      );
      const firstAvailable = searchResults.find((i) => isItemAvailable(i));
      if (exact) {
        handleAddToCart(exact);
      } else if (firstAvailable) {
        handleAddToCart(firstAvailable);
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleAddToCart = (item) => {
    if (!isItemAvailable(item)) return;
    const baseUnit = normalizeUnit(item.unit || 'PCS');
    const existingIndex = activeBill.cart.findIndex(
      (i) => i.id === item.id || i.sku === item.sku
    );

    let newCart;
    if (existingIndex >= 0) {
      newCart = activeBill.cart.map((cartItem, idx) =>
        idx === existingIndex
          ? { ...cartItem, qty: Number(((parseFloat(cartItem.qty) || 0) + 1).toFixed(4)) }
          : cartItem
      );
    } else {
      newCart = [
        ...activeBill.cart,
        {
          id: item.id,
          sku: item.sku,
          name: item.name,
          size: item.size || '',
          brand: item.brand || 'Generic',
          category: item.category || 'Hardware',
          bin: item.bin_id || 'R01-L1-S1',
          baseUnit,
          billingUnit: baseUnit,
          qty: 1,
          rate: Number(item.selling_price) || 0,
          mrp: (Number(item.selling_price) || 0) * 1.15,
          discountPercent: 0,
          maxStock: Number(item.quantity) || 0,
        },
      ];
    }

    updateActiveBill({ cart: newCart });
    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  // Cart item modifiers
  const updateQty = (index, delta) => {
    const newCart = activeBill.cart.map((item, idx) => {
      if (idx === index) {
        const current = parseFloat(item.qty) || 0;
        const minVal = isMeasurableUnit(item.baseUnit) ? 0.1 : 1;
        const nextQty = Math.max(minVal, Number((current + delta).toFixed(4)));
        return { ...item, qty: nextQty };
      }
      return item;
    });
    updateActiveBill({ cart: newCart });
  };

  const setExplicitQty = (index, val) => {
    const newCart = activeBill.cart.map((item, idx) => {
      if (idx !== index) return item;
      if (val === '') return { ...item, qty: '' };
      if (isMeasurableUnit(item.baseUnit)) {
        const parsed = parseFloat(val);
        if (isNaN(parsed) || parsed < 0) return item;
        return { ...item, qty: val };
      }
      const nextQty = Math.max(1, parseInt(val, 10) || 1);
      return { ...item, qty: nextQty };
    });
    updateActiveBill({ cart: newCart });
  };

  const finalizeQtyOnBlur = (index) => {
    const newCart = activeBill.cart.map((item, idx) => {
      if (idx !== index) return item;
      const parsed = parseFloat(item.qty);
      if (isMeasurableUnit(item.baseUnit)) {
        return { ...item, qty: !isNaN(parsed) && parsed > 0 ? Number(parsed.toFixed(4)) : 1 };
      }
      return { ...item, qty: !isNaN(parsed) && parsed >= 1 ? Math.round(parsed) : 1 };
    });
    updateActiveBill({ cart: newCart });
  };

  const updateBillingUnit = (index, nextUnit) => {
    const newCart = activeBill.cart.map((item, idx) =>
      idx === index ? { ...item, billingUnit: normalizeUnit(nextUnit) } : item
    );
    updateActiveBill({ cart: newCart });
  };

  const updateRate = (index, val) => {
    const nextRate = Math.max(0, parseFloat(val) || 0);
    const newCart = activeBill.cart.map((item, idx) =>
      idx === index ? { ...item, rate: nextRate } : item
    );
    updateActiveBill({ cart: newCart });
  };

  const updateDiscountPercent = (index, val) => {
    const nextDisc = Math.min(100, Math.max(0, parseFloat(val) || 0));
    const newCart = activeBill.cart.map((item, idx) =>
      idx === index ? { ...item, discountPercent: nextDisc } : item
    );
    updateActiveBill({ cart: newCart });
  };

  const removeFromCart = (index) => {
    const newCart = activeBill.cart.filter((_, idx) => idx !== index);
    updateActiveBill({ cart: newCart });
  };

  const clearCart = () => {
    if (activeBill.cart.length > 0 && confirm('Clear all items from this bill?')) {
      updateActiveBill({ cart: [] });
    }
  };

  // Multi-Bill Tab Operations
  const addNewBill = () => {
    if (bills.length >= 10) {
      alert('Maximum 10 concurrent bills allowed.');
      return;
    }
    const newId = `bill-${Date.now()}`;
    const newBill = {
      id: newId,
      customerName: 'Walk-in Customer',
      customerPhone: '',
      cart: [],
      billDiscountPercent: 0,
      paymentMode: 'Cash',
    };
    setBills([...bills, newBill]);
    setActiveBillId(newId);
  };

  const closeBill = (billId, e) => {
    e.stopPropagation();
    if (bills.length === 1) {
      // If closing the only tab, just clear it
      updateActiveBill({ cart: [], customerName: 'Walk-in Customer', customerPhone: '', billDiscountPercent: 0 });
      return;
    }
    const target = bills.find((b) => b.id === billId);
    if (target && target.cart.length > 0) {
      if (!confirm(`Close bill for ${target.customerName}? Items in this bill will be discarded.`)) {
        return;
      }
    }
    const remaining = bills.filter((b) => b.id !== billId);
    setBills(remaining);
    if (activeBillId === billId) {
      setActiveBillId(remaining[0].id);
    }
  };

  const cyclePaymentMode = () => {
    const modes = ['Cash', 'Card', 'UPI'];
    const currentIdx = modes.indexOf(activeBill.paymentMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    updateActiveBill({ paymentMode: nextMode });
  };

  // Financial Calculations (Non-GST Clean Retail Calculation with Length/Weight Unit Conversion)
  const itemSubtotal = activeBill.cart.reduce((acc, i) => acc + getBaseQty(i) * i.rate, 0);
  const itemDiscounts = activeBill.cart.reduce(
    (acc, i) => acc + (getBaseQty(i) * i.rate * (i.discountPercent || 0)) / 100,
    0
  );
  const afterItemDiscount = Math.max(0, itemSubtotal - itemDiscounts);
  const billDiscountAmount = (afterItemDiscount * (activeBill.billDiscountPercent || 0)) / 100;
  const rawTotal = Math.max(0, afterItemDiscount - billDiscountAmount);
  const roundedTotal = Math.round(rawTotal);
  const roundOff = roundedTotal - rawTotal;
  const totalDiscount = itemDiscounts + billDiscountAmount;

  // Complete Sale
  const handleGenerateBill = async () => {
    if (activeBill.cart.length === 0) {
      alert('Cart is empty. Please add items to checkout.');
      return;
    }

    const invalidQty = activeBill.cart.find((i) => (parseFloat(i.qty) || 0) <= 0);
    if (invalidQty) {
      alert(`Please enter a valid quantity greater than 0 for "${invalidQty.name}".`);
      return;
    }

    // Check if any item exceeds current available stock (in base unit)
    const overStock = activeBill.cart.filter((i) => {
      const liveItem = allItems.find((x) => x.sku === i.sku || x.id === i.id);
      const avail = liveItem ? Number(liveItem.quantity) : Number(i.maxStock || 0);
      return getBaseQty(i) > avail;
    });
    if (overStock.length > 0) {
      const list = overStock
        .map((i) => {
          const baseU = normalizeUnit(i.baseUnit || 'PCS');
          const billU = normalizeUnit(i.billingUnit || baseU);
          return `• ${i.name} (billing ${formatQty(i.qty)} ${billU} = ${formatQty(getBaseQty(i))} ${baseU}, stock ${formatQty(i.maxStock)} ${baseU})`;
        })
        .join('\n');
      if (!confirm(`Warning: Stock is lower than billed quantity for:\n${list}\n\nProceed anyway (stock will be set to 0)?`)) {
        return;
      }
    }

    const invoicePayload = {
      customer_name: activeBill.customerName || 'Walk-in Customer',
      customer_phone: activeBill.customerPhone || '',
      subtotal: itemSubtotal,
      discount: totalDiscount,
      total: roundedTotal,
      payment_mode: activeBill.paymentMode || 'Cash',
      items: activeBill.cart.map((i) => {
        const baseU = normalizeUnit(i.baseUnit || 'PCS');
        const billU = normalizeUnit(i.billingUnit || baseU);
        const billedQty = parseFloat(i.qty) || 0;
        const baseQty = getBaseQty(i);
        const lineSub = baseQty * i.rate;
        const lineDisc = (lineSub * (i.discountPercent || 0)) / 100;
        return {
          id: i.id,
          sku: i.sku,
          name: i.name,
          bin: i.bin,
          quantity: billedQty,
          unit: billU,
          base_unit: baseU,
          stock_deduction_qty: baseQty,
          rate: i.rate,
          discount: lineDisc,
          total: lineSub - lineDisc,
        };
      }),
    };

    if (window.api && window.api.createInvoice) {
      const res = await window.api.createInvoice(invoicePayload);
      if (res && res.success) {
        const completedInvoice = {
          ...invoicePayload,
          invoice_number: res.invoice_number,
          date: new Date().toLocaleString(),
          zeroStockAlerts: res.zeroStockAlerts || [],
        };
        setLastInvoice(completedInvoice);

        const prefs = getPrintPreferences();
        setPrintPrefs(prefs);

        // Reset current active bill immediately so POS is ready for the next customer
        updateActiveBill({
          cart: [],
          customerName: 'Walk-in Customer',
          customerPhone: '',
          billDiscountPercent: 0,
          paymentMode: 'Cash',
        });

        loadCatalog();
        loadRecentInvoices();

        // Notify shell of stock changes
        window.dispatchEvent(
          new CustomEvent('stock-updated', {
            detail: { zeroStockAlerts: res.zeroStockAlerts || [] },
          })
        );

        if (prefs.afterPayment === 'auto' || prefs.autoPrint) {
          // Flow B: Automatic silent print to configured printer -> ready for next customer
          const printRes = await executePrint({
            silent: true,
            deviceName: prefs.printerName || '',
            format: prefs.format || '80mm',
            orientation: prefs.orientation || 'portrait',
          });
          if (printRes && printRes.success) {
            setPrintFailure(null);
            showPosToast(`Invoice #${res.invoice_number} sent to ${prefs.printerName || 'default printer'} (${prefs.format})`);
          } else {
            setPrintFailure({
              invoice: completedInvoice,
              reason: printRes?.error || 'The printer is unavailable or disconnected.',
            });
          }
        } else if (prefs.afterPayment === 'none') {
          showPosToast(`Invoice #${res.invoice_number} saved.`);
        } else {
          // Flow C: Auto-print disabled -> open Print Preview modal (A1-A6 + Thermal + Printer picker)
          setShowReceiptModal(true);
        }
      }
    }
  };

  const activePrinterObj =
    printers.find((p) => p.name === printPrefs.printerName) ||
    printers.find((p) => p.isDefault) ||
    printers[0] ||
    null;

  return (
    <div className="space-y-4">
      {/* Floating Top-Right Toast (2s) */}
      {posToast && (
        <div className="animate-toast fixed top-4 right-5 z-[100] flex items-center gap-2 bg-slate-900 text-white border border-slate-700/80 shadow-2xl shadow-slate-900/25 px-4 py-2.5 rounded-xl text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{posToast}</span>
        </div>
      )}

      {/* Printer Disconnected / Failure Recovery Banner (Zero Duplicate Stock Deduction) */}
      {printFailure && (
        <div className="fixed top-4 right-5 z-[95] w-full max-w-md">
          <PrintErrorBanner
            invoiceNumber={printFailure.invoice?.invoice_number}
            reason={printFailure.reason}
            retrying={retryingPrint}
            onRetry={async () => {
              setRetryingPrint(true);
              await loadPrinters();
              const prefs = getPrintPreferences();
              const retryRes = await executePrint({
                silent: true,
                deviceName: prefs.printerName || '',
                format: prefs.format || '80mm',
                orientation: prefs.orientation || 'portrait',
              });
              setRetryingPrint(false);
              if (retryRes && retryRes.success) {
                const invNo = printFailure.invoice?.invoice_number;
                setPrintFailure(null);
                showPosToast(`Invoice #${invNo} printed.`);
              } else {
                setPrintFailure((prev) =>
                  prev
                    ? { ...prev, reason: retryRes?.error || 'The printer is unavailable or disconnected.' }
                    : null
                );
              }
            }}
            onSavePdf={async () => {
              setRetryingPrint(true);
              const prefs = getPrintPreferences();
              const pdfRes = await exportReceiptPdf({
                invoiceNumber: printFailure.invoice?.invoice_number || 'INVOICE',
                format: prefs.format === '80mm' || prefs.format === '58mm' ? 'A4' : prefs.format,
                orientation: prefs.orientation || 'portrait',
              });
              setRetryingPrint(false);
              if (pdfRes && pdfRes.success) {
                setPrintFailure(null);
                showPosToast(pdfRes.path ? 'Invoice PDF saved.' : 'Opened PDF export.');
              }
            }}
            onDismiss={() => setPrintFailure(null)}
          />
        </div>
      )}

      {/* Top Bar: Multi-Bill Concurrent Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        {/* Bill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {bills.map((bill, index) => {
            const isActive = bill.id === activeBillId;
            const billTotal = bill.cart.reduce(
              (acc, i) => acc + getBaseQty(i) * i.rate * (1 - (i.discountPercent || 0) / 100),
              0
            );
            return (
              <div
                key={bill.id}
                onClick={() => setActiveBillId(bill.id)}
                className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-white border-blue-600 text-blue-700 shadow-sm ring-1 ring-blue-600/20'
                    : 'bg-slate-100/80 border-slate-200 text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    bill.cart.length > 0 ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                <div className="text-left">
                  <p className="truncate max-w-[110px] font-bold leading-tight">
                    {bill.customerName && bill.customerName !== 'Walk-in Customer'
                      ? bill.customerName
                      : `Bill #${index + 1}`}
                  </p>
                  <p className="text-[10px] text-slate-400 font-normal">
                    {bill.cart.length} item{bill.cart.length === 1 ? '' : 's'} · ₹{Math.round(billTotal)}
                  </p>
                </div>
                <button
                  onClick={(e) => closeBill(bill.id, e)}
                  title="Close Bill"
                  className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {/* Add New Bill Tab Button */}
          {bills.length < 10 && (
            <button
              onClick={addNewBill}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-blue-600 hover:bg-blue-100/60 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('pos_new_bill')} {bills.length}/10</span>
            </button>
          )}
        </div>

        {/* Sub-Header Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('pos_bill_history')}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Cart & Search (2 cols) | Right Summary (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Left Column: Search & Cart Table */}
        <div className="lg:col-span-2 space-y-3">
          {/* Product Search Bar */}
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('pos_search_placeholder')}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Inline Product Lookup Results Table (As in reference image) */}
            {searchResults.length > 0 && (
              <div className="animate-popover absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200/90 rounded-2xl shadow-2xl shadow-slate-900/12 overflow-hidden z-30">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        <th className="py-2.5 px-4">Product</th>
                        <th className="py-2.5 px-3">Rack</th>
                        <th className="py-2.5 px-3">Stock Here</th>
                        <th className="py-2.5 px-3 text-right">MRP</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-3">Specs / Brand</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {searchResults.map((item) => {
                        const available = isItemAvailable(item);
                        return (
                        <tr
                          key={item.id}
                          onClick={() => available && handleAddToCart(item)}
                          className={`transition-colors ${
                            available
                              ? 'hover:bg-blue-50/70 cursor-pointer'
                              : 'bg-slate-50/80 opacity-75 cursor-not-allowed'
                          }`}
                        >
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="w-8 h-8 rounded-md object-contain bg-white border border-slate-200 p-0.5 flex-shrink-0"
                                />
                              )}
                              <div>
                                <p className={`font-bold leading-tight ${available ? 'text-slate-900' : 'text-slate-500'}`}>
                                  {tName(item.name)}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-600">
                            {item.bin_id || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            {!available ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                {t('cat_unavailable')}
                              </span>
                            ) : (
                              <span
                                className={`text-[11px] font-bold ${
                                  item.quantity <= (item.reorder_level || 15)
                                    ? 'text-amber-600'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {formatQty(item.quantity)} {normalizeUnit(item.unit || 'PCS')}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-400 line-through">
                            ₹ {(Number(item.selling_price) * 1.15).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ₹ {Number(item.selling_price).toFixed(2)}
                            {isMeasurableUnit(item.unit) && (
                              <span className="text-[10px] font-medium text-slate-400">
                                /{normalizeUnit(item.unit)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {item.size || item.brand || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {available ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCart(item);
                                }}
                                className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-2xs"
                              >
                                + Add
                              </button>
                            ) : (
                              <span className="inline-block px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded-md text-[10px] font-bold">
                                {t('cat_unavailable')}
                              </span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Active Cart Table */}
          <div className="surface-card rounded-2xl overflow-hidden flex flex-col justify-between min-h-[390px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="py-3 px-4">{t('pos_col_product')}</th>
                    <th className="py-3 px-3 text-center w-44">{t('pos_col_qty')}</th>
                    <th className="py-3 px-3 text-right w-28">{t('pos_col_rate')}</th>
                    <th className="py-3 px-3 text-right w-24">{t('pos_col_disc')}</th>
                    <th className="py-3 px-4 text-right w-28">{t('pos_col_total')}</th>
                    <th className="py-3 px-3 text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeBill.cart.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-16 text-center text-slate-400">
                        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-600">{t('pos_empty_cart')}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {t('pos_empty_cart_hint')}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    activeBill.cart.map((item, index) => {
                      const baseUnit = normalizeUnit(item.baseUnit || item.unit || 'PCS');
                      const billingUnit = normalizeUnit(item.billingUnit || baseUnit);
                      const compatibleUnits = getCompatibleUnits(baseUnit);
                      const measurable = isMeasurableUnit(baseUnit);
                      const baseQty = getBaseQty(item);
                      const lineSub = baseQty * item.rate;
                      const lineTotal = lineSub * (1 - (item.discountPercent || 0) / 100);

                      return (
                        <tr key={`${item.id}-${index}`} className="hover:bg-slate-50/70 transition-colors">
                          {/* Product Details */}
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 leading-snug">{tName(item.name)}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="font-mono text-slate-600">{item.sku}</span>
                              <span>·</span>
                              <span>{t('dash_shelf')}: {item.bin || 'R01-L1-S1'}</span>
                              <span>·</span>
                              <span className="text-emerald-600 font-medium">
                                {t('cat_stock')}: {formatQty(item.maxStock)} {baseUnit}
                              </span>
                            </div>
                          </td>

                          {/* Quantity / Length / Weight Input */}
                          <td className="py-3 px-3">
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => updateQty(index, -1)}
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min={measurable ? '0.001' : '1'}
                                  step={measurable ? 'any' : '1'}
                                  value={item.qty}
                                  onChange={(e) => setExplicitQty(index, e.target.value)}
                                  onBlur={() => finalizeQtyOnBlur(index)}
                                  className={`no-spinner text-center bg-slate-50 border border-slate-200 rounded-md py-0.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                    measurable ? 'w-14' : 'w-12'
                                  }`}
                                />
                                {measurable && compatibleUnits.length > 1 ? (
                                  <select
                                    value={billingUnit}
                                    onChange={(e) => updateBillingUnit(index, e.target.value)}
                                    aria-label="Billing unit"
                                    className="bg-blue-50 border border-blue-200 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                                  >
                                    {compatibleUnits.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                                <button
                                  onClick={() => updateQty(index, 1)}
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              {measurable && billingUnit !== baseUnit && (
                                <span className="text-[10px] font-medium text-blue-600">
                                  = {formatQty(baseQty)} {baseUnit}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Editable Rate Column (Negotiated Counter Price) */}
                          <td className="py-3 px-3 text-right">
                            <div className="relative inline-block w-24">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">
                                ₹
                              </span>
                              <input
                                type="number"
                                step="0.5"
                                value={item.rate}
                                onChange={(e) => updateRate(index, e.target.value)}
                                className="no-spinner w-full text-right bg-slate-50 border border-slate-200 rounded-md pl-5 pr-2 py-1 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            {measurable && (
                              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                per {baseUnit}
                              </div>
                            )}
                          </td>

                          {/* Discount % */}
                          <td className="py-3 px-3 text-right">
                            <div className="relative inline-block w-16">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={item.discountPercent || 0}
                                onChange={(e) => updateDiscountPercent(index, e.target.value)}
                                className="no-spinner w-full text-right bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </td>

                          {/* Line Total */}
                          <td className="py-3 px-4 text-right font-black text-slate-900 text-sm">
                            ₹ {lineTotal.toFixed(2)}
                          </td>

                          {/* Remove Item */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => removeFromCart(index)}
                              className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom table helper toolbar */}
            {activeBill.cart.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {activeBill.cart.length} item{activeBill.cart.length === 1 ? '' : 's'} in cart
                </span>
                <button
                  onClick={clearCart}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            )}
          </div>

          {/* Keyboard Hotkey Bar */}
          <div className="surface-card rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <button
              onClick={() => searchInputRef.current?.focus()}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
            >
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 shadow-2xs">
                F2
              </kbd>
              <span>Find product</span>
            </button>

            <button
              onClick={() => customerInputRef.current?.focus()}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
            >
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 shadow-2xs">
                F4
              </kbd>
              <span>Customer</span>
            </button>

            <button
              onClick={() => discountInputRef.current?.focus()}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
            >
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 shadow-2xs">
                F6
              </kbd>
              <span>Bill discount %</span>
            </button>

            <button
              onClick={cyclePaymentMode}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors"
            >
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 shadow-2xs">
                F8
              </kbd>
              <span>Payment mode</span>
            </button>

            <button
              onClick={handleGenerateBill}
              className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md border border-blue-200 transition-colors font-semibold"
            >
              <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded text-[10px] font-bold text-blue-700 shadow-2xs">
                F9
              </kbd>
              <span>Complete sale</span>
            </button>

            <button
              onClick={addNewBill}
              className="flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition-colors text-slate-500"
            >
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-600 shadow-2xs">
                Alt+N
              </kbd>
              <span>New bill</span>
            </button>

            <span className="flex items-center gap-1 px-2 py-1 text-slate-400 text-[10px]">
              <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono">
                Alt+1-9
              </kbd>
              <span>Switch</span>
            </span>
          </div>
        </div>

        {/* Right Column: Checkout Summary & Customer Details */}
        <div className="surface-card rounded-2xl p-5 space-y-4">
          {/* Bill Calculation Box */}
          <div className="space-y-2.5 pb-4 border-b border-slate-200/80 text-xs">
            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>{t('pos_subtotal')}</span>
              <span className="font-semibold text-slate-800 tabular-nums">₹ {itemSubtotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-500 font-medium">
              <span>{t('pos_discount')}</span>
              <span className="font-semibold text-emerald-600 tabular-nums">– ₹ {totalDiscount.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>{t('pos_round_off')}</span>
              <span className="tabular-nums">{roundOff >= 0 ? `+ ₹ ${roundOff.toFixed(2)}` : `– ₹ ${Math.abs(roundOff).toFixed(2)}`}</span>
            </div>

            <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white border border-blue-200/70 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900/70">{t('pos_total')}</span>
              <span className="text-[28px] font-black text-blue-600 tracking-[-0.03em] tabular-nums leading-none">
                ₹ {roundedTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Bill Discount % (F6) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                {t('pos_bill_discount_label')}
              </label>
              <span className="text-[10px] text-slate-400 font-mono">F6</span>
            </div>
            <div className="relative">
              <input
                ref={discountInputRef}
                type="number"
                min="0"
                max="100"
                value={activeBill.billDiscountPercent || 0}
                onChange={(e) =>
                  updateActiveBill({
                    billDiscountPercent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                  })
                }
                className="no-spinner w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                %
              </span>
            </div>
          </div>

          {/* Payment Mode Selector (F8) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                {t('pos_payment_label')}
              </label>
              <span className="text-[10px] text-slate-400 font-mono">F8</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { mode: 'Cash', label: t('pos_cash'), icon: Banknote },
                { mode: 'Card', label: t('pos_card'), icon: CreditCard },
                { mode: 'UPI', label: t('pos_upi'), icon: Smartphone },
              ].map(({ mode, label, icon: Icon }) => {
                const isSelected = activeBill.paymentMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateActiveBill({ paymentMode: mode })}
                    className={`py-3 px-2 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs ring-1 ring-blue-600'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Details (F4) */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  {t('pos_customer_name')}
                </label>
                <span className="text-[10px] text-slate-400 font-mono">F4</span>
              </div>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={customerInputRef}
                  type="text"
                  placeholder="e.g. Raj Builders"
                  value={activeBill.customerName}
                  onChange={(e) => updateActiveBill({ customerName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                Customer Phone (Optional)
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={activeBill.customerPhone}
                  onChange={(e) => updateActiveBill({ customerPhone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            {/* Cashier / Attendant tag */}
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Cashier:</span>
              <span className="font-semibold text-slate-700">A. Adithya (Admin)</span>
            </div>
          </div>

          {/* Complete Sale Button (F9) */}
          <button
            onClick={handleGenerateBill}
            disabled={activeBill.cart.length === 0}
            className={`w-full py-3 px-4 rounded-xl text-[13px] font-bold tracking-[-0.01em] transition-all flex items-center justify-between ${
              activeBill.cart.length === 0
                ? 'bg-slate-100/90 text-slate-400 border border-slate-200/90 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border border-blue-700/80 shadow-md shadow-blue-600/25 ring-1 ring-inset ring-white/15 active:scale-[0.99]'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('pos_complete_btn')}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums font-extrabold">
                ₹ {roundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <kbd
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                  activeBill.cart.length === 0
                    ? 'bg-white text-slate-400 border-slate-200/90'
                    : 'bg-white/15 text-white border-white/25'
                }`}
              >
                F9
              </kbd>
            </span>
          </button>
        </div>
      </div>

      {/* Bill History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Recent Bill History</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {recentInvoices.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No recent invoices recorded.</p>
              ) : (
                recentInvoices.map((inv) => (
                  <div
                    key={inv.id || inv.invoice_number}
                    className="p-3.5 bg-slate-50 hover:bg-blue-50/50 rounded-xl border border-slate-200/80 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">
                          {inv.invoice_number}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                          {inv.payment_mode || 'Cash'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-semibold mt-0.5">
                        {inv.customer_name || 'Walk-in Customer'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {inv.date_time || 'Recent'} · {inv.items_count || 1} items
                      </p>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <span className="text-sm font-black text-slate-900">
                        ₹ {Number(inv.total).toFixed(2)}
                      </span>
                      <button
                        onClick={() => {
                          setShowHistoryModal(false);
                          navigate('/history');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 bg-white border border-blue-200 rounded-lg"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  navigate('/history');
                }}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Open Full Sales History →
              </button>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal (opens when Auto-Print is disabled) */}
      {showReceiptModal && lastInvoice && (
        <PrintPreviewModal
          invoice={lastInvoice}
          profile={shopProfile}
          zeroStockAlerts={lastInvoice.zeroStockAlerts || []}
          primaryCloseLabel={t('pos_next_customer')}
          onClose={() => setShowReceiptModal(false)}
        />
      )}

      {/* Hidden Print DOM (used when Auto-Print is enabled) */}
      {!showReceiptModal && lastInvoice && (
        <PrintableReceipt invoice={lastInvoice} profile={shopProfile} format={printPrefs.format} />
      )}
    </div>
  );
}
