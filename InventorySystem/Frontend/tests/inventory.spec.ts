import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const DB_PREFIX = '/tmp/test-inventory-e2e';

test.describe('Single-Store Inventory Management System E2E Suite', () => {
  test('E2E Flow: Complete System User Journey with Transactions, Finance, and Backups', async ({ page }) => {
    const DB_PATH = `${DB_PREFIX}-${Date.now()}.db`;
    // Enable browser logging and dialog trapping for diagnostic purposes
    const logPath = path.join(process.cwd(), 'tests', 'playwright_debug.log');
    fs.writeFileSync(logPath, '--- START TEST RUN ---\n');
    const log = (msg: string) => {
      fs.appendFileSync(logPath, msg + '\n');
    };

    page.on('console', msg => log('BROWSER LOG: ' + msg.text()));
    page.on('pageerror', err => log('BROWSER ERROR: ' + err.message));
    page.on('dialog', async dialog => {
      log('DIALOG DETECTED: ' + dialog.message());
      await dialog.dismiss();
    });

    // ────────── 1. LAUNCHER PAGE ──────────
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify Title & Welcome text on Launcher
    await expect(page.locator('h1')).toContainText('Single Store Inventory');
    await expect(page.locator('p').first()).toContainText('Select or create a database to get started');

    // Tab Navigation Test
    const openRecentTab = page.getByRole('button', { name: 'Open Recent' });
    const newDbTab = page.getByRole('button', { name: 'New Database' });
    await expect(openRecentTab).toBeVisible();
    await expect(newDbTab).toBeVisible();

    // Click on New Database Tab
    await newDbTab.click();
    await page.waitForTimeout(500);

    // Fill in the new database creation form
    const saveLocationInput = page.getByPlaceholder('/path/to/mystore.db');
    await saveLocationInput.fill(DB_PATH);
    await page.getByPlaceholder('My Store').fill('E2E Test Store');
    await page.getByPlaceholder('Enter a strong password to encrypt the database').fill('TestSecurePassword123');

    // Click "Create Database" button
    await page.getByRole('button', { name: 'Create Database' }).click();
    await page.waitForTimeout(1500);

    // We should now be redirected to the main dashboard
    await expect(page.locator('header')).toContainText('Alpha Tech Systems');

    // ────────── 2. LAYOUT & SIDEBAR ──────────
    // Collapse the sidebar
    const toggleSidebarBtn = page.locator('button[title="Collapse sidebar"]');
    await expect(toggleSidebarBtn).toBeVisible();
    await toggleSidebarBtn.click();
    await page.waitForTimeout(500);

    // Expand the sidebar
    const expandSidebarBtn = page.locator('button[title="Expand sidebar"]');
    await expect(expandSidebarBtn).toBeVisible();
    await expandSidebarBtn.click();
    await page.waitForTimeout(500);

    // ────────── 3. MASTERS SETUP ──────────
    await page.getByRole('button', { name: 'Masters' }).click();
    await page.waitForTimeout(500);

    // Add Category "Electronics"
    await page.getByRole('button', { name: 'Add Category' }).click();
    await page.waitForSelector('form');
    await page.locator('form input:not([type="checkbox"])').fill('Electronics');
    await page.getByRole('button', { name: 'Save Record' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('table')).toContainText('Electronics');

    // Add Brand "TechBrand"
    await page.getByRole('button', { name: 'Brands' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Add Brand' }).click();
    await page.waitForSelector('form');
    await page.locator('form input:not([type="checkbox"])').fill('TechBrand');
    await page.getByRole('button', { name: 'Save Record' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('table')).toContainText('TechBrand');

    // Add Unit "Pcs"
    await page.getByRole('button', { name: 'Units' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Add Unit' }).click();
    await page.waitForSelector('form');
    await page.locator('form input:not([type="checkbox"])').fill('Pcs');
    await page.getByRole('button', { name: 'Save Record' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('table')).toContainText('Pcs');

    // Add Supplier "Super Supplier"
    await page.getByRole('button', { name: 'Suppliers' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Add Supplier' }).click();
    await page.waitForSelector('form');

    await page.locator('form input:not([type="checkbox"])').nth(0).fill('Super Supplier');
    await page.locator('form input:not([type="checkbox"])').nth(1).fill('John Supplier');
    await page.locator('form input:not([type="checkbox"])').nth(2).fill('9876543210');
    await page.locator('form input:not([type="checkbox"])').nth(3).fill('john@supplier.com');
    await page.locator('form textarea').nth(0).fill('123 Supplier Lane');

    await page.getByRole('button', { name: 'Save Record' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('table')).toContainText('Super Supplier');

    // ────────── 4. CUSTOMERS SETUP ──────────
    await page.getByRole('button', { name: 'Customers' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Add Customer' }).click();
    await page.waitForSelector('form');

    await page.locator('form input:not([type="checkbox"])').nth(0).fill('John Doe');
    await page.locator('form input:not([type="checkbox"])').nth(1).fill('John Contact');
    await page.locator('form input:not([type="checkbox"])').nth(2).fill('9800000000');
    await page.locator('form input:not([type="checkbox"])').nth(3).fill('john.doe@gmail.com');

    await page.getByRole('button', { name: 'Save Customer' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('table')).toContainText('John Doe');

    // ────────── 5. PRODUCTS CATALOG SETUP ──────────
    await page.getByRole('button', { name: 'Products' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Add Product' }).click();
    await page.waitForSelector('form');

    // Fill Product details
    await page.locator('form input:not([type="checkbox"])').nth(0).fill('Super Gadget'); // Product Name

    // Select dropdowns
    const selectElements = page.locator('form select');
    await expect(selectElements).toHaveCount(4);
    await selectElements.nth(0).selectOption({ label: 'Electronics' });
    await selectElements.nth(1).selectOption({ label: 'TechBrand' });
    await selectElements.nth(2).selectOption({ label: 'Pcs' });
    await selectElements.nth(3).selectOption({ label: 'Super Supplier' });

    // Fill pricing and stock info
    await page.locator('form input:not([type="checkbox"])').nth(1).fill('GAD-001'); // SKU
    await page.locator('form input:not([type="checkbox"])').nth(2).fill('150'); // Cost Price
    await page.locator('form input:not([type="checkbox"])').nth(3).fill('250'); // Selling Price
    await page.locator('form input:not([type="checkbox"])').nth(4).fill('100'); // Opening Qty
    await page.locator('form input:not([type="checkbox"])').nth(5).fill('10'); // Reorder Level
    await page.locator('form input:not([type="checkbox"])').nth(6).fill('500'); // Maximum Stock
    await page.locator('form input:not([type="checkbox"])').nth(7).fill('3'); // Lead Time (Days)

    // Save Product
    await page.getByRole('button', { name: 'Save Product' }).click();
    await page.waitForTimeout(1000);

    // Verify product is in table with opening stock
    await expect(page.locator('table')).toContainText('Super Gadget');
    await expect(page.locator('table')).toContainText('100');

    // ────────── 6. PURCHASING TRANSACTION FLOW ──────────
    await page.getByRole('button', { name: 'Purchasing' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'New Purchase Order' }).click();
    await page.waitForSelector('form');

    // Setup Purchase order form
    await page.locator('form select').nth(0).selectOption({ label: 'Super Supplier' });
    await page.locator('form select').nth(1).selectOption({ label: 'Super Gadget (GAD-001)' });
    await page.locator('form input:not([type="checkbox"])').nth(0).fill('10'); // Order Qty
    await page.locator('form input:not([type="checkbox"])').nth(1).fill('150'); // Cost Price

    // Submit Purchase Order
    await page.getByRole('button', { name: 'Create Order' }).click();
    await page.waitForTimeout(1000);

    // Check that the ordered order is in the list
    await expect(page.locator('table')).toContainText('Ordered');

    // Receive the Purchase Order items to update stock
    await page.getByRole('button', { name: 'Receive Items' }).first().click();
    await page.waitForSelector('form');
    await page.getByRole('button', { name: 'Post to Inventory' }).click();
    await page.waitForTimeout(1000);

    // Verify order status updated to Received
    await expect(page.locator('table')).toContainText('Received');

    // ────────── 7. SALES TRANSACTION FLOW ──────────
    await page.getByRole('button', { name: 'Sales' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'New Sale' }).click();
    await page.waitForSelector('form');

    // Select customer and product
    await page.locator('form select').nth(0).selectOption({ label: 'John Doe' });
    await page.locator('form select').nth(1).selectOption({ label: 'Super Gadget (GAD-001)' });
    await page.locator('form input:not([type="checkbox"])').nth(0).fill('5'); // Sale Qty
    await page.locator('form input:not([type="checkbox"])').nth(1).fill('250'); // Sale Unit Price

    // Complete the sales invoice
    await page.getByRole('button', { name: 'Complete Sale' }).click();
    await page.waitForTimeout(1000);

    // Verify sales status in list
    await expect(page.locator('table')).toContainText('Completed');

    // ────────── 8. FINANCE INSPECTION ──────────
    await page.getByRole('button', { name: 'Finance' }).click();
    await page.waitForTimeout(500);

    // Check Debtors list has customer John Doe
    await expect(page.locator('table')).toContainText('John Doe');

    // Switch to Creditors tab and check outstanding liability to Supplier
    await page.getByRole('button', { name: 'Creditors' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('table')).toContainText('Super Supplier');

    // ────────── 9. STOCK LEDGER INSPECTION ──────────
    await page.getByRole('button', { name: 'Stock Ledger' }).click();
    await page.waitForTimeout(500);

    // Verify ledger table tracks product transaction history
    await expect(page.locator('table')).toContainText('Super Gadget');

    // ────────── 10. SETTINGS & BACKUP ACTIONS ──────────
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(500);

    // Click "Create Backup"
    await page.getByRole('button', { name: 'Create Backup' }).click();
    await page.waitForTimeout(1000);

    // Check backup success alert is shown
    await expect(page.locator('body')).toContainText('Backup created successfully');
  });
});
