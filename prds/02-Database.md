# Database

Tables:
Products
Categories
Brands
Units
Suppliers
PurchaseOrders
PurchaseItems
StockTransactions
StockAdjustments
StockCounts
InventorySnapshots
Settings
AuditLog

Rules:
- SQLite only
- EF Core migrations
- SKU unique
- StockTransactions are the source of truth.
