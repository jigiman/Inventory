const urlParams = new URLSearchParams(window.location.search);
const paramBackend = urlParams.get('backend');
if (paramBackend) {
  localStorage.setItem('backend_url', paramBackend);
}

let API_BASE = window.location.origin.includes('localhost:5173')
  ? (localStorage.getItem('backend_url') || 'http://127.0.0.1:5000')
  : window.location.origin;

if (API_BASE.startsWith('https://127.0.0.1:5000') || API_BASE.startsWith('https://localhost:5000')) {
  API_BASE = API_BASE.replace('https://', 'http://');
  localStorage.setItem('backend_url', API_BASE);
}

let sessionToken = sessionStorage.getItem('session_token') || '';

export function setSessionToken(token: string) {
  sessionToken = token;
  if (token) {
    sessionStorage.setItem('session_token', token);
  } else {
    sessionStorage.removeItem('session_token');
  }
}

async function requestRaw<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 30000; // 30 seconds

export function clearCache() {
  console.log('API CACHE CLEARED');
  memoryCache.clear();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const isGet = !options || !options.method || options.method.toUpperCase() === 'GET';
  console.log(`API REQUEST: ${isGet ? 'GET' : options?.method} ${path}`);
  
  // Skip caching launcher configuration checks
  const isLauncher = path.startsWith('/api/launcher');
  
  if (!isGet || isLauncher) {
    if (!isGet) {
      clearCache();
    }
    const res = await requestRaw<T>(path, options);
    console.log(`API REQUEST SUCCESS (RAW): ${path}`);
    return res;
  }

  const cacheKey = path;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`API REQUEST CACHE HIT: ${path}`);
    return Promise.resolve(cached.data);
  }

  console.log(`API REQUEST CACHE MISS: ${path}`);
  const data = await requestRaw<T>(path, options);
  console.log(`API REQUEST SUCCESS: ${path}`);
  memoryCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
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

export interface Customer {
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
  parentProductId?: number;
  variantValues?: string;
  variants?: Product[];
}


export interface PurchaseItem {
  id?: number;
  productId: number;
  product?: Product;
  quantityOrdered: number;
  quantityReceived: number;
  costPrice: number;
  unitPrice?: number;
}

export interface PurchaseOrder {
  id?: number;
  orderNumber?: string;
  supplierId: number;
  supplier?: Supplier;
  orderDate?: string;
  status?: string;
  totalAmount: number;
  items: PurchaseItem[];
}

export interface SaleItem {
  id?: number;
  productId: number;
  product?: Product;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  discountPercentage?: number;
  supplierId?: number;
  supplier?: Supplier;
  costPrice?: number;
}

export interface Sale {
  id?: number;
  saleNumber?: string;
  customerId: number;
  customer?: Customer;
  saleDate?: string;
  status?: string;
  subTotal?: number;
  discountAmount?: number;
  totalAmount: number;
  items: SaleItem[];
}

export interface Payment {
  id?: number;
  paymentDate?: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  notes: string;
  customerId?: number;
  supplierId?: number;
  saleId?: number;
  purchaseOrderId?: number;
  isRefund?: boolean;
}

export interface SalesReturnItem {
  id?: number;
  salesReturnId?: number;
  productId: number;
  product?: Product;
  quantity: number;
  unitPrice: number;
}

export interface SalesReturn {
  id?: number;
  returnNumber?: string;
  customerId: number;
  customer?: Customer;
  saleId?: number;
  sale?: Sale;
  returnDate?: string;
  totalAmount: number;
  notes: string;
  items: SalesReturnItem[];
}

export interface PurchaseReturnItem {
  id?: number;
  purchaseReturnId?: number;
  productId: number;
  product?: Product;
  quantity: number;
  costPrice: number;
}

export interface PurchaseReturn {
  id?: number;
  returnNumber?: string;
  supplierId: number;
  supplier?: Supplier;
  purchaseOrderId?: number;
  purchaseOrder?: PurchaseOrder;
  returnDate?: string;
  totalAmount: number;
  notes: string;
  items: PurchaseReturnItem[];
}

export interface FinanceReportItem {
  customer?: Customer;
  supplier?: Supplier;
  totalSales?: number;
  totalPurchases?: number;
  totalReturns?: number;
  totalPaid: number;
  balance: number;
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
    sessionToken?: string;
  }>('/api/launcher'),
  openDatabase: (dbPath: string, password?: string) => request<{ status: string; dbPath: string; sessionToken: string }>('/api/launcher/open', {
    method: 'POST', body: JSON.stringify({ dbPath, password }),
  }),
  createDatabase: (dbPath: string, name?: string, password?: string) => request<{ status: string; dbPath: string; name: string; sessionToken: string }>('/api/launcher/new', {
    method: 'POST', body: JSON.stringify({ dbPath, name, password }),
  }),
  loadDemoDatabase: () => request<{ status: string; dbPath: string; name: string; sessionToken: string }>('/api/launcher/demo', {
    method: 'POST',
  }),
  removeRecentDatabase: (dbPath: string) => request<{ recentDatabases: { name: string; path: string; lastOpened: string }[] }>('/api/launcher/remove-recent', {
    method: 'POST', body: JSON.stringify({ dbPath }),
  }),
  saveTheme: (theme: 'light' | 'dark') => request<{ theme: 'light' | 'dark' }>('/api/launcher/theme', {
    method: 'POST', body: JSON.stringify({ theme }),
  }),
  pickDatabaseFile: () => request<{ path: string | null }>('/api/launcher/pick-file', {
    method: 'POST',
  }),
  checkUpdates: () => request<{
    updateAvailable: boolean;
    latestVersion: string;
    currentVersion: string;
    downloadUrl: string;
  }>('/api/launcher/check-update'),

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

  // Customers
  getCustomers: () => request<Customer[]>('/api/customers'),
  createCustomer: (customer: Customer) => request<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(customer) }),
  updateCustomer: (id: number, customer: Customer) => request<Customer>(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(customer) }),
  deleteCustomer: (id: number) => request<void>(`/api/customers/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: (page = 1, pageSize = 50, search?: string) => {
    let url = `/api/products?page=${page}&pageSize=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return request<PaginatedResult<Product>>(url);
  },
  createProduct: (product: Product) => request<Product>('/api/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id: number, product: Product) => request<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  deleteProduct: (id: number) => request<void>(`/api/products/${id}`, { method: 'DELETE' }),
  getProductBatches: (id: number) => request<any[]>(`/api/products/${id}/batches`),

  // Purchase Orders
  getPurchaseOrders: (params?: { page?: number; pageSize?: number; search?: string; status?: string; startDate?: string; endDate?: string }) => {
    let url = '/api/purchase-orders';
    if (params) {
      const q = new URLSearchParams();
      if (params.page) q.append('page', params.page.toString());
      if (params.pageSize) q.append('pageSize', params.pageSize.toString());
      if (params.search) q.append('search', params.search);
      if (params.status) q.append('status', params.status);
      if (params.startDate) q.append('startDate', params.startDate);
      if (params.endDate) q.append('endDate', params.endDate);
      url += '?' + q.toString();
    }
    return request<PaginatedResult<PurchaseOrder>>(url);
  },
  createPurchaseOrder: (po: PurchaseOrder) => request<PurchaseOrder>('/api/purchase-orders', { method: 'POST', body: JSON.stringify(po) }),
  receivePurchaseOrder: (id: number, items: { productId: number; quantityReceived: number }[]) =>
    request<PurchaseOrder>(`/api/purchase-orders/${id}/receive`, { method: 'POST', body: JSON.stringify(items) }),

  // Sales
  getSales: (params?: { page?: number; pageSize?: number; search?: string; status?: string; startDate?: string; endDate?: string; customerId?: number }) => {
    let url = '/api/sales';
    if (params) {
      const q = new URLSearchParams();
      if (params.page) q.append('page', params.page.toString());
      if (params.pageSize) q.append('pageSize', params.pageSize.toString());
      if (params.search) q.append('search', params.search);
      if (params.status) q.append('status', params.status);
      if (params.startDate) q.append('startDate', params.startDate);
      if (params.endDate) q.append('endDate', params.endDate);
      if (params.customerId) q.append('customerId', params.customerId.toString());
      url += '?' + q.toString();
    }
    return request<PaginatedResult<Sale>>(url);
  },
  createSale: (sale: Sale) => request<Sale>('/api/sales', { method: 'POST', body: JSON.stringify(sale) }),
  getSale: (id: number) => request<Sale>(`/api/sales/${id}`),
  getSalePdfUrl: (id: number) => `${API_BASE}/api/sales/${id}/pdf?token=${encodeURIComponent(sessionToken)}`,

  // Returns
  getSalesReturns: (params?: { customerId?: number; saleId?: number }) => {
    let url = '/api/sales-returns';
    if (params) {
      const q = new URLSearchParams();
      if (params.customerId) q.append('customerId', params.customerId.toString());
      if (params.saleId) q.append('saleId', params.saleId.toString());
      url += '?' + q.toString();
    }
    return request<SalesReturn[]>(url);
  },
  createSalesReturn: (sr: SalesReturn) => request<SalesReturn>('/api/sales-returns', { method: 'POST', body: JSON.stringify(sr) }),
  getPurchaseReturns: (params?: { supplierId?: number; purchaseOrderId?: number }) => {
    let url = '/api/purchase-returns';
    if (params) {
      const q = new URLSearchParams();
      if (params.supplierId) q.append('supplierId', params.supplierId.toString());
      if (params.purchaseOrderId) q.append('purchaseOrderId', params.purchaseOrderId.toString());
      url += '?' + q.toString();
    }
    return request<PurchaseReturn[]>(url);
  },
  createPurchaseReturn: (pr: PurchaseReturn) => request<PurchaseReturn>('/api/purchase-returns', { method: 'POST', body: JSON.stringify(pr) }),

  // Finance & Payments
  getDebtors: (params?: { page?: number; pageSize?: number; search?: string; minBalance?: number }) => {
    let url = '/api/finance/debtors';
    if (params) {
      const q = new URLSearchParams();
      if (params.page) q.append('page', params.page.toString());
      if (params.pageSize) q.append('pageSize', params.pageSize.toString());
      if (params.search) q.append('search', params.search);
      if (params.minBalance !== undefined) q.append('minBalance', params.minBalance.toString());
      url += '?' + q.toString();
    }
    return request<PaginatedResult<FinanceReportItem>>(url);
  },
  getCreditors: (params?: { page?: number; pageSize?: number; search?: string; minBalance?: number }) => {
    let url = '/api/finance/creditors';
    if (params) {
      const q = new URLSearchParams();
      if (params.page) q.append('page', params.page.toString());
      if (params.pageSize) q.append('pageSize', params.pageSize.toString());
      if (params.search) q.append('search', params.search);
      if (params.minBalance !== undefined) q.append('minBalance', params.minBalance.toString());
      url += '?' + q.toString();
    }
    return request<PaginatedResult<FinanceReportItem>>(url);
  },
  recordPayment: (payment: Payment) => request<Payment>('/api/payments', { method: 'POST', body: JSON.stringify(payment) }),
  getPayments: (params?: { saleId?: number; purchaseOrderId?: number; customerId?: number }) => {
    let url = '/api/payments';
    if (params) {
      const q = new URLSearchParams();
      if (params.saleId) q.append('saleId', params.saleId.toString());
      if (params.purchaseOrderId) q.append('purchaseOrderId', params.purchaseOrderId.toString());
      if (params.customerId) q.append('customerId', params.customerId.toString());
      url += '?' + q.toString();
    }
    return request<Payment[]>(url);
  },

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

  getBackups: () => request<string[]>('/api/backups'),
  createBackup: () => request<{ file: string }>('/api/backups', { method: 'POST' }),
  restoreBackup: (fileName: string) => request<{ status: string }>('/api/backups/restore', { method: 'POST', body: JSON.stringify({ fileName }) }),
  deleteBackup: (fileName: string) => request<{ status: string }>(`/api/backups/${encodeURIComponent(fileName)}`, { method: 'DELETE' }),

  // Dashboard
  getDashboardData: () => request<{
    totalProducts: number;
    totalQuantity: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalDebtors: number;
    totalCreditors: number;
    recentTransactions: {
      id: number;
      transactionDate: string;
      productName: string;
      transactionType: string;
      quantity: number;
    }[];
  }>('/api/reports/dashboard'),

  // Export URLs helper
  getExportUrl: (type: string, format: string) => `${API_BASE}/api/reports/export?type=${type}&format=${format}&token=${encodeURIComponent(sessionToken)}`,

  // Updater
  getUpdateStatus: () => request<UpdateStatus>('/api/updater/status'),
  checkForUpdates: () => request<UpdateStatus>('/api/updater/check', { method: 'POST' }),
  downloadUpdate: () => request<UpdateStatus>('/api/updater/download', { method: 'POST' }),
  applyUpdate: () => request<{ message: string }>('/api/updater/apply', { method: 'POST' }),
};

export interface UpdateStatus {
  isSupported: boolean;
  currentVersion: string;
  updateAvailable: boolean;
  targetVersion?: string;
  releaseNotes?: string;
  isDownloaded: boolean;
  downloadProgress: number;
  error?: string;
}

