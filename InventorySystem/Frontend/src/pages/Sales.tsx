import { useState, useEffect } from 'react';
import { Trash2, Plus, ShoppingBag, Eye } from 'lucide-react';
import { api } from '../api';
import type { Sale, Customer, Product, SaleItem } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog States
  const [openCreate, setOpenCreate] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // New Sale Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [saleItems, setSaleItems] = useState<{ productId: number; quantity: number; unitPrice: number }[]>([
    { productId: 0, quantity: 1, unitPrice: 0 }
  ]);

  // Inline Customer Creation States
  const [showAddCustomerInline, setShowAddCustomerInline] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

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

  async function loadData() {
    setError('');
    try {
      const [custs, prods] = await Promise.all([
        api.getCustomers(),
        api.getProducts(),
      ]);
      setCustomers(custs);
      setProducts(prods.items);
      if (custs.length > 0) setSelectedCustomerId(custs[0].id!);
      if (prods.items.length > 0) {
          setSaleItems([{ productId: prods.items[0].id!, quantity: 1, unitPrice: prods.items[0].sellingPrice }]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sales data');
    }
  }

  async function refreshCustomers(selectNewId?: number) {
    try {
      const custs = await api.getCustomers();
      setCustomers(custs);
      if (selectNewId) {
        setSelectedCustomerId(selectNewId);
      } else if (custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].id!);
      }
    } catch (e) {
      console.error('Failed to refresh customers', e);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Reset to page 1 on filter change, but if we are already at page 1 loadSales
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



  const handleAddSaleItem = () => {
    const defaultProd = products[0];
    setSaleItems([...saleItems, { productId: defaultProd?.id || 0, quantity: 1, unitPrice: defaultProd?.sellingPrice || 0 }]);
  };

  const handleRemoveSaleItem = (index: number) => {
    const next = [...saleItems];
    next.splice(index, 1);
    setSaleItems(next);
  };

  const handleSaleItemChange = (index: number, field: string, value: any) => {
    const next = [...saleItems];
    next[index] = { ...next[index], [field]: value };
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        next[index].unitPrice = prod.sellingPrice;
      }
    }
    setSaleItems(next);
  };

  const handleSaveSale = async () => {
    if (saleItems.some(i => i.productId === 0 || i.quantity <= 0)) {
      alert('Please check all items have valid products and quantities.');
      return;
    }
    try {
      const items: SaleItem[] = saleItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice
      }));
      const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      await api.createSale({
        customerId: selectedCustomerId,
        items,
        totalAmount
      });
      setOpenCreate(false);
      loadData();
      await loadSales();
    } catch (err: any) {
      alert(err.message || 'Failed to create Sale');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-end gap-1.5 pb-2">
        <Button 
          onClick={() => {
            setOpenCreate(true);
            setShowAddCustomerInline(false);
          }} 
          disabled={products.length === 0} 
          className="inline-flex items-center space-x-2"
        >
          <Plus size={16} />
          <span>New Sale</span>
        </Button>
        {products.length === 0 && (
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            * Please add a Product in the <strong>Products</strong> tab to record a sale.
          </p>
        )}
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
                  <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-slate-200">${sale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
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

      {/* Create Sale Dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} title="New Sale Transaction" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveSale(); }} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select
                  label="Customer"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                  disabled={showAddCustomerInline}
                >
                  {customers.length === 0 && <option value="0">-- No Customers Available (Click New Customer) --</option>}
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              {!showAddCustomerInline && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddCustomerInline(true);
                    setNewCustomerName('');
                    setNewCustomerPhone('');
                  }}
                  className="mb-1 cursor-pointer"
                >
                  <Plus size={16} className="mr-1" />
                  <span>New Customer</span>
                </Button>
              )}
            </div>

            {showAddCustomerInline && (
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800 rounded-xl p-4 space-y-4 mt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Quick Add Customer</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Customer Name"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                  />
                  <Input
                    label="Phone Number"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="e.g. +1 555-0199"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowAddCustomerInline(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={async () => {
                      if (!newCustomerName.trim()) {
                        alert('Customer name is required');
                        return;
                      }
                      try {
                        const newCust = await api.createCustomer({
                          name: newCustomerName,
                          phone: newCustomerPhone,
                          contactPerson: '',
                          email: '',
                          address: '',
                          notes: 'Created inline from Sales screen'
                        });
                        await refreshCustomers(newCust.id);
                        setShowAddCustomerInline(false);
                      } catch (err: any) {
                        alert(err.message || 'Failed to create customer');
                      }
                    }}
                  >
                    Save Customer
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">Sale Items</h3>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {saleItems.map((item, idx) => (
                <div key={idx} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Select
                      label="Product"
                      value={item.productId}
                      onChange={(e) => handleSaleItemChange(idx, 'productId', Number(e.target.value))}
                    >
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      label="Qty"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleSaleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      label="Price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => handleSaleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSaleItem(idx)}
                    disabled={saleItems.length === 1}
                    className="p-2.5 mb-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 rounded-xl cursor-pointer transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between items-center">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="inline-flex items-center space-x-1.5"
                    onClick={handleAddSaleItem}
                >
                    <Plus size={14} />
                    <span>Add Item</span>
                </Button>
                <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Amount</span>
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-50">${saleItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button type="submit" className="inline-flex items-center space-x-2">
                <ShoppingBag size={16} />
                <span>Complete Sale</span>
            </Button>
          </div>
        </form>
      </Dialog>

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
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {selectedSale.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-200">
                          {item.product?.name}
                          {item.product?.sku && <span className="block text-3xs font-normal font-mono text-slate-400 mt-0.5">{item.product.sku}</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">${(item.unitPrice ?? 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-200">
                          ${((item.quantity ?? 0) * (item.unitPrice ?? 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/40 rounded-xl p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Total Sale Amount</span>
              <span className="text-lg font-extrabold text-indigo-700 dark:text-indigo-400">
                ${selectedSale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
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
                <p className="text-xs text-slate-400 italic">No payments recorded yet. Remaining: ${remainingBalance.toFixed(2)}</p>
              ) : (
                <div className="space-y-2 mb-3">
                  <div className="max-h-[150px] overflow-y-auto pr-1 space-y-2">
                    {payments.map((p) => (
                      <div key={p.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800 rounded-xl p-2.5 text-xs">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-200">${(p.amount ?? 0).toFixed(2)}</span>
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
                      ${totalPaid.toFixed(2)} Paid / <span className={remainingBalance > 0 ? "text-amber-500" : "text-emerald-500"}>${remainingBalance.toFixed(2)} Bal</span>
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
                          alert(`Amount cannot exceed the remaining balance of $${remainingBalance.toFixed(2)}`);
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
                          await loadData(); // Refresh the main sales list to reflect state changes
                          await loadSales();
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
                  <span>Record Return</span>
                </Button>
              </div>

              {loadingReturns ? (
                <p className="text-xs text-slate-400">Loading returns...</p>
              ) : saleReturns.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No returns recorded yet.</p>
              ) : (
                <div className="space-y-2 mb-3">
                  <div className="max-h-[150px] overflow-y-auto pr-1 space-y-2">
                    {saleReturns.map((r) => (
                      <div key={r.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800 rounded-xl p-2.5 text-xs">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-200">{r.returnNumber}</span>
                          <span className="text-slate-400 mx-1.5">|</span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold">${(r.totalAmount ?? 0).toFixed(2)}</span>
                          {r.notes && <span className="text-slate-400 ml-2">({r.notes})</span>}
                        </div>
                        <span className="text-slate-400 font-medium">{new Date(r.returnDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs font-bold pt-2.5 border-t border-slate-150 dark:border-slate-800">
                    <span className="text-slate-400">Total Returned:</span>
                    <span className="text-rose-600">${totalReturned.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button onClick={() => { setOpenDetails(false); setSelectedSale(null); }}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Return Sale Items Dialog */}
      {selectedSale && openReturn && (
        <Dialog
          open={openReturn}
          onClose={() => setOpenReturn(false)}
          title={`Return Items for Sale: ${selectedSale.saleNumber}`}
          size="md"
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const returnedItems = selectedSale.items.map(item => {
                const qty = returnQuantities[item.productId] ?? 0;
                return {
                  productId: item.productId,
                  quantity: qty,
                  unitPrice: item.unitPrice
                };
              }).filter(item => item.quantity > 0);

              if (returnedItems.length === 0) {
                alert('Please specify return quantity greater than zero for at least one product.');
                return;
              }

              setSubmittingReturn(true);
              try {
                const totalAmount = returnedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
                await api.createSalesReturn({
                  customerId: selectedSale.customerId,
                  saleId: selectedSale.id,
                  totalAmount,
                  notes: returnNotes,
                  items: returnedItems
                });
                setOpenReturn(false);
                await loadReturns();
                await loadData();
                await loadSales();
              } catch (err: any) {
                alert(err.message || 'Failed to record sales return');
              } finally {
                setSubmittingReturn(false);
              }
            }}
            className="space-y-6"
          >
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
              {selectedSale.items.map(item => {
                const prevReturnedQty = saleReturns.reduce((sum, ret) => {
                  const retItem = ret.items?.find((ri: any) => ri.productId === item.productId);
                  return sum + (retItem?.quantity ?? 0);
                }, 0);
                const maxReturn = item.quantity - prevReturnedQty;

                return (
                  <div key={item.productId} className="flex gap-4 items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800/40">
                    <div className="flex-1">
                      <p className="font-bold text-slate-850 dark:text-slate-200">{item.product?.name}</p>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        Purchased: {item.quantity} | Already Returned: {prevReturnedQty}
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
