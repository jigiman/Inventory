import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  RotateCcw, 
  Wallet, 
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { api } from '../api';
import type { Supplier, PurchaseOrder, PurchaseReturn, Payment } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

interface SupplierDetailProps {
  supplierId: number;
  onBack: () => void;
  onSelectPurchaseOrder?: (orderId: number) => void;
}

function parseTimestamp(dateStr?: any): number {
  if (!dateStr) return 0;
  if (typeof dateStr === 'number') return isNaN(dateStr) ? 0 : dateStr;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? 0 : dateStr.getTime();
  try {
    const str = String(dateStr).trim();
    if (!str || str === 'null' || str === 'undefined') return 0;
    const safeStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
    const time = Date.parse(safeStr);
    return isNaN(time) ? 0 : time;
  } catch {
    return 0;
  }
}

function formatDate(dateStr?: any) {
  if (!dateStr) return '-';
  try {
    const time = parseTimestamp(dateStr);
    if (time === 0) return typeof dateStr === 'string' ? dateStr : '-';
    const d = new Date(time);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return '-';
  }
}

function formatCurrency(val?: any): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  try {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return '0.00';
  }
}

export default function SupplierDetail({ supplierId, onBack, onSelectPurchaseOrder }: SupplierDetailProps) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<'all' | 'orders' | 'returns' | 'payments'>('all');

  // Payment Dialog state
  const [openPayment, setOpenPayment] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [formPayment, setFormPayment] = useState<Payment>({
    amount: 0,
    paymentMethod: 'Cash',
    reference: '',
    notes: '',
    supplierId: supplierId,
    isRefund: false
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [allSups, poData, prData, payData] = await Promise.all([
        api.getSuppliers().catch(() => []),
        api.getPurchaseOrders({ supplierId, pageSize: 100 }).catch(() => ({ items: [], totalCount: 0, page: 1, pageSize: 100 })),
        api.getPurchaseReturns({ supplierId }).catch(() => []),
        api.getPayments({ supplierId }).catch(() => [])
      ]);

      let sup = allSups.find(s => s.id === supplierId);
      if (!sup) {
        try {
          sup = await api.getSupplier(supplierId);
        } catch (e) {
          // ignore
        }
      }

      setSupplier(sup || { id: supplierId, name: `Supplier #${supplierId}`, contactPerson: '', phone: '', email: '', address: '', notes: '' });
      setPurchaseOrders(poData.items || []);
      setPurchaseReturns(prData || []);
      setPayments(payData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load supplier details');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [supplierId]);

  // Financial calculations
  const activeOrders = purchaseOrders.filter(po => po.status !== 'Cancelled' && po.status !== 'Draft');
  const totalPurchases = activeOrders.reduce((sum, po) => sum + (po.totalAmount || 0), 0);
  const totalReturns = purchaseReturns.reduce((sum, pr) => sum + (pr.totalAmount || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.isRefund ? -p.amount : p.amount), 0);
  const balance = totalPurchases - totalReturns - totalPaid;

  const handleOpenPayment = (isRefund = false) => {
    setFormPayment({
      amount: Math.max(0, isRefund ? totalReturns : balance),
      paymentMethod: 'Cash',
      reference: '',
      notes: '',
      supplierId: supplierId,
      isRefund: isRefund
    });
    setOpenPayment(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formPayment.amount <= 0) {
      alert('Amount must be greater than zero');
      return;
    }

    setSubmittingPayment(true);
    try {
      await api.recordPayment(formPayment);
      setOpenPayment(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Combine transactions for chronological ledger
  const allTransactions = [
    ...activeOrders.map(po => ({
      id: `po-${po.id}`,
      type: 'Purchase Order',
      ref: po.orderNumber,
      date: po.orderDate,
      status: po.status || 'Ordered',
      debit: po.totalAmount, // Increases amount owed
      credit: 0,
      notes: po.notes || '',
      poId: po.id
    })),
    ...purchaseReturns.map(pr => ({
      id: `pr-${pr.id}`,
      type: 'Purchase Return',
      ref: pr.returnNumber,
      date: pr.returnDate,
      status: 'Completed',
      debit: 0,
      credit: pr.totalAmount, // Decreases amount owed
      notes: pr.notes || '',
      poId: pr.purchaseOrderId
    })),
    ...payments.map(p => ({
      id: `pay-${p.id}`,
      type: p.isRefund ? 'Supplier Refund' : 'Supplier Payment',
      ref: p.reference || `PAY-${p.id}`,
      date: p.paymentDate,
      status: 'Paid',
      debit: p.isRefund ? p.amount : 0,
      credit: p.isRefund ? 0 : p.amount, // Payment decreases amount owed
      notes: `${p.paymentMethod}${p.notes ? ' - ' + p.notes : ''}`,
      poId: p.purchaseOrderId
    }))
  ].sort((a, b) => parseTimestamp(b.date) - parseTimestamp(a.date));

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={onBack} className="inline-flex items-center space-x-2">
          <ArrowLeft size={16} />
          <span>Back</span>
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error || 'Supplier not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack} className="rounded-xl">
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 font-bold">
                <Building2 size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {supplier.name}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Creditor Statement & Transaction History
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => handleOpenPayment(false)}
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
          >
            <Wallet size={16} />
            <span>Record Payment</span>
          </Button>
        </div>
      </div>

      {/* Supplier Contact Info Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-950/40 p-4.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 shadow-xs text-xs">
        <div className="space-y-1">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-2xs">Contact Person</span>
          <p className="font-bold text-slate-800 dark:text-slate-200">{supplier.contactPerson || '-'}</p>
        </div>
        <div className="space-y-1">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-2xs">Phone</span>
          <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
            {supplier.phone ? (
              <>
                <Phone size={12} className="text-slate-400" />
                <span>{supplier.phone}</span>
              </>
            ) : '-'}
          </p>
        </div>
        <div className="space-y-1">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-2xs">Email</span>
          <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 truncate">
            {supplier.email ? (
              <>
                <Mail size={12} className="text-slate-400 shrink-0" />
                <span className="truncate">{supplier.email}</span>
              </>
            ) : '-'}
          </p>
        </div>
        <div className="space-y-1">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-2xs">Address</span>
          <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 truncate">
            {supplier.address ? (
              <>
                <MapPin size={12} className="text-slate-400 shrink-0" />
                <span className="truncate">{supplier.address}</span>
              </>
            ) : '-'}
          </p>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/50 bg-white p-5 dark:border-slate-800/60 dark:bg-slate-950/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Purchases</span>
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <FileText size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
            NPR {formatCurrency(totalPurchases)}
          </p>
          <span className="text-2xs text-slate-400 mt-1 block">{activeOrders.length} Completed / Active Orders</span>
        </div>

        <div className="rounded-2xl border border-slate-200/50 bg-white p-5 dark:border-slate-800/60 dark:bg-slate-950/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Returns</span>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <RotateCcw size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-amber-600 dark:text-amber-400">
            NPR {formatCurrency(totalReturns)}
          </p>
          <span className="text-2xs text-slate-400 mt-1 block">{purchaseReturns.length} Purchase Returns Recorded</span>
        </div>

        <div className="rounded-2xl border border-slate-200/50 bg-white p-5 dark:border-slate-800/60 dark:bg-slate-950/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Paid</span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Wallet size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            NPR {formatCurrency(totalPaid)}
          </p>
          <span className="text-2xs text-slate-400 mt-1 block">{payments.length} Payment Records</span>
        </div>

        <div className="rounded-2xl border border-slate-200/50 bg-white p-5 dark:border-slate-800/60 dark:bg-slate-950/40 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              {balance >= 0 ? 'Outstanding Owed' : 'Supplier Credit'}
            </span>
            <div className={`rounded-xl p-2.5 ${balance > 0 ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400'}`}>
              <DollarSign size={18} />
            </div>
          </div>
          <p className={`mt-3 text-2xl font-black ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : balance < 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-900 dark:text-slate-100'}`}>
            NPR {formatCurrency(Math.abs(balance))}
          </p>
          <span className="text-2xs text-slate-400 mt-1 block">
            {balance > 0 ? 'Current balance payable' : balance < 0 ? 'Credit balance in your favor' : 'Account fully settled'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200/60 dark:border-slate-800/60 space-x-6 overflow-x-auto text-sm font-bold">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          All Transactions Ledger ({allTransactions.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'orders'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Purchase Orders ({purchaseOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'returns'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Purchase Returns ({purchaseReturns.length})
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'payments'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          Payments ({payments.length})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/50 bg-white/50 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/40 shadow-xs">
        <div className="overflow-x-auto">
          {activeTab === 'all' && (
            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
              <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Transaction Type</th>
                  <th className="px-6 py-4">Reference</th>
                  <th className="px-6 py-4 text-right">Debit (Owed)</th>
                  <th className="px-6 py-4 text-right">Credit (Paid/Returned)</th>
                  <th className="px-6 py-4">Details / Notes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {allTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium">
                      {formatDate(tx.date)}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">
                      <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wide border ${
                        tx.type === 'Purchase Order'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200/20 dark:bg-indigo-950/20 dark:text-indigo-400'
                          : tx.type === 'Purchase Return'
                          ? 'bg-amber-50 text-amber-700 border-amber-200/20 dark:bg-amber-950/20 dark:text-amber-400'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200/20 dark:bg-emerald-950/20 dark:text-emerald-400'
                      }`}>
                        <span>{tx.type}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                      {tx.ref}
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-slate-900 dark:text-slate-100">
                      {tx.debit > 0 ? `NPR ${formatCurrency(tx.debit)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                      {tx.credit > 0 ? `NPR ${formatCurrency(tx.credit)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {tx.notes || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {tx.poId && onSelectPurchaseOrder && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectPurchaseOrder(tx.poId!)}
                          className="inline-flex items-center space-x-1 text-xs"
                        >
                          <ExternalLink size={13} />
                          <span>View Order</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {allTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      No transactions recorded for this supplier yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'orders' && (
            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
              <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
                <tr>
                  <th className="px-6 py-4">Order Number</th>
                  <th className="px-6 py-4">Order Date</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Total Amount</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {activeOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-slate-200">{po.orderNumber}</td>
                    <td className="px-6 py-4 text-xs">
                      {formatDate(po.orderDate)}
                    </td>
                    <td className="px-6 py-4 text-xs max-w-xs truncate">
                      {po.items?.map(it => `${it.product?.name || `Product #${it.productId}`} (x${it.quantityOrdered})`).join(', ') || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wide border ${
                        po.status === 'Received'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20 dark:bg-emerald-950/20 dark:text-emerald-400'
                          : po.status === 'Ordered'
                          ? 'bg-blue-50 text-blue-700 border-blue-200/20 dark:bg-blue-950/20 dark:text-blue-400'
                          : po.status === 'Cancelled'
                          ? 'bg-rose-50 text-rose-700 border-rose-200/20 dark:bg-rose-950/20 dark:text-rose-400'
                          : 'bg-amber-50 text-amber-700 border-amber-200/20 dark:bg-amber-950/20 dark:text-amber-400'
                      }`}>
                        {po.status || 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-extrabold text-slate-900 dark:text-slate-100">
                      NPR {formatCurrency(po.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {po.id && onSelectPurchaseOrder && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectPurchaseOrder(po.id!)}
                          className="inline-flex items-center space-x-1"
                        >
                          <ExternalLink size={14} />
                          <span>View Details</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {activeOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      No purchase orders found for this supplier.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'returns' && (
            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
              <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
                <tr>
                  <th className="px-6 py-4">Return Number</th>
                  <th className="px-6 py-4">Return Date</th>
                  <th className="px-6 py-4">Returned Items</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Return Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {purchaseReturns.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900 dark:text-slate-200">{pr.returnNumber}</td>
                    <td className="px-6 py-4 text-xs">
                      {formatDate(pr.returnDate)}
                    </td>
                    <td className="px-6 py-4 text-xs max-w-xs truncate">
                      {pr.items?.map(it => `${it.product?.name || `Product #${it.productId}`} (x${it.quantity})`).join(', ') || '-'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">{pr.notes || '-'}</td>
                    <td className="px-6 py-4 text-right font-extrabold text-amber-600 dark:text-amber-400">
                      NPR {formatCurrency(pr.totalAmount)}
                    </td>
                  </tr>
                ))}
                {purchaseReturns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      No purchase returns recorded for this supplier.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'payments' && (
            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
              <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
                <tr>
                  <th className="px-6 py-4">Payment Date</th>
                  <th className="px-6 py-4">Reference</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4 text-xs">
                      {formatDate(p.paymentDate)}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-200">{p.reference || `PAY-${p.id}`}</td>
                    <td className="px-6 py-4 text-xs font-semibold">{p.paymentMethod}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wide border ${
                        p.isRefund
                          ? 'bg-rose-50 text-rose-700 border-rose-200/20 dark:bg-rose-950/20 dark:text-rose-400'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200/20 dark:bg-emerald-950/20 dark:text-emerald-400'
                      }`}>
                        {p.isRefund ? 'Refund' : 'Payment Out'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">{p.notes || '-'}</td>
                    <td className="px-6 py-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                      NPR {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      No payments recorded for this supplier yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Record Payment Dialog */}
      <Dialog
        open={openPayment}
        onClose={() => setOpenPayment(false)}
        title={formPayment.isRefund ? 'Record Supplier Refund' : 'Record Supplier Payment'}
      >
        <form onSubmit={handleSavePayment} className="space-y-4">
          <Input
            label="Payment Amount (NPR) *"
            type="number"
            step="0.01"
            min="0.01"
            value={formPayment.amount || ''}
            onChange={(e) => setFormPayment({ ...formPayment, amount: parseFloat(e.target.value) || 0 })}
            required
          />
          <Select
            label="Payment Method *"
            value={formPayment.paymentMethod}
            onChange={(e) => setFormPayment({ ...formPayment, paymentMethod: e.target.value })}
            options={[
              { value: 'Cash', label: 'Cash' },
              { value: 'Bank Transfer', label: 'Bank Transfer' },
              { value: 'Cheque', label: 'Cheque' },
              { value: 'Digital Wallet', label: 'Digital Wallet' }
            ]}
          />
          <Input
            label="Payment Reference / Cheque #"
            value={formPayment.reference || ''}
            onChange={(e) => setFormPayment({ ...formPayment, reference: e.target.value })}
            placeholder="e.g. CHQ-100293 or Bank Ref"
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              value={formPayment.notes || ''}
              onChange={(e) => setFormPayment({ ...formPayment, notes: e.target.value })}
              rows={3}
              placeholder="Payment notes or description..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenPayment(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingPayment}>
              {submittingPayment ? 'Recording...' : 'Submit Payment'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
