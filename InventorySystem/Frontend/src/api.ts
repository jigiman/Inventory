const urlParams = new URLSearchParams(window.location.search);
const paramBackend = urlParams.get('backend');
if (paramBackend) {
  localStorage.setItem('backend_url', paramBackend);
}

const API_BASE = window.location.origin.includes('localhost:5173')
  ? (localStorage.getItem('backend_url') || 'http://127.0.0.1:5000')
  : window.location.origin;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export interface Category {
  id?: number;
  name: string;
  isArchived: boolean;
}

export interface Brand {
  id?: number;
  name: string;
  isArchived: boolean;
}

export interface Unit {
  id?: number;
  name: string;
}

export interface Supplier {
  id?: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export interface PaginatedResult<T> {
  totalCount: number;
  items: T[];
  page: number;
  pageSize: number;
}

export interface Product {
  id?: number;
  sku: string;
  name: string;
  description: string;
  categoryId: number;
  category?: Category;
  brandId: number;
  brand?: Brand;
  unitId: number;
  unit?: Unit;
  supplierId: number;
  supplier?: Supplier;
  costPrice: number;
  sellingPrice: number;
  openingQuantity: number;
  currentQuantity: number;
  reorderLevel: number;
  maximumStock: number;
  leadTime: number;
  productImage: string;
  isActive: boolean;
  notes: string;
}

export interface PurchaseItem {
  id?: number;
  productId: number;
  product?: Product;
  quantityOrdered: number;
  quantityReceived: number;
  costPrice: number;
}

export interface PurchaseOrder {
  id?: number;
  orderNumber?: string;
  supplierId: number;
  supplier?: Supplier;
  orderDate?: string;
  status?: string;
  items: PurchaseItem[];
}

export interface StockTransaction {
  id: number;
  productId: number;
  product?: Product;
  transactionType: string;
  quantityIn: number;
  quantityOut: number;
  reference: string;
  transactionDate: string;
  runningBalance: number;
}

export interface StockAdjustment {
  id?: number;
  productId: number;
  quantity: number;
  adjustmentType: string;
  reason: string;
  createdDate?: string;
}

export interface StockCount {
  id?: number;
  productId: number;
  physicalQuantity: number;
  systemQuantity: number;
  difference?: number;
  remarks: string;
  countDate?: string;
}

export interface Setting {
  id?: number;
  key: string;
  value: string;
}

export const api = {
  // Launcher
  getLauncherStatus: () => request<{
    status: 'NOT_INITIALIZED' | 'READY';
    recentDatabases: { name: string; path: string; lastOpened: string }[];
    theme: 'light' | 'dark';
  }>('/api/launcher'),
  openDatabase: (dbPath: string) => request<{ status: string; dbPath: string }>('/api/launcher/open', {
    method: 'POST', body: JSON.stringify({ dbPath }),
  }),
  createDatabase: (dbPath: string, name?: string) => request<{ status: string; dbPath: string; name: string }>('/api/launcher/new', {
    method: 'POST', body: JSON.stringify({ dbPath, name }),
  }),
  saveTheme: (theme: 'light' | 'dark') => request<{ theme: 'light' | 'dark' }>('/api/launcher/theme', {
    method: 'POST', body: JSON.stringify({ theme }),
  }),

  // Categories
  getCategories: () => request<Category[]>('/api/categories'),
  createCategory: (cat: Category) => request<Category>('/api/categories', { method: 'POST', body: JSON.stringify(cat) }),
  updateCategory: (id: number, cat: Category) => request<Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(cat) }),
  deleteCategory: (id: number) => request<void>(`/api/categories/${id}`, { method: 'DELETE' }),

  // Brands
  getBrands: () => request<Brand[]>('/api/brands'),
  createBrand: (brand: Brand) => request<Brand>('/api/brands', { method: 'POST', body: JSON.stringify(brand) }),
  updateBrand: (id: number, brand: Brand) => request<Brand>(`/api/brands/${id}`, { method: 'PUT', body: JSON.stringify(brand) }),
  deleteBrand: (id: number) => request<void>(`/api/brands/${id}`, { method: 'DELETE' }),

  // Units
  getUnits: () => request<Unit[]>('/api/units'),
  createUnit: (unit: Unit) => request<Unit>('/api/units', { method: 'POST', body: JSON.stringify(unit) }),
  updateUnit: (id: number, unit: Unit) => request<Unit>(`/api/units/${id}`, { method: 'PUT', body: JSON.stringify(unit) }),
  deleteUnit: (id: number) => request<void>(`/api/units/${id}`, { method: 'DELETE' }),

  // Suppliers
  getSuppliers: () => request<Supplier[]>('/api/suppliers'),
  createSupplier: (supplier: Supplier) => request<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify(supplier) }),
  updateSupplier: (id: number, supplier: Supplier) => request<Supplier>(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(supplier) }),
  deleteSupplier: (id: number) => request<void>(`/api/suppliers/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: (page = 1, pageSize = 50, search?: string) => {
    let url = `/api/products?page=${page}&pageSize=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return request<PaginatedResult<Product>>(url);
  },
  createProduct: (product: Product) => request<Product>('/api/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id: number, product: Product) => request<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  deleteProduct: (id: number) => request<void>(`/api/products/${id}`, { method: 'DELETE' }),

  // Purchase Orders
  getPurchaseOrders: () => request<PurchaseOrder[]>('/api/purchase-orders'),
  createPurchaseOrder: (po: PurchaseOrder) => request<PurchaseOrder>('/api/purchase-orders', { method: 'POST', body: JSON.stringify(po) }),
  receivePurchaseOrder: (id: number, items: { productId: number; quantityReceived: number }[]) =>
    request<PurchaseOrder>(`/api/purchase-orders/${id}/receive`, { method: 'POST', body: JSON.stringify(items) }),

  // Inventory
  getLedger: (page = 1, pageSize = 50, search?: string) => {
    let url = `/api/inventory/ledger?page=${page}&pageSize=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return request<PaginatedResult<StockTransaction>>(url);
  },
  adjustStock: (adj: StockAdjustment) => request<StockAdjustment>('/api/inventory/adjust', { method: 'POST', body: JSON.stringify(adj) }),
  countStock: (count: StockCount) => request<StockCount>('/api/inventory/count', { method: 'POST', body: JSON.stringify(count) }),

  // Settings
  getSettings: () => request<Setting[]>('/api/settings'),
  saveSetting: (setting: Setting) => request<Setting>('/api/settings', { method: 'POST', body: JSON.stringify(setting) }),

  // Backups
  getBackups: () => request<string[]>('/api/backups'),
  createBackup: () => request<{ file: string }>('/api/backups', { method: 'POST' }),
  restoreBackup: (fileName: string) => request<{ status: string }>('/api/backups/restore', { method: 'POST', body: JSON.stringify({ fileName }) }),

  // Dashboard
  getDashboardData: () => request<{
    totalProducts: number;
    totalQuantity: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    recentTransactions: {
      id: number;
      transactionDate: string;
      productName: string;
      transactionType: string;
      quantity: number;
    }[];
  }>('/api/reports/dashboard'),

  // Export URLs helper
  getExportUrl: (type: string, format: string) => `${API_BASE}/api/reports/export?type=${type}&format=${format}`,
};
