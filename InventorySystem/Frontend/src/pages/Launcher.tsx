import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Database, Clock, ChevronRight, AlertCircle, Loader2, Package, Trash2 } from 'lucide-react';
import { api, setSessionToken } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { pickOpenFile, pickSaveFile, isPhotino } from '../utils/photino';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface RecentDatabase {
  name: string;
  path: string;
  lastOpened: string;
}

interface LauncherProps {
  recentDatabases: RecentDatabase[];
  onReady: () => void;
}

type Tab = 'recent' | 'new';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Launcher({ recentDatabases, onReady }: LauncherProps) {
  const [tab, setTab] = useState<Tab>(recentDatabases.length > 0 ? 'recent' : 'new');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Local state for recent databases
  const [recents, setRecents] = useState<RecentDatabase[]>(recentDatabases);
  useEffect(() => {
    setRecents(recentDatabases);
  }, [recentDatabases]);

  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);

  // "New database" form
  const [newPath, setNewPath] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // "Open with password" (if needed)
  const [selectedDbPath, setSelectedDbPath] = useState<string | null>(null);
  const [openPassword, setOpenPassword] = useState('');



  // ── actions ────────────────────────────────────────────────────────────────

  const handleOpen = async (path: string, password?: string) => {
    if (!path.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.openDatabase(path.trim(), password);
      if (res.sessionToken) {
        setSessionToken(res.sessionToken);
      }
      onReady();
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('file is not a database') || msg.includes('authentication') || msg.includes('password')) {
        setSelectedDbPath(path);
        setError('Database is encrypted. Please provide the password.');
      } else {
        setError(e.message || 'Failed to open database.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecent = async () => {
    if (!confirmDeletePath) return;
    setLoading(true);
    try {
      const res = await api.removeRecentDatabase(confirmDeletePath);
      setRecents(res.recentDatabases);
      setConfirmDeletePath(null);
    } catch (e: any) {
      setError(e.message || 'Failed to remove database reference.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickOpen = async () => {
    if (inPhotino) {
      const path = await pickOpenFile();
      if (path) await handleOpen(path);
    } else {
      setLoading(true);
      setError('');
      try {
        const res = await api.pickDatabaseFile();
        if (res && res.path) {
          await handleOpen(res.path);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to open file picker.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePickSave = async () => {
    const path = await pickSaveFile();
    if (path) setNewPath(path);
  };

  const handleCreate = async () => {
    if (!newPath.trim()) {
      setError('Please choose a save location for the new database.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.createDatabase(newPath.trim(), newName.trim() || undefined, newPassword.trim() || undefined);
      if (res.sessionToken) {
        setSessionToken(res.sessionToken);
      }
      onReady();
    } catch (e: any) {
      setError(e.message || 'Failed to create database.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.loadDemoDatabase();
      if (res.sessionToken) {
        setSessionToken(res.sessionToken);
      }
      onReady();
    } catch (e: any) {
      setError(e.message || 'Failed to load demo database.');
    } finally {
      setLoading(false);
    }
  };

  const inPhotino = isPhotino();

  return (
    <div className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-slate-50 via-slate-100/50 to-indigo-50 dark:from-slate-950 dark:via-[#0d1220] dark:to-indigo-950 transition-colors duration-300">


      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/10 dark:bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-600/5 dark:bg-violet-600/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-2xl" />
      </div>

      <div className="flex min-h-full items-center justify-center p-6">
        <div className="relative z-10 w-full max-w-lg animate-in py-8">
          {/* Logo + title */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-2xl shadow-indigo-500/40">
              <Package size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Single Store Inventory</h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Select or create a database to get started</p>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 backdrop-blur-2xl">
            {/* Tab bar */}
            <div className="flex border-b border-slate-200/80 dark:border-white/10">
              {[
                { id: 'recent' as Tab, label: 'Open Recent', icon: <Clock size={15} /> },
                { id: 'new' as Tab, label: 'New Database', icon: <Plus size={15} /> },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setError(''); }}
                  className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-semibold transition-all duration-200 cursor-pointer first:rounded-tl-3xl last:rounded-tr-3xl ${
                    tab === t.id
                      ? 'bg-slate-100/80 dark:bg-white/10 text-slate-900 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Error banner */}
              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-600 dark:text-rose-300">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* ── Recent tab ──────────────────────────────────────────────────── */}
              {tab === 'recent' && (
                <div className="space-y-3">
                  {/* Password prompt for encrypted DB */}
                  {selectedDbPath && (
                    <div className="mb-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 animate-in slide-in-from-top-2">
                      <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Database size={16} className="text-indigo-500" />
                        Enter password for: <span className="text-indigo-600 dark:text-indigo-400">{selectedDbPath.split(/[\\/]/).pop()}</span>
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="Database password"
                          value={openPassword}
                          onChange={e => setOpenPassword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleOpen(selectedDbPath, openPassword)}
                          className="flex-1"
                          autoFocus
                        />
                        <Button onClick={() => handleOpen(selectedDbPath, openPassword)} disabled={loading}>
                          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Unlock'}
                        </Button>
                        <Button variant="outline" onClick={() => { setSelectedDbPath(null); setOpenPassword(''); setError(''); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {recents.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-555 dark:text-slate-500">No recent databases found.</p>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto pr-1 space-y-3">
                      {recents.map((db) => (
                        <div
                          key={db.path}
                          className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200/60 dark:border-white/8 bg-white/40 dark:bg-white/5 p-4 text-left transition-all duration-200 hover:border-indigo-500/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/10"
                        >
                          <button
                            onClick={() => handleOpen(db.path)}
                            disabled={loading || !!selectedDbPath}
                            className="flex flex-1 items-center gap-4 text-left disabled:opacity-50 cursor-pointer min-w-0"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-650 dark:text-indigo-400 group-hover:bg-indigo-500/30 transition-colors">
                              <Database size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{db.name}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{db.path}</p>
                              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-600">{formatDate(db.lastOpened)}</p>
                            </div>
                            {loading ? (
                              <Loader2 size={16} className="shrink-0 animate-spin text-indigo-650 dark:text-indigo-400" />
                            ) : (
                              <ChevronRight size={16} className="shrink-0 text-slate-400 dark:text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDeletePath(db.path)}
                            disabled={loading}
                            className="rounded-xl p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 transition-all duration-300 cursor-pointer"
                            title="Remove reference"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                {/* Open from different location */}
                <div className="pt-2">
                  <button
                    onClick={handlePickOpen}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-white/15 py-3 text-sm text-slate-555 dark:text-slate-500 transition-colors hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer disabled:opacity-40"
                  >
                    <FolderOpen size={15} />
                    {inPhotino ? 'Browse for another database…' : 'Open from a different path…'}
                  </button>
                </div>
              </div>
            )}

            {/* ── New database tab ─────────────────────────────────────────────── */}
            {tab === 'new' && (
              <div className="space-y-4">
                {/* Save location picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-555 mb-2">
                    Save Location
                  </label>
                  {inPhotino ? (
                    // Native "Save As" dialog button
                    <button
                      onClick={handlePickSave}
                      disabled={loading}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all duration-200 cursor-pointer disabled:opacity-40 ${
                        newPath
                          ? 'border-indigo-500/40 bg-indigo-55/40 dark:bg-indigo-500/10 text-slate-700 dark:text-slate-200'
                          : 'border-dashed border-slate-300 dark:border-white/20 text-slate-500 dark:text-slate-500 hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400'
                      }`}
                    >
                      <FolderOpen size={16} className={newPath ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'} />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {newPath || 'Choose where to save the database…'}
                      </span>
                      {newPath && (
                        <span className="shrink-0 text-xs text-indigo-655 dark:text-indigo-400 font-medium">Change</span>
                      )}
                    </button>
                  ) : (
                    // Dev-mode fallback: manual path input
                    <Input
                      placeholder="/path/to/mystore.db"
                      value={newPath}
                      onChange={e => setNewPath(e.target.value)}
                    />
                  )}
                </div>

                <Input
                  label="Display name (optional)"
                  placeholder="My Store"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />

                <Input
                  label="Encryption password (optional)"
                  placeholder="Enter a strong password to encrypt the database"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />

                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={loading || !newPath.trim()}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Creating…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Plus size={16} /> Create Database
                    </span>
                  )}
                </Button>
              </div>
            )}

            <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-white/10">
              <button
                onClick={handleLoadDemo}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/20 py-3 text-sm font-semibold text-indigo-650 dark:text-indigo-400 transition-all hover:bg-indigo-500/10 dark:hover:bg-indigo-500/20 hover:border-indigo-500/60 cursor-pointer disabled:opacity-40 shadow-sm"
              >
                <Database size={15} className="text-indigo-500 dark:text-indigo-400 animate-pulse" />
                Explore Demo Database (Pre-seeded)
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-550 dark:text-slate-600">
          Databases can be saved anywhere on your computer. Backups are stored in a{' '}
          <code className="text-slate-600 dark:text-slate-500">Backups/</code> folder next to the database file.
        </p>
      </div>
    </div>

      <ConfirmDialog
        open={confirmDeletePath !== null}
        title="Remove Database Reference"
        description="Are you sure you want to remove this database from the recent list? This only removes the reference and does not delete the database file from your computer."
        confirmLabel="Remove Reference"
        variant="danger"
        onConfirm={handleRemoveRecent}
        onCancel={() => setConfirmDeletePath(null)}
      />
    </div>
  );
}
