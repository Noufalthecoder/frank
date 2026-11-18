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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Finance() {
  const { t } = useLanguage();
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
      alert('Please fill amount');
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
    if (!confirm('Delete this expense entry?')) return;
    if (window.api && window.api.deleteExpense) {
      await window.api.deleteExpense(id);
      loadAllFinanceData();
    }
  };

  const handleExportExpensesCsv = () => {
    const headers = ['Date', 'Category', 'Description', 'Payment Mode', 'Amount'];
    const esc = (val) => {
      const s = String(val ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = filteredExpenses.map((e) => [
      esc(e.date || ''),
      esc(e.category || ''),
      esc(e.description || ''),
      esc(e.payment_mode || 'Cash'),
      Number(e.amount || 0).toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredExpenses.length} expense${filteredExpenses.length === 1 ? '' : 's'} to CSV.`);
  };

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
        label: 'Sales',
        data: sortedDates.length > 0 ? sortedDates.map((d) => dateMap[d].sales) : [0],
        backgroundColor: '#1e3a8a',
        borderRadius: 4,
      },
      {
        label: 'Expenses',
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
      alert('Please enter counted cash in drawer');
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
      setClosingSavedMsg(`Day Close recorded for ${todayStr}`);
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
                <p className="text-[11px] font-medium text-slate-400">Total Sales</p>
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
                <p className="text-[11px] font-medium text-slate-400">Total Expenses</p>
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
                <p className="text-[11px] font-medium text-slate-400">Net Cash Flow</p>
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
                <p className="text-[11px] font-medium text-slate-400">Gross Sales Margin</p>
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
                <h2 className="text-sm font-bold text-slate-900">Daily Cash Flow</h2>
                <p className="text-xs text-slate-400 mb-3">Live Sales vs Expenses breakdown</p>
              </div>
              {sortedDates.length === 0 ? (
                <div className="h-64 w-full flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                  <Wallet className="w-7 h-7 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">No cash flow data yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Record sales or expenses to populate daily cash flow</p>
                </div>
              ) : (
                <div className="h-64 w-full">
                  <Bar data={cashFlowData} options={cashFlowOptions} />
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-4">Top Expenses</h2>
                {topExpenseCategories.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">No expenses recorded in this period.</p>
                ) : (
                  <div className="space-y-3 text-xs">
                    {topExpenseCategories.map(([cat, amt]) => (
                      <div key={cat} className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-medium text-slate-700">{cat}</span>
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
                + Record New Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Expense Ledger ({filteredExpenses.length})</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExpensesCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('cat_export_csv')}</span>
              </button>
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
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">{e.category}</td>
                    <td className="py-3 px-4 text-slate-600">{e.description || '—'}</td>
                    <td className="py-3 px-4 text-slate-500">{e.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{e.payment_mode || 'Cash'}</td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600">
                      ₹ {Number(e.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No expenses recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Day Close' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Today's Cash Register */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Daily Cash Closing Register</h2>
                <p className="text-xs text-slate-400">Reconcile physical cash drawer for {todayStr}</p>
              </div>
              {closingSavedMsg && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-600 font-medium">Opening Cash (Start of Day):</span>
                <input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                  className="w-28 text-right bg-white border border-slate-200 rounded px-2 py-1 font-bold text-slate-800"
                />
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-600 font-medium">Today's Cash Sales (Live from POS):</span>
                <span className="font-bold text-emerald-600">+ ₹ {cashSalesToday.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-600 font-medium">Today's Cash Expenses (Live):</span>
                <span className="font-bold text-rose-600">– ₹ {cashExpensesToday.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between bg-blue-50/70 p-3.5 rounded-lg border border-blue-200 font-bold text-sm">
                <span className="text-blue-900">System Expected Cash:</span>
                <span className="text-blue-700">₹ {expectedCash.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Actual Physical Cash Counted (₹) *
                </label>
                <input
                  type="number"
                  placeholder="Enter exact drawer count"
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
                  <span>Cash Difference (Over / Short):</span>
                  <span>
                    {difference >= 0 ? `+ ₹ ${difference.toFixed(2)}` : `– ₹ ${Math.abs(difference).toFixed(2)}`}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Closing Notes</label>
                <textarea
                  rows="2"
                  placeholder="Optional remark on discrepancies or drawer handover..."
                  value={closingRemarks}
                  onChange={(e) => setClosingRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <button
                onClick={handleRecordClosing}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm shadow-blue-200 transition-colors"
              >
                Record Day Close ({todayStr})
              </button>
            </div>
          </div>

          {/* Historical Day Closings */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Past Day Closings</h3>
            </div>
            {dayClosings.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">
                No day closings recorded yet. Submit today's cash count to create your first record.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto">
                {dayClosings.map((dc) => (
                  <div key={dc.id || dc.closing_date} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 font-mono">{dc.closing_date}</p>
                      <p className="text-[11px] text-slate-400">
                        Expected: ₹{Number(dc.system_expected_cash).toFixed(0)} · Counted: ₹{Number(dc.counted_cash).toFixed(0)}
                      </p>
                      {dc.remarks && <p className="text-[11px] text-slate-500 mt-0.5 italic">"{dc.remarks}"</p>}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[11px] border ${
                        Number(dc.difference) === 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {Number(dc.difference) === 0
                        ? 'Matched'
                        : Number(dc.difference) > 0
                        ? `+₹${Number(dc.difference).toFixed(0)}`
                        : `–₹${Math.abs(Number(dc.difference)).toFixed(0)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Record Shop Expense</h3>
              <button onClick={() => setShowAddExpense(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category *</label>
                <select
                  value={newExp.category}
                  onChange={(e) => setNewExp({ ...newExp, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                >
                  <option value="Shop Rent">Shop Rent</option>
                  <option value="Salaries">Salaries</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Transport">Transport / Tempo</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly shop rent"
                  value={newExp.description}
                  onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Amount (₹) *</label>
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
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={newExp.date}
                    onChange={(e) => setNewExp({ ...newExp, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment Mode</label>
                <select
                  value={newExp.payment_mode}
                  onChange={(e) => setNewExp({ ...newExp, payment_mode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-blue-700"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
