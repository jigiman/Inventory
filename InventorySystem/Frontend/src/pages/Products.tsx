import React, { useState, useEffect, useMemo } from 'react';
import { Edit2, Trash2, Plus, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';
import type { Product, Category, Brand, Unit, Supplier } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Confirm delete dialog
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Search, Sort, and Pagination states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 50;

  // Variants state
  const [hasVariants, setHasVariants] = useState(false);
  const [variantsList, setVariantsList] = useState<any[]>([]);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<number, boolean>>({});

  const [formProduct, setFormProduct] = useState<Product>({
    sku: '', name: '', description: '',
    categoryId: 0, brandId: 0, unitId: 0, supplierId: 0,
    costPrice: 0, sellingPrice: 0,
    openingQuantity: 0, currentQuantity: 0,
    reorderLevel: 0, maximumStock: 0,
    leadTime: 0, productImage: '',
    isActive: true, notes: ''
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [prodsResult, cats, brs, uns, sups] = await Promise.all([
        api.getProducts(currentPage, itemsPerPage, searchTerm),
        api.getCategories(),
        api.getBrands(),
        api.getUnits(),
        api.getSuppliers(),
      ]);
      setProducts(prodsResult.items);
      setTotalProducts(prodsResult.totalCount);
      setCategories(cats);
      setBrands(brs);
      setUnits(uns);
      setSuppliers(sups);
    } catch (err: any) {
      setError(err.message || 'Failed to load product data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm]);

  const handleOpenAdd = () => {
    setEditId(null);
    setHasVariants(false);
    setVariantsList([]);
    setFormProduct({
      sku: '', name: '', description: '',
      categoryId: categories[0]?.id || 0,
      brandId: brands[0]?.id || 0,
      unitId: units[0]?.id || 0,
      supplierId: suppliers[0]?.id || 0,
      costPrice: 0, sellingPrice: 0,
      openingQuantity: 0, currentQuantity: 0,
      reorderLevel: 0, maximumStock: 0,
      leadTime: 0, productImage: '',
      isActive: true, notes: ''
    });
    setOpenDialog(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditId(product.id!);
    if (product.variants && product.variants.length > 0) {
      setHasVariants(true);
      setVariantsList(product.variants.map(v => ({
        id: v.id,
        sku: v.sku,
        variantValues: v.variantValues || '',
        costPrice: v.costPrice,
        sellingPrice: v.sellingPrice,
        openingQuantity: v.openingQuantity,
        currentQuantity: v.currentQuantity,
        reorderLevel: v.reorderLevel,
        maximumStock: v.maximumStock,
        isActive: v.isActive
      })));
    } else {
      setHasVariants(false);
      setVariantsList([]);
    }
    setFormProduct({ ...product });
    setOpenDialog(true);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productPayload = {
        ...formProduct,
        variants: hasVariants ? variantsList : []
      };
      if (editId) {
        await api.updateProduct(editId, productPayload);
      } else {
        await api.createProduct(productPayload);
      }
      setOpenDialog(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save product');
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all duration-200"
            />
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
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
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

      {/* Add / Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        title={editId ? 'Edit Product' : 'Add New Product'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input 
              label="Product Name" 
              required 
              value={formProduct.name} 
              onChange={(e) => setFormProduct({ ...formProduct, name: e.target.value })} 
            />
            <div className="flex items-center pt-7">
              <Switch 
                checked={hasVariants} 
                onChange={(checked) => setHasVariants(checked)} 
                label="This product has variants (e.g. Size, Color)"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Description</label>
            <textarea
              className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
              rows={2}
              value={formProduct.description || ''} 
              onChange={(e) => setFormProduct({ ...formProduct, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
            <Select 
              label="Category" 
              required
              value={formProduct.categoryId}
              onChange={(e) => setFormProduct({ ...formProduct, categoryId: Number(e.target.value) })}
            >
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>

            <Select 
              label="Brand" 
              required
              value={formProduct.brandId}
              onChange={(e) => setFormProduct({ ...formProduct, brandId: Number(e.target.value) })}
            >
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>

            <Select 
              label="Unit" 
              required
              value={formProduct.unitId}
              onChange={(e) => setFormProduct({ ...formProduct, unitId: Number(e.target.value) })}
            >
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>

            <Select 
              label="Supplier" 
              required
              value={formProduct.supplierId}
              onChange={(e) => setFormProduct({ ...formProduct, supplierId: Number(e.target.value) })}
            >
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>

          {!hasVariants ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
              <Input 
                label="SKU" 
                value={formProduct.sku} 
                onChange={(e) => setFormProduct({ ...formProduct, sku: e.target.value })} 
              />
              <Input 
                label="Cost Price" 
                type="number" 
                step="0.01" 
                min="0" 
                required={!hasVariants} 
                value={formProduct.costPrice} 
                onChange={(e) => setFormProduct({ ...formProduct, costPrice: parseFloat(e.target.value) || 0 })} 
              />
              <Input 
                label="Selling Price" 
                type="number" 
                step="0.01" 
                min="0" 
                required={!hasVariants} 
                value={formProduct.sellingPrice} 
                onChange={(e) => setFormProduct({ ...formProduct, sellingPrice: parseFloat(e.target.value) || 0 })} 
              />
              <Input 
                label="Opening Qty" 
                type="number" 
                min="0" 
                disabled={!!editId}
                required={!hasVariants} 
                value={formProduct.openingQuantity} 
                onChange={(e) => setFormProduct({ ...formProduct, openingQuantity: parseFloat(e.target.value) || 0 })} 
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4 items-end">
            {!hasVariants && (
              <>
                <Input 
                  label="Reorder Level" 
                  type="number" 
                  min="0" 
                  required={!hasVariants} 
                  value={formProduct.reorderLevel} 
                  onChange={(e) => setFormProduct({ ...formProduct, reorderLevel: parseFloat(e.target.value) || 0 })} 
                />
                <Input 
                  label="Maximum Stock" 
                  type="number" 
                  min="0" 
                  required={!hasVariants} 
                  value={formProduct.maximumStock} 
                  onChange={(e) => setFormProduct({ ...formProduct, maximumStock: parseFloat(e.target.value) || 0 })} 
                />
              </>
            )}

            <Input 
              label="Lead Time (Days)" 
              type="number" 
              min="0" 
              required 
              value={formProduct.leadTime} 
              onChange={(e) => setFormProduct({ ...formProduct, leadTime: parseInt(e.target.value) || 0 })} 
            />
            <div className="py-2.5">
              <Switch 
                checked={formProduct.isActive} 
                onChange={(checked) => setFormProduct({ ...formProduct, isActive: checked })} 
                label="Active Status"
              />
            </div>
          </div>

          {hasVariants && (
            <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-200">Manage Variants</h4>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setVariantsList(prev => [
                    ...prev, 
                    { sku: '', variantValues: '', costPrice: 0, sellingPrice: 0, openingQuantity: 0, reorderLevel: 0, maximumStock: 0, isActive: true }
                  ])}
                  className="text-xs font-semibold inline-flex items-center"
                >
                  <Plus size={12} className="mr-1" /> Add Variant Option
                </Button>
              </div>

              {variantsList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No variants added yet. Click 'Add Variant Option' above to create one.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <table className="w-full text-left text-xs text-slate-500 dark:text-slate-400">
                    <thead className="bg-slate-550/5 dark:bg-slate-900/60 text-3xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/60 select-none">
                      <tr>
                        <th className="px-3 py-2 w-1/4">Attributes (e.g. Red, L)</th>
                        <th className="px-3 py-2 w-1/5">SKU</th>
                        <th className="px-3 py-2 text-right">Cost</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right w-16">Opening Qty</th>
                        <th className="px-3 py-2 text-right w-16">Reorder</th>
                        <th className="px-3 py-2 text-right w-16">Max</th>
                        <th className="px-3 py-2 text-center w-10">Active</th>
                        <th className="px-3 py-2 text-center w-10">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {variantsList.map((variant, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              required
                              value={variant.variantValues}
                              onChange={(e) => {
                                const newVariants = [...variantsList];
                                newVariants[index].variantValues = e.target.value;
                                setVariantsList(newVariants);
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                              placeholder="Red, L"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={variant.sku}
                              onChange={(e) => {
                                const newVariants = [...variantsList];
                                newVariants[index].sku = e.target.value;
                                setVariantsList(newVariants);
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                              placeholder="SKU-XXXX"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={variant.costPrice}
                              onChange={(e) => {
                                const newVariants = [...variantsList];
                                newVariants[index].costPrice = parseFloat(e.target.value) || 0;
                                setVariantsList(newVariants);
                              }}
                              className="w-20 px-2 py-1 text-xs text-right rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={variant.sellingPrice}
                              onChange={(e) => {
                                const newVariants = [...variantsList];
                                newVariants[index].sellingPrice = parseFloat(e.target.value) || 0;
                                setVariantsList(newVariants);
                              }}
                              className="w-20 px-2 py-1 text-xs text-right rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              required
                              min="0"
                              disabled={variant.id > 0}
                              value={variant.openingQuantity}
                              onChange={(e) => {
                                const newVariants = [...variantsList];
                                newVariants[index].openingQuantity = parseFloat(e.target.value) || 0;
                                setVariantsList(newVariants);
                              }}
                              className="w-16 px-2 py-1 text-xs text-right rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              required
                              min="0"
                              value={variant.reorderLevel}
                              onChange={(e) => {
                                const newVariants = [...variantsList];
                                newVariants[index].reorderLevel = parseFloat(e.target.value) || 0;
                                setVariantsList(newVariants);
                              }}
                              className="w-16 px-2 py-1 text-xs text-right rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              required
                              min="0"
                              value={variant.maximumStock}
                              onChange={(e) => {
                                const newVariants = [...variantsList];
                                newVariants[index].maximumStock = parseFloat(e.target.value) || 0;
                                setVariantsList(newVariants);
                              }}
                              className="w-16 px-2 py-1 text-xs text-right rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={variant.isActive}
                              onChange={(e) => {
                                const newVariants = [...variantsList];
                                newVariants[index].isActive = e.target.checked;
                                setVariantsList(newVariants);
                              }}
                              className="rounded border-slate-350 text-indigo-650 focus:ring-indigo-550 h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const newVariants = variantsList.filter((_, idx) => idx !== index);
                                setVariantsList(newVariants);
                              }}
                              className="p-1 rounded text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Notes</label>
            <textarea
              className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
              rows={2}
              value={formProduct.notes || ''} 
              onChange={(e) => setFormProduct({ ...formProduct, notes: e.target.value })}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Product
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
