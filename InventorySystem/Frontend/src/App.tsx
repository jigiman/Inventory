import { useState, useEffect } from 'react';
import { 
   LayoutDashboard, 
   Package, 
   Building2, 
   FileText, 
   Database, 
   TrendingUp, 
   Settings as SettingsIcon, 
   Menu,
   ShoppingCart,
   Wallet,
   Users
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Masters from './pages/Masters';
import Customers from './pages/Customers';
import Purchasing from './pages/Purchasing';
import Sales from './pages/Sales';
import Finance from './pages/Finance';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Launcher from './pages/Launcher';
import { api, setSessionToken } from './api';
import { getTheme, setTheme } from './utils/theme';
import type { Theme } from './utils/theme';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [darkMode, setDarkMode] = useState<Theme>(() => getTheme());
  const [storeName, setStoreName] = useState('Single Store Inventory');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [updateInfo, setUpdateInfo] = useState<{
    updateAvailable: boolean;
    latestVersion: string;
    currentVersion: string;
    downloadUrl: string;
  } | null>(null);
  const [hideUpdateBanner, setHideUpdateBanner] = useState(false);

  // Synchronize DOM with theme state
  useEffect(() => {
    setTheme(darkMode);
  }, [darkMode]);

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

  // Check for updates once database is ready
  useEffect(() => {
    if (launcherStatus !== 'READY') return;
    async function checkForUpdates() {
      try {
        const res = await api.checkUpdates();
        setUpdateInfo(res);
      } catch (e) {
        console.error('Failed to check for updates:', e);
      }
    }
    checkForUpdates();
  }, [launcherStatus]);


  const navigationItems = [
    { id: 'dashboard', text: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'products', text: 'Products', icon: <Package size={18} /> },
    { id: 'masters', text: 'Masters', icon: <Building2 size={18} /> },
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
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Package size={20} className="animate-pulse" />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-650 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">
              {storeName}
            </span>
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
        {updateInfo?.updateAvailable && !hideUpdateBanner && (
          <div className="mx-auto max-w-7xl px-8 pt-6 -mb-2">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-indigo-50/40 p-4 dark:bg-indigo-950/20 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/25 text-indigo-650 dark:text-indigo-400">
                  <TrendingUp size={16} className="animate-bounce" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Update Available!
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    A newer version <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">v{updateInfo.latestVersion}</span> is available (current: v{updateInfo.currentVersion}).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={updateInfo.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-indigo-605 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 transition-all duration-200"
                >
                  Download Update
                </a>
                <button
                  onClick={() => setHideUpdateBanner(true)}
                  className="rounded-xl p-2 text-slate-450 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mx-auto max-w-7xl p-8 lg:p-10 animate-in">
          {activePage === 'dashboard' && <Dashboard />}
          {activePage === 'products' && <Products />}
          {activePage === 'masters' && <Masters />}
          {activePage === 'customers' && <Customers />}
          {activePage === 'purchasing' && <Purchasing />}
          {activePage === 'sales' && <Sales />}
          {activePage === 'finance' && <Finance />}
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
