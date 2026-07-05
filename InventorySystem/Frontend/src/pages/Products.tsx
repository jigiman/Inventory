import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Typography, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import { api } from '../api';
import type { Product, Category, Brand, Unit, Supplier } from '../api';

export default function Products() {
  const theme = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [formProduct, setFormProduct] = useState<Product>({
    sku: '', name: '', description: '',
    categoryId: 0, brandId: 0, unitId: 0, supplierId: 0,
    costPrice: 0, sellingPrice: 0,
    openingQuantity: 0, currentQuantity: 0,
    reorderLevel: 0, maximumStock: 0,
    shelfLocation: '', leadTime: 0, productImage: '',
    isActive: true, notes: ''
  });

  const gridRef = useRef<AgGridReact>(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [prods, cats, brs, uns, sups] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getBrands(),
        api.getUnits(),
        api.getSuppliers(),
      ]);
      setProducts(prods);
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
  }, []);

  const handleOpenAdd = () => {
    setEditId(null);
    setFormProduct({
      sku: '', name: '', description: '',
      categoryId: categories[0]?.id || 0,
      brandId: brands[0]?.id || 0,
      unitId: units[0]?.id || 0,
      supplierId: suppliers[0]?.id || 0,
      costPrice: 0, sellingPrice: 0,
      openingQuantity: 0, currentQuantity: 0,
      reorderLevel: 0, maximumStock: 0,
      shelfLocation: '', leadTime: 0, productImage: '',
      isActive: true, notes: ''
    });
    setOpenDialog(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditId(product.id!);
    setFormProduct({ ...product });
    setOpenDialog(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.deleteProduct(id);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete product');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.updateProduct(editId, formProduct);
      } else {
        await api.createProduct(formProduct);
      }
      setOpenDialog(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save product');
    }
  };

  // AG Grid Column Definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'sku', headerName: 'SKU', width: 120, filter: true },
    { field: 'name', headerName: 'Name', width: 180, filter: true },
    { field: 'category.name', headerName: 'Category', width: 130 },
    { field: 'brand.name', headerName: 'Brand', width: 110 },
    { field: 'currentQuantity', headerName: 'Qty in Stock', width: 110, type: 'numericColumn' },
    { field: 'costPrice', headerName: 'Cost', width: 100, valueFormatter: (p) => `$${p.value?.toFixed(2)}`, type: 'numericColumn' },
    { field: 'sellingPrice', headerName: 'Price', width: 100, valueFormatter: (p) => `$${p.value?.toFixed(2)}`, type: 'numericColumn' },
    { field: 'shelfLocation', headerName: 'Location', width: 120 },
    {
      field: 'isActive',
      headerName: 'Status',
      width: 100,
      valueFormatter: (p) => p.value ? 'Active' : 'Inactive',
    },
    {
      headerName: 'Actions',
      width: 160,
      cellRenderer: (params: any) => (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', height: '100%' }}>
          <Button variant="outlined" size="small" onClick={() => handleOpenEdit(params.data)}>Edit</Button>
          <Button variant="outlined" size="small" color="error" onClick={() => handleDelete(params.data.id)}>Delete</Button>
        </div>
      )
    }
  ], [categories, brands, suppliers]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
  }), []);

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>Products</Typography>
        <Button variant="contained" onClick={handleOpenAdd}>
          Add Product
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : (
        <div className={theme.palette.mode === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} style={{ flexGrow: 1, height: '600px', width: '100%', boxShadow: 'var(--shadow-md)' }}>
          <AgGridReact
            ref={gridRef}
            rowData={products}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={15}
          />
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editId ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label="SKU" fullWidth required value={formProduct.sku} onChange={(e) => setFormProduct({ ...formProduct, sku: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Product Name" fullWidth required value={formProduct.name} onChange={(e) => setFormProduct({ ...formProduct, name: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Description" fullWidth multiline rows={2} value={formProduct.description} onChange={(e) => setFormProduct({ ...formProduct, description: e.target.value })} />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <Select value={formProduct.categoryId} label="Category" onChange={(e) => setFormProduct({ ...formProduct, categoryId: Number(e.target.value) })}>
                    {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth required>
                  <InputLabel>Brand</InputLabel>
                  <Select value={formProduct.brandId} label="Brand" onChange={(e) => setFormProduct({ ...formProduct, brandId: Number(e.target.value) })}>
                    {brands.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth required>
                  <InputLabel>Unit</InputLabel>
                  <Select value={formProduct.unitId} label="Unit" onChange={(e) => setFormProduct({ ...formProduct, unitId: Number(e.target.value) })}>
                    {units.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth required>
                  <InputLabel>Supplier</InputLabel>
                  <Select value={formProduct.supplierId} label="Supplier" onChange={(e) => setFormProduct({ ...formProduct, supplierId: Number(e.target.value) })}>
                    {suppliers.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField label="Cost Price" type="number" fullWidth slotProps={{ htmlInput: { step: '0.01', min: '0' } }} required value={formProduct.costPrice} onChange={(e) => setFormProduct({ ...formProduct, costPrice: parseFloat(e.target.value) || 0 })} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField label="Selling Price" type="number" fullWidth slotProps={{ htmlInput: { step: '0.01', min: '0' } }} required value={formProduct.sellingPrice} onChange={(e) => setFormProduct({ ...formProduct, sellingPrice: parseFloat(e.target.value) || 0 })} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField label="Opening Quantity" type="number" fullWidth slotProps={{ htmlInput: { min: '0', disabled: !!editId } }} required value={formProduct.openingQuantity} onChange={(e) => setFormProduct({ ...formProduct, openingQuantity: parseFloat(e.target.value) || 0 })} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField label="Reorder Level" type="number" fullWidth slotProps={{ htmlInput: { min: '0' } }} required value={formProduct.reorderLevel} onChange={(e) => setFormProduct({ ...formProduct, reorderLevel: parseFloat(e.target.value) || 0 })} />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField label="Maximum Stock" type="number" fullWidth slotProps={{ htmlInput: { min: '0' } }} required value={formProduct.maximumStock} onChange={(e) => setFormProduct({ ...formProduct, maximumStock: parseFloat(e.target.value) || 0 })} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField label="Shelf Location" fullWidth value={formProduct.shelfLocation} onChange={(e) => setFormProduct({ ...formProduct, shelfLocation: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField label="Lead Time (Days)" type="number" fullWidth slotProps={{ htmlInput: { min: '0' } }} required value={formProduct.leadTime} onChange={(e) => setFormProduct({ ...formProduct, leadTime: parseInt(e.target.value) || 0 })} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControlLabel control={<Switch checked={formProduct.isActive} onChange={(e) => setFormProduct({ ...formProduct, isActive: e.target.checked })} />} label="Active" />
              </Grid>

              <Grid item xs={12}>
                <TextField label="Notes" fullWidth multiline rows={2} value={formProduct.notes} onChange={(e) => setFormProduct({ ...formProduct, notes: e.target.value })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
