import { useState, useEffect } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Grid, FormControl, InputLabel, Select, MenuItem, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, CircularProgress, Alert, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../api';
import type { PurchaseOrder, Supplier, Product, PurchaseItem } from '../api';

export default function Purchasing() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [pos, sups, prods] = await Promise.all([
        api.getPurchaseOrders(),
        api.getSuppliers(),
        api.getProducts(),
      ]);
      setOrders(pos);
      setSuppliers(sups);
      setProducts(prods);
      if (sups.length > 0) setSelectedSupplierId(sups[0].id!);
    } catch (err: any) {
      setError(err.message || 'Failed to load purchasing data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleAddPoItem = () => {
    setPoItems([...poItems, { productId: products[0]?.id || 0, quantityOrdered: 1, costPrice: products[0]?.costPrice || 0 }]);
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
      const prod = products.find(p => p.id === value);
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
        costPrice: i.costPrice
      }));
      await api.createPurchaseOrder({
        supplierId: selectedSupplierId,
        items
      });
      setOpenCreate(false);
      loadData();
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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>Purchasing (Purchase Orders)</Typography>
        <Button variant="contained" onClick={() => setOpenCreate(true)} disabled={suppliers.length === 0 || products.length === 0}>
          New Purchase Order
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ boxShadow: 'var(--shadow-md)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order Number</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{order.supplier?.name}</TableCell>
                  <TableCell>{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : ''}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        color: order.status === 'Received' ? 'success.main' : 'warning.main',
                        fontWeight: 'bold'
                      }}
                    >
                      {order.status}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {order.status !== 'Received' && (
                      <Button variant="outlined" size="small" onClick={() => handleOpenReceive(order)}>
                        Receive Items
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">No Purchase Orders created yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create PO Dialog */}
      <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Purchase Order</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Supplier</InputLabel>
              <Select value={selectedSupplierId} label="Supplier" onChange={(e) => setSelectedSupplierId(Number(e.target.value))}>
                {suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>

            <Typography variant="h6">Items</Typography>

            {poItems.map((item, idx) => (
              <Grid container spacing={2} key={idx} alignItems="center">
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Product</InputLabel>
                    <Select value={item.productId} label="Product" onChange={(e) => handlePoItemChange(idx, 'productId', Number(e.target.value))}>
                      {products.map(p => <MenuItem key={p.id} value={p.id}>{p.name} ({p.sku})</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={2}>
                  <TextField label="Qty" type="number" fullWidth value={item.quantityOrdered} onChange={(e) => handlePoItemChange(idx, 'quantityOrdered', parseFloat(e.target.value) || 0)} />
                </Grid>
                <Grid item xs={3}>
                  <TextField label="Cost" type="number" fullWidth slotProps={{ htmlInput: { step: '0.01' } }} value={item.costPrice} onChange={(e) => handlePoItemChange(idx, 'costPrice', parseFloat(e.target.value) || 0)} />
                </Grid>
                <Grid item xs={1}>
                  <IconButton color="error" onClick={() => handleRemovePoItem(idx)} disabled={poItems.length === 1}>
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}

            <Button startIcon={<AddIcon />} onClick={handleAddPoItem} sx={{ alignSelf: 'flex-start' }}>
              Add Item
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)}>Cancel</Button>
          <Button onClick={handleSavePo} variant="contained">Create Order</Button>
        </DialogActions>
      </Dialog>

      {/* Receive PO Dialog */}
      <Dialog open={openReceive} onClose={() => setOpenReceive(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Receive Purchase Order: {selectedOrder?.orderNumber}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {selectedOrder?.items.map(item => (
              <Grid container spacing={2} key={item.productId} alignItems="center">
                <Grid item xs={6}>
                  <Typography variant="body1">{item.product?.name}</Typography>
                  <Typography variant="caption" color="textSecondary">Ordered: {item.quantityOrdered}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Quantity Received"
                    type="number"
                    fullWidth
                    value={receiveQuantities[item.productId] ?? 0}
                    onChange={(e) => setReceiveQuantities({ ...receiveQuantities, [item.productId]: parseFloat(e.target.value) || 0 })}
                  />
                </Grid>
              </Grid>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReceive(false)}>Cancel</Button>
          <Button onClick={handleSaveReceive} variant="contained">Post to Inventory</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
