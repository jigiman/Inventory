import { useState, useEffect, useMemo } from 'react';
import { Edit2, Trash2, Plus, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { api } from '../api';
import type { Product, Category, Brand, Unit, Supplier } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import ProductForm from './ProductForm';

export default function Products() {
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editProductId, setEditProductId] = useState<number | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Supplier stock details dialog states
  const [openStockDetails, setOpenStockDetails] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] = useState<any | null>(null);
  const [stockBatches, setStockBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Confirm delete dialog
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Search, Sort, and Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 50;

  const [expandedProductIds, setExpandedProductIds] = useState<Record<number, boolean>>({});

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load static metadata on mount
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [cats, brs, uns, sups] = await Promise.all([
          api.getCategories(),
          api.getBrands(),
          api.getUnits(),
          api.getSuppliers(),
        ]);
        setCategories(cats);
        setBrands(brs);
        setUnits(uns);
        setSuppliers(sups);
      } catch (err: any) {
        console.error('Failed to load static metadata:', err);
      }
    }
    loadMetadata();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const prodsResult = await api.getProducts(currentPage, itemsPerPage, debouncedSearchValue);
      setProducts(prodsResult.items);
      setTotalProducts(prodsResult.totalCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load product data');
    } finally {
      setLoading(false);
    }
  }

  // Fetch products when page or debounced search term changes
  useEffect(() => {
    let active = true;
    async function fetchProducts() {
      setLoading(true);
      setError('');
      try {
        const prodsResult = await api.getProducts(currentPage, itemsPerPage, debouncedSearchValue);
        if (active) {
          setProducts(prodsResult.items);
          setTotalProducts(prodsResult.totalCount);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Failed to load product data');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchProducts();
    return () => {
      active = false;
    };
  }, [currentPage, debouncedSearchValue]);

  const handleOpenAdd = () => {
    setEditProductId(null);
    setViewMode('create');
  };

  const handleViewStock = async (productOrVariant: any) => {
    setSelectedStockProduct(productOrVariant);
    setOpenStockDetails(true);
    setLoadingBatches(true);
    try {
      const data = await api.getProductBatches(productOrVariant.id);
      setStockBatches(data);
    } catch (e) {
      console.error('Failed to load stock batches', e);
      setStockBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleOpenEdit = (product: Product) => {
    setEditProductId(product.id!);
    setViewMode('edit');
  };

  const handleDelete = (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (confirmDeleteId == null) return;
    setConfirmDeleteId(null);
    try {
      await api.deleteProduct(confirmDeleteId);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete product');
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

  // Compute sorted list (filtering is now done server-side)
  const sortedProducts = useMemo(() => {
    let result = [...products];

    // 1. Sort
    result.sort((a: any, b: any) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // Nested object fields logic
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
  }, [products, sortField, sortAsc]);

  // Pagination computations
  const totalItems = totalProducts;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedProducts = sortedProducts;

  const startRange = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endRange = Math.min(currentPage * itemsPerPage, totalItems);

  // Change page handler
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <ProductForm
        productId={editProductId}
        categories={categories}
        brands={brands}
        units={units}
        suppliers={suppliers}
        onBack={() => {
          setViewMode('list');
          setEditProductId(null);
        }}
        onSuccess={() => {
          setViewMode('list');
          setEditProductId(null);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex justify-end items-center gap-4">
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
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
          <Button onClick={handleOpenAdd} className="inline-flex items-center space-x-2">
            <Plus size={16} />
            <span>Add Product</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-650 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
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
                    <th className="px-4 py-4 w-10"></th>
                    <th onClick={() => handleSort('name')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                      <div className="flex items-center space-x-1">
                        <span>Name</span>
                        {sortField === 'name' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('currentQuantity')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>Qty</span>
                        {sortField === 'currentQuantity' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('costPrice')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>Cost</span>
                        {sortField === 'costPrice' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>
                    <th onClick={() => handleSort('sellingPrice')} className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>Price</span>
                        {sortField === 'sellingPrice' && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </div>
                    </th>

                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedProducts.flatMap((p) => {
                    const hasVars = p.variants && p.variants.length > 0;
                    const totalQty = hasVars ? p.variants!.reduce((sum, v) => sum + v.currentQuantity, 0) : p.currentQuantity;
                    const minPrice = hasVars ? Math.min(...p.variants!.map(v => v.sellingPrice)) : p.sellingPrice;
                    const maxPrice = hasVars ? Math.max(...p.variants!.map(v => v.sellingPrice)) : p.sellingPrice;
                    const displayPrice = hasVars 
                      ? minPrice === maxPrice 
                        ? `NPR ${minPrice.toFixed(2)}` 
                        : `NPR ${minPrice.toFixed(2)} - NPR ${maxPrice.toFixed(2)}` 
                      : `NPR ${p.sellingPrice.toFixed(2)}`;

                    const minCost = hasVars ? Math.min(...p.variants!.map(v => v.costPrice)) : p.costPrice;
                    const maxCost = hasVars ? Math.max(...p.variants!.map(v => v.costPrice)) : p.costPrice;
                    const displayCost = hasVars 
                      ? minCost === maxCost 
                        ? `NPR ${minCost.toFixed(2)}` 
                        : `NPR ${minCost.toFixed(2)} - NPR ${maxCost.toFixed(2)}` 
                      : `NPR ${p.costPrice.toFixed(2)}`;

                    const isExpanded = expandedProductIds[p.id!] || false;

                    return [
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-4 py-3.5 text-center">
                          {hasVars && (
                            <button
                              type="button"
                              onClick={() => setExpandedProductIds(prev => ({ ...prev, [p.id!]: !prev[p.id!] }))}
                              className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-slate-200">
                          {p.name}
                          {hasVars && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/30 text-4xs font-bold uppercase dark:bg-indigo-950/20 dark:text-indigo-400">
                              {p.variants!.length} Variants
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right font-extrabold text-slate-700 dark:text-slate-350">{totalQty}</td>
                        <td className="px-6 py-3.5 text-right font-semibold">{displayCost}</td>
                        <td className="px-6 py-3.5 text-right font-bold text-indigo-650 dark:text-indigo-400">{displayPrice}</td>

                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wide border ${
                            p.isActive 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/30 dark:bg-emerald-950/20 dark:text-emerald-400' 
                              : 'bg-slate-100 text-slate-500 border-slate-200/50 dark:bg-slate-900 dark:text-slate-550'
                          }`}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex gap-2 justify-end items-center">
                            <button 
                              type="button"
                              className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 cursor-pointer transition-colors"
                              onClick={() => handleViewStock(p)}
                              title="View Supplier Stock Breakdown"
                            >
                              <Eye size={13} />
                            </button>
                            <button 
                              type="button"
                              className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 cursor-pointer transition-colors"
                              onClick={() => handleOpenEdit(p)}
                              title="Edit Product"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button 
                              type="button"
                              className="flex items-center justify-center p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-650 dark:bg-rose-950/30 dark:text-rose-400 cursor-pointer transition-colors"
                              onClick={() => handleDelete(p.id!)}
                              title="Delete Product"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>,
                      isExpanded && hasVars && (
                        <tr key={`${p.id}-expanded`} className="bg-slate-50/20 dark:bg-slate-900/10">
                          <td colSpan={7} className="px-8 py-3">
                            <div className="border border-slate-200/50 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                              <table className="w-full text-left text-xs text-slate-500 dark:text-slate-400">
                                <thead className="bg-slate-50 dark:bg-slate-900/60 text-3xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/60 select-none">
                                  <tr>
                                    <th className="px-6 py-2.5">Variant Attributes</th>
                                    <th className="px-6 py-2.5">SKU</th>
                                    <th className="px-6 py-2.5 text-right">Qty</th>
                                    <th className="px-6 py-2.5 text-right">Cost</th>
                                    <th className="px-6 py-2.5 text-right">Price</th>
                                    <th className="px-6 py-2.5">Status</th>
                                    <th className="px-6 py-2.5 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                  {p.variants!.map((v) => (
                                    <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                      <td className="px-6 py-2.5 font-bold text-slate-700 dark:text-slate-350">{v.variantValues}</td>
                                      <td className="px-6 py-2.5 font-medium text-slate-500">{v.sku || '-'}</td>
                                      <td className="px-6 py-2.5 text-right font-extrabold text-slate-700 dark:text-slate-350">{v.currentQuantity}</td>
                                      <td className="px-6 py-2.5 text-right font-semibold">NPR {v.costPrice.toFixed(2)}</td>
                                      <td className="px-6 py-2.5 text-right font-bold text-indigo-650 dark:text-indigo-400">NPR {v.sellingPrice.toFixed(2)}</td>
                                      <td className="px-6 py-2.5">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-4xs font-extrabold uppercase tracking-wide border ${
                                          v.isActive 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/30 dark:bg-emerald-950/20 dark:text-emerald-400' 
                                            : 'bg-slate-100 text-slate-500 border-slate-200/50 dark:bg-slate-900 dark:text-slate-550'
                                        }`}>
                                          {v.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-2.5 text-right">
                                        <button
                                          type="button"
                                          className="inline-flex items-center justify-center p-1 rounded border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:text-slate-400 cursor-pointer transition-colors"
                                          onClick={() => handleViewStock(v)}
                                          title="View Supplier Stock Breakdown"
                                        >
                                          <Eye size={12} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )
                    ];
                  })}
                  {paginatedProducts.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                        No products found matching your search.
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
                Showing <span className="text-slate-650 dark:text-slate-300">{startRange}</span> to <span className="text-slate-650 dark:text-slate-300">{endRange}</span> of <span className="text-slate-650 dark:text-slate-300">{totalItems}</span> products
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
                  // Only show current page, first, last, and neighbors
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

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <Dialog
        open={openStockDetails}
        onClose={() => { setOpenStockDetails(false); setSelectedStockProduct(null); setStockBatches([]); }}
        title={`Supplier Stock Breakdown: ${selectedStockProduct?.name || ''}`}
        size="md"
      >
        <div className="space-y-4 text-sm">
          {loadingBatches ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent dark:border-indigo-400" />
            </div>
          ) : stockBatches.length === 0 ? (
            <p className="text-slate-400 italic py-8 text-center">No active supplier stock batches found for this product.</p>
          ) : (
            <div className="overflow-hidden border border-slate-200/50 dark:border-slate-800/60 rounded-xl">
              <table className="w-full text-left text-xs text-slate-500 dark:text-slate-400">
                <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/60">
                  <tr>
                    <th className="px-4 py-2.5">Supplier</th>
                    <th className="px-4 py-2.5 text-right">In Stock Qty</th>
                    <th className="px-4 py-2.5 text-right">Cost Price</th>
                    <th className="px-4 py-2.5">Batch Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {stockBatches.map((b: any) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-200">
                        {b.supplierName}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-800 dark:text-slate-200">
                        {b.remainingQuantity}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                        NPR {(b.costPrice ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(b.transactionDate).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" onClick={() => { setOpenStockDetails(false); setSelectedStockProduct(null); setStockBatches([]); }}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
