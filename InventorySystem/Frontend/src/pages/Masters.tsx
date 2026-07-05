import React, { useState, useEffect } from 'react';
import { Box, Tab, Tabs, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, CircularProgress, Alert, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { api } from '../api';
import type { Category, Brand, Unit, Supplier } from '../api';

export default function Masters() {
  const [activeTab, setActiveTab] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Form states
  const [formCategory, setFormCategory] = useState<Category>({ name: '', isArchived: false });
  const [formBrand, setFormBrand] = useState<Brand>({ name: '', isArchived: false });
  const [formUnit, setFormUnit] = useState<Unit>({ name: '' });
  const [formSupplier, setFormSupplier] = useState<Supplier>({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });

  async function loadData() {
    setLoading(true);
    setError('');
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
      setError(err.message || 'Failed to load master data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditId(null);
    setFormCategory({ name: '', isArchived: false });
    setFormBrand({ name: '', isArchived: false });
    setFormUnit({ name: '' });
    setFormSupplier({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });
    setOpenDialog(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditId(item.id);
    if (activeTab === 0) setFormCategory(item);
    else if (activeTab === 1) setFormBrand(item);
    else if (activeTab === 2) setFormUnit(item);
    else if (activeTab === 3) setFormSupplier(item);
    setOpenDialog(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      if (activeTab === 0) await api.deleteCategory(id);
      else if (activeTab === 1) await api.deleteBrand(id);
      else if (activeTab === 2) await api.deleteUnit(id);
      else if (activeTab === 3) await api.deleteSupplier(id);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (activeTab === 0) {
        if (editId) await api.updateCategory(editId, formCategory);
        else await api.createCategory(formCategory);
      } else if (activeTab === 1) {
        if (editId) await api.updateBrand(editId, formBrand);
        else await api.createBrand(formBrand);
      } else if (activeTab === 2) {
        if (editId) await api.updateUnit(editId, formUnit);
        else await api.createUnit(formUnit);
      } else if (activeTab === 3) {
        if (editId) await api.updateSupplier(editId, formSupplier);
        else await api.createSupplier(formSupplier);
      }
      setOpenDialog(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save item');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>Master Records</Typography>
        <Button variant="contained" onClick={handleOpenAdd}>
          Add New {activeTab === 0 ? 'Category' : activeTab === 1 ? 'Brand' : activeTab === 2 ? 'Unit' : 'Supplier'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tab label="Categories" />
        <Tab label="Brands" />
        <Tab label="Units" />
        <Tab label="Suppliers" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ boxShadow: 'var(--shadow-md)' }}>
          <Table>
            <TableHead>
              {activeTab === 0 && (
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Archived</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              )}
              {activeTab === 1 && (
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Archived</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              )}
              {activeTab === 2 && (
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              )}
              {activeTab === 3 && (
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Contact Person</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              )}
            </TableHead>
            <TableBody>
              {activeTab === 0 && categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>{cat.name}</TableCell>
                  <TableCell>{cat.isArchived ? 'Yes' : 'No'}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpenEdit(cat)} size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(cat.id!)} size="small" color="error"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {activeTab === 1 && brands.map((br) => (
                <TableRow key={br.id}>
                  <TableCell>{br.name}</TableCell>
                  <TableCell>{br.isArchived ? 'Yes' : 'No'}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpenEdit(br)} size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(br.id!)} size="small" color="error"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {activeTab === 2 && units.map((un) => (
                <TableRow key={un.id}>
                  <TableCell>{un.name}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpenEdit(un)} size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(un.id!)} size="small" color="error"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {activeTab === 3 && suppliers.map((sup) => (
                <TableRow key={sup.id}>
                  <TableCell>{sup.name}</TableCell>
                  <TableCell>{sup.contactPerson}</TableCell>
                  <TableCell>{sup.phone}</TableCell>
                  <TableCell>{sup.email}</TableCell>
                  <TableCell>{sup.address}</TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpenEdit(sup)} size="small"><EditIcon /></IconButton>
                    <IconButton onClick={() => handleDelete(sup.id!)} size="small" color="error"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dynamic Master Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleSave}>
          <DialogTitle>{editId ? 'Edit' : 'Add'} {activeTab === 0 ? 'Category' : activeTab === 1 ? 'Brand' : activeTab === 2 ? 'Unit' : 'Supplier'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {activeTab === 0 && (
                <TextField label="Name" fullWidth required value={formCategory.name} onChange={(e) => setFormCategory({ ...formCategory, name: e.target.value })} />
              )}
              {activeTab === 1 && (
                <TextField label="Name" fullWidth required value={formBrand.name} onChange={(e) => setFormBrand({ ...formBrand, name: e.target.value })} />
              )}
              {activeTab === 2 && (
                <TextField label="Name" fullWidth required value={formUnit.name} onChange={(e) => setFormUnit({ ...formUnit, name: e.target.value })} />
              )}
              {activeTab === 3 && (
                <>
                  <TextField label="Supplier Name" fullWidth required value={formSupplier.name} onChange={(e) => setFormSupplier({ ...formSupplier, name: e.target.value })} />
                  <TextField label="Contact Person" fullWidth value={formSupplier.contactPerson} onChange={(e) => setFormSupplier({ ...formSupplier, contactPerson: e.target.value })} />
                  <TextField label="Phone" fullWidth value={formSupplier.phone} onChange={(e) => setFormSupplier({ ...formSupplier, phone: e.target.value })} />
                  <TextField label="Email" type="email" fullWidth value={formSupplier.email} onChange={(e) => setFormSupplier({ ...formSupplier, email: e.target.value })} />
                  <TextField label="Address" fullWidth multiline rows={2} value={formSupplier.address} onChange={(e) => setFormSupplier({ ...formSupplier, address: e.target.value })} />
                  <TextField label="Notes" fullWidth multiline rows={2} value={formSupplier.notes} onChange={(e) => setFormSupplier({ ...formSupplier, notes: e.target.value })} />
                </>
              )}
            </Box>
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
