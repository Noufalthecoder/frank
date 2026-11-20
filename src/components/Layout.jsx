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
  Languages,
  Store,
  Users,
  Printer,
  Sliders,
  Database
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
  const globalSearchRef = useRef(null);
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
    const handleGlobalShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        globalSearchRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleGlobalShortcut);

    return () => {
      window.removeEventListener('stock-updated', handleStockUpdate);
      window.removeEventListener('shop-profile-updated', handleProfileUpdate);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleGlobalShortcut);
    };
  }, []);

  const navItems = [
    { name: t('nav_dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { name: t('nav_pos'), path: '/pos', icon: ShoppingCart },
    { name: t('nav_history'), path: '/history', icon: Receipt },
    { name: t('nav_catalog'), path: '/catalog', icon: Boxes },
    { name: t('nav_vendors'), path: '/vendors', icon: Truck },
    { name: t('nav_finance'), path: '/finance', icon: Wallet },
    { name: t('nav_settings'), path: '/settings', icon: Settings },
  ];

  const settingsSubItems = [
    { id: 'profile', label: t('set_tab_profile'), icon: Store },
    { id: 'racks', label: t('set_tab_racks'), icon: Grid3X3 },
    { id: 'users', label: t('set_tab_users'), icon: Users },
    { id: 'print', label: t('set_tab_print'), icon: Printer },
    { id: 'prefs', label: t('set_tab_prefs'), icon: Sliders },
    { id: 'db', label: t('set_tab_db'), icon: Database },
  ];
  const onSettings = location.pathname === '/settings';
  const activeSettingsTab = new URLSearchParams(location.search).get('tab') || 'profile';

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
    <div className="flex h-screen w-screen overflow-hidden bg-[#f6f8fb] text-slate-800">
      {/* Sidebar (ZenoHosp style) */}
      <aside className="w-[280px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between">
        <div className="flex flex-col min-h-0">
          {/* Brand header */}
          <div className="flex items-center gap-3 px-6 min-h-[72px] border-b border-slate-200">
            {shopProfile.logo_data ? (
              <img src={shopProfile.logo_data} alt="" className="h-10 w-10 rounded-xl object-contain flex-shrink-0 bg-white" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0 py-2">
              <h1 className="text-[19px] font-extrabold text-slate-950 tracking-[-0.03em] leading-tight truncate">
                {shopProfile.shop_name || 'T. S. P Enterprises'}
              </h1>
            </div>
          </div>

          {/* Navigation: POS Billing first, then a gap, then the rest */}
          <nav className="py-5 flex flex-col gap-1.5 overflow-y-auto">
            {navItems.map((item, idx) => {
              const isActive = location.pathname === item.path;
              return (
                <React.Fragment key={item.path}>
                  <NavLink
                    to={item.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex items-center gap-3 ml-4 mr-4 px-3.5 py-3 rounded-lg text-[15px] font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {isActive && (
                      <span aria-hidden="true" className="absolute -left-4 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r bg-blue-600" />
                    )}
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} strokeWidth={1.75} />
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                  {item.path === '/settings' && onSettings && (
                    <div className="ml-4 mr-4 mb-1 flex flex-col gap-1">
                      {settingsSubItems.map((sub) => {
                        const subActive = activeSettingsTab === sub.id;
                        return (
                          <NavLink
                            key={sub.id}
                            to={`/settings?tab=${sub.id}`}
                            className={`flex items-center gap-3 pl-9 pr-3 py-2 rounded-lg text-[14px] font-medium transition-colors ${
                              subActive
                                ? 'bg-blue-50 text-blue-700 font-semibold'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <sub.icon className={`w-4 h-4 flex-shrink-0 ${subActive ? 'text-blue-600' : 'text-slate-400'}`} strokeWidth={1.75} />
                            <span className="truncate">{sub.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                  {idx === 0 && <div className="h-5" aria-hidden="true" />}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Admin Profile Card */}
        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/70 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm ring-2 ring-blue-100 flex-shrink-0">
              FR
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 leading-tight truncate group-hover:text-blue-700 transition-colors">
                Franklin
              </p>
              <p className="text-[13px] text-slate-400 font-medium truncate mt-0.5">{t('admin')}</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Glassmorphic Top Header */}
        <header className="h-[72px] bg-white/85 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-6 z-20 flex-shrink-0">
          {/* Global Search Bar with Ctrl+K Shortcut */}
          <div className="relative w-[28rem] max-w-lg group">
            <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={globalSearchRef}
              type="text"
              placeholder={t('search_global')}
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={handleSearchSubmit}
              className="w-full bg-slate-100/70 hover:bg-slate-100 border border-slate-200/80 rounded-xl pl-10 pr-14 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 focus:bg-white transition-all font-medium"
            />
            {globalSearch ? (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[12px] font-semibold text-slate-400 bg-white border border-slate-200/90 rounded-md shadow-2xs">
                Ctrl K
              </kbd>
            )}
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3">
            {/* Language Switcher Pill: EN / தமிழ் */}
            <div
              className="flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/80"
              role="group"
              aria-label={t('fi_lang_switcher')}
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-lg text-[13px] font-bold transition-all ${
                  lang === 'en'
                    ? 'bg-white text-blue-600 shadow-xs ring-1 ring-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('ta')}
                className={`px-2.5 py-1 rounded-lg text-[13px] font-bold transition-all ${
                  lang === 'ta'
                    ? 'bg-white text-blue-600 shadow-xs ring-1 ring-slate-200/60'
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
                className={`relative p-2 rounded-xl border transition-all ${
                  showNotifDropdown
                    ? 'bg-slate-100 border-slate-200 text-slate-900'
                    : 'bg-white border-slate-200/80 text-slate-500 hover:text-slate-800 hover:bg-slate-50 hover:border-slate-300/80 shadow-2xs'
                }`}
                title={t('notification_title')}
              >
                <Bell className="w-4 h-4" />
                {outOfStockItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[12px] font-bold text-white shadow-sm ring-2 ring-white tabular-nums">
                    {outOfStockItems.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifDropdown && (
                <div className="animate-popover absolute right-0 mt-2 w-84 bg-white rounded-2xl shadow-2xl shadow-slate-900/12 border border-slate-200/90 overflow-hidden z-50">
                  <div className="px-4 py-3 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-700" />
                      <span className="text-xs font-bold text-slate-900">{t('notification_title')}</span>
                    </div>
                    {outOfStockItems.length > 0 ? (
                      <span className="text-[12px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200 tabular-nums">
                        {outOfStockItems.length} {t('out_of_stock_count')}
                      </span>
                    ) : (
                      <span className="text-[12px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
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
                        <p className="text-[13px] text-slate-400 mt-0.5">{t('all_products_available')}</p>
                      </div>
                    ) : (
                      outOfStockItems.map((item) => (
                        <div
                          key={item.id || item.sku}
                          onClick={() => handleNotifItemClick(item.sku)}
                          className="p-3.5 hover:bg-blue-50/40 transition-colors cursor-pointer flex items-start gap-3 group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-rose-200/70">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                {tName(item.name)}
                              </p>
                              <span className="text-[12px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200 flex-shrink-0 tabular-nums">
                                0 {item.unit || 'PCS'}
                              </span>
                            </div>
                            <p className="text-[13px] text-slate-500 mt-0.5 truncate">
                              {t('cat_col_sku')}: <span className="font-mono font-medium text-slate-700">{item.sku}</span> · {t('fi_rack')}: <span className="font-medium text-slate-700">{item.bin_id || t('fi_unassigned')}</span>
                            </p>
                            <div className="flex items-center gap-1 text-[12px] font-semibold text-blue-600 mt-1.5 group-hover:translate-x-0.5 transition-transform">
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
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#f6f8fb]">
          <div className="w-full max-w-[2000px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
