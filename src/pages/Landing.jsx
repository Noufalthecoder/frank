import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Boxes,
  Receipt,
  Truck,
  Wallet,
  Grid3X3,
  LayoutDashboard,
  ArrowRight,
  IndianRupee,
  FileText,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

const ADMIN_NAME = 'Franklin';

export default function Landing() {
  const { lang, t } = useLanguage();
  const [stats, setStats] = useState({ sales: 0, bills: 0, alerts: 0 });
  const [shop, setShop] = useState({ shop_name: 'T. S. P Enterprises' });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!window.api) return;
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const [invoices, items, profile] = await Promise.all([
          window.api.getInvoices?.() || [],
          window.api.getItems?.() || [],
          window.api.getShopProfile?.() || null,
        ]);
        if (!alive) return;
        const todays = (invoices || []).filter(
          (i) => String(i.date_time || '').startsWith(today) && i.status !== 'Returned' && i.status !== 'Cancelled'
        );
        setStats({
          sales: todays.reduce((sum, i) => sum + (Number(i.total) || 0), 0),
          bills: todays.length,
          alerts: (items || []).filter((i) => Number(i.quantity) <= Number(i.reorder_level || 0)).length,
        });
        if (profile) setShop(profile);
      } catch (_) {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('lp_morning') : hour < 17 ? t('lp_afternoon') : t('lp_evening');
  const dateText = new Date().toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const statCards = [
    { icon: IndianRupee, label: t('lp_today_sales'), value: `₹ ${stats.sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, tone: 'text-emerald-600 bg-emerald-50' },
    { icon: FileText, label: t('lp_bills_today'), value: stats.bills, tone: 'text-blue-600 bg-blue-50' },
    { icon: AlertTriangle, label: t('lp_low_stock'), value: stats.alerts, tone: 'text-rose-600 bg-rose-50' },
  ];

  const links = [
    { to: '/catalog', icon: Boxes, name: t('nav_catalog'), desc: t('lp_d_catalog') },
    { to: '/history', icon: Receipt, name: t('nav_history'), desc: t('lp_d_history') },
    { to: '/vendors', icon: Truck, name: t('nav_vendors'), desc: t('lp_d_vendors') },
    { to: '/finance', icon: Wallet, name: t('nav_finance'), desc: t('lp_d_finance') },
    { to: '/settings?tab=racks', icon: Grid3X3, name: t('set_tab_racks'), desc: t('lp_d_racks') },
    { to: '/dashboard', icon: LayoutDashboard, name: t('nav_dashboard'), desc: t('lp_d_dashboard') },
  ];

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white p-8 md:p-10 shadow-xl shadow-blue-600/20">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10" />
        <div className="absolute right-24 -bottom-20 w-52 h-52 rounded-full bg-white/10" />
        <div className="relative">
          <div className="flex items-center gap-2 text-blue-100 text-xs font-semibold">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </span>
            <span>{shop.shop_name}</span>
            <span className="opacity-60">·</span>
            <span>{dateText}</span>
          </div>
          <h1 className="mt-5 text-3xl md:text-4xl font-extrabold tracking-[-0.03em]">
            {greeting}, {ADMIN_NAME}
          </h1>
          <p className="mt-2 text-sm md:text-base text-blue-100">{t('lp_sub')}</p>
          <Link
            to="/pos"
            className="mt-6 inline-flex items-center gap-2 bg-white text-blue-700 font-bold text-sm px-5 py-3 rounded-xl shadow-lg hover:bg-blue-50 active:scale-[0.98] transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            {t('lp_start_billing')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Today at a glance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="surface-card rounded-2xl p-5 flex items-center gap-4">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.tone}`}>
                <Icon className="w-5 h-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-[-0.02em]">{c.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick access */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('lp_quick_access')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.to}
                to={l.to}
                className="group surface-card rounded-2xl p-4 flex items-center gap-3.5 hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Icon className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{l.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{l.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
