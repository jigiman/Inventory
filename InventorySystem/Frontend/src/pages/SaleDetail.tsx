import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Plus, CreditCard, RefreshCw, Calendar, User, Package } from 'lucide-react';
import { api } from '../api';
import type { Sale } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { isPhotino, pickSaveFile, saveFileData } from '../utils/photino';

interface SaleDetailProps {
  saleId: number;
  onBack: () => void;
  onRefreshList?: () => void;
}

export default function SaleDetail({ saleId, onBack, onRefreshList }: SaleDetailProps) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

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

  async function loadSaleDetail() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getSale(saleId);
      setSale(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sale details');
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments() {
    if (!saleId) return;
    setLoadingPayments(true);
    try {
      const data = await api.getPayments({ saleId });
      setPayments(data);
    } catch (e) {
      console.error('Failed to load payments', e);
    } finally {
      setLoadingPayments(false);
    }
  }

  async function loadReturns() {
    if (!saleId) return;
    setLoadingReturns(true);
    try {
      const data = await api.getSalesReturns({ saleId });
      setSaleReturns(data);
    } catch (e) {
      console.error('Failed to load returns', e);
    } finally {
      setLoadingReturns(false);
    }
  }

  useEffect(() => {
    loadSaleDetail();
    loadPayments();
    loadReturns();
  }, [saleId]);

  const totalPaid = payments.reduce((sum, p) => sum + (p.isRefund ? -p.amount : p.amount), 0);
  const totalReturned = saleReturns.reduce((sum, r) => sum + r.totalAmount, 0);
  const remainingBalance = (sale?.totalAmount ?? 0) - totalReturned - totalPaid;

  const handleDownloadPdf = async () => {
    if (!sale || !sale.id) return;
    setDownloadingPdf(true);
    try {
      const pdfUrl = api.getSalePdfUrl(sale.id);
      const defaultFilename = `Invoice_${sale.saleNumber}.pdf`;

      if (isPhotino()) {
        const path = await pickSaveFile('pdf', defaultFilename);
        if (!path) {
          setDownloadingPdf(false);
          return;
        }
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error('Failed to download invoice PDF');
        const blob = await response.blob();

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          saveFileData(path, base64data);
          setDownloadingPdf(false);
        };
        reader.readAsDataURL(blob);
      } else {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error('Failed to generate PDF');
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        setDownloadingPdf(false);
      }
    } catch (err: any) {
      console.error('Error downloading PDF:', err);
      alert(err.message || 'Failed to download PDF invoice');
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="inline-flex items-center space-x-2">
          <ArrowLeft size={16} />
          <span>Back to Sales</span>
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error || 'Sale transaction not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onBack} className="inline-flex items-center space-x-2 cursor-pointer">
            <ArrowLeft size={18} />
            <span>Back</span>
          </Button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Invoice {sale.saleNumber}
              </h1>
              <span className="text-xs font-extrabold uppercase tracking-wide px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200/40 dark:bg-emerald-950/20 dark:text-emerald-400">
                {sale.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <Calendar size={13} />
              <span>Created on {sale.saleDate ? new Date(sale.saleDate).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }) : '-'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-sm"
          >
            <Download size={16} />
            <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </Button>
        </div>
      </div>

      {/* Main Detail Cards Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Columns: Items & Summary */}
        <div className="lg:col-span-2 space-y-6">

          {/* Customer Card */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/40">
            <div className="flex items-center space-x-2 mb-3 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-2xs font-extrabold">
              <User size={14} />
              <span>Customer Information</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-base">{sale.customer?.name || 'Walk-in Customer'}</p>
                {sale.customer?.contactPerson && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Contact: {sale.customer.contactPerson}</p>
                )}
              </div>
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {sale.customer?.phone && <p><span className="font-medium text-slate-400">Phone:</span> {sale.customer.phone}</p>}
                {sale.customer?.email && <p><span className="font-medium text-slate-400">Email:</span> {sale.customer.email}</p>}
              </div>
            </div>
          </div>

          {/* Invoice Line Items */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-2xs font-extrabold">
                <Package size={14} />
                <span>Invoice Items ({sale.items?.length || 0})</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200/50 dark:border-slate-800/60">
              <table className="w-full text-left text-xs text-slate-500 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-2xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/60">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {sale.items?.map((item) => {
                    const gross = (item.quantity ?? 0) * (item.unitPrice ?? 0);
                    const disc = item.discountAmount ?? 0;
                    const lineNet = Math.max(0, gross - disc);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-200">
                          {item.product?.name}
                          <div className="flex gap-2 text-3xs font-normal font-mono text-slate-400 mt-0.5">
                            {item.product?.sku && <span>SKU: {item.product.sku}</span>}
                            {item.supplier?.name && <span className="text-indigo-500 font-sans font-medium">Supplier: {item.supplier.name}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-200">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">NPR {(item.unitPrice ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400 font-medium">
                          {disc > 0 ? `- NPR ${disc.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                          NPR {lineNet.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Totals Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-80 rounded-xl bg-slate-50 dark:bg-slate-950/40 p-4 border border-slate-200/50 dark:border-slate-800 space-y-2">
                {sale.subTotal !== undefined && sale.subTotal > 0 && (
                  <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-semibold">NPR {sale.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {sale.discountAmount !== undefined && sale.discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                    <span>Bill Discount:</span>
                    <span className="font-semibold">- NPR {sale.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {sale.charges && sale.charges.length > 0 && (
                  <div className="space-y-1 py-1 border-t border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-3xs font-extrabold uppercase tracking-wider text-slate-400 block">Additional Charges</span>
                    {sale.charges.map((ch, idx) => (
                      <div key={ch.id || idx} className="flex justify-between text-xs text-indigo-600 dark:text-indigo-400">
                        <span>{ch.chargeName}:</span>
                        <span className="font-semibold">+ NPR {(ch.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Total Sale Amount</span>
                  <span className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400">
                    NPR {sale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Column: Payments & Returns Sidebars */}
        <div className="space-y-6">

          {/* Payments Box */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/40 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-2xs font-extrabold">
                <CreditCard size={14} />
                <span>Payment History</span>
              </div>
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
                  className="cursor-pointer text-xs"
                >
                  <Plus size={13} className="mr-1" />
                  <span>Record Payment</span>
                </Button>
              )}
            </div>

            {loadingPayments ? (
              <p className="text-xs text-slate-400">Loading payments...</p>
            ) : payments.length === 0 ? (
              <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <p className="text-xs italic">No payments recorded yet.</p>
                <p className="text-xs font-bold text-amber-500 mt-1">Remaining: NPR {remainingBalance.toFixed(2)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800 rounded-xl p-3 text-xs">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-200">NPR {(p.amount ?? 0).toFixed(2)}</span>
                        <span className="text-slate-400 mx-1.5">|</span>
                        <span className="text-slate-550 dark:text-slate-400 font-medium">{p.paymentMethod}</span>
                        {p.reference && <span className="text-slate-400 block text-3xs">Ref: {p.reference}</span>}
                      </div>
                      <span className="text-slate-400 font-medium">{new Date(p.paymentDate).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs font-bold pt-3 border-t border-slate-150 dark:border-slate-800">
                  <span className="text-slate-400">Paid / Balance:</span>
                  <span>
                    NPR {totalPaid.toFixed(2)} / <span className={remainingBalance > 0 ? "text-amber-500" : "text-emerald-500"}>NPR {remainingBalance.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            )}

            {/* Add Payment Inline Form */}
            {showAddPayment && (
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800 rounded-xl p-4 space-y-3 mt-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">New Payment</h4>
                <div className="space-y-3">
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
                        alert(`Amount cannot exceed remaining balance of NPR ${remainingBalance.toFixed(2)}`);
                        return;
                      }
                      setRecordingPayment(true);
                      try {
                        await api.recordPayment({
                          amount: paymentAmount,
                          paymentMethod: paymentMethod,
                          reference: paymentReference,
                          notes: paymentNotes || 'Recorded from Sales detail page',
                          customerId: sale.customerId,
                          saleId: sale.id
                        });
                        await loadPayments();
                        await loadSaleDetail();
                        if (onRefreshList) onRefreshList();
                        setShowAddPayment(false);
                      } catch (err: any) {
                        alert(err.message || 'Failed to record payment');
                      } finally {
                        setRecordingPayment(false);
                      }
                    }}
                  >
                    {recordingPayment ? 'Saving...' : 'Submit Payment'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Sales Returns Box */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/40 space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-2xs font-extrabold">
                <RefreshCw size={14} />
                <span>Sales Returns</span>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const initQties: { [productId: number]: number } = {};
                  sale.items?.forEach(item => {
                    initQties[item.productId] = 0;
                  });
                  setReturnQuantities(initQties);
                  setReturnNotes('');
                  setOpenReturn(true);
                }}
                className="cursor-pointer text-xs"
              >
                <Plus size={13} className="mr-1" />
                <span>Process Return</span>
              </Button>
            </div>

            {loadingReturns ? (
              <p className="text-xs text-slate-400">Loading returns...</p>
            ) : saleReturns.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No returns recorded for this sale.</p>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
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

            {/* Process Return Modal */}
            {openReturn && (
              <Dialog
                open={openReturn}
                onClose={() => setOpenReturn(false)}
                title={`Process Return: ${sale.saleNumber}`}
                size="md"
              >
                <div className="space-y-4 text-sm">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select quantities to return back to inventory for each item:
                  </p>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {sale.items?.map((item) => (
                      <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800 rounded-xl p-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-200">{item.product?.name}</p>
                          <p className="text-xs text-slate-400">Purchased: {item.quantity} | Price: NPR {(item.unitPrice ?? 0).toFixed(2)}</p>
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
                            const origItem = sale.items?.find(i => i.productId === Number(prodId));
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
                            customerId: sale.customerId,
                            saleId: sale.id,
                            items: itemsToReturn,
                            totalAmount,
                            notes: returnNotes
                          });
                          await loadReturns();
                          await loadSaleDetail();
                          if (onRefreshList) onRefreshList();
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

        </div>

      </div>
    </div>
  );
}
