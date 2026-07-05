import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Sparkles } from 'lucide-react';
import { api } from '../api';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';

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
  });

  const handleFormatChange = (reportKey: string, format: string) => {
    setFormats({ ...formats, [reportKey]: format });
  };

  const handleExport = (reportKey: string) => {
    const format = formats[reportKey] || 'pdf';
    const url = api.getExportUrl(reportKey, format);
    window.open(url, '_blank');
  };

  const reportsList = [
    {
      key: 'CurrentStock',
      title: 'Current Stock Report',
      description: 'Generates a full list of all active products, their current quantities, cost prices, and valuations.',
      color: 'border-l-indigo-500'
    },
    {
      key: 'InventoryLedger',
      title: 'Inventory Ledger Report',
      description: 'Generates a chronological statement of all stock movements, including opening stock, purchases, and adjustments.',
      color: 'border-l-violet-500'
    },
    {
      key: 'InventoryValuation',
      title: 'Inventory Valuation Report',
      description: 'Details product valuations by both cost price and selling price, displaying margins and inventory capital distribution.',
      color: 'border-l-pink-500'
    },
    {
      key: 'LowStock',
      title: 'Low Stock Alert Report',
      description: 'Generates a detailed report identifying items that have fallen below their configured reorder levels.',
      color: 'border-l-amber-500'
    },
    {
      key: 'OutOfStock',
      title: 'Out of Stock Report',
      description: 'Highlights items with zero or negative inventory balances requiring immediate purchasing actions.',
      color: 'border-l-rose-500'
    },
    {
      key: 'DeadStock',
      title: 'Dead Stock Report',
      description: 'Identifies items with zero transaction and movement history over the past 90 days.',
      color: 'border-l-slate-400'
    },
    {
      key: 'FastMoving',
      title: 'Fast Moving Items',
      description: 'Analyses the top 10 fastest selling/moving inventory items based on outgoing volume in the last 30 days.',
      color: 'border-l-emerald-500'
    },
    {
      key: 'SlowMoving',
      title: 'Slow Moving Items',
      description: 'Identifies products with very low sales/adjustments volume (less than 5 units) in the last 30 days.',
      color: 'border-l-cyan-500'
    },
    {
      key: 'SupplierReport',
      title: 'Supplier Performance Report',
      description: 'Aggregates counts of items supplied, and active Purchase Orders per Supplier.',
      color: 'border-l-sky-500'
    },
    {
      key: 'PurchaseReport',
      title: 'Purchase Orders Summary',
      description: 'Lists all Purchase Orders, order dates, status, total items ordered, and total transaction costs.',
      color: 'border-l-teal-500'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Reports & Exports</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Generate on-demand analytical records and data tables.</p>
        </div>
        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold text-indigo-650 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/20">
          <Sparkles size={12} className="animate-spin" />
          <span>Real-time Data</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reportsList.map((report) => {
          const currentFormat = formats[report.key] || 'pdf';
          return (
            <Card key={report.key} className={`flex flex-col justify-between p-6 space-y-4 hover:scale-[1.01] border-l-4 ${report.color} dark:border-t-0 dark:border-r-0 dark:border-b-0`}>
              <div className="space-y-2">
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight">{report.title}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed min-h-[48px]">
                  {report.description}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Select
                  value={currentFormat}
                  onChange={(e) => handleFormatChange(report.key, e.target.value)}
                >
                  <option value="pdf">PDF Document</option>
                  <option value="excel">Excel Spreadsheet</option>
                  <option value="csv">CSV File</option>
                </Select>

                <Button
                  onClick={() => handleExport(report.key)}
                  className="w-full flex items-center justify-center space-x-2 text-sm shadow-sm"
                >
                  {currentFormat === 'pdf' ? (
                    <FileText size={16} />
                  ) : currentFormat === 'excel' ? (
                    <FileSpreadsheet size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>Export Report</span>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
