using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Backend.Services;
using Backend.Models;
using Xunit;

namespace Backend.Tests;

public class FeaturesTests : IAsyncDisposable
{
    private readonly WebApplication _app;
    private readonly string _address;
    private readonly HttpClient _client;
    private readonly string _dbPath;
    private string? _sessionToken;

    public FeaturesTests()
    {
        // Start backend on a dynamic/random port (port = 0)
        var startTask = Program.StartAsync(Array.Empty<string>(), port: 0);
        startTask.Wait();
        var result = startTask.Result;
        _app = result.App;
        _address = result.Address;

        _client = new HttpClient { BaseAddress = new Uri(_address) };

        // Generate temporary DB path under Home directory to pass path validation
        _dbPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), $"feat_test_{Guid.NewGuid():N}.db");
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _app.StopAsync();
        await _app.DisposeAsync();

        try
        {
            if (File.Exists(_dbPath))
                File.Delete(_dbPath);
            var saltPath = _dbPath + ".salt";
            if (File.Exists(saltPath))
                File.Delete(saltPath);
        }
        catch
        {
            // Ignore cleanup errors
        }
    }

    private void SetSessionAuth(string? token)
    {
        _client.DefaultRequestHeaders.Authorization = 
            !string.IsNullOrEmpty(token) ? new AuthenticationHeaderValue("Bearer", token) : null;
    }

    [Fact]
    public async Task Complete_Workflow_And_Endpoints_Verification()
    {
        // 1. Initial GET /api/launcher (should be NOT_INITIALIZED)
        var launcherRes = await _client.GetFromJsonAsync<LauncherStatusResponse>("/api/launcher");
        Assert.NotNull(launcherRes);
        Assert.Equal("NOT_INITIALIZED", launcherRes.Status);

        // 2. Call theme endpoint
        var themePayload = new { theme = "dark" };
        var themeRes = await _client.PostAsJsonAsync("/api/launcher/theme", themePayload);
        Assert.Equal(HttpStatusCode.OK, themeRes.StatusCode);

        // 3. Call an API without initialization (should return 503 Service Unavailable)
        var uninitRes = await _client.GetAsync("/api/brands");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, uninitRes.StatusCode);

        // 4. Create a new database via POST /api/launcher/new
        var newDbPayload = new { dbPath = _dbPath, password = "TestPassWord123!", name = "TestDB" };
        var createDbRes = await _client.PostAsJsonAsync("/api/launcher/new", newDbPayload);
        Assert.Equal(HttpStatusCode.OK, createDbRes.StatusCode);
        
        var createDbData = await createDbRes.Content.ReadFromJsonAsync<LauncherOpenResponse>();
        Assert.NotNull(createDbData);
        Assert.Equal("READY", createDbData.Status);
        Assert.NotEmpty(createDbData.SessionToken);
        _sessionToken = createDbData.SessionToken;

        // Set auth header for subsequent API calls
        SetSessionAuth(_sessionToken);

        // 5. Test unauthorized request with invalid token
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "wrong-token");
        var authRes = await _client.GetAsync("/api/brands");
        Assert.Equal(HttpStatusCode.Unauthorized, authRes.StatusCode);

        // Restore correct token
        SetSessionAuth(_sessionToken);

        // 6. Test Brands Endpoint (GET, POST, PUT, DELETE)
        var brandPayload = new Brand { Name = "Brand A" };
        var createBrandRes = await _client.PostAsJsonAsync("/api/brands", brandPayload);
        Assert.Equal(HttpStatusCode.Created, createBrandRes.StatusCode);
        var createdBrand = await createBrandRes.Content.ReadFromJsonAsync<Brand>();
        Assert.NotNull(createdBrand);
        Assert.True(createdBrand.Id > 0);

        // BadRequest check
        var badBrandRes = await _client.PostAsJsonAsync("/api/brands", new Brand { Name = "" });
        Assert.Equal(HttpStatusCode.BadRequest, badBrandRes.StatusCode);

        // Put check
        createdBrand.Name = "Brand A Updated";
        var putBrandRes = await _client.PutAsJsonAsync($"/api/brands/{createdBrand.Id}", createdBrand);
        Assert.Equal(HttpStatusCode.OK, putBrandRes.StatusCode);

        // List check
        var listBrands = await _client.GetFromJsonAsync<List<Brand>>("/api/brands");
        Assert.NotNull(listBrands);
        Assert.Contains(listBrands, b => b.Name == "Brand A Updated");

        // 7. Test Categories Endpoint (GET, POST, PUT, DELETE)
        var categoryPayload = new Category { Name = "Category A" };
        var createCatRes = await _client.PostAsJsonAsync("/api/categories", categoryPayload);
        var createdCat = await createCatRes.Content.ReadFromJsonAsync<Category>();
        Assert.NotNull(createdCat);

        createdCat.Name = "Category A Updated";
        var putCatRes = await _client.PutAsJsonAsync($"/api/categories/{createdCat.Id}", createdCat);
        Assert.Equal(HttpStatusCode.OK, putCatRes.StatusCode);

        var listCats = await _client.GetFromJsonAsync<List<Category>>("/api/categories");
        Assert.NotNull(listCats);

        // 8. Test Units Endpoint (GET, POST, PUT, DELETE)
        var unitPayload = new Unit { Name = "Piece" };
        var createUnitRes = await _client.PostAsJsonAsync("/api/units", unitPayload);
        var createdUnit = await createUnitRes.Content.ReadFromJsonAsync<Unit>();
        Assert.NotNull(createdUnit);

        createdUnit.Name = "Piece Updated";
        var putUnitRes = await _client.PutAsJsonAsync($"/api/units/{createdUnit.Id}", createdUnit);
        Assert.Equal(HttpStatusCode.OK, putUnitRes.StatusCode);

        var listUnits = await _client.GetFromJsonAsync<List<Unit>>("/api/units");
        Assert.NotNull(listUnits);

        // 9. Test Suppliers Endpoint (GET, POST, PUT, DELETE)
        var supplierPayload = new Supplier { Name = "Supplier A", Email = "supplier@example.com" };
        var createSupRes = await _client.PostAsJsonAsync("/api/suppliers", supplierPayload);
        var createdSup = await createSupRes.Content.ReadFromJsonAsync<Supplier>();
        Assert.NotNull(createdSup);

        createdSup.Name = "Supplier A Updated";
        var putSupRes = await _client.PutAsJsonAsync($"/api/suppliers/{createdSup.Id}", createdSup);
        Assert.Equal(HttpStatusCode.OK, putSupRes.StatusCode);

        var listSups = await _client.GetFromJsonAsync<List<Supplier>>("/api/suppliers");
        Assert.NotNull(listSups);

        // 10. Test Customers Endpoint (GET, POST, PUT, DELETE)
        var customerPayload = new Customer { Name = "Customer A", Phone = "1234567890" };
        var createCustRes = await _client.PostAsJsonAsync("/api/customers", customerPayload);
        var createdCust = await createCustRes.Content.ReadFromJsonAsync<Customer>();
        Assert.NotNull(createdCust);

        createdCust.Name = "Customer A Updated";
        var putCustRes = await _client.PutAsJsonAsync($"/api/customers/{createdCust.Id}", createdCust);
        Assert.Equal(HttpStatusCode.OK, putCustRes.StatusCode);

        var listCusts = await _client.GetFromJsonAsync<List<Customer>>("/api/customers");
        Assert.NotNull(listCusts);

        // 11. Test Products Endpoint (GET, POST, PUT, DELETE)
        var productPayload = new Product
        {
            SKU = "PROD-A",
            Name = "Product A",
            CategoryId = createdCat.Id,
            BrandId = createdBrand.Id,
            UnitId = createdUnit.Id,
            SupplierId = createdSup.Id,
            CostPrice = 10.0m,
            SellingPrice = 15.0m,
            CurrentQuantity = 0
        };
        var createProdRes = await _client.PostAsJsonAsync("/api/products", productPayload);
        Assert.Equal(HttpStatusCode.Created, createProdRes.StatusCode);
        var createdProd = await createProdRes.Content.ReadFromJsonAsync<Product>();
        Assert.NotNull(createdProd);

        createdProd.Name = "Product A Updated";
        var putProdRes = await _client.PutAsJsonAsync($"/api/products/{createdProd.Id}", createdProd);
        Assert.Equal(HttpStatusCode.OK, putProdRes.StatusCode);

        // List products
        var listProds = await _client.GetFromJsonAsync<PaginatedResponse<Product>>("/api/products");
        Assert.NotNull(listProds);
        Assert.NotEmpty(listProds.Items);

        // 12. Test Purchases Endpoint (GET, POST, RECEIVE)
        var purchasePayload = new PurchaseOrder
        {
            SupplierId = createdSup.Id,
            OrderDate = DateTime.UtcNow,
            TotalAmount = 100.0m,
            Items = new List<PurchaseItem>
            {
                new()
                {
                    ProductId = createdProd.Id,
                    QuantityOrdered = 10,
                    QuantityReceived = 10,
                    UnitPrice = 10.0m
                }
            }
        };
        var createPurchaseRes = await _client.PostAsJsonAsync("/api/purchase-orders", purchasePayload);
        Assert.Equal(HttpStatusCode.Created, createPurchaseRes.StatusCode);
        var createdPurchase = await createPurchaseRes.Content.ReadFromJsonAsync<PurchaseOrder>();
        Assert.NotNull(createdPurchase);

        // List purchase orders
        var listPurchases = await _client.GetFromJsonAsync<PaginatedResponse<PurchaseOrder>>("/api/purchase-orders");
        Assert.NotNull(listPurchases);

        // Receive order
        var receivePayload = new List<ReceiveItemDto>
        {
            new() { ProductId = createdProd.Id, QuantityReceived = 10 }
        };
        var receiveRes = await _client.PostAsJsonAsync($"/api/purchase-orders/{createdPurchase.Id}/receive", receivePayload);
        Assert.Equal(HttpStatusCode.OK, receiveRes.StatusCode);

        // 13. Test Sales Endpoint (GET, POST)
        var salePayload = new Sale
        {
            CustomerId = createdCust.Id,
            SaleDate = DateTime.UtcNow,
            TotalAmount = 75.0m,
            Items = new List<SaleItem>
            {
                new()
                {
                    ProductId = createdProd.Id,
                    Quantity = 5,
                    UnitPrice = 15.0m
                }
            }
        };
        var createSaleRes = await _client.PostAsJsonAsync("/api/sales", salePayload);
        Assert.Equal(HttpStatusCode.Created, createSaleRes.StatusCode);

        var listSales = await _client.GetFromJsonAsync<PaginatedResponse<Sale>>("/api/sales");
        Assert.NotNull(listSales);

        // 14. Test Stock Counts Endpoint (POST)
        var stockCountPayload = new StockCount
        {
            CountDate = DateTime.UtcNow,
            ProductId = createdProd.Id,
            SystemQuantity = 5,
            PhysicalQuantity = 6,
            Difference = 1,
            Remarks = "Count Test"
        };
        var createCountRes = await _client.PostAsJsonAsync("/api/inventory/count", stockCountPayload);
        Assert.Equal(HttpStatusCode.OK, createCountRes.StatusCode);

        // 15. Test Stock Adjustments Endpoint (GET, POST)
        var adjustmentPayload = new StockAdjustment
        {
            CreatedDate = DateTime.UtcNow,
            ProductId = createdProd.Id,
            Quantity = 1,
            AdjustmentType = "Damaged",
            Reason = "Damaged product"
        };
        var createAdjustmentRes = await _client.PostAsJsonAsync("/api/inventory/adjust", adjustmentPayload);
        Assert.Equal(HttpStatusCode.OK, createAdjustmentRes.StatusCode);

        var ledgerRes = await _client.GetAsync("/api/inventory/ledger");
        Assert.Equal(HttpStatusCode.OK, ledgerRes.StatusCode);

        // 16. Test Settings Endpoint (GET, POST)
        var settingsPayload = new Setting { Key = "Theme", Value = "dark" };
        var createSettingsRes = await _client.PostAsJsonAsync("/api/settings", settingsPayload);
        Assert.Equal(HttpStatusCode.OK, createSettingsRes.StatusCode);

        var listSettings = await _client.GetFromJsonAsync<List<Setting>>("/api/settings");
        Assert.NotNull(listSettings);

        // 17. Test Backups Endpoint (GET, POST)
        var createBackupRes = await _client.PostAsync("/api/backups", null);
        Assert.Equal(HttpStatusCode.OK, createBackupRes.StatusCode);

        var listBackupsRes = await _client.GetAsync("/api/backups");
        Assert.Equal(HttpStatusCode.OK, listBackupsRes.StatusCode);

        // 18. Test Diagnostics Endpoint (GET)
        var integrityRes = await _client.GetAsync("/api/diagnostics/integrity");
        Assert.Equal(HttpStatusCode.OK, integrityRes.StatusCode);

        var exportDiagRes = await _client.GetAsync("/api/diagnostics/export");
        Assert.Equal(HttpStatusCode.OK, exportDiagRes.StatusCode);

        // 19. Test Reports Endpoint (GET dashboard, export)
        var reportDashboardRes = await _client.GetAsync("/api/reports/dashboard");
        Assert.Equal(HttpStatusCode.OK, reportDashboardRes.StatusCode);

        var reportExportRes = await _client.GetAsync("/api/reports/export?type=CurrentStock&format=csv");
        Assert.Equal(HttpStatusCode.OK, reportExportRes.StatusCode);

        // 20. Cleanup Entities
        var deleteProdRes = await _client.DeleteAsync($"/api/products/{createdProd.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteProdRes.StatusCode);

        var deleteCatRes = await _client.DeleteAsync($"/api/categories/{createdCat.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteCatRes.StatusCode);

        var deleteBrandRes = await _client.DeleteAsync($"/api/brands/{createdBrand.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteBrandRes.StatusCode);

        var deleteUnitRes = await _client.DeleteAsync($"/api/units/{createdUnit.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteUnitRes.StatusCode);

        var deleteSupRes = await _client.DeleteAsync($"/api/suppliers/{createdSup.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteSupRes.StatusCode);

        var deleteCustRes = await _client.DeleteAsync($"/api/customers/{createdCust.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteCustRes.StatusCode);

        // 21. Remove Recent DB Reference
        var removeRecentPayload = new { dbPath = _dbPath };
        var removeRecentRes = await _client.PostAsJsonAsync("/api/launcher/remove-recent", removeRecentPayload);
        Assert.Equal(HttpStatusCode.OK, removeRecentRes.StatusCode);
    }

    [Fact]
    public async Task Validation_And_Error_Pathways_Verification()
    {
        // 1. Path traversal security check
        var traversalPayload = new { dbPath = "../illegal_path.db" };
        var traversalRes = await _client.PostAsJsonAsync("/api/launcher/open", traversalPayload);
        Assert.Equal(HttpStatusCode.BadRequest, traversalRes.StatusCode);

        // 2. Open non-existent database file
        var nonExistentPayload = new { dbPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "non_existent_db_file.db") };
        var openNonExistentRes = await _client.PostAsJsonAsync("/api/launcher/open", nonExistentPayload);
        Assert.Equal(HttpStatusCode.BadRequest, openNonExistentRes.StatusCode);

        // 3. Setup initialized DB for other checks
        var newDbPayload = new { dbPath = _dbPath, password = "TestPassWord123!", name = "TestDB" };
        var createDbRes = await _client.PostAsJsonAsync("/api/launcher/new", newDbPayload);
        Assert.Equal(HttpStatusCode.OK, createDbRes.StatusCode);
        var createDbData = await createDbRes.Content.ReadFromJsonAsync<LauncherOpenResponse>();
        Assert.NotNull(createDbData);
        _sessionToken = createDbData.SessionToken;
        SetSessionAuth(_sessionToken);

        // 4. Validation Filter: POST setting with empty Key
        var badSetting = new Setting { Key = "", Value = "value" };
        var badSettingRes = await _client.PostAsJsonAsync("/api/settings", badSetting);
        Assert.Equal(HttpStatusCode.BadRequest, badSettingRes.StatusCode);

        // 5. Validation Filter: POST product with empty name
        var badProduct = new Product { Name = "", SKU = "BAD-PROD" };
        var badProductRes = await _client.PostAsJsonAsync("/api/products", badProduct);
        Assert.Equal(HttpStatusCode.BadRequest, badProductRes.StatusCode);

        // 6. Invalid Restore Backup File validation check
        var badRestorePayload = new { fileName = "" };
        var badRestoreRes = await _client.PostAsJsonAsync("/api/backups/restore", badRestorePayload);
        Assert.Equal(HttpStatusCode.BadRequest, badRestoreRes.StatusCode);

        // 7. Remove recent DB reference with empty path validation check
        var badRemoveRecentPayload = new { dbPath = "" };
        var badRemoveRecentRes = await _client.PostAsJsonAsync("/api/launcher/remove-recent", badRemoveRecentPayload);
        Assert.Equal(HttpStatusCode.BadRequest, badRemoveRecentRes.StatusCode);
    }
}

public class LauncherStatusResponse
{
    public string Status { get; set; } = "";
}

public class LauncherOpenResponse
{
    public string Status { get; set; } = "";
    public string SessionToken { get; set; } = "";
}

public class PaginatedResponse<T>
{
    public int TotalCount { get; set; }
    public List<T> Items { get; set; } = new();
}

public class ReceiveItemDto
{
    public int ProductId { get; set; }
    public decimal QuantityReceived { get; set; }
}
