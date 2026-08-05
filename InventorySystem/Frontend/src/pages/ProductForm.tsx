import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Package, Layers, DollarSign, Image as ImageIcon } from 'lucide-react';
import { api } from '../api';
import type { Product, Category, Brand, Unit, Supplier } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';

interface ProductFormProps {
  productId?: number | null;
  categories: Category[];
  brands: Brand[];
  units: Unit[];
  suppliers: Supplier[];
  onBack: () => void;
  onSuccess: () => void;
}

export default function ProductForm({
  productId,
  categories,
  brands,
  units,
  suppliers,
  onBack,
  onSuccess
}: ProductFormProps) {
  const isEditing = !!productId;
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Variants state
  const [hasVariants, setHasVariants] = useState(false);
  const [variantsList, setVariantsList] = useState<any[]>([]);

  const [formProduct, setFormProduct] = useState<Product>({
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

  useEffect(() => {
    if (!isEditing || !productId) return;
    async function loadProduct() {
      setLoading(true);
      setError('');
      try {
        const prod = await api.getProduct(productId!);
        setFormProduct(prod);
        if (prod.variants && prod.variants.length > 0) {
          setHasVariants(true);
          setVariantsList(prod.variants.map(v => ({
            id: v.id,
            sku: v.sku || '',
            variantValues: v.variantValues || v.name.replace(`${prod.name} (`, '').replace(')', ''),
            costPrice: v.costPrice,
            sellingPrice: v.sellingPrice,
            openingQuantity: v.openingQuantity,
            reorderLevel: v.reorderLevel,
            maximumStock: v.maximumStock,
            isActive: v.isActive
          })));
        } else {
          setHasVariants(false);
          setVariantsList([]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load product details');
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [productId, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (hasVariants && variantsList.length === 0) {
      setError('Please add at least one variant or disable product variants.');
      return;
    }

    setSaving(true);
    try {
      const payload: Product = {
        ...formProduct,
        variants: hasVariants ? variantsList.map(v => ({
          ...v,
          categoryId: formProduct.categoryId,
          brandId: formProduct.brandId,
          unitId: formProduct.unitId,
          supplierId: formProduct.supplierId
        })) : []
      };

      if (isEditing && productId) {
        await api.updateProduct(productId, payload);
      } else {
        await api.createProduct(payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-5">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" type="button" onClick={onBack} className="inline-flex items-center space-x-2 cursor-pointer">
            <ArrowLeft size={18} />
            <span>Back to Products</span>
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {isEditing ? `Edit Product: ${formProduct.name}` : 'Create New Product'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isEditing ? 'Modify product details and variant configurations' : 'Fill out details to add a new item to inventory'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="inline-flex items-center space-x-2 shadow-md shadow-indigo-500/20">
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Product'}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Area (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information Card */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40 space-y-5">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
              <Package size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                General Information
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input 
                  label="Product Name" 
                  required 
                  value={formProduct.name} 
                  onChange={(e) => setFormProduct({ ...formProduct, name: e.target.value })}
                  placeholder="e.g. Wireless Ergonomic Mouse"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Description</label>
                <textarea
                  className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
                  rows={3}
                  value={formProduct.description || ''}
                  onChange={(e) => setFormProduct({ ...formProduct, description: e.target.value })}
                  placeholder="Provide a detailed description of the product..."
                />
              </div>

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
          </div>

          {/* Pricing & Stock Card (Single product mode) */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40 space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
                <DollarSign size={18} />
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Pricing & Stock Settings
                </h2>
              </div>
              <Switch 
                checked={hasVariants} 
                onChange={(checked) => setHasVariants(checked)} 
                label="Has Product Variants"
              />
            </div>

            {!hasVariants ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
                  <Input 
                    label="SKU" 
                    value={formProduct.sku} 
                    onChange={(e) => setFormProduct({ ...formProduct, sku: e.target.value })} 
                    placeholder="e.g. SK-1002"
                  />
                  <Input 
                    label="Cost Price (NPR)" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    required={!hasVariants} 
                    value={formProduct.costPrice} 
                    onChange={(e) => setFormProduct({ ...formProduct, costPrice: parseFloat(e.target.value) || 0 })} 
                  />
                  <Input 
                    label="Selling Price (NPR)" 
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
                    disabled={isEditing}
                    required={!hasVariants} 
                    value={formProduct.openingQuantity} 
                    onChange={(e) => setFormProduct({ ...formProduct, openingQuantity: parseFloat(e.target.value) || 0 })} 
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
                  <Input 
                    label="Lead Time (Days)" 
                    type="number" 
                    min="0" 
                    required 
                    value={formProduct.leadTime} 
                    onChange={(e) => setFormProduct({ ...formProduct, leadTime: parseInt(e.target.value) || 0 })} 
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-700 dark:text-indigo-300">
                Product pricing, SKU, and stock levels are configured individually per variant in the Variants section below.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Cards (1 col) */}
        <div className="space-y-6">
          {/* Status & Settings */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40 space-y-5">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Product Status
            </h2>
            <div className="py-1">
              <Switch 
                checked={formProduct.isActive} 
                onChange={(checked) => setFormProduct({ ...formProduct, isActive: checked })} 
                label="Active Status"
              />
            </div>
          </div>

          {/* Media / Product Image */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40 space-y-4">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
              <ImageIcon size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Product Image
              </h2>
            </div>
            <Input
              label="Image URL"
              value={formProduct.productImage || ''}
              onChange={(e) => setFormProduct({ ...formProduct, productImage: e.target.value })}
              placeholder="https://example.com/image.png"
            />
            {formProduct.productImage ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 h-40 bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <img
                  src={formProduct.productImage}
                  alt={formProduct.name || 'Product'}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            ) : null}
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40 space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Internal Notes
            </h2>
            <textarea
              className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
              rows={3}
              value={formProduct.notes || ''}
              onChange={(e) => setFormProduct({ ...formProduct, notes: e.target.value })}
              placeholder="Add internal notes or inventory comments..."
            />
          </div>
        </div>
      </div>

      {/* Variants Section - Full Width */}
      {hasVariants && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-xs dark:border-slate-800/60 dark:bg-slate-900/40 space-y-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
              <Layers size={18} />
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Product Variants ({variantsList.length})
              </h2>
            </div>
            <Button 
              type="button" 
              size="sm" 
              variant="outline" 
              onClick={() => setVariantsList(prev => [
                ...prev, 
                { sku: '', variantValues: '', costPrice: 0, sellingPrice: 0, openingQuantity: 0, reorderLevel: 0, maximumStock: 0, isActive: true }
              ])}
              className="text-xs font-semibold inline-flex items-center cursor-pointer"
            >
              <Plus size={14} className="mr-1" /> Add Variant Option
            </Button>
          </div>

          {variantsList.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <p className="text-xs text-slate-400">No variants added yet.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setVariantsList([
                  { sku: '', variantValues: '', costPrice: 0, sellingPrice: 0, openingQuantity: 0, reorderLevel: 0, maximumStock: 0, isActive: true }
                ])}
              >
                Add First Variant
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800">
              <table className="w-full text-left text-xs text-slate-500 dark:text-slate-400 min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-3xs font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/60 select-none">
                  <tr>
                    <th className="px-4 py-3 min-w-[180px]">Attributes (e.g. Red, L)</th>
                    <th className="px-4 py-3 min-w-[140px]">SKU</th>
                    <th className="px-4 py-3 text-right min-w-[110px]">Cost Price</th>
                    <th className="px-4 py-3 text-right min-w-[110px]">Selling Price</th>
                    <th className="px-4 py-3 text-right min-w-[100px]">Opening Qty</th>
                    <th className="px-4 py-3 text-right min-w-[100px]">Reorder Qty</th>
                    <th className="px-4 py-3 text-right min-w-[100px]">Max Stock</th>
                    <th className="px-4 py-3 text-center min-w-[70px]">Active</th>
                    <th className="px-4 py-3 text-center min-w-[70px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {variantsList.map((variant, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          required
                          value={variant.variantValues}
                          onChange={(e) => {
                            const newVariants = [...variantsList];
                            newVariants[index].variantValues = e.target.value;
                            setVariantsList(newVariants);
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                          placeholder="e.g. Red, XL"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={variant.sku}
                          onChange={(e) => {
                            const newVariants = [...variantsList];
                            newVariants[index].sku = e.target.value;
                            setVariantsList(newVariants);
                          }}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                          placeholder="SKU-XXXX"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
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
                          className="w-24 px-2.5 py-1.5 text-xs text-right rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
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
                          className="w-24 px-2.5 py-1.5 text-xs text-right rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
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
                          className="w-20 px-2.5 py-1.5 text-xs text-right rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
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
                          className="w-20 px-2.5 py-1.5 text-xs text-right rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
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
                          className="w-20 px-2.5 py-1.5 text-xs text-right rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={variant.isActive}
                          onChange={(e) => {
                            const newVariants = [...variantsList];
                            newVariants[index].isActive = e.target.checked;
                            setVariantsList(newVariants);
                          }}
                          className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newVariants = variantsList.filter((_, idx) => idx !== index);
                            setVariantsList(newVariants);
                          }}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                        >
                          <Trash2 size={14} />
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
    </form>
  );
}
