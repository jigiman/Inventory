import { useState, useEffect } from 'react';
import { 
   LayoutDashboard, 
   Package, 
   Building2, 
   Truck,
   FileText, 
   Database, 
   TrendingUp, 
   Settings as SettingsIcon, 
   Menu,
   ShoppingCart,
   Wallet,
   Users,
   RotateCw
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Masters from './pages/Masters';
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import Customers from './pages/Customers';
import Purchasing from './pages/Purchasing';
import Sales from './pages/Sales';
import Finance from './pages/Finance';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Launcher from './pages/Launcher';
import UpdateBanner from './components/UpdateBanner';
import { api, setSessionToken } from './api';
import { getTheme, setTheme } from './utils/theme';
import type { Theme } from './utils/theme';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState<Theme>(() => getTheme());
  const [storeName, setStoreName] = useState('Single Store Inventory');
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Fetch application version
  useEffect(() => {
    async function loadVersion() {
      try {
        const res = await api.getUpdateStatus();
        if (res?.currentVersion) {
          setAppVersion(res.currentVersion);
        }
      } catch {
        // Ignore fallback
      }
    }
    loadVersion();
  }, []);

  // Synchronize DOM with theme state
  useEffect(() => {
    setTheme(darkMode);
  }, [darkMode]);

  const isDevMode = import.meta.env.DEV || window.location.search.includes('dev=true');

  // Global keyboard shortcuts for refreshing UI (Development mode only)
  useEffect(() => {
    if (!isDevMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        window.location.reload();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDevMode]);

  // Detect desktop environment and apply scaling class
  useEffect(() => {
    const isDesktop = window.location.search.includes('desktop=true') || 
                      (window as any).chrome?.webview !== undefined || 
                      (window as any).webkit?.messageHandlers !== undefined;
    if (isDesktop) {
      document.documentElement.classList.add('desktop-app');
    }
  }, []);

  // Launcher / DB selection state
  type LauncherStatus = 'checking' | 'NOT_INITIALIZED' | 'READY';
  const [launcherStatus, setLauncherStatus] = useState<LauncherStatus>('checking');
  const [recentDatabases, setRecentDatabases] = useState<{ name: string; path: string; lastOpened: string }[]>([]);

  // Check launcher status — retry until backend is up
  useEffect(() => {
    let cancelled = false;
    async function checkLauncher() {
      while (!cancelled) {
        try {
          const res = await api.getLauncherStatus();
          if (!cancelled) {
            setRecentDatabases(res.recentDatabases);
            if (res.sessionToken) {
              setSessionToken(res.sessionToken);
            }
            setLauncherStatus(res.status);
            if (res.theme === 'light' || res.theme === 'dark') {
              setDarkMode(res.theme);
            }
          }
          return;
        } catch {
          // Backend not up yet — wait and retry
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
    checkLauncher();
    return () => { cancelled = true; };
  }, []);

  // Load Store Name
  useEffect(() => {
    if (launcherStatus !== 'READY') return;
    async function loadStoreName() {
      try {
        const settings = await api.getSettings();
        const nameSetting = settings.find(s => s.key === 'StoreName');
        if (nameSetting) setStoreName(nameSetting.value);
      } catch (e) {
        // Fallback to default name
      }
    }
    loadStoreName();
  }, [activePage, launcherStatus]);

  const navigationItems = [
    { id: 'dashboard', text: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'products', text: 'Products', icon: <Package size={18} /> },
    { id: 'masters', text: 'Masters', icon: <Building2 size={18} /> },
    { id: 'suppliers', text: 'Suppliers', icon: <Truck size={18} /> },
    { id: 'customers', text: 'Customers', icon: <Users size={18} /> },
    { id: 'purchasing', text: 'Purchasing', icon: <FileText size={18} /> },
    { id: 'sales', text: 'Sales', icon: <ShoppingCart size={18} /> },
    { id: 'finance', text: 'Finance', icon: <Wallet size={18} /> },
    { id: 'inventory', text: 'Stock Ledger', icon: <Database size={18} /> },
    { id: 'reports', text: 'Reports', icon: <TrendingUp size={18} /> },
    { id: 'settings', text: 'Settings', icon: <SettingsIcon size={18} /> },
  ];

  return (
    <>
      {/* Launcher screen — shown before a database is selected */}
      {launcherStatus === 'checking' && (
        <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950 via-[#0d1220] to-indigo-950">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-slate-400">Starting…</p>
          </div>
        </div>
      )}

      {launcherStatus === 'NOT_INITIALIZED' && (
        <Launcher
          recentDatabases={recentDatabases}
          onReady={() => setLauncherStatus('READY')}
        />
      )}

      {/* Main app shell — only rendered once DB is ready */}
      {launcherStatus === 'READY' && (
        <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-[#070b13] dark:text-slate-100 transition-colors duration-300">
          {/* Top Navigation Bar with glassmorphism */}
          <header className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/50 bg-white/80 px-8 backdrop-blur-lg dark:border-slate-800/40 dark:bg-slate-950/80">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 transition-all duration-300 cursor-pointer shadow-sm border border-slate-200/30 dark:border-slate-800"
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Menu size={18} />
              </button>
              {isDevMode && (
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 transition-all duration-300 cursor-pointer shadow-sm border border-slate-200/30 dark:border-slate-800"
                  title="Refresh UI (Dev Mode Only)"
                >
                  <RotateCw size={18} />
                </button>
              )}
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
                  <Package size={20} className="animate-pulse" />
                </div>
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-650 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">
                  {storeName}
                </span>
                {appVersion && (
                  <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800/60 dark:text-indigo-300 font-mono shadow-2xs">
                    v{appVersion}
                  </span>
                )}
              </div>
            </div>
          </header>

          {/* Sidebar Navigation */}
          <aside className={`fixed bottom-0 top-16 left-0 z-30 ${isSidebarCollapsed ? 'w-20' : 'w-64'} border-r border-slate-200/50 bg-white/50 pt-8 backdrop-blur-md dark:border-slate-800/40 dark:bg-slate-950/40 transition-all duration-300`}>
            <nav className="space-y-2 px-3">
              {navigationItems.map((item) => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={`relative flex w-full items-center ${isSidebarCollapsed ? 'justify-center px-0 py-3.5' : 'space-x-3.5 px-4 py-3'} rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer group active:scale-[0.98] ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10' 
                        : 'text-slate-650 hover:bg-slate-100/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/60 dark:hover:text-slate-205'
                    }`}
                    title={isSidebarCollapsed ? item.text : undefined}
                  >
                    <span className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && <span>{item.text}</span>}
                    {isActive && !isSidebarCollapsed && (
                      <div className="absolute right-3 h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Content Pane */}
          <main className={`flex-1 ${isSidebarCollapsed ? 'pl-20' : 'pl-64'} pt-16 transition-all duration-300`}>
            <UpdateBanner />
            <div className="mx-auto max-w-7xl p-8 lg:p-10 animate-in">
              {activePage === 'dashboard' && <Dashboard />}
              {activePage === 'products' && <Products />}
              {activePage === 'masters' && <Masters />}
              {activePage === 'suppliers' && (
                <Suppliers
                  onSelectSupplier={(id) => {
                    setSelectedSupplierId(id);
                    setActivePage('supplier-detail');
                  }}
                />
              )}
              {activePage === 'supplier-detail' && selectedSupplierId != null && (
                <SupplierDetail
                  supplierId={selectedSupplierId}
                  onBack={() => setActivePage('suppliers')}
                />
              )}
              {activePage === 'customers' && <Customers />}
              {activePage === 'purchasing' && <Purchasing />}
              {activePage === 'sales' && <Sales />}
              {activePage === 'finance' && (
                <Finance
                  onSelectSupplier={(id) => {
                    setSelectedSupplierId(id);
                    setActivePage('supplier-detail');
                  }}
                />
              )}
              {activePage === 'inventory' && <Inventory />}
              {activePage === 'reports' && <Reports />}
              {activePage === 'settings' && <Settings />}
            </div>
          </main>
        </div>
      )}
    </>
  );
}
