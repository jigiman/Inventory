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
}
