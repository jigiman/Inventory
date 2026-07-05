# Project Improvements: Single-Store Inventory Management System

This document outlines potential improvements and feature enhancements for the Single-Store Inventory Management System, categorized by functional and technical areas.

## 1. Core Inventory Features

*   **Barcode Support:** Integrate barcode scanning (HID or camera-based) for faster stock entry and lookups. Support generating and printing barcode labels for products.
*   **Serial Number Tracking:** Allow tracking unique serial numbers for high-value or electronic items.
*   **Batch & Expiry Management:** Enable batch/lot tracking with expiration dates, crucial for perishable goods or pharmaceuticals.
*   **Multi-Currency Purchasing:** Support for entering purchase orders in different currencies with automated exchange rate calculations (at least for the transaction date).
*   **Advanced Pricing Rules:** Implement volume-based discounts, promotional pricing periods, and multiple price lists (e.g., Retail vs. Wholesale).

## 2. Desktop Experience (Photino Integration)

*   **System Tray Integration:** Add a system tray icon for quick access and background notifications (e.g., "Low Stock" alerts appearing as OS notifications).
*   **Global Hotkeys:** Implement keyboard shortcuts for frequent actions like "New Transaction," "Product Search," and "Toggle Dashboard."
*   **Direct Printing:** Enhance printing capabilities to support direct-to-thermal printers for shelf labels and receipts, bypassing the standard browser print dialog where possible.
*   **Window State Persistence:** Automatically save and restore the application window's size, position, and maximized state across restarts.
*   **Local File System Integration:** Better integration for managing backups, allowing users to select any local or network-mapped directory.

## 3. Technical Enhancements

*   **Database Encryption:** Implement SQLite encryption at rest (using SQLCipher or similar) to protect sensitive business data.
*   **Auto-Update Mechanism:** A robust system for checking, downloading, and applying application updates without manual re-installation.
*   **Offline Data Resilience:** Improved error handling and local logging specifically for desktop environments where hardware interruptions (like power loss) might occur.
*   **Modular Architecture:** Refine the backend to use a more decoupled Clean Architecture or Vertical Slice Architecture to make adding new modules even simpler.
*   **Asset Management:** Improved handling of product images, including local compression and thumbnail generation to keep the database and application size optimized.

## 4. Reporting & Analytics

*   **Interactive Dashboards:** Enhance ECharts implementation to allow drill-down from charts directly to filtered data grids.
*   **Custom Report Builder:** Allow users to select columns, filters, and grouping to create and save their own custom reports.
*   **Demand Forecasting:** Basic AI/ML integration to predict stock-out dates based on historical purchase and usage trends.
*   **Accounting Integration:** Export data in formats compatible with common accounting software (e.g., QuickBooks, Xero).
*   **Inventory Reconciliation Tools:** Enhanced workflows for physical stock counts, including "blind counts" where system quantities are hidden from the counter.
