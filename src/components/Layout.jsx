import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  Grid3X3,
  ShoppingCart,
  Receipt,
  Truck,
  Wallet,
  Settings,
  Search,
  Bell,
  Package,
  Layers,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  X,
  Languages
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

export default function Layout({ children }) {
  const { lang, setLang, t, tName } = useLanguage();
  const [globalSearch, setGlobalSearch] = useState('');
  const [outOfStockItems, setOutOfStockItems] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [shopProfile, setShopProfile] = useState({
    shop_name: 'T. S. P Enterprises',
    address_line1: 'Beach Road',
    address_line2: 'Tharuvaikulam',
  });
  const notifRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const fetchOutOfStock = async () => {
    if (window.api && window.api.getOutOfStockItems) {
      try {
        const zeroItems = await window.api.getOutOfStockItems();
        setOutOfStockItems(zeroItems || []);
      } catch (err) {
        console.error('Error fetching out-of-stock items:', err);
      }
    }
  };

  const fetchProfile = async () => {
    if (window.api && window.api.getShopProfile) {
      try {
        const p = await window.api.getShopProfile();
        if (p) setShopProfile(p);
      } catch (_) {}
    }
  };

  useEffect(() => {
    fetchOutOfStock();
    fetchProfile();

    const handleStockUpdate = () => {
      fetchOutOfStock();
    };
    const handleProfileUpdate = (e) => {
      if (e.detail) setShopProfile(e.detail);
      else fetchProfile();
    };

    window.addEventListener('stock-updated', handleStockUpdate);
    window.addEventListener('shop-profile-updated', handleProfileUpdate);

    // Close dropdown on outside click
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('stock-updated', handleStockUpdate);
      window.removeEventListener('shop-profile-updated', handleProfileUpdate);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navItems = [
    { name: t('nav_dashboard'), path: '/', icon: LayoutDashboard },
    { name: t('nav_catalog'), path: '/catalog', icon: Boxes },
    { name: t('nav_pos'), path: '/pos', icon: ShoppingCart },
    { name: t('nav_history'), path: '/history', icon: Receipt },
    { name: t('nav_vendors'), path: '/vendors', icon: Truck },
    { name: t('nav_finance'), path: '/finance', icon: Wallet },
    { name: t('nav_settings'), path: '/settings', icon: Settings },
  ];

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && globalSearch.trim()) {
      navigate(`/catalog?q=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  const handleNotifItemClick = (sku) => {
    setShowNotifDropdown(false);
    navigate(`/catalog?q=${encodeURIComponent(sku)}`);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-200">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-snug truncate">
                {shopProfile.shop_name || 'T. S. P Enterprises'}
              </h1>
              <p className="text-[11px] font-medium text-slate-400 truncate">
                {shopProfile.address_line1 || 'Beach Road'} · {shopProfile.address_line2 || 'Tharuvaikulam'}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <p className="text-xs font-semibold text-slate-700">StockMate v2.0</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('offline_ready')}</p>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20">
          {/* Global Search Bar */}
          <div className="relative w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('search_global')}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={handleSearchSubmit}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3">
            {/* Language Switcher Pill: EN / தமிழ் */}
            <div
              className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200"
              role="group"
              aria-label="Language switcher"
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                  lang === 'en'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('ta')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                  lang === 'ta'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                தமிழ்
              </button>
            </div>

            {/* Bell Notification Container */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown((prev) => !prev)}
                className={`relative p-2 rounded-lg transition-colors ${
                  showNotifDropdown ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                }`}
                title={t('notification_title')}
              >
                <Bell className="w-4 h-4" />
                {outOfStockItems.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
                    {outOfStockItems.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-84 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-700" />
                      <span className="text-xs font-bold text-slate-900">{t('notification_title')}</span>
                    </div>
                    {outOfStockItems.length > 0 ? (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                        {outOfStockItems.length} {t('out_of_stock_count')}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        {t('all_stock_healthy')}
                      </span>
                    )}
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {outOfStockItems.length === 0 ? (
                      <div className="p-6 text-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                        <p className="text-xs font-semibold text-slate-800">{t('no_notifications')}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{t('all_products_available')}</p>
                      </div>
                    ) : (
                      outOfStockItems.map((item) => (
                        <div
                          key={item.id || item.sku}
                          onClick={() => handleNotifItemClick(item.sku)}
                          className="p-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-rose-100">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                {tName(item.name)}
                              </p>
                              <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 flex-shrink-0">
                                0 {item.unit || 'PCS'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              SKU: <span className="font-mono font-medium text-slate-700">{item.sku}</span> · Rack: <span className="font-medium text-slate-700">{item.bin_id || 'Unassigned'}</span>
                            </p>
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 mt-1.5 group-hover:translate-x-0.5 transition-transform">
                              <span>{t('update_stock_catalog')}</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center border border-blue-200">
                AA
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 leading-tight">A. Adithya</p>
                <p className="text-[11px] text-slate-400 font-medium">{t('admin')}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
