import { useState, useEffect, useMemo } from 'react';
import { Trash2, Plus, ArrowDownRight, Clipboard, Eye } from 'lucide-react';
import { api } from '../api';
import type { PurchaseOrder, Supplier, Product, PurchaseItem } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import PurchaseOrderDetail from './PurchaseOrderDetail';

export default function Purchasing() {
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectableProducts = useMemo(() => {
    return products.flatMap(p => 
      p.variants && p.variants.length > 0 
        ? p.variants.map(v => ({ 
            id: v.id, 
            name: `${p.name} (${v.variantValues})`, 
            sku: v.sku, 
            costPrice: v.costPrice, 
            sellingPrice: v.sellingPrice 
          }))
        : [{ 
            id: p.id, 
            name: p.name, 
            sku: p.sku, 
            costPrice: p.costPrice, 
            sellingPrice: p.sellingPrice 
          }]
    );
  }, [products]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination States
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);

  // Dialog States
  const [openCreate, setOpenCreate] = useState(false);
  const [openReceive, setOpenReceive] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // New PO Form States
  const [selectedSupplierId, setSelectedSupplierId] = useState<number>(0);
  const [poItems, setPoItems] = useState<{ productId: number; quantityOrdered: number; costPrice: number }[]>([
    { productId: 0, quantityOrdered: 1, costPrice: 0 }
  ]);

  // Receive Form States
  const [receiveQuantities, setReceiveQuantities] = useState<{ [productId: number]: number }>({});

  async function loadOrders() {
    setLoading(true);
    setError('');
    try {
      const result = await api.getPurchaseOrders({
        page: currentPage,
        pageSize: pageSize,
        search: searchQuery || undefined,
        status: filterStatus,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      setOrders(result.items);
      setTotalCount(result.totalCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    setError('');
    try {
      const [sups, prods] = await Promise.all([
        api.getSuppliers(),
        api.getProducts(1, 1000),
      ]);
      setSuppliers(sups);
      setProducts(prods.items);
      if (sups.length > 0) setSelectedSupplierId(sups[0].id!);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchasing data');
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      loadOrders();
    }
  }, [searchQuery, filterStatus, startDate, endDate]);

  useEffect(() => {
    loadOrders();
  }, [currentPage]);

  const handleOpenCreate = () => {
    if (selectableProducts.length > 0) {
      setPoItems([{ productId: selectableProducts[0].id || 0, quantityOrdered: 1, costPrice: selectableProducts[0].costPrice || 0 }]);
    } else {
      setPoItems([{ productId: 0, quantityOrdered: 1, costPrice: 0 }]);
    }
    if (suppliers.length > 0) {
      setSelectedSupplierId(suppliers[0].id || 0);
    }
    setOpenCreate(true);
  };

  const handleAddPoItem = () => {
    setPoItems([...poItems, { productId: selectableProducts[0]?.id || 0, quantityOrdered: 1, costPrice: selectableProducts[0]?.costPrice || 0 }]);
  };

  const handleRemovePoItem = (index: number) => {
    const next = [...poItems];
    next.splice(index, 1);
    setPoItems(next);
  };

  const handlePoItemChange = (index: number, field: string, value: any) => {
    const next = [...poItems];
    next[index] = { ...next[index], [field]: value };
    if (field === 'productId') {
      const prod = selectableProducts.find(p => p.id === value);
      if (prod) {
        next[index].costPrice = prod.costPrice;
      }
    }
    setPoItems(next);
  };

  const handleSavePo = async () => {
    if (poItems.some(i => i.productId === 0 || i.quantityOrdered <= 0)) {
      alert('Please check all items have valid products and quantities.');
      return;
    }
    try {
      const items: PurchaseItem[] = poItems.map(i => ({
        productId: i.productId,
        quantityOrdered: i.quantityOrdered,
        quantityReceived: 0,
        costPrice: i.costPrice,
        unitPrice: i.costPrice // Using costPrice as unitPrice for simplicity in the PO
      }));
      const totalAmount = items.reduce((sum, item) => sum + (item.quantityOrdered * item.costPrice), 0);
      await api.createPurchaseOrder({
        supplierId: selectedSupplierId,
        items,
        totalAmount
      });
      setOpenCreate(false);
      loadData();
      loadOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to create Purchase Order');
    }
  };

  const handleOpenReceive = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    const initial: { [key: number]: number } = {};
    order.items.forEach(item => {
      initial[item.productId] = item.quantityOrdered; // default to ordered quantity
    });
    setReceiveQuantities(initial);
    setOpenReceive(true);
  };

  const handleSaveReceive = async () => {
    if (!selectedOrder) return;
    try {
      const payload = Object.keys(receiveQuantities).map(pidStr => ({
        productId: parseInt(pidStr),
        quantityReceived: receiveQuantities[parseInt(pidStr)]
      }));
      await api.receivePurchaseOrder(selectedOrder.id!, payload);
      setOpenReceive(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to receive items');
    }
  };

  if (viewMode === 'detail' && selectedOrderId !== null) {
    return (
      <PurchaseOrderDetail
        purchaseOrderId={selectedOrderId}
        onBack={() => {
          setViewMode('list');
          setSelectedOrderId(null);
        }}
        onRefreshList={loadOrders}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center">
        <Button onClick={handleOpenCreate} disabled={suppliers.length === 0 || products.length === 0} className="inline-flex items-center space-x-2">
          <Plus size={16} />
          <span>New Purchase Order</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-650 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/60">
        <Input
          label="Search Purchase Order"
          placeholder="PO # or Supplier Name..."
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
          <option value="Pending">Pending</option>
          <option value="Received">Received</option>
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-650 border-t-transparent dark:border-indigo-400" />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-200/50 dark:border-slate-800/60">
          <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
            <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
              <tr>
                <th className="px-6 py-4">Order Number</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4">Order Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">{order.orderNumber}</td>
                  <td className="px-6 py-4 font-medium">{order.supplier?.name}</td>
                  <td className="px-6 py-4 text-slate-450">{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : ''}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-3xs font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${
                        order.status === 'Received'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250/10 dark:bg-emerald-950/20 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-700 border-amber-250/10 dark:bg-amber-950/20 dark:text-amber-400'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setSelectedOrderId(order.id!); setViewMode('detail'); }}
                        className="inline-flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Eye size={14} />
                        <span>Details</span>
                      </Button>
                      {order.status !== 'Received' ? (
                        <Button variant="outline" size="sm" onClick={() => handleOpenReceive(order)} className="inline-flex items-center space-x-1.5">
                          <ArrowDownRight size={14} />
                          <span>Receive Items</span>
                        </Button>
                      ) : (
                        <span className="inline-flex items-center text-xs font-semibold text-slate-400 space-x-1 px-3">
                          <Clipboard size={14} />
                          <span>Completed</span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    No purchase orders matching filters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/60 text-xs mt-4">
            <span className="text-slate-550 dark:text-slate-400 font-medium">
              Showing {orders.length} of {totalCount} purchase orders
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

      {/* Create PO Dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} title="Create Purchase Order" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSavePo(); }} className="space-y-6">
          <Select
            label="Supplier"
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(Number(e.target.value))}
          >
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">Items to Order</h3>
            
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {poItems.map((item, idx) => (
                <div key={idx} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Select
                      label="Product"
                      value={item.productId}
                      onChange={(e) => handlePoItemChange(idx, 'productId', Number(e.target.value))}
                    >
                      {selectableProducts.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      label="Qty"
                      type="number"
                      min="1"
                      value={item.quantityOrdered}
                      onChange={(e) => handlePoItemChange(idx, 'quantityOrdered', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      label="Cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.costPrice}
                      onChange={(e) => handlePoItemChange(idx, 'costPrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePoItem(idx)}
                    disabled={poItems.length === 1}
                    className="p-2.5 mb-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 rounded-xl cursor-pointer transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 inline-flex items-center space-x-1.5"
              onClick={handleAddPoItem}
            >
              <Plus size={14} />
              <span>Add Item</span>
            </Button>
          </div>

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button type="submit">Create Order</Button>
          </div>
        </form>
      </Dialog>

      {/* Receive PO Dialog */}
      <Dialog open={openReceive} onClose={() => setOpenReceive(false)} title={`Receive Purchase Order: ${selectedOrder?.orderNumber}`} size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveReceive(); }} className="space-y-6">
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {selectedOrder?.items.map(item => (
              <div key={item.productId} className="flex gap-4 items-center justify-between py-3.5 border-b border-slate-100 dark:border-slate-800/40">
                <div className="flex-1">
                  <p className="font-bold text-slate-805 dark:text-slate-200">{item.product?.name}</p>
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
            <Button type="button" variant="outline" onClick={() => setOpenReceive(false)}>Cancel</Button>
            <Button type="submit">Post to Inventory</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
