import { useState, useEffect } from 'react';
import { Trash2, Plus, ShoppingBag } from 'lucide-react';
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

  // New Sale Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [saleItems, setSaleItems] = useState<{ productId: number; quantity: number; unitPrice: number }[]>([
    { productId: 0, quantity: 1, unitPrice: 0 }
  ]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [sls, custs, prods] = await Promise.all([
        api.getSales(),
        api.getCustomers(),
        api.getProducts(),
      ]);
      setSales(sls);
      setCustomers(custs);
      setProducts(prods.items);
      if (custs.length > 0) setSelectedCustomerId(custs[0].id!);
      if (prods.items.length > 0) {
          setSaleItems([{ productId: prods.items[0].id!, quantity: 1, unitPrice: prods.items[0].sellingPrice }]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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
    } catch (err: any) {
      alert(err.message || 'Failed to create Sale');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center">
        <Button onClick={() => setOpenCreate(true)} disabled={customers.length === 0 || products.length === 0} className="inline-flex items-center space-x-2">
          <Plus size={16} />
          <span>New Sale</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

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
                <th className="px-6 py-4 text-right">Status</th>
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
                  <td className="px-6 py-4 text-right">
                    <span className="text-3xs font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-250/10 dark:bg-emerald-950/20 dark:text-emerald-400">
                      {sale.status}
                    </span>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No sales recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Sale Dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} title="New Sale Transaction" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSaveSale(); }} className="space-y-6">
          <Select
            label="Customer"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
          >
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

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
    </div>
  );
}
