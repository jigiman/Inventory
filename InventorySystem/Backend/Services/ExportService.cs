using System.Collections.Generic;
using System.IO;
using System.Linq;
using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Backend.Services;

public class ExportService
{
    static ExportService()
    {
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
    }

    public byte[] ExportToCsv(List<string> headers, List<List<string>> rows)
    {
        using var writer = new StringWriter();
        writer.WriteLine(string.Join(",", headers.Select(h => $"\"{h.Replace("\"", "\"\"")}\"")));
        foreach (var row in rows)
        {
            writer.WriteLine(string.Join(",", row.Select(cell => $"\"{cell?.Replace("\"", "\"\"") ?? ""}\"")));
        }
        return System.Text.Encoding.UTF8.GetBytes(writer.ToString());
    }

    public byte[] ExportToExcel(string sheetName, List<string> headers, List<List<string>> rows)
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add(sheetName);

        for (int col = 0; col < headers.Count; col++)
        {
            worksheet.Cell(1, col + 1).Value = headers[col];
            worksheet.Cell(1, col + 1).Style.Font.Bold = true;
        }

        for (int row = 0; row < rows.Count; row++)
        {
            for (int col = 0; col < rows[row].Count; col++)
            {
                worksheet.Cell(row + 2, col + 1).Value = rows[row][col] ?? string.Empty;
            }
        }

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public byte[] ExportToPdf(string title, List<string> headers, List<List<string>> rows)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Header()
                    .Text(title)
                    .SemiBold().FontSize(16).FontColor(Colors.Blue.Medium);

                page.Content()
                    .PaddingVertical(0.5f, Unit.Centimetre)
                    .Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            foreach (var _ in headers)
                            {
                                columns.RelativeColumn();
                            }
                        });

                        table.Header(header =>
                        {
                            foreach (var colTitle in headers)
                            {
                                header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text(colTitle).Bold();
                            }
                        });

                        foreach (var row in rows)
                        {
                            foreach (var cell in row)
                            {
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(4).Text(cell ?? string.Empty);
                            }
                        }
                    });

                page.Footer()
                    .AlignRight()
                    .Text(x =>
                    {
                        x.Span("Page ");
                        x.CurrentPageNumber();
                    });
            });
        });

        using var stream = new MemoryStream();
        document.GeneratePdf(stream);
        return stream.ToArray();
    }

    public byte[] ExportSaleInvoicePdf(Backend.Models.Sale sale, string storeName = "Inventory Store")
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.5f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor(Colors.Black));

                page.Header().Column(headerCol =>
                {
                    headerCol.Item().Row(row =>
                    {
                        row.RelativeItem().Column(c =>
                        {
                            c.Item().Text($"Invoice #: {sale.SaleNumber}").Bold().FontSize(10.5f);
                            c.Item().Text($"Date: {sale.SaleDate:yyyy-MM-dd HH:mm}").FontSize(9).FontColor(Colors.Grey.Darken2);
                        });
                    });

                    headerCol.Item().PaddingVertical(8).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);

                    // Customer Details Section (Name & Phone ONLY)
                    headerCol.Item().PaddingBottom(12).Column(c =>
                    {
                        c.Item().Text("Customer Details:").Bold().FontSize(9).FontColor(Colors.Grey.Darken2);
                        c.Item().Text(sale.Customer?.Name ?? "Walk-in Customer").Bold().FontSize(10.5f);
                        if (!string.IsNullOrWhiteSpace(sale.Customer?.Phone))
                        {
                            c.Item().Text($"Phone: {sale.Customer.Phone}").FontSize(9.5f).FontColor(Colors.Grey.Darken3);
                        }
                    });
                });

                page.Content().Column(col =>
                {
                    // Table items
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3); // Product
                            columns.RelativeColumn(1); // Quantity
                            columns.RelativeColumn(1.5f); // Unit Price
                            columns.RelativeColumn(1.5f); // Discount
                            columns.RelativeColumn(1.5f); // Total
                        });

                        table.Header(header =>
                        {
                            header.Cell().BorderBottom(1).BorderColor(Colors.Black).Padding(6).Text("Product").Bold().FontSize(9);
                            header.Cell().BorderBottom(1).BorderColor(Colors.Black).Padding(6).AlignRight().Text("Qty").Bold().FontSize(9);
                            header.Cell().BorderBottom(1).BorderColor(Colors.Black).Padding(6).AlignRight().Text("Unit Price").Bold().FontSize(9);
                            header.Cell().BorderBottom(1).BorderColor(Colors.Black).Padding(6).AlignRight().Text("Discount").Bold().FontSize(9);
                            header.Cell().BorderBottom(1).BorderColor(Colors.Black).Padding(6).AlignRight().Text("Total").Bold().FontSize(9);
                        });

                        if (sale.Items != null)
                        {
                            foreach (var item in sale.Items)
                            {
                                decimal gross = item.Quantity * item.UnitPrice;
                                decimal lineNet = Math.Max(0, gross - item.DiscountAmount);

                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(6).Column(prodCell =>
                                {
                                    prodCell.Item().Text(item.Product?.Name ?? $"Product #{item.ProductId}").Bold();
                                    if (!string.IsNullOrWhiteSpace(item.Product?.SKU))
                                        prodCell.Item().Text($"SKU: {item.Product.SKU}").FontSize(8);
                                });

                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(6).AlignRight().Text(item.Quantity.ToString("0.##")).Bold();
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(6).AlignRight().Text($"NPR {item.UnitPrice:N2}");
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(6).AlignRight().Text(item.DiscountAmount > 0 ? $"- NPR {item.DiscountAmount:N2}" : "-");
                                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(6).AlignRight().Text($"NPR {lineNet:N2}").Bold();
                            }
                        }
                    });

                    col.Item().PaddingTop(15).AlignRight().Width(220).Column(summaryCol =>
                    {
                        if (sale.SubTotal > 0)
                        {
                            summaryCol.Item().Row(r =>
                            {
                                r.RelativeItem().Text("Subtotal:").FontSize(9);
                                r.RelativeItem().AlignRight().Text($"NPR {sale.SubTotal:N2}").FontSize(9);
                            });
                        }

                        if (sale.DiscountAmount > 0)
                        {
                            summaryCol.Item().Row(r =>
                            {
                                r.RelativeItem().Text("Bill Discount:").FontSize(9);
                                r.RelativeItem().AlignRight().Text($"- NPR {sale.DiscountAmount:N2}").FontSize(9);
                            });
                        }

                        if (sale.Charges != null && sale.Charges.Count > 0)
                        {
                            foreach (var ch in sale.Charges)
                            {
                                summaryCol.Item().Row(r =>
                                {
                                    r.RelativeItem().Text($"{ch.ChargeName}:").FontSize(9);
                                    r.RelativeItem().AlignRight().Text($"+ NPR {ch.Amount:N2}").FontSize(9);
                                });
                            }
                        }

                        summaryCol.Item().PaddingVertical(4).LineHorizontal(1).LineColor(Colors.Black);

                        summaryCol.Item().Row(r =>
                        {
                            r.RelativeItem().Text("Total Amount:").Bold().FontSize(12);
                            r.RelativeItem().AlignRight().Text($"NPR {sale.TotalAmount:N2}").Bold().FontSize(12);
                        });
                    });
                });
            });
        });

        using var stream = new MemoryStream();
        document.GeneratePdf(stream);
        return stream.ToArray();
    }
}
