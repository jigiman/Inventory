import { useState, useEffect } from 'react';
import { Plus, Eye } from 'lucide-react';
import { api } from '../api';
import type { Sale } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import CreateSale from './CreateSale';
import SaleDetail from './SaleDetail';

export default function Sales() {
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination States
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);

  async function loadSales() {
    setLoading(true);
    setError('');
    try {
      const result = await api.getSales({
        page: currentPage,
        pageSize: pageSize,
        search: searchQuery,
        status: filterStatus,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      setSales(result.items);
      setTotalCount(result.totalCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      loadSales();
    }
  }, [searchQuery, filterStatus, startDate, endDate]);

  useEffect(() => {
    loadSales();
  }, [currentPage]);

  if (viewMode === 'create') {
    return (
      <CreateSale
        onBack={() => setViewMode('list')}
        onSuccess={() => {
          setViewMode('list');
          loadSales();
        }}
      />
    );
  }

  if (viewMode === 'detail' && selectedSaleId !== null) {
    return (
      <SaleDetail
        saleId={selectedSaleId}
        onBack={() => {
          setViewMode('list');
          setSelectedSaleId(null);
        }}
        onRefreshList={loadSales}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-end gap-1.5 pb-2">
        <Button 
          onClick={() => setViewMode('create')} 
          className="inline-flex items-center space-x-2 cursor-pointer"
        >
          <Plus size={16} />
          <span>New Sale</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/60">
        <Input
          label="Search Sale"
          placeholder="Sale # or Customer Name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery('')}
        />
        <Select
          label="Status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </Select>
        <Input
          label="From Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="To Date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-200/50 dark:border-slate-800/60">
          <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
            <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
              <tr>
                <th className="px-6 py-4">Sale Number</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4 text-right">Total Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">{sale.saleNumber}</td>
                  <td className="px-6 py-4 font-medium">{sale.customer?.name}</td>
                  <td className="px-6 py-4 text-slate-500">{sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : ''}</td>
                  <td className="px-6 py-4">{sale.items?.length} Items</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-slate-200">NPR {sale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-6 py-4">
                    <span className="text-3xs font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-250/10 dark:bg-emerald-950/20 dark:text-emerald-400">
                      {sale.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        if (sale.id) {
                          setSelectedSaleId(sale.id);
                          setViewMode('detail');
                        }
                      }}
                      className="inline-flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Eye size={14} />
                      <span>Details</span>
                    </Button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No sales matching filters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/60 text-xs mt-4">
            <span className="text-slate-550 dark:text-slate-400 font-medium">
              Showing {sales.length} of {totalCount} sales
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <span className="flex items-center px-3 font-bold text-slate-700 dark:text-slate-300">
                Page {currentPage} of {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
