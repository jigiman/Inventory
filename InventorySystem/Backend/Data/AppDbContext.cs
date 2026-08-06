using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public override async Task<int> SaveChangesAsync(System.Threading.CancellationToken cancellationToken = default)
    {
        var auditEntries = new System.Collections.Generic.List<(AuditLog Log, Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry Entry)>();
        
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is AuditLog || entry.State == EntityState.Detached || entry.State == EntityState.Unchanged)
                continue;

            var auditLog = new AuditLog
            {
                Timestamp = DateTime.UtcNow,
                EntityType = entry.Entity.GetType().Name,
                Action = entry.State.ToString()
            };

            var detailsList = new System.Collections.Generic.List<string>();
            if (entry.State == EntityState.Added)
            {
                foreach (var prop in entry.Properties)
                {
                    if (prop.Metadata.IsPrimaryKey()) continue;
                    detailsList.Add($"{prop.Metadata.Name}: {prop.CurrentValue}");
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                foreach (var prop in entry.Properties)
                {
                    if (prop.IsModified)
                    {
                        detailsList.Add($"{prop.Metadata.Name}: {prop.OriginalValue} -> {prop.CurrentValue}");
                    }
                }
            }
            else if (entry.State == EntityState.Deleted)
            {
                foreach (var prop in entry.Properties)
                {
                    detailsList.Add($"{prop.Metadata.Name}: {prop.OriginalValue}");
                }
            }

            auditLog.Details = string.Join("; ", detailsList);
            auditEntries.Add((auditLog, entry));
        }

        var result = await base.SaveChangesAsync(cancellationToken);

        if (auditEntries.Count > 0)
        {
            foreach (var item in auditEntries)
            {
                var primaryKey = item.Entry.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey());
                item.Log.EntityId = primaryKey?.CurrentValue?.ToString() ?? "Unknown";
            }

            AuditLogs.AddRange(auditEntries.Select(x => x.Log));
            await base.SaveChangesAsync(cancellationToken);
        }

        return result;
    }

    public DbSet<Product> Products => Set<Product>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseItem> PurchaseItems => Set<PurchaseItem>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<StockTransaction> StockTransactions => Set<StockTransaction>();
    public DbSet<StockAdjustment> StockAdjustments => Set<StockAdjustment>();
    public DbSet<StockCount> StockCounts => Set<StockCount>();
    public DbSet<InventorySnapshot> InventorySnapshots => Set<InventorySnapshot>();
    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<SalesReturn> SalesReturns => Set<SalesReturn>();
    public DbSet<SalesReturnItem> SalesReturnItems => Set<SalesReturnItem>();
    public DbSet<PurchaseReturn> PurchaseReturns => Set<PurchaseReturn>();
    public DbSet<PurchaseReturnItem> PurchaseReturnItems => Set<PurchaseReturnItem>();
    public DbSet<Charge> Charges => Set<Charge>();
    public DbSet<PurchaseOrderCharge> PurchaseOrderCharges => Set<PurchaseOrderCharge>();
    public DbSet<SaleCharge> SaleCharges => Set<SaleCharge>();


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Product constraints & indexes
        modelBuilder.Entity<Product>()
            .HasIndex(p => p.SKU)
            .IsUnique()
            .HasFilter("SKU != ''");

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.Name);

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.CategoryId);

        modelBuilder.Entity<Product>()
            .HasIndex(p => p.SupplierId);

        modelBuilder.Entity<Product>()
            .HasOne(p => p.ParentProduct)
            .WithMany(p => p.Variants)
            .HasForeignKey(p => p.ParentProductId)
            .OnDelete(DeleteBehavior.Cascade);

        // StockTransaction indexes
        modelBuilder.Entity<StockTransaction>()
            .HasIndex(t => t.TransactionDate);

        modelBuilder.Entity<StockTransaction>()
            .HasIndex(t => t.ProductId);

        // PurchaseOrder indexes
        modelBuilder.Entity<PurchaseOrder>()
            .HasIndex(po => po.OrderDate);

        modelBuilder.Entity<PurchaseOrder>()
            .HasIndex(po => po.SupplierId);

        // Sale indexes
        modelBuilder.Entity<Sale>()
            .HasIndex(s => s.SaleDate);

        modelBuilder.Entity<Sale>()
            .HasIndex(s => s.CustomerId);

        // Payment indexes
        modelBuilder.Entity<Payment>()
            .HasIndex(p => p.PaymentDate);

        modelBuilder.Entity<Payment>()
            .HasIndex(p => p.CustomerId);

        modelBuilder.Entity<Payment>()
            .HasIndex(p => p.SupplierId);

        // StockAdjustment indexes
        modelBuilder.Entity<StockAdjustment>()
            .HasIndex(sa => sa.CreatedDate);

        modelBuilder.Entity<StockAdjustment>()
            .HasIndex(sa => sa.ProductId);

        // Settings constraints
        modelBuilder.Entity<Setting>()
            .HasIndex(s => s.Key)
            .IsUnique();
    }
}
