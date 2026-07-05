# Product Requirements Document (PRD)

## Single-Store Inventory Management System

**Version:** 1.0\
**Platform:** Photino.NET + ASP.NET Core (.NET 10) + React +
TypeScript + SQLite

------------------------------------------------------------------------

# 1. Vision

Build a modern, offline-first desktop inventory management application
for a **single store**. The application must be distributed as a single
desktop application using Photino.NET, requiring no external database
server and storing all data in SQLite.

## Goals

-   Portable desktop application
-   Offline-first
-   Single-store inventory
-   High performance
-   Zero external dependencies
-   Modern UI
-   Easy backup & restore
-   Future-ready architecture

------------------------------------------------------------------------

# 2. Technology Stack

## Desktop

-   Photino.NET

## Backend

-   ASP.NET Core (.NET 10)
-   Minimal APIs
-   Entity Framework Core

## Frontend

-   React
-   TypeScript
-   Vite
-   Material UI
-   AG Grid Community
-   Apache ECharts

## Database

-   SQLite

## Reporting

-   QuestPDF
-   ClosedXML

## Logging

-   Serilog

------------------------------------------------------------------------

# 3. Architecture

    Photino.NET
        │
        ├── React Frontend
        │
        ├── ASP.NET Core Backend
        │
        └── SQLite Database

Feature-based modules:

-   Dashboard
-   Products
-   Categories
-   Brands
-   Units
-   Suppliers
-   Purchasing
-   Inventory
-   Reports
-   Settings
-   Backup

------------------------------------------------------------------------

# 4. Functional Requirements

## Dashboard

Display:

-   Total Products
-   Current Inventory Quantity
-   Current Inventory Value
-   Low Stock Count
-   Out of Stock Count
-   Inventory Trend
-   Purchase Trend
-   Top Purchased Products
-   Category Distribution
-   Recent Transactions

------------------------------------------------------------------------

## Products

Each product contains:

-   SKU
-   Name
-   Description
-   Category
-   Brand
-   Unit
-   Supplier
-   Cost Price
-   Selling Price
-   Opening Quantity
-   Current Quantity
-   Reorder Level
-   Maximum Stock
-   Shelf Location
-   Lead Time
-   Product Image
-   Active Status
-   Notes

Rules:

-   SKU must be unique.
-   No negative prices.
-   No duplicate products.

------------------------------------------------------------------------

## Categories

-   Create
-   Edit
-   Archive
-   Search

------------------------------------------------------------------------

## Brands

-   Create
-   Edit
-   Archive

------------------------------------------------------------------------

## Units

Examples:

-   pcs
-   kg
-   litre
-   box
-   pack

------------------------------------------------------------------------

## Suppliers

Fields:

-   Name
-   Contact Person
-   Phone
-   Email
-   Address
-   Notes

Capabilities:

-   Purchase history
-   Last purchase date
-   Last purchase price

------------------------------------------------------------------------

## Purchasing

Support:

-   Purchase Orders
-   Goods Receipt
-   Purchase Register
-   Supplier Invoice
-   Purchase Returns

Automatic inventory update after receiving stock.

------------------------------------------------------------------------

## Inventory

Support transaction types:

-   Opening Stock
-   Purchase
-   Adjustment (+)
-   Adjustment (-)
-   Damaged
-   Expired
-   Stock Count Adjustment

Maintain immutable transaction history.

Current stock is calculated from transactions and may be cached for
performance.

------------------------------------------------------------------------

## Stock Count

Fields:

-   Date
-   Product
-   System Quantity
-   Physical Quantity
-   Difference
-   Adjustment
-   Remarks

------------------------------------------------------------------------

## Inventory Ledger

Every stock movement must generate a ledger record containing:

-   Date
-   Product
-   Transaction Type
-   Reference
-   Quantity In
-   Quantity Out
-   Running Balance

------------------------------------------------------------------------

# 5. Reports

Provide:

-   Current Stock
-   Inventory Ledger
-   Inventory Valuation
-   Low Stock
-   Out of Stock
-   Overstock
-   Dead Stock
-   Fast Moving
-   Slow Moving
-   Purchase Report
-   Supplier Report
-   Category Report
-   Monthly Purchase Report

Export formats:

-   Excel
-   PDF
-   CSV

------------------------------------------------------------------------

# 6. Dashboard KPIs

-   Inventory Value
-   Inventory Quantity
-   Products Count
-   Low Stock
-   Out of Stock
-   Purchases This Month
-   Top Suppliers
-   Top Categories

------------------------------------------------------------------------

# 7. Database

Core tables:

-   Products
-   Categories
-   Brands
-   Units
-   Suppliers
-   PurchaseOrders
-   PurchaseItems
-   StockTransactions
-   StockAdjustments
-   StockCounts
-   InventorySnapshots
-   Settings
-   AuditLog

Indexes:

-   SKU
-   Product Name
-   Category
-   Supplier
-   Transaction Date

------------------------------------------------------------------------

# 8. User Experience

Navigation:

-   Dashboard
-   Products
-   Purchasing
-   Inventory
-   Reports
-   Settings

Requirements:

-   Responsive desktop layout
-   Global search
-   Sorting
-   Filtering
-   Pagination
-   Keyboard navigation
-   Confirmation dialogs
-   Toast notifications
-   Empty-state messages

------------------------------------------------------------------------

# 9. Backup & Restore

Features:

-   One-click backup
-   One-click restore
-   Automatic daily backups
-   Configurable retention
-   Database integrity verification

------------------------------------------------------------------------

# 10. Non-Functional Requirements

-   Offline operation
-   Startup \< 3 seconds
-   Database encryption optional
-   Automatic migrations
-   Structured logging
-   Crash recovery
-   Cross-platform compatibility
-   Memory efficient

------------------------------------------------------------------------

# 11. Security

-   Local data only
-   Input validation
-   SQL injection protection via EF Core
-   Error logging
-   Safe file handling

------------------------------------------------------------------------

# 12. Project Structure

``` text
InventorySystem/
├── Backend/
├── Frontend/
├── Shared/
├── Database/
├── AppData/
│   ├── inventory.db
│   ├── Backups/
│   ├── Images/
│   └── Exports/
└── Installer/
```

------------------------------------------------------------------------

# 13. Future Features

Not in initial scope:

-   Barcode scanning
-   Customer management
-   POS
-   Multi-store
-   Cloud sync
-   Accounting integration
-   AI demand forecasting

------------------------------------------------------------------------

# 14. Acceptance Criteria

-   Application launches from one executable.
-   SQLite database initializes automatically.
-   Inventory updates correctly after every transaction.
-   Ledger balances are accurate.
-   Reports reconcile with transaction history.
-   Backup and restore are successful.
-   Excel/PDF exports generate correctly.
-   Application functions fully offline.

------------------------------------------------------------------------

# 15. Success Metrics

-   Inventory accuracy \>99%
-   Startup time \<3 seconds
-   Report generation \<5 seconds
-   Backup completion \<30 seconds
-   Zero data loss during normal operation
