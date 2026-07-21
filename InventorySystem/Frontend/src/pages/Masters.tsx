import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Plus, Search, X } from 'lucide-react';
import { api } from '../api';
import type { Category, Brand, Unit, Supplier } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input } from '../components/ui/Input';
import { Switch } from '../components/ui/Switch';

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

  // Confirm delete dialog
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Form states
  const [formCategory, setFormCategory] = useState<Category>({ name: '', isArchived: false });
  const [formBrand, setFormBrand] = useState<Brand>({ name: '', isArchived: false });
  const [formUnit, setFormUnit] = useState<Unit>({ name: '' });
  const [formSupplier, setFormSupplier] = useState<Supplier>({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });

  // Search & Dialog UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogError, setDialogError] = useState('');

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
    setDialogError('');
    setFormCategory({ name: '', isArchived: false });
    setFormBrand({ name: '', isArchived: false });
    setFormUnit({ name: '' });
    setFormSupplier({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });
    setOpenDialog(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditId(item.id);
    setDialogError('');
    if (activeTab === 0) setFormCategory(item);
    else if (activeTab === 1) setFormBrand(item);
    else if (activeTab === 2) setFormUnit(item);
    else if (activeTab === 3) setFormSupplier(item);
    setOpenDialog(true);
  };

  const handleDelete = (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (confirmDeleteId == null) return;
    const idToDelete = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      if (activeTab === 0) await api.deleteCategory(idToDelete);
      else if (activeTab === 1) await api.deleteBrand(idToDelete);
      else if (activeTab === 2) await api.deleteUnit(idToDelete);
      else if (activeTab === 3) await api.deleteSupplier(idToDelete);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError('');
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
      setDialogError(err.message || 'Failed to save item');
    }
  };

  const tabs = ['Categories', 'Brands', 'Units', 'Suppliers'];

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredUnits = units.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.phone && s.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (s.notes && s.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="relative w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${tabs[activeTab].toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all duration-200"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <Button onClick={handleOpenAdd} className="inline-flex items-center space-x-2">
          <Plus size={16} />
          <span>Add {activeTab === 0 ? 'Category' : activeTab === 1 ? 'Brand' : activeTab === 2 ? 'Unit' : 'Supplier'}</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Modern Pill Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-2xl max-w-md border border-slate-200/20 dark:border-slate-800/40">
        {tabs.map((tab, idx) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(idx);
              setSearchTerm('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 cursor-pointer ${
              activeTab === idx
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-200/50 dark:border-slate-800/60">
          <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
            <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60 select-none">
              {activeTab === 0 && (
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Archived</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              )}
              {activeTab === 1 && (
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Archived</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              )}
              {activeTab === 2 && (
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              )}
              {activeTab === 3 && (
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Address</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {activeTab === 0 && filteredCategories.map((cat) => (
                <tr key={cat.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors ${cat.isArchived ? 'opacity-60 italic' : ''}`}>
                  <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-slate-200">{cat.name}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wide border ${cat.isArchived ? 'bg-amber-50 text-amber-700 border-amber-200/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200/30 dark:bg-emerald-950/20 dark:text-emerald-400'}`}>
                      {cat.isArchived ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex gap-2 justify-end items-center">
                      <button 
                        type="button" 
                        onClick={() => handleOpenEdit(cat)} 
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 cursor-pointer transition-colors" 
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDelete(cat.id!)} 
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 cursor-pointer transition-colors" 
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeTab === 1 && filteredBrands.map((br) => (
                <tr key={br.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors ${br.isArchived ? 'opacity-60 italic' : ''}`}>
                  <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-slate-200">{br.name}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wide border ${br.isArchived ? 'bg-amber-50 text-amber-700 border-amber-200/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200/30 dark:bg-emerald-950/20 dark:text-emerald-400'}`}>
                      {br.isArchived ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex gap-2 justify-end items-center">
                      <button 
                        type="button" 
                        onClick={() => handleOpenEdit(br)} 
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-655 dark:text-slate-350 cursor-pointer transition-colors" 
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDelete(br.id!)} 
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 cursor-pointer transition-colors" 
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeTab === 2 && filteredUnits.map((un) => (
                <tr key={un.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-slate-205">{un.name}</td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex gap-2 justify-end items-center">
                      <button 
                        type="button" 
                        onClick={() => handleOpenEdit(un)} 
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350 cursor-pointer transition-colors" 
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDelete(un.id!)} 
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 cursor-pointer transition-colors" 
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeTab === 3 && filteredSuppliers.map((sup) => (
                <tr key={sup.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-slate-200">{sup.name}</td>
                  <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">{sup.contactPerson}</td>
                  <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">{sup.phone}</td>
                  <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">{sup.email}</td>
                  <td className="px-6 py-3.5 truncate max-w-xs text-slate-700 dark:text-slate-300">{sup.address}</td>
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
              {((activeTab === 0 && filteredCategories.length === 0) ||
                (activeTab === 1 && filteredBrands.length === 0) ||
                (activeTab === 2 && filteredUnits.length === 0) ||
                (activeTab === 3 && filteredSuppliers.length === 0)) && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    No master records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Dynamic Master Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={() => setOpenDialog(false)} 
        title={`${editId ? 'Edit' : 'Add'} ${activeTab === 0 ? 'Category' : activeTab === 1 ? 'Brand' : activeTab === 2 ? 'Unit' : 'Supplier'}`}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-5">
          {dialogError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-650 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
              {dialogError}
            </div>
          )}

          {activeTab === 0 && (
            <div className="space-y-4">
              <Input label="Category Name" required value={formCategory.name} onChange={(e) => setFormCategory({ ...formCategory, name: e.target.value })} />
              <div className="pt-2">
                <Switch checked={formCategory.isArchived} onChange={(checked) => setFormCategory({ ...formCategory, isArchived: checked })} label="Archived" />
              </div>
            </div>
          )}
          {activeTab === 1 && (
            <div className="space-y-4">
              <Input label="Brand Name" required value={formBrand.name} onChange={(e) => setFormBrand({ ...formBrand, name: e.target.value })} />
              <div className="pt-2">
                <Switch checked={formBrand.isArchived} onChange={(checked) => setFormBrand({ ...formBrand, isArchived: checked })} label="Archived" />
              </div>
            </div>
          )}
          {activeTab === 2 && (
            <Input label="Unit Name" required value={formUnit.name} onChange={(e) => setFormUnit({ ...formUnit, name: e.target.value })} />
          )}
          {activeTab === 3 && (
            <div className="space-y-4">
              <Input label="Supplier Name" required value={formSupplier.name} onChange={(e) => setFormSupplier({ ...formSupplier, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Contact Person" value={formSupplier.contactPerson || ''} onChange={(e) => setFormSupplier({ ...formSupplier, contactPerson: e.target.value })} />
                <Input label="Phone" value={formSupplier.phone || ''} onChange={(e) => setFormSupplier({ ...formSupplier, phone: e.target.value })} />
              </div>
              <Input label="Email" type="email" value={formSupplier.email || ''} onChange={(e) => setFormSupplier({ ...formSupplier, email: e.target.value })} />
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Address</label>
                <textarea
                  className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
                  rows={2}
                  value={formSupplier.address || ''} 
                  onChange={(e) => setFormSupplier({ ...formSupplier, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Notes</label>
                <textarea
                  className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
                  rows={2}
                  value={formSupplier.notes || ''} 
                  onChange={(e) => setFormSupplier({ ...formSupplier, notes: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button type="submit">Save Record</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete Item"
        description="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
