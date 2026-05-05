using Business.BusinessEntities;
using Datos.EF;
using DTO;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ShingekiNoAPPI.Options;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/superadmin")]
    [ApiController]
    [Authorize(Roles = "SuperAdmin")]
    public sealed class SuperAdminController : ControllerBase
    {
        private readonly ShingekiContext _context;
        private readonly IAmazonS3 _s3;
        private readonly S3StorageOptions _s3Options;

        public SuperAdminController(ShingekiContext context, IAmazonS3 s3, IOptions<S3StorageOptions> s3Options)
        {
            _context = context;
            _s3 = s3;
            _s3Options = s3Options.Value;
        }

        [HttpGet("restaurants")]
        public async Task<IActionResult> GetRestaurants(CancellationToken cancellationToken)
        {
            var restaurants = await _context.Branches
                .IgnoreQueryFilters()
                .Where(b => !b.IsDeleted)
                .OrderBy(b => b.Name)
                .ToListAsync(cancellationToken);

            var usage = await BuildTenantUsageAsync(restaurants, cancellationToken);
            var response = restaurants
                .Select(b => ToResponseDto(b, usage.TryGetValue(b.Id, out var stats) ? stats : new TenantUsageSnapshot()))
                .ToList();

            return Ok(response);
        }

        [HttpPost("restaurants")]
        public async Task<IActionResult> CreateRestaurant([FromBody] RestaurantCreateDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest("El nombre del restaurante es obligatorio.");
            if (string.IsNullOrWhiteSpace(dto.AdminUsername)) return BadRequest("El usuario admin inicial es obligatorio.");
            if (string.IsNullOrWhiteSpace(dto.AdminPassword)) return BadRequest("La contrasena admin inicial es obligatoria.");

            var slug = await MakeUniqueSlug(dto.Slug ?? dto.Name);
            if (await _context.Users.IgnoreQueryFilters().AnyAsync(u => u.Username == dto.AdminUsername && !u.IsDeleted))
            {
                return BadRequest($"El usuario '{dto.AdminUsername}' ya existe.");
            }

            var restaurant = new Branch
            {
                Name = dto.Name,
                Address = dto.Address,
                City = dto.City,
                Region = dto.Region,
                PostalCode = dto.PostalCode,
                Country = string.IsNullOrWhiteSpace(dto.Country) ? "UY" : dto.Country,
                Phone = dto.Phone,
                HomePage = dto.HomePage,
                Slug = slug,
                TenantFolder = slug,
                BrandName = string.IsNullOrWhiteSpace(dto.BrandName) ? dto.Name : dto.BrandName,
                PublicDescription = dto.PublicDescription,
                LogoUrl = dto.LogoUrl,
                PrimaryColor = string.IsNullOrWhiteSpace(dto.PrimaryColor) ? "#111827" : dto.PrimaryColor,
                SecondaryColor = string.IsNullOrWhiteSpace(dto.SecondaryColor) ? "#f59e0b" : dto.SecondaryColor,
                AccentColor = string.IsNullOrWhiteSpace(dto.AccentColor) ? "#10b981" : dto.AccentColor,
                BillingEmail = dto.BillingEmail,
                MembershipPlan = ParseEnum(dto.MembershipPlan, MembershipPlan.Starter),
                MembershipStatus = ParseEnum(dto.MembershipStatus, MembershipStatus.Trial),
                PublicOrderingEnabled = dto.PublicOrderingEnabled,
                MonthlyOrderLimit = dto.MonthlyOrderLimit,
                OpeningHour = NormalizeHour(dto.OpeningHour, 18),
                ClosingHour = NormalizeHour(dto.ClosingHour, 2),
                DayShiftEnabled = dto.DayShiftEnabled,
                DayOpeningHour = NormalizeHour(dto.DayOpeningHour, 10),
                DayClosingHour = NormalizeHour(dto.DayClosingHour, 16),
                NightShiftEnabled = dto.NightShiftEnabled,
                NightOpeningHour = NormalizeHour(dto.NightOpeningHour, 21),
                NightClosingHour = NormalizeHour(dto.NightClosingHour, 2),
                TimeZoneId = string.IsNullOrWhiteSpace(dto.TimeZoneId) ? "America/Montevideo" : dto.TimeZoneId,
                TrialEndsAt = DateTime.UtcNow.AddDays(14),
                IsDeleted = false
            };
            SyncLegacyHours(restaurant);

            _context.Branches.Add(restaurant);
            await _context.SaveChangesAsync();

            var admin = new User
            {
                Username = dto.AdminUsername,
                Name = string.IsNullOrWhiteSpace(dto.AdminName) ? "Admin" : dto.AdminName,
                LastName = string.IsNullOrWhiteSpace(dto.AdminLastName) ? restaurant.Name : dto.AdminLastName,
                Phone = int.TryParse(dto.AdminPhone, out var phone) ? phone : 0,
                Password = HashPassword(dto.AdminPassword),
                BranchId = restaurant.Id,
                Role = UserRole.Admin,
                Picture = string.Empty,
                IsDeleted = false
            };

            _context.Users.Add(admin);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRestaurants), new { id = restaurant.Id }, new
            {
                restaurant = ToResponseDto(restaurant, new TenantUsageSnapshot()),
                adminUser = admin.Username,
                orderUrl = BuildFrontendUrl($"/order.html?negocio={Uri.EscapeDataString(GetPublicHandle(restaurant))}")
            });
        }

        [HttpPut("restaurants/{id:long}")]
        public async Task<IActionResult> UpdateRestaurant(long id, [FromBody] BranchCreateDto dto)
        {
            var restaurant = await _context.Branches.IgnoreQueryFilters().FirstOrDefaultAsync(b => b.Id == id && !b.IsDeleted);
            if (restaurant == null) return NotFound("Restaurante no encontrado.");

            var requestedSlug = NormalizeSlug(dto.Slug ?? dto.Name ?? restaurant.Name);
            if (!requestedSlug.Equals(restaurant.Slug, StringComparison.OrdinalIgnoreCase) &&
                await _context.Branches.IgnoreQueryFilters().AnyAsync(b => b.Id != id && b.Slug == requestedSlug && !b.IsDeleted))
            {
                return BadRequest($"El slug '{requestedSlug}' ya esta en uso.");
            }

            restaurant.Name = dto.Name;
            restaurant.Address = dto.Address;
            restaurant.City = dto.City;
            restaurant.Region = dto.Region;
            restaurant.PostalCode = dto.PostalCode;
            restaurant.Country = dto.Country;
            restaurant.Phone = dto.Phone;
            restaurant.HomePage = dto.HomePage;
            restaurant.Slug = requestedSlug;
            restaurant.TenantFolder = requestedSlug;
            restaurant.BrandName = string.IsNullOrWhiteSpace(dto.BrandName) ? dto.Name : dto.BrandName;
            restaurant.PublicDescription = dto.PublicDescription;
            restaurant.LogoUrl = dto.LogoUrl;
            restaurant.PrimaryColor = string.IsNullOrWhiteSpace(dto.PrimaryColor) ? restaurant.PrimaryColor : dto.PrimaryColor;
            restaurant.SecondaryColor = string.IsNullOrWhiteSpace(dto.SecondaryColor) ? restaurant.SecondaryColor : dto.SecondaryColor;
            restaurant.AccentColor = string.IsNullOrWhiteSpace(dto.AccentColor) ? restaurant.AccentColor : dto.AccentColor;
            restaurant.BillingEmail = dto.BillingEmail;
            restaurant.MembershipPlan = ParseEnum(dto.MembershipPlan, restaurant.MembershipPlan);
            restaurant.MembershipStatus = ParseEnum(dto.MembershipStatus, restaurant.MembershipStatus);
            restaurant.PublicOrderingEnabled = dto.PublicOrderingEnabled;
            restaurant.MonthlyOrderLimit = dto.MonthlyOrderLimit;
            restaurant.OpeningHour = NormalizeHour(dto.OpeningHour, restaurant.OpeningHour);
            restaurant.ClosingHour = NormalizeHour(dto.ClosingHour, restaurant.ClosingHour);
            restaurant.DayShiftEnabled = dto.DayShiftEnabled;
            restaurant.DayOpeningHour = NormalizeHour(dto.DayOpeningHour, restaurant.DayOpeningHour);
            restaurant.DayClosingHour = NormalizeHour(dto.DayClosingHour, restaurant.DayClosingHour);
            restaurant.NightShiftEnabled = dto.NightShiftEnabled;
            restaurant.NightOpeningHour = NormalizeHour(dto.NightOpeningHour, restaurant.NightOpeningHour);
            restaurant.NightClosingHour = NormalizeHour(dto.NightClosingHour, restaurant.NightClosingHour);
            SyncLegacyHours(restaurant);
            restaurant.TimeZoneId = string.IsNullOrWhiteSpace(dto.TimeZoneId) ? restaurant.TimeZoneId : dto.TimeZoneId;
            restaurant.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(ToResponseDto(restaurant, new TenantUsageSnapshot()));
        }

        private async Task<Dictionary<long, TenantUsageSnapshot>> BuildTenantUsageAsync(List<Branch> restaurants, CancellationToken cancellationToken)
        {
            var result = restaurants.ToDictionary(r => r.Id, _ => new TenantUsageSnapshot());
            if (restaurants.Count == 0) return result;

            var branchIds = restaurants.Select(r => r.Id).ToList();
            var now = DateTime.UtcNow;
            var monthStart = new DateTime(now.Year, now.Month, 1);

            var users = await _context.Users.IgnoreQueryFilters()
                .Where(u => !u.IsDeleted && branchIds.Contains(u.BranchId))
                .GroupBy(u => u.BranchId)
                .Select(g => new { BranchId = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var item in users) result[item.BranchId].InternalUsersCount = item.Count;

            var clients = await _context.Clients.IgnoreQueryFilters()
                .Where(c => !c.IsDeleted && branchIds.Contains(c.BranchId))
                .GroupBy(c => c.BranchId)
                .Select(g => new { BranchId = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var item in clients) result[item.BranchId].CustomerUsersCount = item.Count;

            var categories = await _context.Categories.IgnoreQueryFilters()
                .Where(c => !c.IsDeleted && branchIds.Contains(c.BranchId))
                .GroupBy(c => c.BranchId)
                .Select(g => new { BranchId = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var item in categories) result[item.BranchId].CategoriesCount = item.Count;

            var products = await _context.Products.IgnoreQueryFilters()
                .Where(p => !p.IsDeleted && branchIds.Contains(p.BranchId))
                .GroupBy(p => p.BranchId)
                .Select(g => new
                {
                    BranchId = g.Key,
                    Count = g.Count(),
                    ImageCount = g.Count(p => p.ImageUrl != null && p.ImageUrl != string.Empty)
                })
                .ToListAsync(cancellationToken);
            foreach (var item in products)
            {
                result[item.BranchId].ProductsCount = item.Count;
                result[item.BranchId].MediaAssetsCount += item.ImageCount;
            }

            var ingredients = await _context.Ingredients.IgnoreQueryFilters()
                .Where(i => !i.IsDeleted && branchIds.Contains(i.BranchId))
                .GroupBy(i => i.BranchId)
                .Select(g => new
                {
                    BranchId = g.Key,
                    Count = g.Count(),
                    ImageCount = g.Count(i => i.ImageUrl != null && i.ImageUrl != string.Empty)
                })
                .ToListAsync(cancellationToken);
            foreach (var item in ingredients)
            {
                result[item.BranchId].IngredientsCount = item.Count;
                result[item.BranchId].MediaAssetsCount += item.ImageCount;
            }

            var stockItems = await _context.BranchStocks.IgnoreQueryFilters()
                .Where(s => branchIds.Contains(s.BranchId))
                .GroupBy(s => s.BranchId)
                .Select(g => new { BranchId = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var item in stockItems) result[item.BranchId].StockItemsCount = item.Count;

            var orders = await _context.Orders.IgnoreQueryFilters()
                .Where(o => !o.IsDeleted && branchIds.Contains(o.BranchId))
                .GroupBy(o => o.BranchId)
                .Select(g => new TenantOrderStats
                {
                    BranchId = g.Key,
                    OrdersCount = g.Count(),
                    OrdersThisMonthCount = g.Count(o => o.OrderDate >= monthStart),
                    OpenOrdersCount = g.Count(o => o.CurrentStatus != OrderStatus.Delivered && o.CurrentStatus != OrderStatus.Cancelled),
                    DeliveredOrdersCount = g.Count(o => o.CurrentStatus == OrderStatus.Delivered),
                    CancelledOrdersCount = g.Count(o => o.CurrentStatus == OrderStatus.Cancelled),
                    RevenueTotal = g.Sum(o => o.TotalAmount),
                    RevenueThisMonth = g.Sum(o => o.OrderDate >= monthStart ? o.TotalAmount : 0m),
                    LastOrderAt = g.Max(o => (DateTime?)o.OrderDate)
                })
                .ToListAsync(cancellationToken);
            foreach (var item in orders)
            {
                var stats = result[item.BranchId];
                stats.OrdersCount = item.OrdersCount;
                stats.OrdersThisMonthCount = item.OrdersThisMonthCount;
                stats.OpenOrdersCount = item.OpenOrdersCount;
                stats.DeliveredOrdersCount = item.DeliveredOrdersCount;
                stats.CancelledOrdersCount = item.CancelledOrdersCount;
                stats.RevenueTotal = item.RevenueTotal;
                stats.RevenueThisMonth = item.RevenueThisMonth;
                stats.LastOrderAt = item.LastOrderAt;
            }

            var orderItems = await _context.OrderItems.IgnoreQueryFilters()
                .Where(i => !i.IsDeleted && !i.Order.IsDeleted && branchIds.Contains(i.Order.BranchId))
                .GroupBy(i => i.Order.BranchId)
                .Select(g => new { BranchId = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var item in orderItems) result[item.BranchId].OrderItemsCount = item.Count;

            foreach (var restaurant in restaurants)
            {
                var stats = result[restaurant.Id];
                var s3Usage = await GetS3UsageAsync(restaurant.TenantFolder ?? restaurant.Slug, cancellationToken);
                stats.S3ObjectCount = s3Usage.ObjectCount;
                stats.S3BytesUsed = s3Usage.BytesUsed;
                stats.S3BytesHuman = s3Usage.BytesHuman;
                stats.S3UsageAvailable = s3Usage.Available;
            }

            return result;
        }

        private async Task<string> MakeUniqueSlug(string value)
        {
            var slug = NormalizeSlug(value);
            var candidate = slug;
            var suffix = 2;
            while (await _context.Branches.IgnoreQueryFilters().AnyAsync(b => b.Slug == candidate && !b.IsDeleted))
            {
                candidate = $"{slug}-{suffix++}";
            }

            return candidate;
        }

        private static string NormalizeSlug(string value)
        {
            var slug = Regex.Replace((value ?? string.Empty).Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
            return string.IsNullOrWhiteSpace(slug) ? $"tenant-{Guid.NewGuid():N}".Substring(0, 16) : slug;
        }

        private static int NormalizeHour(int value, int fallback)
        {
            return value >= 0 && value <= 23 ? value : fallback;
        }

        private static void SyncLegacyHours(Branch branch)
        {
            if (!branch.DayShiftEnabled && !branch.NightShiftEnabled)
            {
                branch.DayShiftEnabled = true;
            }

            if (branch.DayShiftEnabled)
            {
                branch.OpeningHour = branch.DayOpeningHour;
                branch.ClosingHour = branch.DayClosingHour;
            }
            else
            {
                branch.OpeningHour = branch.NightOpeningHour;
                branch.ClosingHour = branch.NightClosingHour;
            }
        }

        private static string GetPublicHandle(Branch branch)
        {
            var slug = NormalizeSlug(branch.Slug);
            if (!slug.StartsWith("tenant-", StringComparison.OrdinalIgnoreCase)) return slug;

            return NormalizeSlug(branch.BrandName ?? branch.Name);
        }

        private static TEnum ParseEnum<TEnum>(string? value, TEnum fallback) where TEnum : struct
        {
            return !string.IsNullOrWhiteSpace(value) && Enum.TryParse<TEnum>(value, true, out var parsed)
                ? parsed
                : fallback;
        }

        private static string HashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password ?? string.Empty));
            return string.Concat(bytes.Select(b => b.ToString("x2")));
        }

        private string BuildFrontendUrl(string path)
        {
            var origin = Request.Headers.Referer.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(origin) && Uri.TryCreate(origin, UriKind.Absolute, out var referer))
            {
                return $"{referer.Scheme}://{referer.Authority}{path}";
            }

            return path;
        }

        private async Task<S3UsageSnapshot> GetS3UsageAsync(string tenantFolder, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(_s3Options.BucketName))
            {
                return new S3UsageSnapshot(false, 0, 0, "S3 no configurado");
            }

            try
            {
                var prefix = $"{NormalizeTenantFolder(tenantFolder)}/";
                string? continuationToken = null;
                long bytes = 0;
                long objects = 0;

                do
                {
                    var response = await _s3.ListObjectsV2Async(new ListObjectsV2Request
                    {
                        BucketName = _s3Options.BucketName,
                        Prefix = prefix,
                        ContinuationToken = continuationToken,
                        MaxKeys = 1000
                    }, cancellationToken);

                    objects += response.S3Objects.Count;
                    bytes += response.S3Objects.Sum(o => o.Size);
                    continuationToken = response.IsTruncated ? response.NextContinuationToken : null;
                }
                while (!string.IsNullOrWhiteSpace(continuationToken));

                return new S3UsageSnapshot(true, objects, bytes, FormatBytes(bytes));
            }
            catch
            {
                return new S3UsageSnapshot(false, 0, 0, "Sin lectura S3");
            }
        }

        private static string NormalizeTenantFolder(string tenantFolder)
        {
            var safeTenant = Regex.Replace(tenantFolder ?? "platform", @"[^a-zA-Z0-9/_-]", string.Empty).Trim('/');
            if (string.IsNullOrWhiteSpace(safeTenant)) safeTenant = "platform";
            return safeTenant.StartsWith("tenants/", StringComparison.OrdinalIgnoreCase)
                ? safeTenant
                : $"tenants/{safeTenant}";
        }

        private static string FormatBytes(long bytes)
        {
            string[] units = { "B", "KB", "MB", "GB", "TB" };
            double value = bytes;
            var unit = 0;
            while (value >= 1024 && unit < units.Length - 1)
            {
                value /= 1024;
                unit++;
            }

            return $"{value:0.#} {units[unit]}";
        }

        private static BranchResponseDto ToResponseDto(Branch b, TenantUsageSnapshot usage)
        {
            var hasLogo = !string.IsNullOrWhiteSpace(b.LogoUrl);
            var mediaAssets = usage.MediaAssetsCount + (hasLogo ? 1 : 0);
            var dataRows = 1
                + usage.InternalUsersCount
                + usage.CustomerUsersCount
                + usage.CategoriesCount
                + usage.ProductsCount
                + usage.IngredientsCount
                + usage.StockItemsCount
                + usage.OrdersCount
                + usage.OrderItemsCount;

            return new BranchResponseDto
        {
            Id = b.Id,
            Name = b.Name,
            FullAddress = $"{b.Address}, {b.City}, {b.Country}",
            Phone = b.Phone.ToString(),
            HomePage = b.HomePage,
            Slug = b.Slug,
            TenantFolder = b.TenantFolder,
            BrandName = b.BrandName ?? b.Name,
            PublicDescription = b.PublicDescription ?? string.Empty,
            LogoUrl = b.LogoUrl ?? string.Empty,
            PrimaryColor = b.PrimaryColor,
            SecondaryColor = b.SecondaryColor,
            AccentColor = b.AccentColor,
            BillingEmail = b.BillingEmail ?? string.Empty,
            MembershipPlan = b.MembershipPlan.ToString(),
            MembershipStatus = b.MembershipStatus.ToString(),
            PublicOrderingEnabled = b.PublicOrderingEnabled,
            MonthlyOrderLimit = b.MonthlyOrderLimit,
            OpeningHour = b.OpeningHour,
            ClosingHour = b.ClosingHour,
            DayShiftEnabled = b.DayShiftEnabled,
            DayOpeningHour = b.DayOpeningHour,
            DayClosingHour = b.DayClosingHour,
            NightShiftEnabled = b.NightShiftEnabled,
            NightOpeningHour = b.NightOpeningHour,
            NightClosingHour = b.NightClosingHour,
            TimeZoneId = b.TimeZoneId,
            PublicOrderingUrl = $"/order.html?negocio={Uri.EscapeDataString(GetPublicHandle(b))}",
            CreatedAt = b.CreatedAt,
            UpdatedAt = b.UpdatedAt,
            TrialEndsAt = b.TrialEndsAt,
            InternalUsersCount = usage.InternalUsersCount,
            CustomerUsersCount = usage.CustomerUsersCount,
            TotalUsersCount = usage.InternalUsersCount + usage.CustomerUsersCount,
            OrdersCount = usage.OrdersCount,
            OrdersThisMonthCount = usage.OrdersThisMonthCount,
            OpenOrdersCount = usage.OpenOrdersCount,
            DeliveredOrdersCount = usage.DeliveredOrdersCount,
            CancelledOrdersCount = usage.CancelledOrdersCount,
            RevenueTotal = usage.RevenueTotal,
            RevenueThisMonth = usage.RevenueThisMonth,
            LastOrderAt = usage.LastOrderAt,
            ProductsCount = usage.ProductsCount,
            CategoriesCount = usage.CategoriesCount,
            IngredientsCount = usage.IngredientsCount,
            StockItemsCount = usage.StockItemsCount,
            OrderItemsCount = usage.OrderItemsCount,
            MediaAssetsCount = mediaAssets,
            DataRowsEstimate = dataRows,
            S3ObjectCount = usage.S3ObjectCount,
            S3BytesUsed = usage.S3BytesUsed,
            S3BytesHuman = usage.S3BytesHuman ?? "0 B",
            S3UsageAvailable = usage.S3UsageAvailable
        };
        }

        private sealed class TenantUsageSnapshot
        {
            public int InternalUsersCount { get; set; }
            public int CustomerUsersCount { get; set; }
            public int OrdersCount { get; set; }
            public int OrdersThisMonthCount { get; set; }
            public int OpenOrdersCount { get; set; }
            public int DeliveredOrdersCount { get; set; }
            public int CancelledOrdersCount { get; set; }
            public decimal RevenueTotal { get; set; }
            public decimal RevenueThisMonth { get; set; }
            public DateTime? LastOrderAt { get; set; }
            public int ProductsCount { get; set; }
            public int CategoriesCount { get; set; }
            public int IngredientsCount { get; set; }
            public int StockItemsCount { get; set; }
            public int OrderItemsCount { get; set; }
            public int MediaAssetsCount { get; set; }
            public long S3ObjectCount { get; set; }
            public long S3BytesUsed { get; set; }
            public string S3BytesHuman { get; set; } = "0 B";
            public bool S3UsageAvailable { get; set; }
        }

        private sealed class TenantOrderStats
        {
            public long BranchId { get; set; }
            public int OrdersCount { get; set; }
            public int OrdersThisMonthCount { get; set; }
            public int OpenOrdersCount { get; set; }
            public int DeliveredOrdersCount { get; set; }
            public int CancelledOrdersCount { get; set; }
            public decimal RevenueTotal { get; set; }
            public decimal RevenueThisMonth { get; set; }
            public DateTime? LastOrderAt { get; set; }
        }

        private sealed record S3UsageSnapshot(bool Available, long ObjectCount, long BytesUsed, string BytesHuman);
    }
}
