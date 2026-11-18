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
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#2563eb',
      },
    ],
  };

  const salesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `₹ ${context.parsed.y.toLocaleString('en-IN')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#64748b' },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: {
          maxTicksLimit: 5,
          font: { size: 11 },
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
    labels: categoryEntries.length > 0 ? categoryEntries.map(([c]) => c) : ['Empty'],
    datasets: [
      {
        data: categoryEntries.length > 0 ? categoryEntries.map(([, count]) => count) : [1],
        backgroundColor:
          categoryEntries.length > 0
            ? categoryEntries.map((_, idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length])
            : ['#e2e8f0'],
        borderWidth: 0,
      },
    ],
  };

  const categoryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    cutout: '72%',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live overview of inventory, sales and operations</p>
        </div>

        {/* Live Date Filter */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All Time">All Time</option>
          <option value="Today">Today</option>
          <option value="Last 7 Days">Last 7 Days</option>
          <option value="Last 30 Days">Last 30 Days</option>
        </select>
      </div>

      {/* 4 Metric Cards (Clean White Styling) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Card */}
        <div className="bg-white text-slate-800 rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Sales</span>
            <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold tracking-tight mt-2 text-slate-900">
            ₹ {Math.round(totalSales).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{dateRange}</span>
          </div>
        </div>

        {/* Orders Card */}
        <div className="bg-white text-slate-800 rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Orders</span>
            <span className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold tracking-tight mt-2 text-slate-900">
            {totalOrders.toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 font-medium">
            <span>Completed invoices</span>
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-white text-slate-800 rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Estimated Profit</span>
            <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <CircleDollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold tracking-tight mt-2 text-slate-900">
            ₹ {Math.round(totalProfit).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 mt-1 font-medium">
            <span>
              {totalSales > 0 ? `${((totalProfit / totalSales) * 100).toFixed(1)}% avg margin` : 'No sales yet'}
            </span>
          </div>
        </div>

        {/* Items in Stock Card */}
        <div className="bg-white text-slate-800 rounded-xl p-4 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Items in Stock</span>
            <span className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold tracking-tight mt-2 text-slate-900">
            {Number(totalUnits.toFixed(2)).toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1 text-[11px] mt-1 font-medium">
            <span className="text-slate-500">{items.length} SKUs</span>
            {outOfStockCount > 0 && (
              <span className="text-rose-600 font-bold">· {outOfStockCount} out of stock</span>
            )}
          </div>
        </div>
      </div>

      {/* Middle Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Line Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Sales Trend</h2>
            <p className="text-xs text-slate-400 mb-3">Revenue grouped by invoice date</p>
          </div>
          {validInvoices.length === 0 ? (
            <div className="h-56 w-full flex flex-col items-center justify-center text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
              <TrendingUp className="w-7 h-7 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">No sales recorded yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Complete a bill in POS Billing to see live revenue trends</p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <Line data={salesData} options={salesOptions} />
            </div>
          )}
        </div>

        {/* Stock by Category Donut Chart (1 col) */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Catalog by Category</h2>
            <p className="text-xs text-slate-400 mb-3">Live SKU distribution</p>
          </div>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
              <Package className="w-7 h-7 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">No products in catalog</p>
              <button
                onClick={() => navigate('/catalog')}
                className="text-[11px] font-semibold text-blue-600 hover:underline mt-1"
              >
                Add items in Catalog →
              </button>
            </div>
          ) : (
            <>
              <div className="relative h-40 w-full flex items-center justify-center my-2">
                <Doughnut data={categoryData} options={categoryOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-slate-900">{items.length}</span>
                  <span className="text-[11px] text-slate-400 font-medium">SKUs</span>
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
                      {cat} ({Math.round((count / totalSkus) * 100)}%)
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
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-amber-50 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Low Stock Alerts</h2>
            </div>
            <button
              onClick={() => navigate('/catalog')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">All inventory stock levels are healthy.</p>
            ) : (
              lowStockItems.map((item) => (
                <div
                  key={item.id || item.sku}
                  onClick={() => navigate(`/catalog?q=${encodeURIComponent(item.sku)}`)}
                  className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      {item.name} <span className="text-slate-400 font-normal">({item.sku})</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Shelf {item.bin_id || 'Unassigned'} · {item.category}
                    </p>
                  </div>
                  {Number(item.quantity) <= 0 ? (
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 animate-pulse">
                      0 left (Out of Stock)
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      {item.quantity} left
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Sales (1 col) */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Recent Sales</h2>
              </div>
              <button
                onClick={() => navigate('/history')}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
              >
                View All
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentSales.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No sales recorded yet.</p>
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
              className="w-full py-2 bg-blue-50 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Create New Bill (POS)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
