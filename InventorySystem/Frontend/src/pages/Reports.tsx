import { useState } from 'react';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  Package,
  History,
  DollarSign,
  AlertTriangle,
  AlertOctagon,
  Inbox,
  Zap,
  Clock,
  Building2,
  ShoppingCart,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../api';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { isPhotino, pickSaveFile, saveFileData } from '../utils/photino';

export default function Reports() {
  const [formats, setFormats] = useState<{ [key: string]: string }>({
    CurrentStock: 'pdf',
    InventoryLedger: 'pdf',
    InventoryValuation: 'pdf',
    LowStock: 'pdf',
    OutOfStock: 'pdf',
    DeadStock: 'pdf',
    FastMoving: 'pdf',
    SlowMoving: 'pdf',
    SupplierReport: 'pdf',
    PurchaseReport: 'pdf',
    SalesReport: 'pdf',
    DebtorsReport: 'pdf',
    CreditorsReport: 'pdf',
  });

  const handleFormatChange = (reportKey: string, format: string) => {
    setFormats({ ...formats, [reportKey]: format });
  };

  const handleExport = async (reportKey: string) => {
    const format = formats[reportKey] || 'pdf';
    const url = api.getExportUrl(reportKey, format);

    if (isPhotino()) {
      try {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const defaultFilename = `${reportKey}_${dateStr}.${format}`;

        const path = await pickSaveFile(format, defaultFilename);
        if (!path) return;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to download report');
        const blob = await response.blob();

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          saveFileData(path, base64data);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error('Error saving file in desktop mode:', err);
        alert('Failed to save file: ' + (err as Error).message);
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const reportsList = [
    {
      key: 'CurrentStock',
      title: 'Current Stock Report',
      description: 'Generates a full list of all active products, their current quantities, cost prices, and valuations.',
      icon: <Package size={18} />,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40',
      iconColor: 'text-indigo-600 dark:text-indigo-400'
    },
    {
      key: 'InventoryLedger',
      title: 'Inventory Ledger Report',
      description: 'Generates a chronological statement of all stock movements, including opening stock, purchases, and adjustments.',
      icon: <History size={18} />,
      iconBg: 'bg-violet-50 dark:bg-violet-950/40',
      iconColor: 'text-violet-600 dark:text-violet-400'
    },
    {
      key: 'InventoryValuation',
      title: 'Inventory Valuation Report',
      description: 'Details product valuations by both cost price and selling price, displaying margins and inventory capital distribution.',
      icon: <DollarSign size={18} />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      key: 'LowStock',
      title: 'Low Stock Alert Report',
      description: 'Generates a detailed report identifying items that have fallen below their configured reorder levels.',
      icon: <AlertTriangle size={18} />,
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
      iconColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      key: 'OutOfStock',
      title: 'Out of Stock Report',
      description: 'Highlights items with zero or negative inventory balances requiring immediate purchasing actions.',
      icon: <AlertOctagon size={18} />,
      iconBg: 'bg-rose-50 dark:bg-rose-950/40',
      iconColor: 'text-rose-600 dark:text-rose-400'
    },
    {
      key: 'DeadStock',
      title: 'Dead Stock Report',
      description: 'Identifies items with zero transaction and movement history over the past 90 days.',
      icon: <Inbox size={18} />,
      iconBg: 'bg-slate-100 dark:bg-slate-900/60',
      iconColor: 'text-slate-500 dark:text-slate-400'
    },
    {
      key: 'FastMoving',
      title: 'Fast Moving Items',
      description: 'Analyses the top 10 fastest selling/moving inventory items based on outgoing volume in the last 30 days.',
      icon: <Zap size={18} />,
      iconBg: 'bg-orange-50 dark:bg-orange-950/40',
      iconColor: 'text-orange-600 dark:text-orange-400'
    },
    {
      key: 'SlowMoving',
      title: 'Slow Moving Items',
      description: 'Identifies products with very low sales/adjustments volume (less than 5 units) in the last 30 days.',
      icon: <Clock size={18} />,
      iconBg: 'bg-cyan-50 dark:bg-cyan-950/40',
      iconColor: 'text-cyan-600 dark:text-cyan-400'
    },
    {
      key: 'SupplierReport',
      title: 'Supplier Performance Report',
      description: 'Aggregates counts of items supplied, and active Purchase Orders per Supplier.',
      icon: <Building2 size={18} />,
      iconBg: 'bg-sky-50 dark:bg-sky-950/40',
      iconColor: 'text-sky-600 dark:text-sky-400'
    },
    {
      key: 'PurchaseReport',
      title: 'Purchase Orders Summary',
      description: 'Lists all Purchase Orders, order dates, status, total items ordered, and total transaction costs.',
      icon: <ShoppingCart size={18} />,
      iconBg: 'bg-teal-50 dark:bg-teal-950/40',
      iconColor: 'text-teal-600 dark:text-teal-400'
    },
    {
      key: 'SalesReport',
      title: 'Sales Summary',
      description: 'Generates a summary of all sales transactions, including invoice numbers, customers, dates, and total revenues.',
      icon: <ShoppingCart size={18} />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      key: 'DebtorsReport',
      title: 'Debtors Balance Report',
      description: 'Lists customers with outstanding balances, showing total amount purchased, paid to date, and balance due.',
      icon: <ArrowDownLeft size={18} />,
      iconBg: 'bg-rose-50 dark:bg-rose-950/40',
      iconColor: 'text-rose-600 dark:text-rose-400'
    },
    {
      key: 'CreditorsReport',
      title: 'Creditors Balance Report',
      description: 'Lists suppliers with outstanding payments, showing total purchases, payments to date, and balance owed.',
      icon: <ArrowUpRight size={18} />,
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
      iconColor: 'text-amber-600 dark:text-amber-400'
    }
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border-t border-slate-200/50 dark:border-slate-800/60">
        <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
          <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60 select-none">
            <tr>
              <th className="px-6 py-4">Report Details</th>
              <th className="px-6 py-4 w-48">Format</th>
              <th className="px-6 py-4 text-right w-36">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {reportsList.map((report) => {
              const currentFormat = formats[report.key] || 'pdf';
              return (
                <tr key={report.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-start space-x-4">
                      <div className={`rounded-xl ${report.iconBg} p-2.5 ${report.iconColor} shrink-0 mt-0.5`}>
                        {report.icon}
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{report.title}</h3>
                        <p className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed max-w-2xl">{report.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-[160px]">
                      <Select
                        value={currentFormat}
                        onChange={(e) => handleFormatChange(report.key, e.target.value)}
                      >
                        <option value="pdf">PDF Document</option>
                        <option value="excel">Excel Spreadsheet</option>
                        <option value="csv">CSV File</option>
                      </Select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      onClick={() => handleExport(report.key)}
                      className="inline-flex items-center space-x-2 text-xs shadow-sm"
                      size="sm"
                    >
                      {currentFormat === 'pdf' ? (
                        <FileText size={14} />
                      ) : currentFormat === 'excel' ? (
                        <FileSpreadsheet size={14} />
                      ) : (
                        <Download size={14} />
                      )}
                      <span>Export</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
