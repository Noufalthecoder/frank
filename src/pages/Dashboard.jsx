import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  CircleDollarSign,
  Package,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  ArrowUpRight
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CATEGORY_COLORS = ['#2563eb', '#38bdf8', '#f59e0b', '#8b5cf6', '#10b981', '#94a3b8'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, tName, tCategory } = useLanguage();
  const [dateRange, setDateRange] = useState('All Time');
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const loadDashboardData = async () => {
    if (!window.api) return;
    try {
      const [itemList, invoiceList] = await Promise.all([
        window.api.getItems ? window.api.getItems() : [],
        window.api.getInvoices ? window.api.getInvoices() : [],
      ]);
      setItems(itemList || []);
      setInvoices(invoiceList || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const handleStockUpdate = () => loadDashboardData();
    window.addEventListener('stock-updated', handleStockUpdate);
    return () => window.removeEventListener('stock-updated', handleStockUpdate);
  }, []);

  // Date range filter
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

  const validInvoices = invoices.filter((i) => i.status !== 'Returned' && inRange(i.date_time));
  const totalSales = validInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  const totalOrders = validInvoices.length;
  const totalUnits = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  // Real margin profit calculation
  const costMap = {};
  items.forEach((i) => {
    if (i.sku) costMap[String(i.sku).toUpperCase()] = Number(i.cost_price) || 0;
  });

  const totalProfit = validInvoices.reduce((sum, inv) => {
    try {
      const lines = JSON.parse(inv.items_json || '[]');
      if (lines.length === 0) return sum + Number(inv.total || 0) * 0.25;
      const lineCost = lines.reduce(
        (c, l) => {
          const skuKey = String(l.sku || '').toUpperCase();
          const unitCost = costMap[skuKey] > 0 ? costMap[skuKey] : Number(l.rate || 0) * 0.72;
          const baseUnitsSold = Number(l.stock_deduction_qty ?? l.quantity ?? l.qty ?? 0);
          return c + baseUnitsSold * unitCost;
        },
        0
      );
      return sum + (Number(inv.total || 0) - lineCost);
    } catch (_) {
      return sum + Number(inv.total || 0) * 0.25;
    }
  }, 0);

  // Low stock & zero stock alerts
  const lowStockItems = items
    .filter((i) => (Number(i.quantity) || 0) <= (Number(i.reorder_level) || 15))
    .sort((a, b) => (Number(a.quantity) || 0) - (Number(b.quantity) || 0))
    .slice(0, 5);

  const outOfStockCount = items.filter((i) => (Number(i.quantity) || 0) <= 0).length;

  // Recent Sales (most recent 4 invoices)
  const recentSales = invoices.slice(0, 4);

  // Dynamic Sales Trend line chart grouped by date
  const salesByDate = {};
  validInvoices.forEach((inv) => {
    const key = String(inv.date_time || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    salesByDate[key] = (salesByDate[key] || 0) + (Number(inv.total) || 0);
  });
  const trendDates = Object.keys(salesByDate).sort().slice(-7);

  const salesData = {
    labels: trendDates.length > 0 ? trendDates.map((d) => d.slice(5)) : ['Today'],
    datasets: [
      {
        fill: true,
        label: 'Sales',
        data: trendDates.length > 0 ? trendDates.map((d) => salesByDate[d]) : [0],
        borderColor: '#2563eb',
        borderWidth: 2.5,
        backgroundColor: (context) => {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return 'rgba(37, 99, 235, 0.1)';
          const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
          grad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
          return grad;
        },
        tension: 0.35,
        pointRadius: 4.5,
        pointHoverRadius: 6.5,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
      },
    ],
  };

  const salesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#94a3b8',
        bodyColor: '#ffffff',
        titleFont: { size: 11, weight: '600' },
        bodyFont: { size: 13, weight: '700' },
        padding: 10,
        cornerRadius: 10,
        displayColors: false,
        callbacks: {
          label: (context) => `₹ ${context.parsed.y.toLocaleString('en-IN')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 11, weight: '500' }, color: '#64748b' },
      },
      y: {
        beginAtZero: true,
        border: { display: false, dash: [4, 4] },
        grid: { color: '#f1f5f9' },
        ticks: {
          maxTicksLimit: 5,
          font: { size: 11, weight: '500' },
          color: '#64748b',
          callback: (value) => {
            if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
            if (value >= 1000) {
              const k = value / 1000;
              return `₹${Number.isInteger(k) ? k : k.toFixed(1)}K`;
            }
            return `₹${Math.round(value)}`;
          },
        },
      },
    },
  };

  // Dynamic Stock By Category donut chart (by SKU count or stock units)
  const catCountMap = {};
  items.forEach((i) => {
    const cat = i.category || 'Others';
    catCountMap[cat] = (catCountMap[cat] || 0) + 1;
  });
  const categoryEntries = Object.entries(catCountMap).sort((a, b) => b[1] - a[1]);
  const totalSkus = items.length || 1;

  const categoryData = {
    labels: categoryEntries.length > 0 ? categoryEntries.map(([c]) => tCategory(c)) : ['Empty'],
    datasets: [
      {
        data: categoryEntries.length > 0 ? categoryEntries.map(([, count]) => count) : [1],
        backgroundColor:
          categoryEntries.length > 0
            ? categoryEntries.map((_, idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length])
            : ['#e2e8f0'],
        borderWidth: categoryEntries.length > 1 ? 3 : 0,
        borderColor: '#ffffff',
        hoverOffset: 6,
      },
    ],
  };

  const categoryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        padding: 10,
        cornerRadius: 10,
        boxPadding: 6,
        titleFont: { size: 12, weight: '700' },
        bodyFont: { size: 12, weight: '600' },
        callbacks: {
          label: (context) => {
            const count = context.parsed || 0;
            const pct = Math.round((count / totalSkus) * 100);
            return ` ${count} ${t('dash_skus')} (${pct}%)`;
          },
        },
      },
    },
    cutout: '75%',
  };

  const dateRangeLabel =
    dateRange === 'Today'
      ? t('date_today')
      : dateRange === 'Last 7 Days'
      ? t('date_7d')
      : dateRange === 'Last 30 Days'
      ? t('date_30d')
      : t('date_all');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-slate-900 tracking-[-0.025em]">{t('dash_title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">{t('dash_subtitle')}</p>
        </div>

        {/* Live Date Filter */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3.5 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 transition-all"
        >
          <option value="All Time">{t('date_all')}</option>
          <option value="Today">{t('date_today')}</option>
          <option value="Last 7 Days">{t('date_7d')}</option>
          <option value="Last 30 Days">{t('date_30d')}</option>
        </select>
      </div>

      {/* 4 Metric Cards (Clean White Elevated Styling) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Card */}
        <div className="surface-card-interactive rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('dash_sales')}</span>
            <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600 ring-1 ring-inset ring-emerald-200/70">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-[28px] font-extrabold tracking-[-0.03em] mt-2.5 text-slate-900 tabular-nums leading-none">
            ₹ {Math.round(totalSales).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-2.5 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{dateRangeLabel}</span>
          </div>
        </div>

        {/* Orders Card */}
        <div className="surface-card-interactive rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('dash_orders')}</span>
            <span className="p-2 bg-blue-50 rounded-xl text-blue-600 ring-1 ring-inset ring-blue-200/70">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <p className="text-[28px] font-extrabold tracking-[-0.03em] mt-2.5 text-slate-900 tabular-nums leading-none">
            {totalOrders.toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-2.5 font-medium">
            <span>{t('dash_completed_invoices')}</span>
          </div>
        </div>

        {/* Profit Card */}
        <div className="surface-card-interactive rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('dash_profit')}</span>
            <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600 ring-1 ring-inset ring-emerald-200/70">
              <CircleDollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-[28px] font-extrabold tracking-[-0.03em] mt-2.5 text-slate-900 tabular-nums leading-none">
            ₹ {Math.round(totalProfit).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-2.5 font-semibold tabular-nums">
            <span>
              {totalSales > 0 ? `${((totalProfit / totalSales) * 100).toFixed(1)}% ${t('dash_avg_margin')}` : t('dash_no_sales_yet')}
            </span>
          </div>
        </div>

        {/* Items in Stock Card */}
        <div className="surface-card-interactive rounded-2xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('dash_items_in_stock')}</span>
            <span className="p-2 bg-amber-50 rounded-xl text-amber-600 ring-1 ring-inset ring-amber-200/70">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <p className="text-[28px] font-extrabold tracking-[-0.03em] mt-2.5 text-slate-900 tabular-nums leading-none">
            {Number(totalUnits.toFixed(2)).toLocaleString('en-IN')}
          </p>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] mt-2.5 font-medium tabular-nums">
            <span className="text-slate-500 whitespace-nowrap">{items.length} {t('dash_skus')}</span>
            {outOfStockCount > 0 && (
              <span className="text-rose-600 font-bold whitespace-nowrap">· {outOfStockCount} {t('dash_out_of_stock')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Middle Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Line Chart (2 cols) */}
        <div className="lg:col-span-2 surface-card rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t('dash_sales_trend')}</h2>
            <p className="text-xs text-slate-400 mb-4">{t('dash_sales_trend_sub')}</p>
          </div>
          {validInvoices.length === 0 ? (
            <div className="h-56 w-full flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
              <TrendingUp className="w-7 h-7 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">{t('dash_no_sales_recorded')}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{t('dash_complete_bill_hint')}</p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <Line data={salesData} options={salesOptions} />
            </div>
          )}
        </div>

        {/* Stock by Category Donut Chart (1 col) */}
        <div className="surface-card rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t('dash_catalog_category')}</h2>
            <p className="text-xs text-slate-400 mb-3">{t('dash_sku_dist')}</p>
          </div>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
              <Package className="w-7 h-7 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">{t('dash_no_products')}</p>
              <button
                onClick={() => navigate('/catalog')}
                className="text-[11px] font-semibold text-blue-600 hover:underline mt-1"
              >
                {t('dash_add_in_catalog')}
              </button>
            </div>
          ) : (
            <>
              <div className="relative h-40 w-full flex items-center justify-center my-2">
                <div className="absolute inset-0 z-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-slate-900 tabular-nums">{items.length}</span>
                  <span className="text-[11px] text-slate-400 font-medium">{t('dash_skus')}</span>
                </div>
                <div className="relative z-10 w-full h-full">
                  <Doughnut data={categoryData} options={categoryOptions} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-[11px] text-slate-600 mt-3 pt-3 border-t border-slate-100">
                {categoryEntries.map(([cat, count], idx) => (
                  <div key={cat} className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                    />
                    <span className="truncate">
                      {tCategory(cat)} ({Math.round((count / totalSkus) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Grid: Low Stock Alerts & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts (2 cols) */}
        <div className="lg:col-span-2 surface-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-amber-50 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">{t('dash_low_stock')}</h2>
            </div>
            <button
              onClick={() => navigate('/catalog')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('dash_view_all')}
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{t('dash_all_healthy')}</p>
            ) : (
              lowStockItems.map((item) => (
                <div
                  key={item.id || item.sku}
                  onClick={() => navigate(`/catalog?q=${encodeURIComponent(item.sku)}`)}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      {tName(item.name)} <span className="text-slate-400 font-normal">({item.sku})</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {t('dash_shelf')} {item.bin_id || 'Unassigned'} · {tCategory(item.category)}
                    </p>
                  </div>
                  {Number(item.quantity) <= 0 ? (
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 animate-pulse">
                      {t('dash_zero_left')}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      {item.quantity} {t('dash_left')}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Sales (1 col) */}
        <div className="surface-card rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">{t('dash_recent_sales')}</h2>
              </div>
              <button
                onClick={() => navigate('/history')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                {t('dash_view_all')}
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentSales.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">{t('dash_no_sales_recorded')}</p>
              ) : (
                recentSales.map((sale) => (
                  <div
                    key={sale.id || sale.invoice_number}
                    onClick={() => navigate('/history')}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                        {sale.customer_name || 'Walk-in Customer'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        <span className="font-mono text-slate-600 font-medium">{sale.invoice_number}</span> · {sale.items_count || 1} items · {sale.date_time ? String(sale.date_time).slice(5, 16) : 'Today'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-bold ${sale.status === 'Returned' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        ₹ {Number(sale.total || 0).toLocaleString('en-IN')}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${
                          sale.status === 'Returned'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : sale.payment_mode === 'Cash'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : sale.payment_mode === 'UPI'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {sale.status === 'Returned' ? 'Returned' : sale.payment_mode || 'Cash'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4">
            <button
              onClick={() => navigate('/pos')}
              className="w-full py-2.5 bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{t('dash_create_bill')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
