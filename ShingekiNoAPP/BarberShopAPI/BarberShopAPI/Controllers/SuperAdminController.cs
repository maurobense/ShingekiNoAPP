using Business.BusinessEntities;
using Datos.EF;
using DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

        public SuperAdminController(ShingekiContext context)
        {
            _context = context;
        }

        [HttpGet("restaurants")]
        public async Task<IActionResult> GetRestaurants()
        {
            var restaurants = await _context.Branches
                .IgnoreQueryFilters()
                .Where(b => !b.IsDeleted)
                .OrderBy(b => b.Name)
                .Select(b => ToResponseDto(b))
                .ToListAsync();

            return Ok(restaurants);
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
                TrialEndsAt = DateTime.UtcNow.AddDays(14),
                IsDeleted = false
            };

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
                restaurant = ToResponseDto(restaurant),
                adminUser = admin.Username,
                orderUrl = BuildFrontendUrl($"/order.html?tenant={Uri.EscapeDataString(restaurant.Slug)}")
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
            restaurant.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(ToResponseDto(restaurant));
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

        private static BranchResponseDto ToResponseDto(Branch b) => new()
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
            PublicOrderingUrl = $"/order.html?tenant={Uri.EscapeDataString(b.Slug)}"
        };
    }
}
