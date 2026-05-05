using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Business.BusinessEntities;
using Business.BusinessInterfaces;

namespace Datos.EF
{
    public partial class ShingekiContext : DbContext
    {
        private readonly ITenantService _tenantService;

        // 🔥 LA MAGIA ESTÁ ACÁ: Propiedad que se evalúa EN TIEMPO REAL en cada consulta
        public long CurrentBranchId => _tenantService.GetBranchId();

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

        public ShingekiContext(DbContextOptions<ShingekiContext> options, ITenantService tenantService) : base(options)
        {
            _tenantService = tenantService;
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ❌ ELIMINAMOS LA VARIABLE FIJA: var branchId = _tenantService.GetBranchId();

            // --- FILTROS GLOBALES MULTI-TENANT ---
            // ✅ AHORA USAN 'CurrentBranchId' (Obliga a EF a preguntar el ID en cada Query)
            modelBuilder.Entity<User>().HasQueryFilter(x => !x.IsDeleted && (CurrentBranchId == 0 || x.BranchId == CurrentBranchId));
            modelBuilder.Entity<Branch>().HasQueryFilter(x => !x.IsDeleted);
            modelBuilder.Entity<Client>().HasQueryFilter(x => !x.IsDeleted && (CurrentBranchId == 0 || x.BranchId == CurrentBranchId));
            modelBuilder.Entity<Category>().HasQueryFilter(x => !x.IsDeleted && (CurrentBranchId == 0 || x.BranchId == CurrentBranchId));
            modelBuilder.Entity<Product>().HasQueryFilter(x => !x.IsDeleted && (CurrentBranchId == 0 || x.BranchId == CurrentBranchId));
            modelBuilder.Entity<Ingredient>().HasQueryFilter(x => !x.IsDeleted && (CurrentBranchId == 0 || x.BranchId == CurrentBranchId));
            modelBuilder.Entity<Order>().HasQueryFilter(x => !x.IsDeleted && (CurrentBranchId == 0 || x.BranchId == CurrentBranchId));

            // Filtros tablas hijas
            modelBuilder.Entity<BranchStock>().HasQueryFilter(x => CurrentBranchId == 0 || x.BranchId == CurrentBranchId);
            modelBuilder.Entity<OrderItem>().HasQueryFilter(x => CurrentBranchId == 0 || x.Order.BranchId == CurrentBranchId);

            // --- CONFIGURACIÓN USUARIO ---
            modelBuilder.Entity<Branch>(entity =>
            {
                entity.HasIndex(e => e.Slug).IsUnique();
                entity.HasIndex(e => e.TenantFolder).IsUnique();
                entity.Property(e => e.MembershipPlan).HasConversion<string>();
                entity.Property(e => e.MembershipStatus).HasConversion<string>();
                entity.Property(e => e.Slug).HasDefaultValue(string.Empty);
                entity.Property(e => e.TenantFolder).HasDefaultValue(string.Empty);
                entity.Property(e => e.PrimaryColor).HasDefaultValue("#111827");
                entity.Property(e => e.SecondaryColor).HasDefaultValue("#f59e0b");
                entity.Property(e => e.AccentColor).HasDefaultValue("#10b981");
                entity.Property(e => e.PublicOrderingEnabled).HasDefaultValue(true);
                entity.Property(e => e.OpeningHour).HasDefaultValue(18);
                entity.Property(e => e.ClosingHour).HasDefaultValue(2);
                entity.Property(e => e.DayShiftEnabled).HasDefaultValue(true);
                entity.Property(e => e.DayOpeningHour).HasDefaultValue(10);
                entity.Property(e => e.DayClosingHour).HasDefaultValue(16);
                entity.Property(e => e.NightShiftEnabled).HasDefaultValue(true);
                entity.Property(e => e.NightOpeningHour).HasDefaultValue(21);
                entity.Property(e => e.NightClosingHour).HasDefaultValue(2);
                entity.Property(e => e.TimeZoneId).HasDefaultValue("America/Montevideo");
            });

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(e => e.Username).IsUnique();
                entity.Property(e => e.Role).HasConversion<string>();
                entity.Property(e => e.Username).HasDefaultValue(" ");
            });

            modelBuilder.Entity<Client>(entity =>
            {
                entity.HasIndex(e => new { e.BranchId, e.Phone })
                    .IsUnique()
                    .HasFilter("[IsDeleted] = 0 AND [Phone] > 0");
                entity.HasIndex(e => new { e.BranchId, e.Email })
                    .IsUnique()
                    .HasFilter("[IsDeleted] = 0 AND [Email] IS NOT NULL");
                entity.Property(e => e.Email).HasMaxLength(256);
                entity.Property(e => e.PasswordHash).HasMaxLength(512);
                entity.Property(e => e.EmailVerificationCodeHash).HasMaxLength(128);
                entity.Property(e => e.IsEmailVerified).HasDefaultValue(false);
                entity.Property(e => e.EmailVerificationFailedAttempts).HasDefaultValue(0);
            });

            // --- DECIMALES ---
            foreach (var property in modelBuilder.Model.GetEntityTypes()
                .SelectMany(t => t.GetProperties())
                .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
            {
                property.SetColumnType("decimal(18,2)");
            }

            // --- MUCHOS A MUCHOS ---
            modelBuilder.Entity<ProductIngredient>().HasKey(pi => new { pi.ProductId, pi.IngredientId });

            // ✅ SOLUCIÓN CICLOS CASCADA
            modelBuilder.Entity<OrderItem>()
                .HasOne(oi => oi.Product)
                .WithMany()
                .HasForeignKey(oi => oi.ProductId)
                .OnDelete(DeleteBehavior.NoAction);

            // Evitar cascada en Order -> Branch si da problemas
            modelBuilder.Entity<Order>()
                .HasOne(o => o.Branch)
                .WithMany()
                .HasForeignKey(o => o.BranchId)
                .OnDelete(DeleteBehavior.NoAction);

            // ✅ SOLUCIÓN ERROR TIPOS DE DATOS (CashMovement)
            modelBuilder.Entity<CashMovement>()
                .HasOne(m => m.CashSession)
                .WithMany(s => s.Movements)
                .HasForeignKey(m => m.CashSessionId)
                .OnDelete(DeleteBehavior.Cascade);

            // --- OTRAS CONFIGS ---
            modelBuilder.Entity<Order>(entity =>
            {
                entity.Property(e => e.CurrentStatus).HasConversion<string>();
                entity.HasOne(e => e.DeliveryAddress).WithMany().HasForeignKey(e => e.ClientAddressId).OnDelete(DeleteBehavior.Restrict);
            });
        }

        public override int SaveChanges()
        {
            AplicarSucursalAutomatica();
            return base.SaveChanges();
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            AplicarSucursalAutomatica();
            return base.SaveChangesAsync(cancellationToken);
        }

        private void AplicarSucursalAutomatica()
        {
            // Acá sí está bien leerlo en una variable porque SaveChanges se ejecuta por cada petición
            var branchId = _tenantService.GetBranchId();
            if (branchId > 0)
            {
                var addedEntities = ChangeTracker.Entries().Where(e => e.State == EntityState.Added);
                foreach (var entry in addedEntities)
                {
                    var branchIdProperty = entry.Entity.GetType().GetProperty("BranchId");
                    if (branchIdProperty != null)
                    {
                        branchIdProperty.SetValue(entry.Entity, branchId);
                    }
                }
            }
        }
    }
}
