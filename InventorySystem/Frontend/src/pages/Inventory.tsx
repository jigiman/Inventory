import React, { useState, useEffect, useMemo } from 'react';
import { Settings2, ClipboardList, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { api } from '../api';
import type { StockTransaction, Product, StockAdjustment, StockCount } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

export default function Inventory() {
  const [ledger, setLedger] = useState<StockTransaction[]>([]);
  const [totalLedger, setTotalLedger] = useState(0);
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
            sellingPrice: v.sellingPrice,
            currentQuantity: v.currentQuantity
          }))
        : [{ 
            id: p.id, 
            name: p.name, 
            sku: p.sku, 
            costPrice: p.costPrice, 
            sellingPrice: p.sellingPrice,
            currentQuantity: p.currentQuantity
          }]
    );
  }, [products]);

  // Adjust / Count Dialog states
  const [openAdjust, setOpenAdjust] = useState(false);
  const [openCount, setOpenCount] = useState(false);

  // Search, Sort, and Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('transactionDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // default descending to show newest first
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 50;

  // Details Dialog state
  const [selectedTx, setSelectedTx] = useState<StockTransaction | null>(null);

  // Form states
  const [adjustForm, setAdjustForm] = useState<StockAdjustment>({
    productId: 0, quantity: 0, adjustmentType: 'Plus', reason: ''
  });
  const [countForm, setCountForm] = useState<StockCount>({
    productId: 0, physicalQuantity: 0, systemQuantity: 0, remarks: ''
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [ledgerResult, prodsResult] = await Promise.all([
        api.getLedger(currentPage, itemsPerPage, searchTerm),
        api.getProducts(1, 1000) // Get more products for dropdowns, but ideally this should also be paginated/searchable in UI
      ]);
      setLedger(ledgerResult.items);
      setTotalLedger(ledgerResult.totalCount);
      setProducts(prodsResult.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm]);

  const handleOpenAdjust = () => {
    setAdjustForm({
      productId: selectableProducts[0]?.id || 0,
      quantity: 1,
      adjustmentType: 'Plus',
      reason: ''
    });
    setOpenAdjust(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustForm.quantity <= 0) {
      alert('Quantity must be greater than zero');
      return;
    }
    try {
      await api.adjustStock(adjustForm);
      setOpenAdjust(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save adjustment');
    }
  };

  const handleOpenCount = () => {
    const defaultProd = selectableProducts[0];
    setCountForm({
      productId: defaultProd?.id || 0,
      physicalQuantity: defaultProd?.currentQuantity || 0,
      systemQuantity: defaultProd?.currentQuantity || 0,
      remarks: ''
    });
    setOpenCount(true);
  };

  const handleCountProductChange = (productId: number) => {
    const prod = selectableProducts.find(p => p.id === productId);
    setCountForm({
      ...countForm,
      productId,
      systemQuantity: prod ? prod.currentQuantity : 0,
      physicalQuantity: prod ? prod.currentQuantity : 0
    });
  };

  const handleSaveCount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.countStock(countForm);
      setOpenCount(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to submit stock count');
    }
  };

  // Sort helper
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  // Compute sorted ledger list (filtering is now done server-side)
  const sortedLedger = useMemo(() => {
    let result = [...ledger];

    // 1. Sort
    result.sort((a: any, b: any) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // Nested object field logic
      if (sortField.includes('.')) {
        const parts = sortField.split('.');
        valA = a[parts[0]]?.[parts[1]];
        valB = b[parts[0]]?.[parts[1]];
      }

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortAsc ? valA - valB : valB - valA;
      }
    });

    return result;
  }, [ledger, searchTerm, sortField, sortAsc]);

  // Pagination computations
  const totalItems = totalLedger;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedLedger = sortedLedger;

  const startRange = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endRange = Math.min(currentPage * itemsPerPage, totalItems);

  // Change page handler
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const difference = countForm.physicalQuantity - countForm.systemQuantity;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-end items-center gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-60">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ledger..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all duration-200"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Button variant="outline" className="inline-flex items-center space-x-2" onClick={handleOpenAdjust} disabled={products.length === 0}>
            <Settings2 size={16} />
            <span>Manual Adjustment</span>
          </Button>
          <Button className="inline-flex items-center space-x-2" onClick={handleOpenCount} disabled={products.length === 0}>
            <ClipboardList size={16} />
            <span>Physical Count</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-655 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-650 border-t-transparent dark:border-indigo-400" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto border-t border-slate-200/50 dark:border-slate-800/60">
              <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60 select-none">
                  <tr>
                    <th onClick={() => handleSort('transactionDate')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                      <div className="flex items-center space-x-1">
                        <span>Date/Time</span>
                        {sortField === 'transactionDate' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('product.name')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                      <div className="flex items-center space-x-1">
                        <span>Product</span>
                        {sortField === 'product.name' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('transactionType')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                      <div className="flex items-center space-x-1">
                        <span>Type</span>
                        {sortField === 'transactionType' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('quantityIn')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>Qty In</span>
                        {sortField === 'quantityIn' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('quantityOut')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>Qty Out</span>
                        {sortField === 'quantityOut' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedLedger.map((tx) => {
                    const isPlus = tx.transactionType === 'Purchase' || tx.transactionType === 'Opening' || tx.transactionType === 'Adjustment+';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-3.5 text-xs text-slate-500 dark:text-slate-450">{new Date(tx.transactionDate).toLocaleString()}</td>
                        <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-slate-200">{tx.product?.name}</td>
                        <td className="px-6 py-3.5">
                          <span className={`text-3xs font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${
                            isPlus
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-250/10 dark:bg-emerald-950/20 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 border-rose-250/10 dark:bg-rose-950/20 dark:text-rose-400'
                          }`}>
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-extrabold text-slate-700 dark:text-slate-350">{tx.quantityIn > 0 ? `+${tx.quantityIn}` : '-'}</td>
                        <td className="px-6 py-3.5 text-right font-extrabold text-rose-600 dark:text-rose-400">{tx.quantityOut > 0 ? `-${tx.quantityOut}` : '-'}</td>
                        <td className="px-6 py-3.5 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="inline-flex items-center space-x-1 cursor-pointer"
                            onClick={() => setSelectedTx(tx)}
                          >
                            <Eye size={14} />
                            <span>Details</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedLedger.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                        No ledger transactions found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-2 py-1">
              <p className="text-xs font-semibold text-slate-400">
                Showing <span className="text-slate-650 dark:text-slate-300">{startRange}</span> to <span className="text-slate-650 dark:text-slate-300">{endRange}</span> of <span className="text-slate-650 dark:text-slate-300">{totalItems}</span> transactions
              </p>
              
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                          currentPage === page
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  }
                  if (page === 2 || page === totalPages - 1) {
                    return <span key={page} className="text-slate-400 px-1 text-xs">...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Stock Adjustment Dialog */}
      <Dialog open={openAdjust} onClose={() => setOpenAdjust(false)} title="Manual Stock Adjustment" size="sm">
        <form onSubmit={handleSaveAdjust} className="space-y-5">
          <Select
            label="Product"
            value={adjustForm.productId}
            onChange={(e) => setAdjustForm({ ...adjustForm, productId: Number(e.target.value) })}
          >
            {selectableProducts.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
          </Select>

          <Select
            label="Adjustment Type"
            value={adjustForm.adjustmentType}
            onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentType: e.target.value })}
          >
            <option value="Plus">Add Stock (Plus)</option>
            <option value="Minus">Reduce Stock (Minus)</option>
            <option value="Damaged">Damaged Goods (Minus)</option>
            <option value="Expired">Expired Goods (Minus)</option>
          </Select>

          <Input
            label="Quantity"
            type="number"
            step="any"
            min="0.01"
            required
            value={adjustForm.quantity}
            onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 0 })}
          />

          <Input
            label="Reason"
            required
            value={adjustForm.reason}
            onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
          />

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpenAdjust(false)}>Cancel</Button>
            <Button type="submit">Post Adjustment</Button>
          </div>
        </form>
      </Dialog>

      {/* Physical Stock Count Dialog */}
      <Dialog open={openCount} onClose={() => setOpenCount(false)} title="Physical Stock Count" size="sm">
        <form onSubmit={handleSaveCount} className="space-y-5">
          <Select
            label="Product"
            value={countForm.productId}
            onChange={(e) => handleCountProductChange(Number(e.target.value))}
          >
            {selectableProducts.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
          </Select>

          <Input
            label="System Quantity"
            type="number"
            disabled
            value={countForm.systemQuantity}
          />

          <Input
            label="Physical Quantity"
            type="number"
            required
            value={countForm.physicalQuantity}
            onChange={(e) => setCountForm({ ...countForm, physicalQuantity: parseFloat(e.target.value) || 0 })}
          />

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/40 p-5 border border-slate-200/40 dark:border-slate-800 flex justify-between items-center text-sm font-bold">
            <span className="text-slate-400">Difference:</span>
            <span className={difference >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-455"}>
              {difference >= 0 ? `+${difference.toFixed(2)}` : difference.toFixed(2)}
            </span>
          </div>

          <Input
            label="Remarks / Notes"
            value={countForm.remarks || ''}
            onChange={(e) => setCountForm({ ...countForm, remarks: e.target.value })}
          />

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpenCount(false)}>Cancel</Button>
            <Button type="submit">Post Count</Button>
          </div>
        </form>
      </Dialog>

      {/* Transaction Details Dialog */}
      {selectedTx && (
        <Dialog 
          open={!!selectedTx} 
          onClose={() => setSelectedTx(null)} 
          title="Transaction Details" 
          size="sm"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Date/Time</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {new Date(selectedTx.transactionDate).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Type</p>
                <p className="mt-1">
                  <span className={`inline-block text-3xs font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full border ${
                    selectedTx.transactionType === 'Purchase' || selectedTx.transactionType === 'Opening' || selectedTx.transactionType === 'Adjustment+'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-250/10 dark:bg-emerald-950/20 dark:text-emerald-400'
                      : 'bg-rose-50 text-rose-700 border-rose-250/10 dark:bg-rose-950/20 dark:text-rose-400'
                  }`}>
                    {selectedTx.transactionType}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">SKU</p>
                <p className="mt-1 font-mono text-slate-900 dark:text-slate-100">{selectedTx.product?.sku || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Product</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{selectedTx.product?.name || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Qty In</p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{selectedTx.quantityIn > 0 ? `+${selectedTx.quantityIn}` : '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Qty Out</p>
                <p className="mt-1 font-semibold text-rose-600 dark:text-rose-400">{selectedTx.quantityOut > 0 ? `-${selectedTx.quantityOut}` : '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Running Bal</p>
                <p className="mt-1 font-bold text-indigo-650 dark:text-indigo-400">{selectedTx.runningBalance}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Reference</p>
              <p className="mt-1 font-medium text-slate-650 dark:text-slate-300 break-words whitespace-pre-wrap">
                {selectedTx.reference || '-'}
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button onClick={() => setSelectedTx(null)}>Close</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
