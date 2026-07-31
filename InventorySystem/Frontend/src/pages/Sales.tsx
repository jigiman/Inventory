import { useState, useEffect } from 'react';
import { Plus, Eye } from 'lucide-react';
import { api } from '../api';
import type { Sale } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import CreateSale from './CreateSale';

export default function Sales() {
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog States
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Payments States
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

  // Returns States
  const [saleReturns, setSaleReturns] = useState<any[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [openReturn, setOpenReturn] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<{ [productId: number]: number }>({});
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

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

  async function loadPayments() {
    if (!selectedSale) return;
    setLoadingPayments(true);
    try {
      const data = await api.getPayments({ saleId: selectedSale.id });
      setPayments(data);
    } catch (e) {
      console.error('Failed to load payments', e);
    } finally {
      setLoadingPayments(false);
    }
  }

  async function loadReturns() {
    if (!selectedSale) return;
    setLoadingReturns(true);
    try {
      const data = await api.getSalesReturns({ saleId: selectedSale.id });
      setSaleReturns(data);
    } catch (e) {
      console.error('Failed to load returns', e);
    } finally {
      setLoadingReturns(false);
    }
  }

  useEffect(() => {
    if (selectedSale && openDetails) {
      loadPayments();
      loadReturns();
    } else {
      setPayments([]);
      setSaleReturns([]);
    }
  }, [selectedSale, openDetails]);

  const totalPaid = payments.reduce((sum, p) => sum + (p.isRefund ? -p.amount : p.amount), 0);
  const totalReturned = saleReturns.reduce((sum, r) => sum + r.totalAmount, 0);
  const remainingBalance = (selectedSale?.totalAmount ?? 0) - totalReturned - totalPaid;

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
                      onClick={() => { setSelectedSale(sale); setOpenDetails(true); }}
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

      {/* View Sale Details Dialog */}
      {selectedSale && openDetails && (
        <Dialog 
          open={openDetails} 
          onClose={() => { setOpenDetails(false); setSelectedSale(null); }} 
          title={`Sale Transaction: ${selectedSale.saleNumber}`} 
          size="md"
        >
          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Sale Date</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {selectedSale.saleDate ? new Date(selectedSale.saleDate).toLocaleString() : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</p>
                <p className="mt-1">
                  <span className="inline-block text-3xs font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-250/10 dark:bg-emerald-950/20 dark:text-emerald-400">
                    {selectedSale.status}
                  </span>
                </p>
              </div>
            </div>

            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Customer Details</p>
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800 rounded-xl p-3.5 space-y-1">
                <p className="font-bold text-slate-900 dark:text-slate-100">{selectedSale.customer?.name}</p>
                {selectedSale.customer?.contactPerson && (
                  <p className="text-xs text-slate-550 dark:text-slate-400">Contact: {selectedSale.customer.contactPerson}</p>
                )}
                {selectedSale.customer?.phone && (
                  <p className="text-xs text-slate-550 dark:text-slate-400">Phone: {selectedSale.customer.phone}</p>
                )}
                {selectedSale.customer?.email && (
                  <p className="text-xs text-slate-550 dark:text-slate-400">Email: {selectedSale.customer.email}</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Sale Items</p>
              <div className="overflow-hidden border border-slate-200/50 dark:border-slate-800/60 rounded-xl">
                <table className="w-full text-left text-xs text-slate-500 dark:text-slate-400">
                  <thead className="bg-slate-550/5 dark:bg-slate-900/40 text-2xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/60">
                    <tr>
                      <th className="px-4 py-2.5">Product</th>
                      <th className="px-4 py-2.5 text-right">Quantity</th>
                      <th className="px-4 py-2.5 text-right">Unit Price</th>
                      <th className="px-4 py-2.5 text-right">Discount</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {selectedSale.items?.map((item) => {
                      const gross = (item.quantity ?? 0) * (item.unitPrice ?? 0);
                      const disc = item.discountAmount ?? 0;
                      const lineNet = Math.max(0, gross - disc);

                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-200">
                            {item.product?.name}
                            <div className="flex gap-2 text-3xs font-normal font-mono text-slate-400 mt-0.5">
                              {item.product?.sku && <span>SKU: {item.product.sku}</span>}
                              {item.supplier?.name && <span className="text-indigo-500 font-sans font-medium">Supplier: {item.supplier.name}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold">{item.quantity}</td>
                          <td className="px-4 py-3 text-right">NPR {(item.unitPrice ?? 0).toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-medium">
                            {disc > 0 ? `- NPR ${disc.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-200">
                            NPR {lineNet.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800 rounded-xl p-4 space-y-2">
              {selectedSale.subTotal !== undefined && selectedSale.subTotal > 0 && (
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-semibold">NPR {selectedSale.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {selectedSale.discountAmount !== undefined && selectedSale.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                  <span>Bill Discount:</span>
                  <span className="font-semibold">- NPR {selectedSale.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Total Sale Amount</span>
                <span className="text-lg font-extrabold text-indigo-700 dark:text-indigo-400">
                  NPR {selectedSale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Payments List Section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payments History</p>
                {remainingBalance > 0 && !showAddPayment && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setShowAddPayment(true);
                      setPaymentAmount(parseFloat(remainingBalance.toFixed(2)));
                      setPaymentMethod('Cash');
                      setPaymentReference('');
                      setPaymentNotes('');
                    }}
                    className="cursor-pointer"
                  >
                    <Plus size={14} className="mr-1" />
                    <span>Record Payment</span>
                  </Button>
                )}
              </div>

              {loadingPayments ? (
                <p className="text-xs text-slate-400">Loading payments...</p>
              ) : payments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No payments recorded yet. Remaining: NPR {remainingBalance.toFixed(2)}</p>
              ) : (
                <div className="space-y-2 mb-3">
                  <div className="max-h-[150px] overflow-y-auto pr-1 space-y-2">
                    {payments.map((p) => (
                      <div key={p.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800 rounded-xl p-2.5 text-xs">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-200">NPR {(p.amount ?? 0).toFixed(2)}</span>
                          <span className="text-slate-400 mx-1.5">|</span>
                          <span className="text-slate-550 dark:text-slate-400 font-medium">{p.paymentMethod}</span>
                          {p.reference && <span className="text-slate-400 ml-2">({p.reference})</span>}
                        </div>
                        <span className="text-slate-400 font-medium">{new Date(p.paymentDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs font-bold pt-2.5 border-t border-slate-150 dark:border-slate-800">
                    <span className="text-slate-400">Total Paid / Remaining:</span>
                    <span>
                      NPR {totalPaid.toFixed(2)} Paid / <span className={remainingBalance > 0 ? "text-amber-500" : "text-emerald-500"}>NPR {remainingBalance.toFixed(2)} Bal</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Add Payment Form */}
              {showAddPayment && (
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800 rounded-xl p-4 space-y-4 mt-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Record New Payment</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={remainingBalance}
                      required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    />
                    <Select
                      label="Method"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="Card">Card</option>
                      <option value="Cheque">Cheque</option>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Reference"
                      placeholder="e.g. TXN-10293"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                    />
                    <Input
                      label="Notes"
                      placeholder="Optional notes"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowAddPayment(false)}
                      disabled={recordingPayment}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      size="sm" 
                      disabled={recordingPayment || paymentAmount <= 0}
                      onClick={async () => {
                        if (paymentAmount <= 0) {
                          alert('Amount must be greater than zero');
                          return;
                        }
                        if (paymentAmount > remainingBalance + 0.005) {
                          alert(`Amount cannot exceed the remaining balance of NPR ${remainingBalance.toFixed(2)}`);
                          return;
                        }
                        setRecordingPayment(true);
                        try {
                          await api.recordPayment({
                            amount: paymentAmount,
                            paymentMethod: paymentMethod,
                            reference: paymentReference,
                            notes: paymentNotes || 'Recorded from Sales details',
                            customerId: selectedSale.customerId,
                            saleId: selectedSale.id
                          });
                          await loadPayments();
                          await loadSales(); // Refresh the main sales list to reflect state changes
                          setShowAddPayment(false);
                        } catch (err: any) {
                          alert(err.message || 'Failed to record payment');
                        } finally {
                          setRecordingPayment(false);
                        }
                      }}
                    >
                      {recordingPayment ? 'Recording...' : 'Submit Payment'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Returns History Section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Returns History</p>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const initQties: { [productId: number]: number } = {};
                    selectedSale.items.forEach(item => {
                      initQties[item.productId] = 0;
                    });
                    setReturnQuantities(initQties);
                    setReturnNotes('');
                    setOpenReturn(true);
                  }}
                  className="cursor-pointer"
                >
                  <Plus size={14} className="mr-1" />
                  <span>Process Return</span>
                </Button>
              </div>

              {loadingReturns ? (
                <p className="text-xs text-slate-400">Loading returns...</p>
              ) : saleReturns.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No returns processed for this sale.</p>
              ) : (
                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                  {saleReturns.map((ret) => (
                    <div key={ret.id} className="bg-slate-50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex justify-between items-center font-semibold">
                        <span className="text-slate-900 dark:text-slate-200">{ret.returnNumber}</span>
                        <span className="text-rose-600 dark:text-rose-400">NPR {ret.totalAmount.toFixed(2)}</span>
                      </div>
                      <p className="text-slate-400 text-3xs">{new Date(ret.returnDate).toLocaleString()}</p>
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800/60 text-slate-500 dark:text-slate-400">
                        {ret.items?.map((ri: any) => `${ri.product?.name || 'Product'} (x${ri.quantity})`).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Process Return Modal inside Details */}
            {openReturn && (
              <Dialog
                open={openReturn}
                onClose={() => setOpenReturn(false)}
                title={`Sales Return: ${selectedSale.saleNumber}`}
                size="md"
              >
                <div className="space-y-4 text-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select quantities to return back to inventory for each item:
                  </p>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {selectedSale.items?.map((item) => (
                      <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800 rounded-xl p-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-200">{item.product?.name}</p>
                          <p className="text-xs text-slate-400">Purchased: {item.quantity} | Unit Price: NPR {(item.unitPrice ?? 0).toFixed(2)}</p>
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={returnQuantities[item.productId] || 0}
                            onChange={(e) => {
                              const val = Math.min(item.quantity, Math.max(0, parseFloat(e.target.value) || 0));
                              setReturnQuantities(prev => ({ ...prev, [item.productId]: val }));
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <Input
                    label="Return Notes / Reason"
                    placeholder="e.g. Defective item, Customer exchange..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                  />

                  <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="ghost" onClick={() => setOpenReturn(false)} disabled={submittingReturn}>
                      Cancel
                    </Button>
                    <Button 
                      disabled={submittingReturn || !Object.values(returnQuantities).some(q => q > 0)}
                      onClick={async () => {
                        const itemsToReturn = Object.entries(returnQuantities)
                          .filter(([_, qty]) => qty > 0)
                          .map(([prodId, qty]) => {
                            const origItem = selectedSale.items.find(i => i.productId === Number(prodId));
                            return {
                              productId: Number(prodId),
                              quantity: qty,
                              unitPrice: origItem?.unitPrice || 0
                            };
                          });

                        if (itemsToReturn.length === 0) {
                          alert('Please enter at least one quantity to return.');
                          return;
                        }

                        const totalAmount = itemsToReturn.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

                        setSubmittingReturn(true);
                        try {
                          await api.createSalesReturn({
                            customerId: selectedSale.customerId,
                            saleId: selectedSale.id,
                            items: itemsToReturn,
                            totalAmount,
                            notes: returnNotes
                          });
                          await loadReturns();
                          await loadSales();
                          setOpenReturn(false);
                        } catch (err: any) {
                          alert(err.message || 'Failed to process return');
                        } finally {
                          setSubmittingReturn(false);
                        }
                      }}
                    >
                      {submittingReturn ? 'Processing...' : 'Confirm Return'}
                    </Button>
                  </div>
                </div>
              </Dialog>
            )}

          </div>
        </Dialog>
      )}
    </div>
  );
}
