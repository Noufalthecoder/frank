import Pagination, { usePagination } from '../components/Pagination.jsx';
import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  Wallet,
  PiggyBank,
  Plus,
  X,
  Trash2,
  CheckCircle2,
  Calendar,
  Download
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { useAppDialog } from '../components/AppDialogContext.jsx';
import ExportMenu from '../components/ExportMenu.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Finance() {
  const { t, tCategory } = useLanguage();
  const { showAlert, showConfirm } = useAppDialog();
  const payLabel = (m) => {
    const k = { Cash: 'pos_cash', UPI: 'pos_upi', Card: 'pos_card', Bank: 'fi_pay_bank' }[m];
    return k ? t(k) : m;
  };
  const catLabel = (c) => {
    const k = { 'Shop Rent': 'fi_cat_rent', Salaries: 'fi_cat_salaries', Electricity: 'fi_cat_electricity', Transport: 'fi_cat_transport', Maintenance: 'fi_cat_maintenance', Others: 'fi_cat_others' }[c];
    return k ? t(k) : tCategory(c);
  };
  const [activeTab, setActiveTab] = useState('Overview');
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [items, setItems] = useState([]);
  const [dayClosings, setDayClosings] = useState([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  // Day closing state
  const todayStr = new Date().toISOString().split('T')[0];
  const [openingCash, setOpeningCash] = useState(0);
  const [countedCash, setCountedCash] = useState('');
  const [closingRemarks, setClosingRemarks] = useState('');
  const [closingSavedMsg, setClosingSavedMsg] = useState('');

  const [newExp, setNewExp] = useState({
    category: 'Shop Rent',
    description: '',
    amount: '',
    date: todayStr,
    payment_mode: 'Cash',
  });

  useEffect(() => {
    loadAllFinanceData();
    const handleUpdate = () => loadAllFinanceData();
    window.addEventListener('stock-updated', handleUpdate);
    return () => window.removeEventListener('stock-updated', handleUpdate);
  }, []);

  const loadAllFinanceData = async () => {
    if (!window.api) return;
    const [invRes, expRes, itemRes, dcRes] = await Promise.all([
      window.api.getInvoices ? window.api.getInvoices() : [],
      window.api.getExpenses ? window.api.getExpenses() : [],
      window.api.getItems ? window.api.getItems() : [],
      window.api.getDayClosings ? window.api.getDayClosings() : [],
    ]);
    setInvoices(invRes || []);
    setExpenses(expRes || []);
    setItems(itemRes || []);
    setDayClosings(dcRes || []);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExp.amount) {
      await showAlert({
        title: t('fi_missing_amount'),
        message: t('fi_missing_amount_msg'),
        tone: 'warning',
      });
      return;
    }
    if (window.api && window.api.addExpense) {
      await window.api.addExpense({
        ...newExp,
        amount: parseFloat(newExp.amount) || 0,
      });
      setShowAddExpense(false);
      setNewExp({
        category: 'Shop Rent',
        description: '',
        amount: '',
        date: todayStr,
        payment_mode: 'Cash',
      });
      loadAllFinanceData();
    }
  };

  const handleDeleteExpense = async (id) => {
    const ok = await showConfirm({
      title: t('fi_delete_expense'),
      message: t('fi_delete_expense_msg'),
      confirmLabel: t('fi_delete'),
      tone: 'danger',
    });
    if (!ok) return;
    if (window.api && window.api.deleteExpense) {
      await window.api.deleteExpense(id);
      loadAllFinanceData();
    }
  };

  const getExpensesExport = () => ({
    title: t('fi_export_title_expenses'),
    filename: `expenses_${new Date().toISOString().split('T')[0]}`,
    headers: [t('fi_col_date'), t('fi_col_category'), t('fi_col_description'), t('fi_col_payment_mode'), t('fi_col_amount')],
    rows: filteredExpenses.map((e) => [
      e.date || '', e.category ? catLabel(e.category) : '', e.description || '', payLabel(e.payment_mode || 'Cash'), Number(e.amount || 0),
    ]),
  });


  // Date range helper
  const inRange = (dateStr) => {
    if (dateRange === 'All Time') return true;
    if (!dateStr) return false;
    const d = new Date(String(dateStr).replace(' ', 'T'));
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateRange === 'Today') return d >= todayStart;
    if (dateRange === 'Last 7 Days') return d >= new Date(todayStart.getTime() - 6 * 86400000);
    if (dateRange === 'Last 30 Days') return d >= new Date(todayStart.getTime() - 29 * 86400000);
    return true;
  };

  const activeInvoices = invoices.filter((i) => i.status !== 'Returned' && inRange(i.date_time));
  const filteredExpenses = expenses.filter((e) => inRange(e.date));
  const expensePg = usePagination(filteredExpenses.length, { storageKey: 'expenses', defaultSize: 10 });
  const closingPg = usePagination(dayClosings.length, { storageKey: 'day-closings', sizes: [5, 10, 20, 50], defaultSize: 10 });
  const resetExpensePage = expensePg.reset;
  useEffect(() => {
    resetExpensePage();
  }, [dateRange, resetExpensePage]);

  const totalSales = activeInvoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
  const netCashFlow = totalSales - totalExpenses;

  // Estimate gross product profit from cost_price lookup
  const costMap = {};
  items.forEach((i) => {
    costMap[i.sku] = Number(i.cost_price) || 0;
  });

  const grossProfit = activeInvoices.reduce((sum, inv) => {
    try {
      const lines = JSON.parse(inv.items_json || '[]');
      if (lines.length === 0) return sum + Number(inv.total || 0) * 0.25;
      const lineCost = lines.reduce(
        (c, l) => c + (Number(l.quantity || l.qty || 0) * (costMap[l.sku] || Number(l.rate || 0) * 0.72)),
        0
      );
      return sum + (Number(inv.total || 0) - lineCost);
    } catch (_) {
      return sum + Number(inv.total || 0) * 0.25;
    }
  }, 0);

  // Build real Daily Cash Flow chart grouped by YYYY-MM-DD
  const dateMap = {};
  activeInvoices.forEach((inv) => {
    const key = String(inv.date_time || '').slice(0, 10) || todayStr;
    if (!dateMap[key]) dateMap[key] = { sales: 0, expenses: 0 };
    dateMap[key].sales += Number(inv.total) || 0;
  });
  filteredExpenses.forEach((exp) => {
    const key = String(exp.date || '').slice(0, 10) || todayStr;
    if (!dateMap[key]) dateMap[key] = { sales: 0, expenses: 0 };
    dateMap[key].expenses += Number(exp.amount) || 0;
  });
  const sortedDates = Object.keys(dateMap).sort().slice(-10);

  const cashFlowData = {
    labels: sortedDates.length > 0 ? sortedDates.map((d) => d.slice(5)) : [todayStr.slice(5)],
    datasets: [
      {
        label: t('dash_sales'),
        data: sortedDates.length > 0 ? sortedDates.map((d) => dateMap[d].sales) : [0],
        backgroundColor: '#1e3a8a',
        borderRadius: 4,
      },
      {
        label: t('fin_tab_expenses'),
        data: sortedDates.length > 0 ? sortedDates.map((d) => dateMap[d].expenses) : [0],
        backgroundColor: '#60a5fa',
        borderRadius: 4,
      },
    ],
  };

  const cashFlowOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { boxWidth: 10, font: { size: 11 }, color: '#64748b' },
      },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#0f172a',
        bodyColor: '#334155',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 10,
        boxPadding: 6,
        titleFont: { size: 12, weight: '700' },
        bodyFont: { size: 12, weight: '600' },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#64748b' } },
      y: {
        grid: { color: '#f1f5f9' },
        ticks: {
          font: { size: 11 },
          color: '#64748b',
          callback: (value) => {
            if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return value;
          },
        },
      },
    },
  };

  // Top Expenses grouped by Category
  const catTotals = {};
  filteredExpenses.forEach((e) => {
    const c = e.category || 'Others';
    catTotals[c] = (catTotals[c] || 0) + (Number(e.amount) || 0);
  });
  const topExpenseCategories = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Live Today Cash Calculation for Day Close
  const cashSalesToday = invoices
    .filter(
      (i) =>
        i.status !== 'Returned' &&
        (i.payment_mode || 'Cash') === 'Cash' &&
        String(i.date_time || '').startsWith(todayStr)
    )
    .reduce((sum, i) => sum + (Number(i.total) || 0), 0);

  const cashExpensesToday = expenses
    .filter(
      (e) =>
        (e.payment_mode || 'Cash') === 'Cash' &&
        String(e.date || '').startsWith(todayStr)
    )
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const expectedCash = (parseFloat(openingCash) || 0) + cashSalesToday - cashExpensesToday;
  const difference = (parseFloat(countedCash) || 0) - expectedCash;

  const handleRecordClosing = async () => {
    if (countedCash === '') {
      await showAlert({
        title: t('fi_counted_required'),
        message: t('fi_counted_required_msg'),
        tone: 'warning',
      });
      return;
    }
    if (window.api && window.api.recordDayClosing) {
      await window.api.recordDayClosing({
        closing_date: todayStr,
        opening_cash: parseFloat(openingCash) || 0,
        total_cash_sales: cashSalesToday,
        total_expenses: cashExpensesToday,
        system_expected_cash: expectedCash,
        counted_cash: parseFloat(countedCash) || 0,
        difference,
        remarks: closingRemarks.trim(),
      });
      setClosingSavedMsg(t('fi_dayclose_recorded', { date: todayStr }));
      setTimeout(() => setClosingSavedMsg(''), 3500);
      loadAllFinanceData();
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-slate-900 tracking-[-0.025em]">{t('fin_title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">{t('fin_subtitle')}</p>
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All Time">{t('date_all')}</option>
          <option value="Today">{t('date_today')}</option>
          <option value="Last 7 Days">{t('date_7d')}</option>
          <option value="Last 30 Days">{t('date_30d')}</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold text-slate-500">
        {[
          { id: 'Overview', label: t('fin_tab_overview') },
          { id: 'Expenses', label: t('fin_tab_expenses') },
          { id: 'Day Close', label: t('fin_tab_dayclose') },
        ].map(({ id: tab, label }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 transition-colors relative ${
              activeTab === tab ? 'text-blue-600 font-bold' : 'hover:text-slate-800'
            }`}
          >
            {label}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"></span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <div className="space-y-6">
          {/* Top 4 Live Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-400">{t('fi_total_sales')}</p>
                <p className="text-xl font-bold text-slate-900">
                  ₹ {Math.round(totalSales).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-400">{t('fi_total_expenses')}</p>
                <p className="text-xl font-bold text-slate-900">
                  ₹ {Math.round(totalExpenses).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-400">{t('fi_net_cash_flow')}</p>
                <p className={`text-xl font-bold ${netCashFlow >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                  {netCashFlow < 0 ? '– ' : ''}₹ {Math.abs(Math.round(netCashFlow)).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <PiggyBank className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-slate-400">{t('fi_gross_margin')}</p>
                <p className="text-xl font-bold text-slate-900">
                  ₹ {Math.round(grossProfit).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>

          {/* Middle: Daily Cash Flow Bar Chart & Top Expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t('fi_daily_cash_flow')}</h2>
                <p className="text-xs text-slate-400 mb-3">{t('fi_daily_cash_flow_sub')}</p>
              </div>
              {sortedDates.length === 0 ? (
                <div className="h-64 w-full flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                  <Wallet className="w-7 h-7 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">{t('fi_no_cashflow')}</p>
                  <p className="text-[13px] text-slate-400 mt-0.5">{t('fi_no_cashflow_hint')}</p>
                </div>
              ) : (
                <div className="h-64 w-full">
                  <Bar data={cashFlowData} options={cashFlowOptions} />
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-4">{t('fi_top_expenses')}</h2>
                {topExpenseCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">{t('fi_no_expenses_period')}</p>
                ) : (
                  <div className="space-y-3 text-xs">
                    {topExpenseCategories.map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-medium text-slate-700">{catLabel(cat)}</span>
                        <span className="font-bold text-slate-900">
                          ₹ {Number(amt).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setActiveTab('Expenses');
                  setShowAddExpense(true);
                }}
                className="w-full mt-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
              >
                {t('fi_record_new_expense')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">{t('fi_expense_ledger_n', { n: filteredExpenses.length })}</h2>
            <div className="flex items-center gap-2">
              <ExportMenu getSpec={getExpensesExport} onDone={showToast} />
              <button
                onClick={() => setShowAddExpense(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('fin_add_expense')}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[13px] font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">{t('fi_col_category')}</th>
                  <th className="py-3 px-4">{t('fi_col_description')}</th>
                  <th className="py-3 px-4">{t('fi_col_date')}</th>
                  <th className="py-3 px-4">{t('fi_col_payment')}</th>
                  <th className="py-3 px-4 text-right">{t('fi_col_amount')}</th>
                  <th className="py-3 px-4 text-right">{t('fi_col_action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expensePg.slice(filteredExpenses).map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{catLabel(e.category)}</td>
                    <td className="py-3 px-4 text-slate-600">{e.description || '—'}</td>
                    <td className="py-3 px-4 text-slate-500">{e.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{payLabel(e.payment_mode || 'Cash')}</td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600">
                      ₹ {Number(e.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title={t('fi_delete_expense_title')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      {t('fi_no_expenses')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={expensePg.page} pageSize={expensePg.pageSize} total={filteredExpenses.length} sizes={expensePg.sizes} onPage={expensePg.setPage} onPageSize={expensePg.setPageSize} />
        </div>
      )}

      {activeTab === 'Day Close' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Today's Cash Register */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t('fi_close_register')}</h2>
                <p className="text-xs text-slate-400">{t('fi_close_register_sub', { date: todayStr })}</p>
              </div>
              {closingSavedMsg && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('fi_saved')}
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-600 font-medium">{t('fi_opening_cash')}</span>
                <input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                  className="w-28 text-right bg-white border border-slate-200 rounded px-2 py-1 font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-600 font-medium">{t('fi_cash_sales_today')}</span>
                <span className="font-bold text-emerald-600">+ ₹ {cashSalesToday.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-600 font-medium">{t('fi_cash_expenses_today')}</span>
                <span className="font-bold text-rose-600">– ₹ {cashExpensesToday.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between bg-blue-50/70 p-3.5 rounded-lg border border-blue-200 font-bold text-sm">
                <span className="text-blue-900">{t('fi_expected_cash')}</span>
                <span className="text-blue-700">₹ {expectedCash.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  {t('fi_counted_label')}
                </label>
                <input
                  type="number"
                  placeholder={t('fi_counted_placeholder')}
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {countedCash !== '' && (
                <div
                  className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-between ${
                    difference === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <span>{t('fi_cash_diff')}</span>
                  <span>
                    {difference >= 0 ? `+ ₹ ${difference.toFixed(2)}` : `– ₹ ${Math.abs(difference).toFixed(2)}`}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('fi_closing_notes')}</label>
                <textarea
                  rows="2"
                  placeholder={t('fi_closing_notes_ph')}
                  value={closingRemarks}
                  onChange={(e) => setClosingRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <button
                onClick={handleRecordClosing}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm shadow-blue-200 transition-colors"
              >
                {t('fi_record_dayclose', { date: todayStr })}
              </button>
            </div>
          </div>

          {/* Historical Day Closings */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">{t('fi_past_closings')}</h3>
            </div>
            {dayClosings.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">
                {t('fi_no_closings')}
              </p>
            ) : (
              <>
              <div className="divide-y divide-slate-100 text-xs">
                {closingPg.slice(dayClosings).map((dc) => (
                  <div key={dc.id || dc.closing_date} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 font-mono">{dc.closing_date}</p>
                      <p className="text-[13px] text-slate-400">
                        {t('fi_expected_counted', { exp: Number(dc.system_expected_cash).toFixed(0), cnt: Number(dc.counted_cash).toFixed(0) })}
                      </p>
                      {dc.remarks && <p className="text-[13px] text-slate-500 mt-0.5 italic">"{dc.remarks}"</p>}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[13px] border ${
                        Number(dc.difference) === 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {Number(dc.difference) === 0
                        ? t('fi_matched')
                        : Number(dc.difference) > 0
                        ? `+₹${Number(dc.difference).toFixed(0)}`
                        : `–₹${Math.abs(Number(dc.difference)).toFixed(0)}`}
                    </span>
                  </div>
                ))}
              </div>
              <Pagination page={closingPg.page} pageSize={closingPg.pageSize} total={dayClosings.length} sizes={closingPg.sizes} onPage={closingPg.setPage} onPageSize={closingPg.setPageSize} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{t('fi_record_shop_expense')}</h3>
              <button onClick={() => setShowAddExpense(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('fi_category_req')}</label>
                <select
                  value={newExp.category}
                  onChange={(e) => setNewExp({ ...newExp, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                >
                  <option value="Shop Rent">{t('fi_cat_rent')}</option>
                  <option value="Salaries">{t('fi_cat_salaries')}</option>
                  <option value="Electricity">{t('fi_cat_electricity')}</option>
                  <option value="Transport">{t('fi_cat_transport')}</option>
                  <option value="Maintenance">{t('fi_cat_maintenance')}</option>
                  <option value="Others">{t('fi_cat_others')}</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('fi_description')}</label>
                <input
                  type="text"
                  placeholder={t('fi_desc_placeholder')}
                  value={newExp.description}
                  onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('fi_amount_req')}</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    placeholder="2500"
                    value={newExp.amount}
                    onChange={(e) => setNewExp({ ...newExp, amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('fi_date')}</label>
                  <input
                    type="date"
                    value={newExp.date}
                    onChange={(e) => setNewExp({ ...newExp, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1">{t('fi_payment_mode')}</label>
                <select
                  value={newExp.payment_mode}
                  onChange={(e) => setNewExp({ ...newExp, payment_mode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                >
                  <option value="Cash">{t('pos_cash')}</option>
                  <option value="UPI">{t('pos_upi')}</option>
                  <option value="Bank">{t('fi_pay_bank')}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t('cat_cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  {t('fi_save_expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
