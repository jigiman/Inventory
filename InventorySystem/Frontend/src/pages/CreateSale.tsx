import { useState, useEffect, useMemo } from 'react';
import { Trash2, Plus, ArrowLeft, ShoppingBag } from 'lucide-react';
import { api } from '../api';
import type { Customer, Product, SaleItem, Charge } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

interface CreateSaleProps {
  onBack: () => void;
  onSuccess: () => void;
}

export default function CreateSale({ onBack, onSuccess }: CreateSaleProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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

  // Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [saleItems, setSaleItems] = useState<{ productId: number; quantity: number; unitPrice: number; discountType: 'amount' | 'percentage'; discountValue: number; supplierId?: number }[]>([]);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [masterCharges, setMasterCharges] = useState<Charge[]>([]);
  const [saleCharges, setSaleCharges] = useState<{ chargeId?: number; chargeName: string; amount: number }[]>([]);
  const [availableBatches, setAvailableBatches] = useState<{ [productId: number]: any[] }>({});

  const fetchBatchesForProduct = async (productId: number) => {
    if (!productId || availableBatches[productId]) return;
    try {
      const batches = await api.getProductBatches(productId);
      setAvailableBatches(prev => ({ ...prev, [productId]: batches }));
    } catch (e) {
      console.error('Failed to load batches for product', productId, e);
    }
  };

  // Inline Customer Creation States
  const [showAddCustomerInline, setShowAddCustomerInline] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  async function loadInitialData() {
    setLoading(true);
    setError('');
    try {
      const [custs, prods, chs] = await Promise.all([
        api.getCustomers(),
        api.getProducts(1, 1000),
        api.getCharges(),
      ]);
      setCustomers(custs);
      setProducts(prods.items);
      setMasterCharges(chs);

      const mappedSelectable = prods.items.flatMap(p => 
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

      if (custs.length > 0) setSelectedCustomerId(custs[0].id!);
      if (mappedSelectable.length > 0) {
        const initialProdId = mappedSelectable[0].id!;
        setSaleItems([{ productId: initialProdId, quantity: 1, unitPrice: mappedSelectable[0].sellingPrice, discountType: 'amount', discountValue: 0, supplierId: 0 }]);
        fetchBatchesForProduct(initialProdId);
      } else {
        setSaleItems([{ productId: 0, quantity: 1, unitPrice: 0, discountType: 'amount', discountValue: 0, supplierId: 0 }]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load initial data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

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

  const handleAddSaleItem = () => {
    const defaultProd = selectableProducts[0];
    const defaultProdId = defaultProd?.id || 0;
    setSaleItems([...saleItems, { productId: defaultProdId, quantity: 1, unitPrice: defaultProd?.sellingPrice || 0, discountType: 'amount', discountValue: 0, supplierId: 0 }]);
    if (defaultProdId) {
      fetchBatchesForProduct(defaultProdId);
    }
  };

  const handleRemoveSaleItem = (index: number) => {
    const next = [...saleItems];
    next.splice(index, 1);
    setSaleItems(next);
  };

  const handleSaleItemChange = (index: number, field: string, value: any) => {
    const next = [...saleItems];
    const current = { ...next[index], [field]: value };

    if (field === 'productId') {
      const prod = selectableProducts.find(p => p.id === value);
      if (prod) {
        current.unitPrice = prod.sellingPrice;
        current.discountValue = 0;
      }
      current.supplierId = 0;
      fetchBatchesForProduct(value);
    }
    next[index] = current;
    setSaleItems(next);
  };

  const calculateLineItemDiscounts = (item: { quantity: number; unitPrice: number; discountType: 'amount' | 'percentage'; discountValue: number }) => {
    const gross = (item.quantity || 0) * (item.unitPrice || 0);
    let discountAmount = 0;
    let discountPercentage = 0;

    if (item.discountType === 'percentage') {
      discountPercentage = Math.min(100, Math.max(0, item.discountValue || 0));
      discountAmount = parseFloat(((gross * discountPercentage) / 100).toFixed(2));
    } else {
      discountAmount = Math.max(0, item.discountValue || 0);
      discountPercentage = gross > 0 ? parseFloat(((discountAmount / gross) * 100).toFixed(2)) : 0;
    }

    return { gross, discountAmount, discountPercentage, net: Math.max(0, gross - discountAmount) };
  };

  const handleAddSaleCharge = () => {
    if (masterCharges.length > 0) {
      const defaultCh = masterCharges[0];
      setSaleCharges([...saleCharges, { chargeId: defaultCh.id, chargeName: defaultCh.name, amount: defaultCh.defaultAmount }]);
    } else {
      setSaleCharges([...saleCharges, { chargeName: '', amount: 0 }]);
    }
  };

  const handleRemoveSaleCharge = (index: number) => {
    const next = [...saleCharges];
    next.splice(index, 1);
    setSaleCharges(next);
  };

  const handleSaleChargeSelect = (index: number, chargeId: number) => {
    const ch = masterCharges.find(c => c.id === chargeId);
    const next = [...saleCharges];
    if (ch) {
      next[index] = { chargeId: ch.id, chargeName: ch.name, amount: ch.defaultAmount };
    } else {
      next[index] = { ...next[index], chargeId };
    }
    setSaleCharges(next);
  };

  const handleSaleChargeChange = (index: number, field: string, value: any) => {
    const next = [...saleCharges];
    next[index] = { ...next[index], [field]: value };
    setSaleCharges(next);
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saleItems.some(i => i.productId === 0 || i.quantity <= 0)) {
      alert('Please check all items have valid products and quantities.');
      return;
    }
    setSubmitting(true);
    try {
      const items: SaleItem[] = saleItems.map(i => {
        const { discountAmount, discountPercentage } = calculateLineItemDiscounts(i);
        return {
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountAmount: discountAmount,
          discountPercentage: discountPercentage,
          supplierId: i.supplierId && i.supplierId > 0 ? i.supplierId : undefined
        };
      });

      const subTotal = items.reduce((sum, item) => sum + Math.max(0, (item.quantity * item.unitPrice) - (item.discountAmount || 0)), 0);
      const totalCharges = saleCharges.reduce((sum, ch) => sum + (ch.amount || 0), 0);
      const totalAmount = Math.max(0, subTotal - (overallDiscount || 0)) + totalCharges;

      await api.createSale({
        customerId: selectedCustomerId,
        items,
        charges: saleCharges.filter(c => c.chargeName.trim() !== '').map(c => ({
          chargeId: c.chargeId,
          chargeName: c.chargeName,
          amount: c.amount
        })),
        subTotal,
        discountAmount: overallDiscount || 0,
        totalAmount
      });
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to create sale');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center space-x-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            className="inline-flex items-center space-x-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft size={18} />
            <span>Back to Sales</span>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create New Sale</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Record a new sales invoice with item & overall discounts</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSaveSale} className="space-y-6">
        {/* Customer Information Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Customer Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Select
                label="Customer"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
              >
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
              </Select>
            </div>
            {!showAddCustomerInline && (
              <div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddCustomerInline(true);
                    setNewCustomerName('');
                    setNewCustomerPhone('');
                  }}
                  className="inline-flex items-center space-x-1.5"
                >
                  <Plus size={16} />
                  <span>Quick Add New Customer</span>
                </Button>
              </div>
            )}
          </div>

          {showAddCustomerInline && (
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800 rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">New Customer Info</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Customer Name"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
                <Input
                  label="Phone Number"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="e.g. +977 9800000000"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200/40 dark:border-slate-800">
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
                        notes: 'Created inline from Sales page'
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

        {/* Sale Items Table Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Products & Items</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="inline-flex items-center space-x-1.5"
              onClick={handleAddSaleItem}
            >
              <Plus size={14} />
              <span>Add Item Line</span>
            </Button>
          </div>

          <div className="space-y-4">
            {saleItems.map((item, idx) => (
              <div key={idx} className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end p-4 bg-slate-50/50 dark:bg-slate-950/30 border border-slate-200/40 dark:border-slate-800/60 rounded-xl">
                <div className="flex-1 min-w-[200px]">
                  <Select
                    label="Product"
                    value={item.productId}
                    onChange={(e) => handleSaleItemChange(idx, 'productId', Number(e.target.value))}
                  >
                    {selectableProducts.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                  </Select>
                </div>
                <div className="flex-1 min-w-[180px]">
                  <Select
                    label="Supplier Stock Batch"
                    value={item.supplierId || 0}
                    onChange={(e) => handleSaleItemChange(idx, 'supplierId', Number(e.target.value))}
                  >
                    <option value="0">Auto (FIFO)</option>
                    {(availableBatches[item.productId] || []).map((b: any, bIdx: number) => (
                      <option key={bIdx} value={b.supplierId}>
                        {b.supplierName} ({b.remainingQuantity} left @ NPR {b.costPrice})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-full lg:w-24">
                  <Input
                    label="Qty"
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleSaleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-full lg:w-32">
                  <Input
                    label="Unit Price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) => handleSaleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-full lg:w-32">
                  <Input
                    label={`Discount (${item.discountType === 'percentage' ? '%' : 'NPR'})`}
                    type="number"
                    step={item.discountType === 'percentage' ? "0.1" : "0.01"}
                    min="0"
                    max={item.discountType === 'percentage' ? "100" : undefined}
                    value={item.discountValue || 0}
                    onChange={(e) => handleSaleItemChange(idx, 'discountValue', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="w-full lg:w-24">
                  <Select
                    label="Disc Type"
                    value={item.discountType}
                    onChange={(e) => handleSaleItemChange(idx, 'discountType', e.target.value as 'amount' | 'percentage')}
                  >
                    <option value="amount">NPR</option>
                    <option value="percentage">%</option>
                  </Select>
                </div>
                <div className="flex items-center justify-end pb-1">
                  <button
                    type="button"
                    onClick={() => handleRemoveSaleItem(idx)}
                    disabled={saleItems.length === 1}
                    className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 rounded-xl cursor-pointer transition-colors"
                    title="Remove line"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Charges Section */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Additional Charges (Loading, Unloading, Freight, etc.)</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="inline-flex items-center space-x-1 text-xs"
                onClick={handleAddSaleCharge}
              >
                <Plus size={14} />
                <span>Add Charge</span>
              </Button>
            </div>

            {saleCharges.length > 0 && (
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                {saleCharges.map((ch, idx) => (
                  <div key={idx} className="flex gap-4 items-end bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
                    <div className="flex-1">
                      {masterCharges.length > 0 ? (
                        <Select
                          label="Charge Type"
                          value={ch.chargeId || 0}
                          onChange={(e) => handleSaleChargeSelect(idx, Number(e.target.value))}
                        >
                          {masterCharges.map(mc => <option key={mc.id} value={mc.id}>{mc.name} (Default: NPR {mc.defaultAmount})</option>)}
                        </Select>
                      ) : (
                        <Input
                          label="Charge Name"
                          value={ch.chargeName}
                          onChange={(e) => handleSaleChargeChange(idx, 'chargeName', e.target.value)}
                        />
                      )}
                    </div>
                    <div className="w-36">
                      <Input
                        label="Amount (NPR)"
                        type="number"
                        step="0.01"
                        min="0"
                        value={ch.amount}
                        onChange={(e) => handleSaleChargeChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSaleCharge(idx)}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Breakdown & Bill Discount */}
          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            {(() => {
              let itemsGross = 0;
              let itemsDiscounts = 0;
              saleItems.forEach(i => {
                const { gross, discountAmount } = calculateLineItemDiscounts(i);
                itemsGross += gross;
                itemsDiscounts += discountAmount;
              });
              const subTotal = Math.max(0, itemsGross - itemsDiscounts);
              const chargesTotal = saleCharges.reduce((sum, ch) => sum + (ch.amount || 0), 0);
              const finalTotal = Math.max(0, subTotal - (overallDiscount || 0)) + chargesTotal;

              return (
                <div className="w-full md:w-80 space-y-3 bg-slate-50 dark:bg-slate-950/60 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Items Gross Total:</span>
                    <span className="font-semibold">NPR {itemsGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {itemsDiscounts > 0 && (
                    <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400">
                      <span>Line Items Discount:</span>
                      <span className="font-semibold">- NPR {itemsDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-slate-200 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <span>Subtotal:</span>
                    <span>NPR {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <Input
                      label="Overall Bill Discount (NPR)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={overallDiscount}
                      onChange={(e) => setOverallDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                  {chargesTotal > 0 && (
                    <div className="flex justify-between text-xs text-indigo-600 dark:text-indigo-400 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <span>Total Additional Charges:</span>
                      <span className="font-semibold">+ NPR {chargesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Final Payable Total</span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      NPR {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end space-x-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="inline-flex items-center space-x-2 px-6">
            <ShoppingBag size={18} />
            <span>{submitting ? 'Creating Sale...' : 'Complete & Save Sale'}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
