import React, { useState, useEffect } from 'react';
import { Save, Database, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function Settings() {
  const [storeName, setStoreName] = useState('');
  const [backups, setBackups] = useState<string[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function loadSettings() {
    setLoadingSettings(true);
    try {
      const settings = await api.getSettings();
      const nameSetting = settings.find(s => s.key === 'StoreName');
      if (nameSetting) setStoreName(nameSetting.value);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoadingSettings(false);
    }
  }

  async function loadBackups() {
    setLoadingBackups(true);
    try {
      const files = await api.getBackups();
      setBackups(files);
    } catch (err: any) {
      setError(err.message || 'Failed to load backup files');
    } finally {
      setLoadingBackups(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadBackups();
  }, []);

  const handleSaveStoreName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setError('');
    try {
      await api.saveSetting({ key: 'StoreName', value: storeName });
      setSuccessMsg('Store Name updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to save store name');
    }
  };

  const handleCreateBackup = async () => {
    setSuccessMsg('');
    setError('');
    try {
      const res = await api.createBackup();
      setSuccessMsg(`Backup created successfully: ${res.file}`);
      loadBackups();
    } catch (err: any) {
      setError(err.message || 'Failed to create backup');
    }
  };

  const handleRestoreBackup = async (fileName: string) => {
    if (!confirm(`WARNING: Restoring will overwrite the current database with backup file: ${fileName}. Are you sure you want to proceed?`)) return;
    setSuccessMsg('');
    setError('');
    try {
      await api.restoreBackup(fileName);
      setSuccessMsg('Database restored successfully from backup.');
      loadSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to restore backup');
    }
  };

  return (
    <div className="space-y-4 animate-in">

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-650 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-705 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold animate-pulse">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {/* Store configuration card */}
        <div className="space-y-6 border border-slate-200/50 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/20 p-6 rounded-2xl">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Store Profile</h3>
            <p className="text-xs text-slate-400 dark:text-slate-505 mt-0.5">Customize global metadata displayed throughout the application.</p>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
            {loadingSettings ? (
              <div className="flex h-10 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
              </div>
            ) : (
              <form onSubmit={handleSaveStoreName} className="flex gap-4 items-end max-w-lg">
                <div className="flex-1">
                  <Input
                    label="Store Name"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />
                </div>
                <Button type="submit" className="inline-flex items-center space-x-2">
                  <Save size={16} />
                  <span>Save Settings</span>
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Database card */}
        <div className="space-y-6 border border-slate-200/50 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/20 p-6 rounded-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Database Checkpoints</h3>
              <p className="text-xs text-slate-400 dark:text-slate-505 mt-0.5">Create backup checkpoints and restore data states.</p>
            </div>
            <Button variant="secondary" className="inline-flex items-center space-x-2 shadow-sm" onClick={handleCreateBackup}>
              <Database size={16} />
              <span>Create Backup</span>
            </Button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
            {loadingBackups ? (
              <div className="flex h-[200px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-650 border-t-transparent dark:border-indigo-400" />
              </div>
            ) : (
              <div className="overflow-x-auto border-t border-slate-200/50 dark:border-slate-800/60">
                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                  <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
                    <tr>
                      <th className="px-6 py-4">Backup Filename</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {backups.map((file) => (
                      <tr key={file} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">{file}</td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="inline-flex items-center space-x-1.5 border-amber-205 text-amber-705 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-950/20"
                            onClick={() => handleRestoreBackup(file)}
                          >
                            <RefreshCw size={12} className="animate-spin-slow" />
                            <span>Restore State</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {backups.length === 0 && (
                      <tr>
                        <td colSpan={2} className="py-12 text-center text-slate-450 font-medium">
                          No database backups exist yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
