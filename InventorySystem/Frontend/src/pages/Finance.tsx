import { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';
import { api } from '../api';
import type { FinanceReportItem, Payment } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

export default function Finance() {
  const [activeTab, setActiveTab] = useState<'debtors' | 'creditors'>('debtors');
  const [debtors, setDebtors] = useState<FinanceReportItem[]>([]);
  const [creditors, setCreditors] = useState<FinanceReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [minBalance, setMinBalance] = useState<number | ''>('');

  // Pagination States
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);

  // Payment Dialog
  const [openPayment, setOpenPayment] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<FinanceReportItem | null>(null);
  const [formPayment, setFormPayment] = useState<Payment>({
    amount: 0,
    paymentMethod: 'Cash',
    reference: '',
    notes: ''
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: currentPage,
        pageSize: pageSize,
        search: searchQuery || undefined,
        minBalance: minBalance === '' ? undefined : minBalance
      };

      if (activeTab === 'debtors') {
        const result = await api.getDebtors(params);
        setDebtors(result.items);
        setTotalCount(result.totalCount);
      } else {
        const result = await api.getCreditors(params);
        setCreditors(result.items);
        setTotalCount(result.totalCount);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load financial data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      loadData();
    }
  }, [activeTab, searchQuery, minBalance]);

  useEffect(() => {
    loadData();
  }, [currentPage]);

  const handleOpenPayment = (item: FinanceReportItem) => {
    setSelectedEntity(item);
    setFormPayment({
      amount: Math.abs(item.balance),
      paymentMethod: 'Cash',
      reference: '',
      notes: '',
      customerId: item.customer?.id,
      supplierId: item.supplier?.id,
      isRefund: false
    });
    setOpenPayment(true);
  };

  const handleSavePayment = async () => {
    if (formPayment.amount <= 0) {
        alert('Amount must be greater than zero');
        return;
    }
    try {
      await api.recordPayment(formPayment);
      setOpenPayment(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  const data = activeTab === 'debtors' ? debtors : creditors;



  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl max-w-sm border border-slate-200/20 dark:border-slate-800/40">
        <button
          onClick={() => setActiveTab('debtors')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center space-x-2 ${
            activeTab === 'debtors'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          <ArrowDownLeft size={14} />
          <span>Debtors (Customers)</span>
        </button>
        <button
          onClick={() => setActiveTab('creditors')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center space-x-2 ${
            activeTab === 'creditors'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          <ArrowUpRight size={14} />
          <span>Creditors (Suppliers)</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 max-w-xl">
        <Input
          label="Search Name"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Input
          label="Minimum Outstanding Balance"
          type="number"
          placeholder="e.g. 100"
          value={minBalance}
          onChange={(e) => setMinBalance(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
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
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4 text-right">{activeTab === 'debtors' ? 'Total Sales' : 'Total Purchases'}</th>
                <th className="px-6 py-4 text-right">Total Paid</th>
                <th className="px-6 py-4 text-right">Outstanding Balance</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {data.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">
                    {activeTab === 'debtors' ? item.customer?.name : item.supplier?.name}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    NPR {(activeTab === 'debtors' ? item.totalSales : item.totalPurchases)?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400">
                    NPR {item.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right font-black text-rose-600 dark:text-rose-400">
                    NPR {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => handleOpenPayment(item)} className="inline-flex items-center space-x-1.5">
                      <Wallet size={14} />
                      <span>Record {activeTab === 'debtors' ? 'Receipt' : 'Payment'}</span>
                    </Button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    No outstanding {activeTab} matching filters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/60 text-xs mt-4">
            <span className="text-slate-550 dark:text-slate-400 font-medium">
              Showing {data.length} of {totalCount} records
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

      {/* Record Payment Dialog */}
      <Dialog
        open={openPayment}
        onClose={() => setOpenPayment(false)}
        title={`Record ${activeTab === 'debtors' ? 'Receipt from Customer' : 'Payment to Supplier'}`}
        size="md"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSavePayment(); }} className="space-y-5">
          <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Entity</p>
            <p className="text-lg font-black text-slate-900 dark:text-slate-50">
              {activeTab === 'debtors' ? selectedEntity?.customer?.name : selectedEntity?.supplier?.name}
            </p>
            <div className="mt-2 flex justify-between items-center">
                <span className="text-xs text-slate-500">Current Balance:</span>
                <span className="font-bold text-rose-600">NPR {selectedEntity?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <Input
            label="Amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={formPayment.amount}
            onChange={(e) => setFormPayment({ ...formPayment, amount: parseFloat(e.target.value) || 0 })}
          />

          <Select
            label="Payment Method"
            value={formPayment.paymentMethod}
            onChange={(e) => setFormPayment({ ...formPayment, paymentMethod: e.target.value })}
          >
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
            <option value="Mobile Money">Mobile Money</option>
          </Select>

          <Input
            label="Reference / Transaction ID"
            value={formPayment.reference}
            onChange={(e) => setFormPayment({ ...formPayment, reference: e.target.value })}
          />

          <div className="flex items-center space-x-2.5 py-1">
            <input
              type="checkbox"
              id="isRefund"
              className="h-4.5 w-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              checked={formPayment.isRefund || false}
              onChange={(e) => setFormPayment({ ...formPayment, isRefund: e.target.checked })}
            />
            <label htmlFor="isRefund" className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none">
              This is a refund
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Notes</label>
            <textarea
              className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
              rows={2}
              value={formPayment.notes}
              onChange={(e) => setFormPayment({ ...formPayment, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpenPayment(false)}>Cancel</Button>
            <Button type="submit" className="inline-flex items-center space-x-2">
                <DollarSign size={16} />
                <span>Post Payment</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
