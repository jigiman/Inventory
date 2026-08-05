import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, ArrowDownRight, Clipboard, Calendar, Building2, Package, RefreshCw, Phone, Mail, User } from 'lucide-react';
import { api } from '../api';
import type { PurchaseOrder } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';

interface PurchaseOrderDetailProps {
  purchaseOrderId: number;
  onBack: () => void;
  onRefreshList?: () => void;
}

export default function PurchaseOrderDetail({ purchaseOrderId, onBack, onRefreshList }: PurchaseOrderDetailProps) {
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Receive Items States
  const [openReceive, setOpenReceive] = useState(false);
  const [receiveQuantities, setReceiveQuantities] = useState<{ [productId: number]: number }>({});
  const [submittingReceive, setSubmittingReceive] = useState(false);

  // Return Items States
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [openReturn, setOpenReturn] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<{ [productId: number]: number }>({});
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  async function loadOrderDetail() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPurchaseOrder(purchaseOrderId);
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase order details');
    } finally {
      setLoading(false);
    }
  }

  async function loadReturns() {
    if (!purchaseOrderId) return;
    setLoadingReturns(true);
    try {
      const data = await api.getPurchaseReturns({ purchaseOrderId });
      setPurchaseReturns(data);
    } catch (e) {
      console.error('Failed to load purchase returns', e);
    } finally {
      setLoadingReturns(false);
    }
  }

  useEffect(() => {
    loadOrderDetail();
    loadReturns();
  }, [purchaseOrderId]);

  const totalReturned = purchaseReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

  const handleOpenReceive = () => {
    if (!order) return;
    const initial: { [key: number]: number } = {};
    order.items.forEach(item => {
      initial[item.productId] = item.quantityOrdered;
    });
    setReceiveQuantities(initial);
    setOpenReceive(true);
  };

  const handleSaveReceive = async () => {
    if (!order || !order.id) return;
    setSubmittingReceive(true);
    try {
      const payload = Object.keys(receiveQuantities).map(pidStr => ({
        productId: parseInt(pidStr),
        quantityReceived: receiveQuantities[parseInt(pidStr)]
      }));
      await api.receivePurchaseOrder(order.id, payload);
      setOpenReceive(false);
      await loadOrderDetail();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      alert(err.message || 'Failed to receive items');
    } finally {
      setSubmittingReceive(false);
    }
  };

  const handleOpenReturn = () => {
    if (!order) return;
    const initQties: { [productId: number]: number } = {};
    order.items.forEach(item => {
      initQties[item.productId] = 0;
    });
    setReturnQuantities(initQties);
    setReturnNotes('');
    setOpenReturn(true);
  };

  const handleSaveReturn = async () => {
    if (!order || !order.id) return;
    const returnedItems = order.items.map(item => {
      const qty = returnQuantities[item.productId] ?? 0;
      return {
        productId: item.productId,
        quantity: qty,
        costPrice: item.unitPrice ?? item.costPrice
      };
    }).filter(item => item.quantity > 0);

    if (returnedItems.length === 0) {
      alert('Please specify return quantity greater than zero for at least one product.');
      return;
    }

    setSubmittingReturn(true);
    try {
      const totalAmount = returnedItems.reduce((sum, item) => sum + (item.quantity * (item.costPrice ?? 0)), 0);
      await api.createPurchaseReturn({
        supplierId: order.supplierId,
        purchaseOrderId: order.id,
        totalAmount,
        notes: returnNotes,
        items: returnedItems
      });
      setOpenReturn(false);
      await loadReturns();
      await loadOrderDetail();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      alert(err.message || 'Failed to record purchase return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="inline-flex items-center space-x-2">
          <ArrowLeft size={16} />
          <span>Back to Purchase Orders</span>
        </Button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error || 'Purchase Order not found.'}
        </div>
      </div>
    );
  }

  const isReceived = order.status === 'Received';

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-5">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onBack} className="inline-flex items-center space-x-2 cursor-pointer">
            <ArrowLeft size={18} />
            <span>Back</span>
          </Button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {order.orderNumber}
              </h1>
              <span
                className={`text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border ${
                  isReceived
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400'
                }`}
              >
                {order.status}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <Calendar size={13} />
              <span>
                Ordered on {order.orderDate ? new Date(order.orderDate).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { loadOrderDetail(); loadReturns(); }}
            className="inline-flex items-center space-x-1.5 cursor-pointer"
            title="Refresh Details"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </Button>

          {!isReceived ? (
            <Button
              onClick={handleOpenReceive}
              className="inline-flex items-center space-x-2 cursor-pointer shadow-md shadow-indigo-500/20"
            >
              <ArrowDownRight size={16} />
              <span>Receive Items</span>
            </Button>
          ) : (
            <Button
              onClick={handleOpenReturn}
              variant="outline"
              className="inline-flex items-center space-x-2 cursor-pointer border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
            >
              <Plus size={16} />
              <span>Record Return</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Details & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supplier Info Card */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 mb-4">
              <Building2 size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Supplier Details
              </h2>
            </div>
            {order.supplier ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Supplier Name</p>
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-base mt-0.5">{order.supplier.name}</p>
                </div>
                {order.supplier.contactPerson && (
                  <div className="flex items-start space-x-2">
                    <User size={15} className="mt-1 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contact Person</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{order.supplier.contactPerson}</p>
                    </div>
                  </div>
                )}
                {order.supplier.phone && (
                  <div className="flex items-start space-x-2">
                    <Phone size={15} className="mt-1 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phone</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{order.supplier.phone}</p>
                    </div>
                  </div>
                )}
                {order.supplier.email && (
                  <div className="flex items-start space-x-2">
                    <Mail size={15} className="mt-1 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{order.supplier.email}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No supplier information attached.</p>
            )}
          </div>

          {/* Items Table Card */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 mb-4">
              <Package size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Purchased Items ({order.items?.length || 0})
              </h2>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200/50 dark:border-slate-800/60">
              <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                <thead className="bg-slate-50 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-800/60">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty Ordered</th>
                    <th className="px-4 py-3 text-right">Qty Received</th>
                    <th className="px-4 py-3 text-right">Unit Price</th>
                    <th className="px-4 py-3 text-right">Total Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {order.items?.map((item) => {
                    const price = item.unitPrice ?? item.costPrice ?? 0;
                    const lineTotal = (item.quantityOrdered ?? 0) * price;
                    return (
                      <tr key={item.id || item.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                          {item.product?.name || `Product #${item.productId}`}
                          {item.product?.sku && (
                            <span className="block text-xs font-mono font-normal text-slate-400 mt-0.5">
                              SKU: {item.product.sku}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-800 dark:text-slate-200">
                          {item.quantityOrdered}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold">
                          <span className={item.quantityReceived >= item.quantityOrdered ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                            {item.quantityReceived}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium">
                          NPR {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3.5 text-right font-extrabold text-slate-900 dark:text-slate-100">
                          NPR {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Returns History Card */}
          {isReceived && (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                  <Clipboard size={18} />
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Returns History
                  </h2>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenReturn}
                  className="cursor-pointer text-xs"
                >
                  <Plus size={14} className="mr-1" />
                  <span>Record Return</span>
                </Button>
              </div>

              {loadingReturns ? (
                <p className="text-xs text-slate-400">Loading returns history...</p>
              ) : purchaseReturns.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No returns recorded for this purchase order.</p>
              ) : (
                <div className="space-y-3">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/50 dark:border-slate-800/60 rounded-xl overflow-hidden">
                    {purchaseReturns.map((r) => (
                      <div key={r.id} className="flex justify-between items-center p-3.5 bg-slate-50/50 dark:bg-slate-950/20 text-xs">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{r.returnNumber}</span>
                          <span className="text-slate-400 mx-2">|</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            NPR {(r.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          {r.notes && <span className="text-slate-400 ml-2 font-normal">({r.notes})</span>}
                        </div>
                        <span className="text-slate-400 font-medium">{new Date(r.returnDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2 text-sm font-bold border-t border-slate-150 dark:border-slate-800">
                    <span className="text-slate-500">Total Returned:</span>
                    <span className="text-rose-600 dark:text-rose-400">
                      NPR {totalReturned.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Summary (1 col) */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40 space-y-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Financial Summary
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Order Subtotal</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  NPR {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {totalReturned > 0 && (
                <div className="flex justify-between items-center text-rose-600 dark:text-rose-400">
                  <span>Total Returns</span>
                  <span className="font-bold">
                    - NPR {totalReturned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-3 flex justify-between items-center">
                <span className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Net Total</span>
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xl">
                  NPR {(order.totalAmount - totalReturned).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Status</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{order.status}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Total Items</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{order.items?.length || 0} items</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receive PO Dialog */}
      <Dialog open={openReceive} onClose={() => setOpenReceive(false)} title={`Receive Purchase Order: ${order.orderNumber}`} size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveReceive(); }} className="space-y-6">
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {order.items.map(item => (
              <div key={item.productId} className="flex gap-4 items-center justify-between py-3.5 border-b border-slate-100 dark:border-slate-800/40">
                <div className="flex-1">
                  <p className="font-bold text-slate-800 dark:text-slate-200">{item.product?.name}</p>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Ordered Qty: {item.quantityOrdered}</p>
                </div>
                <div className="w-40">
                  <Input
                    label="Received Qty"
                    type="number"
                    min="0"
                    value={receiveQuantities[item.productId] ?? 0}
                    onChange={(e) => setReceiveQuantities({ ...receiveQuantities, [item.productId]: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpenReceive(false)} disabled={submittingReceive}>Cancel</Button>
            <Button type="submit" disabled={submittingReceive}>
              {submittingReceive ? 'Saving...' : 'Post to Inventory'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Return Purchase Items Dialog */}
      {openReturn && (
        <Dialog
          open={openReturn}
          onClose={() => setOpenReturn(false)}
          title={`Return Items for Purchase Order: ${order.orderNumber}`}
          size="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveReturn();
            }}
            className="space-y-6"
          >
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {order.items.map(item => {
                const prevReturnedQty = purchaseReturns.reduce((sum, ret) => {
                  const retItem = ret.items?.find((ri: any) => ri.productId === item.productId);
                  return sum + (retItem?.quantity ?? 0);
                }, 0);
                const maxReturn = item.quantityReceived - prevReturnedQty;

                return (
                  <div key={item.productId} className="flex gap-4 items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/40">
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{item.product?.name}</p>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        Received: {item.quantityReceived} | Already Returned: {prevReturnedQty}
                      </p>
                    </div>
                    <div className="w-32">
                      <Input
                        label="Return Qty"
                        type="number"
                        min="0"
                        max={maxReturn}
                        step="0.01"
                        value={returnQuantities[item.productId] ?? 0}
                        onChange={(e) => setReturnQuantities({ ...returnQuantities, [item.productId]: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <Input
              label="Return Notes"
              placeholder="Reason for return, condition of items, etc."
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />

            <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setOpenReturn(false)} disabled={submittingReturn}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingReturn}>
                {submittingReturn ? 'Saving...' : 'Submit Return'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
