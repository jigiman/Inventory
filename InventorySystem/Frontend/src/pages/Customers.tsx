import React, { useState, useEffect } from 'react';
import { 
  Edit2, 
  Trash2, 
  Plus, 
  Search, 
  Filter, 
  Users, 
  Phone, 
  Mail, 
  MapPin, 
  ArrowLeft, 
  History, 
  FileText, 
  CreditCard,
  Calendar,
  X
} from 'lucide-react';
import { api } from '../api';
import type { Customer, Sale, SalesReturn, Payment } from '../api';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Input } from '../components/ui/Input';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected customer for detail view
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  
  // History states
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'sales' | 'returns' | 'payments'>('sales');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'withPhone' | 'withEmail' | 'withNotes'>('all');

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  // Confirm delete dialog
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Form state
  const [formCustomer, setFormCustomer] = useState<Customer>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const custs = await api.getCustomers();
      setCustomers(custs);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Fetch customer history details when viewingCustomer changes
  useEffect(() => {
    const customer = viewingCustomer;
    if (!customer || !customer.id) return;
    const cid = customer.id;
    async function loadCustomerHistory() {
      setDetailLoading(true);
      try {
        const [salesRes, returnsRes, paymentsRes] = await Promise.all([
          api.getSales({ customerId: cid, pageSize: 100 }),
          api.getSalesReturns({ customerId: cid }),
          api.getPayments({ customerId: cid }),
        ]);
        setSales(salesRes.items || []);
        setReturns(returnsRes || []);
        setPayments(paymentsRes || []);
      } catch (err) {
        console.error('Failed to load customer details:', err);
      } finally {
        setDetailLoading(false);
      }
    }
    loadCustomerHistory();
  }, [viewingCustomer]);

  const handleOpenAdd = () => {
    setEditId(null);
    setFormCustomer({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
    setOpenDialog(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditId(customer.id!);
    setFormCustomer({ ...customer });
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
      await api.deleteCustomer(idToDelete);
      // If we deleted the customer currently being viewed, exit details page
      if (viewingCustomer?.id === idToDelete) {
        setViewingCustomer(null);
      }
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete customer');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let savedCust: Customer;
      if (editId) {
        savedCust = await api.updateCustomer(editId, formCustomer);
        // Update viewingCustomer details in real-time if we are editing it
        if (viewingCustomer?.id === editId) {
          setViewingCustomer(savedCust);
        }
      } else {
        await api.createCustomer(formCustomer);
      }
      setOpenDialog(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    }
  };

  // Filter & Search Logic
  const filteredCustomers = customers.filter((cust) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      cust.name.toLowerCase().includes(searchLower) ||
      (cust.contactPerson || '').toLowerCase().includes(searchLower) ||
      (cust.phone || '').toLowerCase().includes(searchLower) ||
      (cust.email || '').toLowerCase().includes(searchLower) ||
      (cust.address || '').toLowerCase().includes(searchLower) ||
      (cust.notes || '').toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (filterType === 'withPhone') return !!cust.phone;
    if (filterType === 'withEmail') return !!cust.email;
    if (filterType === 'withNotes') return !!cust.notes;

    return true;
  });

  // Render Customer Detail View
  if (viewingCustomer) {
    return (
      <div className="space-y-6">
        {/* Detail Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3.5">
            <button
              onClick={() => setViewingCustomer(null)}
              className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 transition-all duration-300 cursor-pointer shadow-sm border border-slate-200/30 dark:border-slate-800"
              title="Back to Customers list"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span>{viewingCustomer.name}</span>
                <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">(ID: {viewingCustomer.id})</span>
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-405 mt-0.5">Detailed profile and financial transaction history.</p>
            </div>
          </div>
          <div className="flex space-x-3 self-start sm:self-auto">
            <Button variant="outline" onClick={() => handleOpenEdit(viewingCustomer)} className="inline-flex items-center space-x-2">
              <Edit2 size={14} />
              <span>Edit Profile</span>
            </Button>
            <Button variant="outline" onClick={() => handleDelete(viewingCustomer.id!)} className="inline-flex items-center space-x-2 text-rose-600 hover:text-rose-700 dark:text-rose-450 dark:hover:text-rose-400">
              <Trash2 size={14} />
              <span>Delete</span>
            </Button>
          </div>
        </div>

        {/* Profile Card Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white dark:bg-slate-950/40 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-605 dark:text-indigo-400">Contact Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Users size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <span className="block text-2xs text-slate-400 uppercase tracking-wider font-bold">Contact Person</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{viewingCustomer.contactPerson || '-'}</span>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Phone size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <span className="block text-2xs text-slate-400 uppercase tracking-wider font-bold">Phone Number</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{viewingCustomer.phone || '-'}</span>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Mail size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <span className="block text-2xs text-slate-400 uppercase tracking-wider font-bold">Email Address</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-all">{viewingCustomer.email || '-'}</span>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <span className="block text-2xs text-slate-400 uppercase tracking-wider font-bold">Billing Address</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{viewingCustomer.address || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-950/40 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-605 dark:text-indigo-400">Notes & Internal Memo</h3>
            <div className="text-sm text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 min-h-[100px] whitespace-pre-wrap">
              {viewingCustomer.notes || 'No notes added for this customer.'}
            </div>
          </div>
        </div>

        {/* History Area */}
        <div className="space-y-4">
          {/* History Navigation Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl max-w-sm border border-slate-200/25 dark:border-slate-800/40">
            <button
              onClick={() => setDetailTab('sales')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-350 cursor-pointer flex items-center justify-center space-x-1.5 ${
                detailTab === 'sales'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-750 dark:hover:text-slate-300'
              }`}
            >
              <FileText size={14} />
              <span>Sales ({sales.length})</span>
            </button>
            <button
              onClick={() => setDetailTab('returns')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-355 cursor-pointer flex items-center justify-center space-x-1.5 ${
                detailTab === 'returns'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-750 dark:hover:text-slate-300'
              }`}
            >
              <History size={14} />
              <span>Returns ({returns.length})</span>
            </button>
            <button
              onClick={() => setDetailTab('payments')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-355 cursor-pointer flex items-center justify-center space-x-1.5 ${
                detailTab === 'payments'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-750 dark:hover:text-slate-300'
              }`}
            >
              <CreditCard size={14} />
              <span>Payments ({payments.length})</span>
            </button>
          </div>

          {/* History Lists */}
          {detailLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-slate-200/50 dark:border-slate-800/60">
              {detailTab === 'sales' && (
                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                  <thead className="bg-slate-50 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
                    <tr>
                      <th className="px-6 py-4">Sale Number</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Items</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {sales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">{sale.saleNumber || `Sale #${sale.id}`}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {sale.saleDate ? (
                            <span className="flex items-center space-x-1.5">
                              <Calendar size={13} className="text-slate-400" />
                              <span>{new Date(sale.saleDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate">
                          {sale.items?.map(it => `${it.product?.name} (x${it.quantity})`).join(', ') || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wide border ${
                            sale.status === 'Completed' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/20 dark:bg-emerald-950/20 dark:text-emerald-400' 
                              : 'bg-amber-50 text-amber-700 border-amber-200/20 dark:bg-amber-950/20 dark:text-amber-450'
                          }`}>
                            {sale.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-extrabold text-slate-800 dark:text-slate-250">
                          NPR {sale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {sales.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                          No sales transactions found for this customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {detailTab === 'returns' && (
                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                  <thead className="bg-slate-50 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
                    <tr>
                      <th className="px-6 py-4">Return Number</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Returned Items</th>
                      <th className="px-6 py-4">Notes / Reason</th>
                      <th className="px-6 py-4 text-right">Refund Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {returns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">{ret.returnNumber || `Return #${ret.id}`}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {ret.returnDate ? (
                            <span className="flex items-center space-x-1.5">
                              <Calendar size={13} className="text-slate-400" />
                              <span>{new Date(ret.returnDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate">
                          {ret.items?.map(it => `${it.product?.name} (x${it.quantity})`).join(', ') || '-'}
                        </td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-350">{ret.notes || '-'}</td>
                        <td className="px-6 py-4 text-right font-extrabold text-rose-600 dark:text-rose-450">
                          NPR {ret.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {returns.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                          No sales returns or refunds recorded for this customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {detailTab === 'payments' && (
                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                  <thead className="bg-slate-50 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60">
                    <tr>
                      <th className="px-6 py-4">Reference</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Payment Method</th>
                      <th className="px-6 py-4">Notes</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {payments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-200">{pay.reference || `Payment #${pay.id}`}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {pay.paymentDate ? (
                            <span className="flex items-center space-x-1.5">
                              <Calendar size={13} className="text-slate-400" />
                              <span>{new Date(pay.paymentDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wide border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 text-indigo-750 dark:bg-indigo-950/20 dark:text-indigo-400">
                            {pay.paymentMethod}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700 dark:text-slate-350">{pay.notes || '-'}</td>
                        <td className={`px-6 py-4 text-right font-extrabold ${pay.isRefund ? 'text-rose-600 dark:text-rose-450' : 'text-emerald-600 dark:text-emerald-450'}`}>
                          {pay.isRefund ? '-' : '+'}NPR {pay.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                          No payments history found for this customer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Customer Dialog inside Detail Page */}
        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          title={`${editId ? 'Edit' : 'Add'} Customer`}
          size="md"
        >
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-4">
              <Input
                label="Customer Name"
                required
                value={formCustomer.name}
                onChange={(e) => setFormCustomer({ ...formCustomer, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Contact Person"
                  value={formCustomer.contactPerson || ''}
                  onChange={(e) => setFormCustomer({ ...formCustomer, contactPerson: e.target.value })}
                />
                <Input
                  label="Phone"
                  value={formCustomer.phone || ''}
                  onChange={(e) => setFormCustomer({ ...formCustomer, phone: e.target.value })}
                />
              </div>
              <Input
                label="Email"
                type="email"
                value={formCustomer.email || ''}
                onChange={(e) => setFormCustomer({ ...formCustomer, email: e.target.value })}
              />
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Address
                </label>
                <textarea
                  className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
                  rows={2}
                  value={formCustomer.address || ''}
                  onChange={(e) => setFormCustomer({ ...formCustomer, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  Notes
                </label>
                <textarea
                  className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
                  rows={2}
                  value={formCustomer.notes || ''}
                  onChange={(e) => setFormCustomer({ ...formCustomer, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Customer</Button>
            </div>
          </form>
        </Dialog>

        <ConfirmDialog
          open={confirmDeleteId !== null}
          title="Delete Customer"
          description="Are you sure you want to delete this customer? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      </div>
    );
  }

  // Render Customers List View
  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-905 dark:text-white">Customers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage customer profiles, contact info, and addresses.</p>
        </div>
        <Button onClick={handleOpenAdd} className="inline-flex items-center space-x-2 self-start sm:self-auto">
          <Plus size={16} />
          <span>Add Customer</span>
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
            <option value="all">All Customers</option>
            <option value="withPhone">With Phone</option>
            <option value="withEmail">With Email</option>
            <option value="withNotes">With Notes</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent dark:border-indigo-400" />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-200/50 dark:border-slate-800/60">
          <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
            <thead className="bg-slate-550/5 text-2xs font-extrabold uppercase tracking-wider text-slate-400 dark:bg-slate-900/40 border-b border-slate-200/50 dark:border-slate-800/60 select-none">
              <tr>
                <th className="px-6 py-4">Customer Details</th>
                <th className="px-6 py-4">Contact Person</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredCustomers.map((cust) => (
                <tr key={cust.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-slate-200">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                        <Users size={16} />
                      </div>
                      <div>
                        <button 
                          onClick={() => setViewingCustomer(cust)}
                          className="hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 text-left font-bold cursor-pointer transition-colors"
                        >
                          {cust.name}
                        </button>
                        {cust.notes && (
                          <span className="block text-2xs font-normal text-slate-400 mt-0.5 truncate max-w-[150px]" title={cust.notes}>
                            {cust.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-slate-700 dark:text-slate-300">{cust.contactPerson || '-'}</td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    {cust.phone ? (
                      <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                        <Phone size={12} className="text-slate-400" />
                        <span>{cust.phone}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-3.5">
                    {cust.email ? (
                      <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                        <Mail size={12} className="text-slate-400" />
                        <span>{cust.email}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-3.5 truncate max-w-xs">
                    {cust.address ? (
                      <span className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-305">
                        <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">{cust.address}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    <div className="flex gap-2 justify-end items-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cust)}
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-655 dark:text-slate-350 cursor-pointer transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cust.id!)}
                        className="flex items-center justify-center p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 cursor-pointer transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No customers found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        title={`${editId ? 'Edit' : 'Add'} Customer`}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-4">
            <Input
              label="Customer Name"
              required
              value={formCustomer.name}
              onChange={(e) => setFormCustomer({ ...formCustomer, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Contact Person"
                value={formCustomer.contactPerson || ''}
                onChange={(e) => setFormCustomer({ ...formCustomer, contactPerson: e.target.value })}
              />
              <Input
                label="Phone"
                value={formCustomer.phone || ''}
                onChange={(e) => setFormCustomer({ ...formCustomer, phone: e.target.value })}
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={formCustomer.email || ''}
              onChange={(e) => setFormCustomer({ ...formCustomer, email: e.target.value })}
            />
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Address
              </label>
              <textarea
                className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
                rows={2}
                value={formCustomer.address || ''}
                onChange={(e) => setFormCustomer({ ...formCustomer, address: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Notes
              </label>
              <textarea
                className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400/80 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/10 transition-all duration-200"
                rows={2}
                value={formCustomer.notes || ''}
                onChange={(e) => setFormCustomer({ ...formCustomer, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Customer</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete Customer"
        description="Are you sure you want to delete this customer? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
