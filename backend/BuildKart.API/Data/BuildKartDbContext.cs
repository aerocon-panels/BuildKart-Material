using BuildKart.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BuildKart.API.Data;

public sealed class BuildKartDbContext(DbContextOptions<BuildKartDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<AdminUser> AdminUsers => Set<AdminUser>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasIndex(product => product.Sku).IsUnique();
            entity.Property(product => product.UnitPrice).HasPrecision(18, 2);
            entity.HasOne(product => product.Category)
                .WithMany(category => category.Products)
                .HasForeignKey(product => product.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Category>(entity =>
            entity.HasIndex(category => category.Name).IsUnique());

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasIndex(customer => customer.Email)
                .IsUnique()
                .HasFilter("[Email] IS NOT NULL");
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasIndex(order => order.OrderNumber).IsUnique();
            entity.Property(order => order.Subtotal).HasPrecision(18, 2);
            entity.Property(order => order.TaxRate).HasPrecision(5, 4);
            entity.Property(order => order.TaxAmount).HasPrecision(18, 2);
            entity.Property(order => order.Total).HasPrecision(18, 2);
            entity.HasOne(order => order.Customer)
                .WithMany(customer => customer.Orders)
                .HasForeignKey(order => order.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.Property(item => item.Quantity).HasPrecision(18, 3);
            entity.Property(item => item.UnitPriceAtOrder).HasPrecision(18, 2);
            entity.Property(item => item.LineTotal)
                .HasPrecision(18, 2)
                .HasComputedColumnSql(
                    "CAST([Quantity] * [UnitPriceAtOrder] AS decimal(18,2))",
                    stored: true);
            entity.HasOne(item => item.Order)
                .WithMany(order => order.Items)
                .HasForeignKey(item => item.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(item => item.Product)
                .WithMany(product => product.OrderItems)
                .HasForeignKey(item => item.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Quotation>(entity =>
        {
            entity.HasIndex(quotation => quotation.QuoteNumber).IsUnique();
            entity.Property(quotation => quotation.Subtotal).HasPrecision(18, 2);
            entity.Property(quotation => quotation.TaxRate).HasPrecision(5, 4);
            entity.Property(quotation => quotation.TaxAmount).HasPrecision(18, 2);
            entity.Property(quotation => quotation.Total).HasPrecision(18, 2);
            entity.HasOne(quotation => quotation.Customer)
                .WithMany(customer => customer.Quotations)
                .HasForeignKey(quotation => quotation.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.Property(payment => payment.Amount).HasPrecision(18, 2);
            entity.HasIndex(payment => payment.TransactionReference)
                .IsUnique()
                .HasFilter("[TransactionReference] IS NOT NULL");
            entity.HasIndex(payment => payment.GatewayTransactionId)
                .IsUnique()
                .HasFilter("[GatewayTransactionId] IS NOT NULL");
            entity.HasOne(payment => payment.Order)
                .WithMany(order => order.Payments)
                .HasForeignKey(payment => payment.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.HasIndex(user => user.UserName).IsUnique();
            entity.HasIndex(user => user.Email).IsUnique();
        });
    }
}
