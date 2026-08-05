import React, { useState, useEffect } from 'react';
import { 
  Edit2, 
  Trash2, 
  Plus, 
  Search, 
  Filter, 
  Truck, 
  Phone, 
  Mail, 
  MapPin, 
  X 
} from 'lucide-react';
import { api } from '../api';
import type { Supplier } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input } from '../components/ui/Input';

interface SuppliersProps {
  onSelectSupplier?: (supplierId: number) => void;
}

export default function Suppliers({ onSelectSupplier }: SuppliersProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'withPhone' | 'withEmail' | 'withNotes'>('all');

  // Dialog & Form states
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [dialogError, setDialogError] = useState('');

  const [formSupplier, setFormSupplier] = useState<Supplier>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  async function loadSuppliers() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleOpenAdd = () => {
    setEditId(null);
    setDialogError('');
    setFormSupplier({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });
    setOpenDialog(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditId(sup.id || null);
    setDialogError('');
    setFormSupplier({ ...sup });
    setOpenDialog(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplier.name.trim()) {
      setDialogError('Supplier Name is required');
      return;
    }

    setDialogError('');
    try {
      if (editId != null) {
        await api.updateSupplier(editId, formSupplier);
      } else {
        await api.createSupplier(formSupplier);
      }
      setOpenDialog(false);
      loadSuppliers();
    } catch (err: any) {
      setDialogError(err.message || 'Failed to save supplier');
    }
  };

  const handleDelete = (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (confirmDeleteId == null) return;
    const idToDelete = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.deleteSupplier(idToDelete);
      loadSuppliers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete supplier');
    }
  };

  // Filter & Search Logic
  const filteredSuppliers = suppliers.filter((sup) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      sup.name.toLowerCase().includes(searchLower) ||
      (sup.contactPerson || '').toLowerCase().includes(searchLower) ||
      (sup.phone || '').toLowerCase().includes(searchLower) ||
      (sup.email || '').toLowerCase().includes(searchLower) ||
      (sup.address || '').toLowerCase().includes(searchLower) ||
      (sup.notes || '').toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (filterType === 'withPhone') return !!sup.phone;
    if (filterType === 'withEmail') return !!sup.email;
    if (filterType === 'withNotes') return !!sup.notes;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-905 dark:text-white">Suppliers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage supplier profiles, contact info, and addresses.</p>
        </div>
        <Button onClick={handleOpenAdd} className="inline-flex items-center space-x-2 self-start sm:self-auto">
          <Plus size={16} />
          <span>Add Supplier</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/40">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, contact, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-605 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:focus:border-indigo-400"
          >
            <option value="all">All Suppliers</option>
            <option value="withPhone">With Phone</option>
            <option value="withEmail">With Email</option>
            <option value="withNotes">With Notes</option>
          </select>
        </div>
      </div>

      {/* Suppliers Table */}
      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-200/50 dark:border-slate-800/60">
          <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
            <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60 select-none">
              <tr>
                <th className="px-6 py-4">Supplier Details</th>
                <th className="px-6 py-4">Contact Person</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-slate-200">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                        <Truck size={16} />
                      </div>
                      <div>
                        {onSelectSupplier ? (
                          <button 
                            onClick={() => onSelectSupplier(sup.id!)}
                            className="hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 text-left font-bold cursor-pointer transition-colors"
                          >
                            {sup.name}
                          </button>
                        ) : (
                          <span>{sup.name}</span>
                        )}
                        {sup.notes && (
                          <span className="block text-2xs font-normal text-slate-400 mt-0.5 truncate max-w-[150px]" title={sup.notes}>
                            {sup.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">{sup.contactPerson || '-'}</td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    {sup.phone ? (
                      <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                        <Phone size={12} className="text-slate-400" />
                        <span>{sup.phone}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-3.5">
                    {sup.email ? (
                      <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                        <Mail size={12} className="text-slate-400" />
                        <span>{sup.email}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-3.5 truncate max-w-xs">
                    {sup.address ? (
                      <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-305">
                        <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">{sup.address}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    <div className="flex gap-2 justify-end items-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(sup)}
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-655 dark:text-slate-350 cursor-pointer transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sup.id!)}
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 cursor-pointer transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No suppliers found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        title={editId != null ? 'Edit Supplier' : 'Add New Supplier'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {dialogError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
              {dialogError}
            </div>
          )}
          <Input
            label="Supplier Name *"
            value={formSupplier.name}
            onChange={(e) => setFormSupplier({ ...formSupplier, name: e.target.value })}
            placeholder="e.g. Acme Wholesale Corp"
            required
          />
          <Input
            label="Contact Person"
            value={formSupplier.contactPerson || ''}
            onChange={(e) => setFormSupplier({ ...formSupplier, contactPerson: e.target.value })}
            placeholder="e.g. John Doe"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              value={formSupplier.phone || ''}
              onChange={(e) => setFormSupplier({ ...formSupplier, phone: e.target.value })}
              placeholder="e.g. +977 9800000000"
            />
            <Input
              label="Email Address"
              type="email"
              value={formSupplier.email || ''}
              onChange={(e) => setFormSupplier({ ...formSupplier, email: e.target.value })}
              placeholder="e.g. supplier@example.com"
            />
          </div>
          <Input
            label="Address"
            value={formSupplier.address || ''}
            onChange={(e) => setFormSupplier({ ...formSupplier, address: e.target.value })}
            placeholder="e.g. Kathmandu, Nepal"
          />
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <textarea
              value={formSupplier.notes || ''}
              onChange={(e) => setFormSupplier({ ...formSupplier, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes about supplier..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editId != null ? 'Update Supplier' : 'Create Supplier'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={confirmDeleteId != null}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Supplier"
        description="Are you sure you want to delete this supplier? This action cannot be undone."
      />
    </div>
  );
}
