using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Backend.Data;
using Backend.Models;
using Backend.Services;

namespace Backend.Features.Reports;

public static class ReportEndpoints
{
    public static void MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/reports/dashboard", async (AppDbContext db) =>
        {
            var productStats = await db.Products
                .GroupBy(p => 1)
                .Select(g => new
                {
                    TotalProducts = g.Count(),
                    TotalQuantity = g.Sum(p => p.CurrentQuantity),
                    TotalValue = g.Sum(p => p.CurrentQuantity * p.CostPrice),
                    LowStockCount = g.Count(p => p.IsActive && p.CurrentQuantity <= p.ReorderLevel && p.CurrentQuantity > 0),
                    OutOfStockCount = g.Count(p => p.IsActive && p.CurrentQuantity <= 0)
                })
                .FirstOrDefaultAsync();

            var totalProducts = productStats?.TotalProducts ?? 0;
            var totalQuantity = productStats?.TotalQuantity ?? 0;
            var totalValue = productStats?.TotalValue ?? 0;
            var lowStockCount = productStats?.LowStockCount ?? 0;
            var outOfStockCount = productStats?.OutOfStockCount ?? 0;

            // Debtor KPIs - Sum of all positive outstanding balances
            var salesGroup = await db.Sales
                .GroupBy(s => s.CustomerId)
                .Select(g => new { CustomerId = g.Key, Total = g.Sum(s => s.TotalAmount) })
                .ToDictionaryAsync(x => x.CustomerId, x => x.Total);

            var returnsGroup = await db.SalesReturns
                .GroupBy(r => r.CustomerId)
                .Select(g => new { CustomerId = g.Key, Total = g.Sum(r => r.TotalAmount) })
                .ToDictionaryAsync(x => x.CustomerId, x => x.Total);

            var paymentsGroup = await db.Payments
                .Where(p => p.CustomerId != null)
                .GroupBy(p => p.CustomerId!.Value)
                .Select(g => new { CustomerId = g.Key, Total = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
                .ToDictionaryAsync(x => x.CustomerId, x => x.Total);

            var customerIds = await db.Customers.Select(c => c.Id).ToListAsync();
            decimal totalDebtors = 0;
            foreach (var cid in customerIds)
            {
                var sales = salesGroup.GetValueOrDefault(cid, 0);
                var returns = returnsGroup.GetValueOrDefault(cid, 0);
                var paid = paymentsGroup.GetValueOrDefault(cid, 0);
                var balance = sales - returns - paid;
                if (balance > 0)
                {
                    totalDebtors += balance;
                }
            }

            // Creditor KPIs - Sum of all positive outstanding balances
            var purchasesGroup = await db.PurchaseOrders
                .GroupBy(po => po.SupplierId)
                .Select(g => new { SupplierId = g.Key, Total = g.Sum(po => po.TotalAmount) })
                .ToDictionaryAsync(x => x.SupplierId, x => x.Total);

            var purchaseReturnsGroup = await db.PurchaseReturns
                .GroupBy(pr => pr.SupplierId)
                .Select(g => new { SupplierId = g.Key, Total = g.Sum(pr => pr.TotalAmount) })
                .ToDictionaryAsync(x => x.SupplierId, x => x.Total);

            var supplierPaymentsGroup = await db.Payments
                .Where(p => p.SupplierId != null)
                .GroupBy(p => p.SupplierId!.Value)
                .Select(g => new { SupplierId = g.Key, Total = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
                .ToDictionaryAsync(x => x.SupplierId, x => x.Total);

            var supplierIds = await db.Suppliers.Select(s => s.Id).ToListAsync();
            decimal totalCreditors = 0;
            foreach (var sid in supplierIds)
            {
                var purchases = purchasesGroup.GetValueOrDefault(sid, 0);
                var returns = purchaseReturnsGroup.GetValueOrDefault(sid, 0);
                var paid = supplierPaymentsGroup.GetValueOrDefault(sid, 0);
                var balance = purchases - returns - paid;
                if (balance > 0)
                {
                    totalCreditors += balance;
                }
            }

            var recentTransactions = await db.StockTransactions
                .Include(t => t.Product)
                .OrderByDescending(t => t.TransactionDate)
                .Take(5)
                .Select(t => new
                {
                    t.Id,
                    t.TransactionDate,
                    ProductName = t.Product != null ? t.Product.Name : "",
                    t.TransactionType,
                    Quantity = t.QuantityIn > 0 ? t.QuantityIn : -t.QuantityOut
                })
                .ToListAsync();

            var valuationByCategory = await db.Products
                .Include(p => p.Category)
                .GroupBy(p => p.Category != null ? p.Category.Name : "Uncategorized")
                .Select(g => new { CategoryName = g.Key, Valuation = g.Sum(p => p.CurrentQuantity * p.CostPrice) })
                .ToListAsync();

            return Results.Ok(new
            {
                TotalProducts = totalProducts,
                TotalQuantity = totalQuantity,
                TotalValue = totalValue,
                LowStockCount = lowStockCount,
                OutOfStockCount = outOfStockCount,
                TotalDebtors = totalDebtors,
                TotalCreditors = totalCreditors,
                RecentTransactions = recentTransactions,
                ValuationByCategory = valuationByCategory
            });
        });

        app.MapGet("/api/reports/export", async (AppDbContext db, ExportService es, string type, string format) =>
        {
            List<string> headers = new();
            List<List<string>> rows = new();
            string title = "Report";
            bool isCsv = format.Equals("csv", StringComparison.OrdinalIgnoreCase);

            if (type == "CurrentStock")
            {
                title = "Current Stock Report";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Cost Price", "Valuation" };
                if (isCsv)
                {
                    return Results.Stream(async outputStream =>
                    {
                        using var writer = new StreamWriter(outputStream, System.Text.Encoding.UTF8, leaveOpen: true);
                        await writer.WriteLineAsync(string.Join(",", headers.Select(h => $"\"{h.Replace("\"", "\"\"")}\"")));
                        await foreach (var p in db.Products.Include(p => p.Category).AsNoTracking().AsAsyncEnumerable())
                        {
                            var row = new List<string>
                            {
                                p.SKU,
                                p.Name,
                                p.Category?.Name ?? "",
                                p.CurrentQuantity.ToString("0.##"),
                                p.CostPrice.ToString("F2"),
                                (p.CurrentQuantity * p.CostPrice).ToString("F2")
                            };
                            await writer.WriteLineAsync(string.Join(",", row.Select(cell => $"\"{cell?.Replace("\"", "\"\"") ?? ""}\"")));
                        }
                    }, "text/csv", $"CurrentStock_{DateTime.UtcNow:yyyyMMdd}.csv");
                }

                var list = await db.Products.Include(p => p.Category).AsNoTracking().ToListAsync();
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.Category?.Name ?? "",
                    p.CurrentQuantity.ToString("0.##"),
                    p.CostPrice.ToString("F2"),
                    (p.CurrentQuantity * p.CostPrice).ToString("F2")
                }).ToList();
            }
            else if (type == "InventoryLedger")
            {
                title = "Inventory Ledger Report";
                headers = new List<string> { "Date", "Product SKU", "Product Name", "Type", "Ref", "Qty In", "Qty Out", "Running Bal" };
                if (isCsv)
                {
                    return Results.Stream(async outputStream =>
                    {
                        using var writer = new StreamWriter(outputStream, System.Text.Encoding.UTF8, leaveOpen: true);
                        await writer.WriteLineAsync(string.Join(",", headers.Select(h => $"\"{h.Replace("\"", "\"\"")}\"")));
                        await foreach (var t in db.StockTransactions.Include(t => t.Product).AsNoTracking().OrderBy(t => t.TransactionDate).AsAsyncEnumerable())
                        {
                            var row = new List<string>
                            {
                                t.TransactionDate.ToString("yyyy-MM-dd HH:mm"),
                                t.Product?.SKU ?? "",
                                t.Product?.Name ?? "",
                                t.TransactionType,
                                t.Reference,
                                t.QuantityIn.ToString("0.##"),
                                t.QuantityOut.ToString("0.##"),
                                t.RunningBalance.ToString("0.##")
                            };
                            await writer.WriteLineAsync(string.Join(",", row.Select(cell => $"\"{cell?.Replace("\"", "\"\"") ?? ""}\"")));
                        }
                    }, "text/csv", $"InventoryLedger_{DateTime.UtcNow:yyyyMMdd}.csv");
                }

                var list = await db.StockTransactions.Include(t => t.Product).AsNoTracking().OrderBy(t => t.TransactionDate).ToListAsync();
                rows = list.Select(t => new List<string>
                {
                    t.TransactionDate.ToString("yyyy-MM-dd HH:mm"),
                    t.Product?.SKU ?? "",
                    t.Product?.Name ?? "",
                    t.TransactionType,
                    t.Reference,
                    t.QuantityIn.ToString("0.##"),
                    t.QuantityOut.ToString("0.##"),
                    t.RunningBalance.ToString("0.##")
                }).ToList();
            }
            else if (type == "InventoryValuation")
            {
                title = "Inventory Valuation Report";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Cost Price", "Selling Price", "Cost Valuation", "Selling Valuation" };
                if (isCsv)
                {
                    return Results.Stream(async outputStream =>
                    {
                        using var writer = new StreamWriter(outputStream, System.Text.Encoding.UTF8, leaveOpen: true);
                        await writer.WriteLineAsync(string.Join(",", headers.Select(h => $"\"{h.Replace("\"", "\"\"")}\"")));
                        await foreach (var p in db.Products.Include(p => p.Category).AsNoTracking().AsAsyncEnumerable())
                        {
                            var row = new List<string>
                            {
                                p.SKU,
                                p.Name,
                                p.Category?.Name ?? "",
                                p.CurrentQuantity.ToString("0.##"),
                                p.CostPrice.ToString("F2"),
                                p.SellingPrice.ToString("F2"),
                                (p.CurrentQuantity * p.CostPrice).ToString("F2"),
                                (p.CurrentQuantity * p.SellingPrice).ToString("F2")
                            };
                            await writer.WriteLineAsync(string.Join(",", row.Select(cell => $"\"{cell?.Replace("\"", "\"\"") ?? ""}\"")));
                        }
                    }, "text/csv", $"InventoryValuation_{DateTime.UtcNow:yyyyMMdd}.csv");
                }

                var list = await db.Products.Include(p => p.Category).AsNoTracking().ToListAsync();
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.Category?.Name ?? "",
                    p.CurrentQuantity.ToString("0.##"),
                    p.CostPrice.ToString("F2"),
                    p.SellingPrice.ToString("F2"),
                    (p.CurrentQuantity * p.CostPrice).ToString("F2"),
                    (p.CurrentQuantity * p.SellingPrice).ToString("F2")
                }).ToList();
            }
            else if (type == "LowStock")
            {
                title = "Low Stock Alert Report";
                headers = new List<string> { "SKU", "Product Name", "Current Stock", "Reorder Level" };
                if (isCsv)
                {
                    return Results.Stream(async outputStream =>
                    {
                        using var writer = new StreamWriter(outputStream, System.Text.Encoding.UTF8, leaveOpen: true);
                        await writer.WriteLineAsync(string.Join(",", headers.Select(h => $"\"{h.Replace("\"", "\"\"")}\"")));
                        await foreach (var p in db.Products.AsNoTracking().Where(p => p.CurrentQuantity <= p.ReorderLevel).AsAsyncEnumerable())
                        {
                            var row = new List<string>
                            {
                                p.SKU,
                                p.Name,
                                p.CurrentQuantity.ToString("0.##"),
                                p.ReorderLevel.ToString("0.##")
                            };
                            await writer.WriteLineAsync(string.Join(",", row.Select(cell => $"\"{cell?.Replace("\"", "\"\"") ?? ""}\"")));
                        }
                    }, "text/csv", $"LowStock_{DateTime.UtcNow:yyyyMMdd}.csv");
                }

                var list = await db.Products.AsNoTracking().Where(p => p.CurrentQuantity <= p.ReorderLevel).ToListAsync();
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.CurrentQuantity.ToString("0.##"),
                    p.ReorderLevel.ToString("0.##")
                }).ToList();
            }
            else if (type == "OutOfStock")
            {
                title = "Out of Stock Report";
                headers = new List<string> { "SKU", "Product Name", "Category", "Brand", "Cost Price", "Reorder Level" };
                if (isCsv)
                {
                    return Results.Stream(async outputStream =>
                    {
                        using var writer = new StreamWriter(outputStream, System.Text.Encoding.UTF8, leaveOpen: true);
                        await writer.WriteLineAsync(string.Join(",", headers.Select(h => $"\"{h.Replace("\"", "\"\"")}\"")));
                        await foreach (var p in db.Products.Include(p => p.Category).Include(p => p.Brand).AsNoTracking().Where(p => p.CurrentQuantity <= 0).AsAsyncEnumerable())
                        {
                            var row = new List<string>
                            {
                                p.SKU,
                                p.Name,
                                p.Category?.Name ?? "",
                                p.Brand?.Name ?? "",
                                p.CostPrice.ToString("F2"),
                                p.ReorderLevel.ToString("0.##")
                            };
                            await writer.WriteLineAsync(string.Join(",", row.Select(cell => $"\"{cell?.Replace("\"", "\"\"") ?? ""}\"")));
                        }
                    }, "text/csv", $"OutOfStock_{DateTime.UtcNow:yyyyMMdd}.csv");
                }

                var list = await db.Products.Include(p => p.Category).Include(p => p.Brand).AsNoTracking().Where(p => p.CurrentQuantity <= 0).ToListAsync();
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.Category?.Name ?? "",
                    p.Brand?.Name ?? "",
                    p.CostPrice.ToString("F2"),
                    p.ReorderLevel.ToString("0.##")
                }).ToList();
            }
            else if (type == "DeadStock")
            {
                title = "Dead Stock Report (No Activity 90d)";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Last Tx Date" };
                var cutoff = DateTime.UtcNow.AddDays(-90);
                var activeIds = await db.StockTransactions.AsNoTracking().Where(t => t.TransactionDate >= cutoff).Select(t => t.ProductId).Distinct().ToListAsync();
                var list = await db.Products.Include(p => p.Category).AsNoTracking().Where(p => !activeIds.Contains(p.Id)).ToListAsync();
                var lastTxs = await db.StockTransactions.AsNoTracking().GroupBy(t => t.ProductId).Select(g => new { ProductId = g.Key, LastDate = g.Max(t => t.TransactionDate) }).ToListAsync();
                var lastTxMap = lastTxs.ToDictionary(x => x.ProductId, x => x.LastDate);
                rows = list.Select(p => new List<string>
                {
                    p.SKU,
                    p.Name,
                    p.Category?.Name ?? "",
                    p.CurrentQuantity.ToString("0.##"),
                    lastTxMap.TryGetValue(p.Id, out var dt) ? dt.ToString("yyyy-MM-dd") : "Never"
                }).ToList();
            }
            else if (type == "FastMoving")
            {
                title = "Fast Moving Items (Top Outgoing 30d)";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Outgoing Qty" };
                var cutoff = DateTime.UtcNow.AddDays(-30);
                var outTxs = await db.StockTransactions
                    .AsNoTracking()
                    .Where(t => t.TransactionDate >= cutoff && t.QuantityOut > 0)
                    .GroupBy(t => t.ProductId)
                    .Select(g => new { ProductId = g.Key, OutQty = g.Sum(t => t.QuantityOut) })
                    .OrderByDescending(x => x.OutQty)
                    .Take(10)
                    .ToListAsync();
                var outQtyMap = outTxs.ToDictionary(x => x.ProductId, x => x.OutQty);
                var activeIds = outTxs.Select(x => x.ProductId).ToList();
                var list = await db.Products.Include(p => p.Category).AsNoTracking().Where(p => activeIds.Contains(p.Id)).ToListAsync();
                rows = list
                    .Select(p => new { Product = p, Qty = outQtyMap.GetValueOrDefault(p.Id, 0) })
                    .OrderByDescending(x => x.Qty)
                    .Select(x => new List<string>
                    {
                        x.Product.SKU,
                        x.Product.Name,
                        x.Product.Category?.Name ?? "",
                        x.Product.CurrentQuantity.ToString("0.##"),
                        x.Qty.ToString("0.##")
                    }).ToList();
            }
            else if (type == "SlowMoving")
            {
                title = "Slow Moving Items (Low Outgoing 30d)";
                headers = new List<string> { "SKU", "Product Name", "Category", "Current Stock", "Outgoing Qty" };
                var cutoff = DateTime.UtcNow.AddDays(-30);
                var outTxs = await db.StockTransactions
                    .AsNoTracking()
                    .Where(t => t.TransactionDate >= cutoff && t.QuantityOut > 0)
                    .GroupBy(t => t.ProductId)
                    .Select(g => new { ProductId = g.Key, OutQty = g.Sum(t => t.QuantityOut) })
                    .ToListAsync();
                var outQtyMap = outTxs.ToDictionary(x => x.ProductId, x => x.OutQty);
                var list = await db.Products.Include(p => p.Category).AsNoTracking().Where(p => p.IsActive).ToListAsync();
                rows = list
                    .Select(p => new { Product = p, Qty = outQtyMap.GetValueOrDefault(p.Id, 0) })
                    .Where(x => x.Qty < 5)
                    .OrderBy(x => x.Qty)
                    .Select(x => new List<string>
                    {
                        x.Product.SKU,
                        x.Product.Name,
                        x.Product.Category?.Name ?? "",
                        x.Product.CurrentQuantity.ToString("0.##"),
                        x.Qty.ToString("0.##")
                    }).ToList();
            }
            else if (type == "SupplierReport")
            {
                title = "Supplier Performance Report";
                headers = new List<string> { "Supplier Name", "Contact", "Phone", "Email", "Total Products", "Purchase Orders" };
                var prodCounts = await db.Products.AsNoTracking().GroupBy(p => p.SupplierId).Select(g => new { SupplierId = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.SupplierId, x => x.Count);
                var poCounts = await db.PurchaseOrders.AsNoTracking().GroupBy(po => po.SupplierId).Select(g => new { SupplierId = g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.SupplierId, x => x.Count);
                var list = await db.Suppliers.AsNoTracking().ToListAsync();
                rows = list.Select(s => new List<string>
                {
                    s.Name,
                    s.ContactPerson,
                    s.Phone,
                    s.Email,
                    prodCounts.GetValueOrDefault(s.Id, 0).ToString(),
                    poCounts.GetValueOrDefault(s.Id, 0).ToString()
                }).ToList();
            }
            else if (type == "PurchaseReport")
            {
                title = "Purchase Orders Summary Report";
                headers = new List<string> { "PO Number", "Supplier", "Date", "Status", "Items Count", "Total Cost" };
                var list = await db.PurchaseOrders.Include(po => po.Supplier).Include(po => po.Items).AsNoTracking().ToListAsync();
                rows = list.Select(po => new List<string>
                {
                    po.OrderNumber ?? "",
                    po.Supplier?.Name ?? "",
                    po.OrderDate.ToString("yyyy-MM-dd"),
                    po.Status ?? "",
                    po.Items?.Count.ToString() ?? "0",
                    po.Items?.Sum(i => i.QuantityOrdered * i.UnitPrice).ToString("F2") ?? "0.00"
                }).ToList();
            }
            else if (type == "SalesReport")
            {
                title = "Sales Summary Report";
                headers = new List<string> { "Sale Number", "Customer Name", "Date", "Items Count", "Status", "Total Amount" };
                var list = await db.Sales.Include(s => s.Customer).Include(s => s.Items).AsNoTracking().ToListAsync();
                rows = list.Select(s => new List<string>
                {
                    s.SaleNumber,
                    s.Customer?.Name ?? "",
                    s.SaleDate.ToString("yyyy-MM-dd HH:mm"),
                    s.Items?.Count.ToString() ?? "0",
                    s.Status,
                    s.TotalAmount.ToString("F2")
                }).ToList();
            }
            else if (type == "DebtorsReport")
            {
                title = "Debtors Balance Report";
                headers = new List<string> { "Customer Name", "Total Sales", "Total Returns", "Total Paid", "Outstanding Balance" };
                var sales = await db.Sales
                    .GroupBy(s => s.CustomerId)
                    .Select(g => new { CustomerId = g.Key, TotalSales = g.Sum(s => s.TotalAmount) })
                    .ToListAsync();
                var returns = await db.SalesReturns
                    .GroupBy(r => r.CustomerId)
                    .Select(g => new { CustomerId = g.Key, TotalReturns = g.Sum(r => r.TotalAmount) })
                    .ToListAsync();
                var payments = await db.Payments
                    .Where(p => p.CustomerId != null)
                    .GroupBy(p => p.CustomerId)
                    .Select(g => new { CustomerId = g.Key.Value, TotalPaid = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
                    .ToListAsync();
                var customers = await db.Customers.ToListAsync();
                var list = customers.Select(c => {
                    var totalSales = sales.FirstOrDefault(s => s.CustomerId == c.Id)?.TotalSales ?? 0;
                    var totalReturns = returns.FirstOrDefault(r => r.CustomerId == c.Id)?.TotalReturns ?? 0;
                    var totalPaid = payments.FirstOrDefault(p => p.CustomerId == c.Id)?.TotalPaid ?? 0;
                    return new {
                        Name = c.Name,
                        TotalSales = totalSales,
                        TotalReturns = totalReturns,
                        TotalPaid = totalPaid,
                        Balance = totalSales - totalReturns - totalPaid
                    };
                }).Where(r => r.Balance != 0).ToList();
                rows = list.Select(r => new List<string>
                {
                    r.Name,
                    r.TotalSales.ToString("F2"),
                    r.TotalReturns.ToString("F2"),
                    r.TotalPaid.ToString("F2"),
                    r.Balance.ToString("F2")
                }).ToList();
            }
            else if (type == "CreditorsReport")
            {
                title = "Creditors Balance Report";
                headers = new List<string> { "Supplier Name", "Total Purchases", "Total Returns", "Total Paid", "Outstanding Balance" };
                var purchases = await db.PurchaseOrders
                    .GroupBy(po => po.SupplierId)
                    .Select(g => new { SupplierId = g.Key, TotalPurchases = g.Sum(po => po.TotalAmount) })
                    .ToListAsync();
                var returns = await db.PurchaseReturns
                    .GroupBy(r => r.SupplierId)
                    .Select(g => new { SupplierId = g.Key, TotalReturns = g.Sum(r => r.TotalAmount) })
                    .ToListAsync();
                var payments = await db.Payments
                    .Where(p => p.SupplierId != null)
                    .GroupBy(p => p.SupplierId)
                    .Select(g => new { SupplierId = g.Key.Value, TotalPaid = g.Sum(p => p.IsRefund ? -p.Amount : p.Amount) })
                    .ToListAsync();
                var suppliers = await db.Suppliers.ToListAsync();
                var list = suppliers.Select(s => {
                    var totalPurchases = purchases.FirstOrDefault(p => p.SupplierId == s.Id)?.TotalPurchases ?? 0;
                    var totalReturns = returns.FirstOrDefault(r => r.SupplierId == s.Id)?.TotalReturns ?? 0;
                    var totalPaid = payments.FirstOrDefault(p => p.SupplierId == s.Id)?.TotalPaid ?? 0;
                    return new {
                        Name = s.Name,
                        TotalPurchases = totalPurchases,
                        TotalReturns = totalReturns,
                        TotalPaid = totalPaid,
                        Balance = totalPurchases - totalReturns - totalPaid
                    };
                }).Where(r => r.Balance != 0).ToList();
                rows = list.Select(r => new List<string>
                {
                    r.Name,
                    r.TotalPurchases.ToString("F2"),
                    r.TotalReturns.ToString("F2"),
                    r.TotalPaid.ToString("F2"),
                    r.Balance.ToString("F2")
                }).ToList();
            }
            else
            {
                return Results.BadRequest("Unsupported report type");
            }

            byte[] fileBytes;
            string contentType;
            string fileName;

            if (format.Equals("excel", StringComparison.OrdinalIgnoreCase))
            {
                fileBytes = es.ExportToExcel(type, headers, rows);
                contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                fileName = $"{type}_{DateTime.UtcNow:yyyyMMdd}.xlsx";
            }
            else if (format.Equals("pdf", StringComparison.OrdinalIgnoreCase))
            {
                fileBytes = es.ExportToPdf(title, headers, rows);
                contentType = "application/pdf";
                fileName = $"{type}_{DateTime.UtcNow:yyyyMMdd}.pdf";
            }
            else if (isCsv)
            {
                fileBytes = es.ExportToCsv(headers, rows);
                contentType = "text/csv";
                fileName = $"{type}_{DateTime.UtcNow:yyyyMMdd}.csv";
            }
            else
            {
                return Results.BadRequest("Unsupported format");
            }

            return Results.File(fileBytes, contentType, fileName);
        });
    }
}
