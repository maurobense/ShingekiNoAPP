using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using Business.BusinessEntities;

namespace Datos.EF
{
    public partial class ShingekiContext : DbContext
    {

        public DbSet<User> Users { get; set; }
        public DbSet<Client> Clients { get; set; }
        public DbSet<ClientAddress> ClientAddresses { get; set; }

        public DbSet<Branch> Branches { get; set; }
        public DbSet<BranchStock> BranchStocks { get; set; }

        public DbSet<Category> Categories { get; set; }
        public DbSet<Product> Products { get; set; }
        public DbSet<Ingredient> Ingredients { get; set; }
        public DbSet<ProductIngredient> ProductIngredients { get; set; }

        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderItem> OrderItems { get; set; }
        public DbSet<OrderStatusHistory> OrderStatusHistories { get; set; }
        public DbSet<CashSession> CashSessions { get; set; }
        public DbSet<CashMovement> CashMovements { get; set; }

        public ShingekiContext(DbContextOptions<ShingekiContext> options) : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // --- FILTROS GLOBALES (Soft Delete) ---
            modelBuilder.Entity<User>().HasQueryFilter(x => !x.IsDeleted);
            modelBuilder.Entity<Client>().HasQueryFilter(x => !x.IsDeleted);
            modelBuilder.Entity<Branch>().HasQueryFilter(x => !x.IsDeleted);
            modelBuilder.Entity<Category>().HasQueryFilter(x => !x.IsDeleted);
            modelBuilder.Entity<Product>().HasQueryFilter(x => !x.IsDeleted);
            modelBuilder.Entity<Ingredient>().HasQueryFilter(x => !x.IsDeleted);
            modelBuilder.Entity<Order>().HasQueryFilter(x => !x.IsDeleted);

            // --- CONFIGURACIÓN ESPECÍFICA DE USUARIO (AGREGADO) ---
            modelBuilder.Entity<User>(entity =>
            {
                // Hacemos que el Username sea único en la BD
                entity.HasIndex(e => e.Username).IsUnique();

                // Guardamos el Rol como String (ej: "ADMIN") en lugar de número
                entity.Property(e => e.Role).HasConversion<string>();

                // Valor por defecto para migraciones de datos existentes
                entity.Property(e => e.Username).HasDefaultValue(" ");
            });

            // --- DECIMALES ---
            foreach (var property in modelBuilder.Model.GetEntityTypes()
                .SelectMany(t => t.GetProperties())
                .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            {
                property.SetColumnType("decimal(18,2)");
            }

            // --- PRODUCT INGREDIENT (Muchos a Muchos) ---
            modelBuilder.Entity<ProductIngredient>()
                .HasKey(pi => new { pi.ProductId, pi.IngredientId });

            modelBuilder.Entity<ProductIngredient>()
                .HasOne(pi => pi.Product)
                .WithMany(p => p.ProductIngredients)
                .HasForeignKey(pi => pi.ProductId);

            modelBuilder.Entity<ProductIngredient>()
                .HasOne(pi => pi.Ingredient)
                .WithMany(i => i.ProductIngredients)
                .HasForeignKey(pi => pi.IngredientId);

            // --- BRANCH STOCK ---
            modelBuilder.Entity<BranchStock>()
                .HasIndex(bs => new { bs.BranchId, bs.IngredientId })
                .IsUnique();

            // --- ORDER ---
            modelBuilder.Entity<Order>(entity =>
            {
                entity.Property(e => e.CurrentStatus)
                    .HasConversion<string>();

                entity.HasOne(e => e.DeliveryAddress)
                    .WithMany()
                    .HasForeignKey(e => e.ClientAddressId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Client)
                    .WithMany(c => c.Orders)
                    .HasForeignKey(e => e.ClientId)
                    .IsRequired(false);
            });

            // --- ORDER HISTORY ---
            modelBuilder.Entity<OrderStatusHistory>(entity =>
            {
                entity.Property(e => e.Status).HasConversion<string>();
            });
        }
    }
}