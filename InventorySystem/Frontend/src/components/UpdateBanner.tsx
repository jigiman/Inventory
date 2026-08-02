import { useState, useEffect } from 'react';
import { Download, RefreshCw, X, ArrowUpCircle, AlertCircle } from 'lucide-react';
import { api, type UpdateStatus } from '../api';

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const res = await api.checkForUpdates();
        if (active) {
          setStatus(res);
        }
      } catch (err) {
        // Silent catch if offline or web development mode
      }
    }
    check();

    // Check periodically every 30 minutes
    const timer = setInterval(check, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!status || !status.isSupported || !status.updateAvailable || dismissed) {
    return null;
  }

  const handleDownload = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.downloadUpdate();
      setStatus(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to download update.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.applyUpdate();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restart and apply update.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-indigo-600 text-white px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-sm animate-fade-in relative z-50">
      <div className="flex items-center gap-2.5">
        <ArrowUpCircle className="w-5 h-5 text-indigo-200 shrink-0" />
        <div>
          <span className="font-semibold">Update Available: </span>
          <span>
            Version <span className="font-mono font-bold text-indigo-100">{status.targetVersion}</span> is ready to install (current: {status.currentVersion}).
          </span>
          {errorMsg && (
            <div className="flex items-center gap-1 text-red-200 text-xs mt-0.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {status.isDownloaded ? (
          <button
            onClick={handleApply}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white !text-indigo-950 font-bold rounded-lg hover:bg-indigo-50 transition-colors shadow-xs disabled:opacity-50 cursor-pointer border border-indigo-200"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-950 ${loading ? 'animate-spin' : ''}`} />
            <span className="!text-indigo-950 font-bold">{loading ? 'Restarting...' : 'Restart & Apply'}</span>
          </button>
        ) : (
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white !text-indigo-950 font-bold rounded-lg hover:bg-indigo-50 transition-colors shadow-xs disabled:opacity-50 cursor-pointer border border-indigo-200"
          >
            <Download className={`w-4 h-4 text-indigo-950 ${loading ? 'animate-bounce' : ''}`} />
            <span className="!text-indigo-950 font-bold">
              {loading
                ? `Downloading (${status.downloadProgress}%)...`
                : 'Download Update'}
            </span>
          </button>
        )}

        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-indigo-700 rounded-md transition-colors text-indigo-200 hover:text-white cursor-pointer"
          title="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
