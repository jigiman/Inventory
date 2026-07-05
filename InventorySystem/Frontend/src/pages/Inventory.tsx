import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem, TextField, Typography, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import { api } from '../api';
import type { StockTransaction, Product, StockAdjustment, StockCount } from '../api';

export default function Inventory() {
  const theme = useTheme();
  const [ledger, setLedger] = useState<StockTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Adjust / Count Dialog states
  const [openAdjust, setOpenAdjust] = useState(false);
  const [openCount, setOpenCount] = useState(false);

  // Form states
  const [adjustForm, setAdjustForm] = useState<StockAdjustment>({
    productId: 0, quantity: 0, adjustmentType: 'Plus', reason: ''
  });
  const [countForm, setCountForm] = useState<StockCount>({
    productId: 0, physicalQuantity: 0, systemQuantity: 0, remarks: ''
  });

  const gridRef = useRef<AgGridReact>(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [txs, prods] = await Promise.all([
        api.getLedger(),
        api.getProducts()
      ]);
      setLedger(txs);
      setProducts(prods);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdjust = () => {
    setAdjustForm({
      productId: products[0]?.id || 0,
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
    const defaultProd = products[0];
    setCountForm({
      productId: defaultProd?.id || 0,
      physicalQuantity: defaultProd?.currentQuantity || 0,
      systemQuantity: defaultProd?.currentQuantity || 0,
      remarks: ''
    });
    setOpenCount(true);
  };

  const handleCountProductChange = (productId: number) => {
    const prod = products.find(p => p.id === productId);
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

  // AG Grid config
  const columnDefs = useMemo<ColDef[]>(() => [
    { field: 'transactionDate', headerName: 'Date/Time', width: 180, valueFormatter: (p) => new Date(p.value).toLocaleString() },
    { field: 'product.sku', headerName: 'SKU', width: 120, filter: true },
    { field: 'product.name', headerName: 'Product', width: 200, filter: true },
    {
      field: 'transactionType',
      headerName: 'Type',
      width: 140,
      cellStyle: (p) => {
        if (p.value === 'Purchase' || p.value === 'Opening' || p.value === 'Adjustment+') return { color: '#2e7d32', fontWeight: 500 };
        return { color: '#d32f2f', fontWeight: 500 };
      }
    },
    { field: 'quantityIn', headerName: 'Qty In', width: 100, type: 'numericColumn' },
    { field: 'quantityOut', headerName: 'Qty Out', width: 100, type: 'numericColumn' },
    { field: 'runningBalance', headerName: 'Running Bal', width: 120, type: 'numericColumn' },
    { field: 'reference', headerName: 'Reference', width: 220 }
  ], [products]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
  }), []);

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>Stock Ledger & Controls</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" color="secondary" onClick={handleOpenAdjust} disabled={products.length === 0}>
            Manual Adjustment
          </Button>
          <Button variant="contained" onClick={handleOpenCount} disabled={products.length === 0}>
            Physical Stock Count
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : (
        <div className={theme.palette.mode === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} style={{ flexGrow: 1, height: '600px', width: '100%', boxShadow: 'var(--shadow-md)' }}>
          <AgGridReact
            ref={gridRef}
            rowData={ledger}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={15}
          />
        </div>
      )}

      {/* Manual Stock Adjustment Dialog */}
      <Dialog open={openAdjust} onClose={() => setOpenAdjust(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleSaveAdjust}>
          <DialogTitle>Manual Stock Adjustment</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel>Product</InputLabel>
                <Select value={adjustForm.productId} label="Product" onChange={(e) => setAdjustForm({ ...adjustForm, productId: Number(e.target.value) })}>
                  {products.map(p => <MenuItem key={p.id} value={p.id}>{p.name} ({p.sku})</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Adjustment Type</InputLabel>
                <Select value={adjustForm.adjustmentType} label="Adjustment Type" onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentType: e.target.value })}>
                  <MenuItem value="Plus">Add Stock (Plus)</MenuItem>
                  <MenuItem value="Minus">Reduce Stock (Minus)</MenuItem>
                  <MenuItem value="Damaged">Damaged Goods (Minus)</MenuItem>
                  <MenuItem value="Expired">Expired Goods (Minus)</MenuItem>
                </Select>
              </FormControl>

              <TextField label="Quantity" type="number" fullWidth slotProps={{ htmlInput: { min: '0.01', step: 'any' } }} required value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseFloat(e.target.value) || 0 })} />
              
              <TextField label="Reason" fullWidth required value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAdjust(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Post Adjustment</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Physical Stock Count Dialog */}
      <Dialog open={openCount} onClose={() => setOpenCount(false)} maxWidth="xs" fullWidth>
        <form onSubmit={handleSaveCount}>
          <DialogTitle>Physical Stock Count</DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel>Product</InputLabel>
                <Select value={countForm.productId} label="Product" onChange={(e) => handleCountProductChange(Number(e.target.value))}>
                  {products.map(p => <MenuItem key={p.id} value={p.id}>{p.name} ({p.sku})</MenuItem>)}
                </Select>
              </FormControl>

              <TextField label="System Quantity" type="number" fullWidth disabled value={countForm.systemQuantity} />
              
              <TextField label="Physical Quantity" type="number" fullWidth required value={countForm.physicalQuantity} onChange={(e) => setCountForm({ ...countForm, physicalQuantity: parseFloat(e.target.value) || 0 })} />

              <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2">
                  Difference:{' '}
                  <span style={{ fontWeight: 'bold', color: (countForm.physicalQuantity - countForm.systemQuantity) >= 0 ? '#2e7d32' : '#d32f2f' }}>
                    {(countForm.physicalQuantity - countForm.systemQuantity).toFixed(2)}
                  </span>
                </Typography>
              </Box>

              <TextField label="Remarks / Notes" fullWidth value={countForm.remarks} onChange={(e) => setCountForm({ ...countForm, remarks: e.target.value })} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCount(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Post Count</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
