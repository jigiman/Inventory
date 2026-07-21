using Microsoft.AspNetCore.Routing;
using Backend.Features.Categories;
using Backend.Features.Customers;
using Backend.Features.Brands;
using Backend.Features.Units;
using Backend.Features.Suppliers;
using Backend.Features.Products;
using Backend.Features.Purchases;
using Backend.Features.Sales;
using Backend.Features.StockAdjustments;
using Backend.Features.StockCounts;
using Backend.Features.Reports;
using Backend.Features.Settings;

namespace Backend.Features;

public static class EndpointsSetup
{
    public static void MapInventoryEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapCategoryEndpoints();
        app.MapCustomerEndpoints();
        app.MapBrandEndpoints();
        app.MapUnitEndpoints();
        app.MapSupplierEndpoints();
        app.MapProductEndpoints();
        app.MapPurchaseEndpoints();
        app.MapSaleEndpoints();
        app.MapStockAdjustmentEndpoints();
        app.MapStockCountEndpoints();
        app.MapReportEndpoints();
        app.MapSettingEndpoints();
    }
}
