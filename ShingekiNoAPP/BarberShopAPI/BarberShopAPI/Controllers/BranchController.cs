using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "SuperAdmin")]
    public class BranchController : ControllerBase
    {
        private readonly IRepositoryBranch _repoBranch;

        public BranchController(IRepositoryBranch repoBranch)
        {
            _repoBranch = repoBranch;
        }

        // GET: api/Branch
        [HttpGet]
        public ActionResult<IEnumerable<BranchResponseDto>> GetAll()
        {
            try
            {
                // ✅ Usamos GetAll()
                var branches = _repoBranch.GetAll();

                // Mapeo a DTO para evitar ciclos y datos innecesarios
                var dtos = branches.Select(b => new BranchResponseDto
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
                    PublicOrderingUrl = $"/order.html?negocio={Uri.EscapeDataString(GetPublicHandle(b))}"
                });

                return Ok(dtos);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno: {ex.Message}");
            }
        }

        // GET: api/Branch/5
        [HttpGet("{id}")]
        public ActionResult<BranchResponseDto> Get(long id)
        {
            // ✅ Usamos Get(id)
            var branch = _repoBranch.Get(id);

            if (branch == null) return NotFound($"Sucursal {id} no encontrada.");

            var dto = new BranchResponseDto
            {
                Id = branch.Id,
                Name = branch.Name,
                FullAddress = $"{branch.Address}, {branch.City}, {branch.Country}",
                Phone = branch.Phone.ToString(),
                HomePage = branch.HomePage,
                Slug = branch.Slug,
                TenantFolder = branch.TenantFolder,
                BrandName = branch.BrandName ?? branch.Name,
                PublicDescription = branch.PublicDescription ?? string.Empty,
                LogoUrl = branch.LogoUrl ?? string.Empty,
                PrimaryColor = branch.PrimaryColor,
                SecondaryColor = branch.SecondaryColor,
                AccentColor = branch.AccentColor,
                BillingEmail = branch.BillingEmail ?? string.Empty,
                MembershipPlan = branch.MembershipPlan.ToString(),
                MembershipStatus = branch.MembershipStatus.ToString(),
                PublicOrderingEnabled = branch.PublicOrderingEnabled,
                MonthlyOrderLimit = branch.MonthlyOrderLimit,
                OpeningHour = branch.OpeningHour,
                ClosingHour = branch.ClosingHour,
                DayShiftEnabled = branch.DayShiftEnabled,
                DayOpeningHour = branch.DayOpeningHour,
                DayClosingHour = branch.DayClosingHour,
                NightShiftEnabled = branch.NightShiftEnabled,
                NightOpeningHour = branch.NightOpeningHour,
                NightClosingHour = branch.NightClosingHour,
                TimeZoneId = branch.TimeZoneId,
                PublicOrderingUrl = $"/order.html?negocio={Uri.EscapeDataString(GetPublicHandle(branch))}"
            };

            return Ok(dto);
        }

        // POST: api/Branch
        [HttpPost]
        public ActionResult Create([FromBody] BranchCreateDto dto)
        {
            try
            {
                var newBranch = new Branch
                {
                    Name = dto.Name,
                    Address = dto.Address,
                    City = dto.City,
                    Region = dto.Region,
                    PostalCode = dto.PostalCode,
                    Country = dto.Country,
                    Phone = dto.Phone,
                    HomePage = dto.HomePage,
                    Slug = NormalizeSlug(dto.Slug ?? dto.Name),
                    TenantFolder = NormalizeSlug(dto.Slug ?? dto.Name),
                    BrandName = string.IsNullOrWhiteSpace(dto.BrandName) ? dto.Name : dto.BrandName,
                    PublicDescription = dto.PublicDescription,
                    LogoUrl = dto.LogoUrl,
                    PrimaryColor = string.IsNullOrWhiteSpace(dto.PrimaryColor) ? "#111827" : dto.PrimaryColor,
                    SecondaryColor = string.IsNullOrWhiteSpace(dto.SecondaryColor) ? "#f59e0b" : dto.SecondaryColor,
                    AccentColor = string.IsNullOrWhiteSpace(dto.AccentColor) ? "#10b981" : dto.AccentColor,
                    BillingEmail = dto.BillingEmail,
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
                    IsDeleted = false
                };
                SyncLegacyHours(newBranch);
                ApplyMembership(newBranch, dto);

                // Validar (si la lógica está en la entidad)
                // newBranch.Validate(); 

                _repoBranch.Add(newBranch);
                _repoBranch.Save(); // ✅ Guardar cambios

                return CreatedAtAction(nameof(Get), new { id = newBranch.Id }, newBranch.Id);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al crear: {ex.Message}");
            }
        }

        // PUT: api/Branch/5
        [HttpPut("{id}")]
        public ActionResult Update(long id, [FromBody] BranchCreateDto dto)
        {
            try
            {
                var branch = _repoBranch.Get(id);
                if (branch == null) return NotFound("Sucursal no encontrada.");

                // Actualizamos campos
                branch.Name = dto.Name;
                branch.Address = dto.Address;
                branch.City = dto.City;
                branch.Region = dto.Region;
                branch.PostalCode = dto.PostalCode;
                branch.Country = dto.Country;
                branch.Phone = dto.Phone;
                branch.HomePage = dto.HomePage;
                branch.Slug = NormalizeSlug(dto.Slug ?? dto.Name);
                branch.TenantFolder = NormalizeSlug(dto.Slug ?? dto.Name);
                branch.BrandName = string.IsNullOrWhiteSpace(dto.BrandName) ? dto.Name : dto.BrandName;
                branch.PublicDescription = dto.PublicDescription;
                branch.LogoUrl = dto.LogoUrl;
                branch.PrimaryColor = string.IsNullOrWhiteSpace(dto.PrimaryColor) ? branch.PrimaryColor : dto.PrimaryColor;
                branch.SecondaryColor = string.IsNullOrWhiteSpace(dto.SecondaryColor) ? branch.SecondaryColor : dto.SecondaryColor;
                branch.AccentColor = string.IsNullOrWhiteSpace(dto.AccentColor) ? branch.AccentColor : dto.AccentColor;
                branch.BillingEmail = dto.BillingEmail;
                branch.PublicOrderingEnabled = dto.PublicOrderingEnabled;
                branch.MonthlyOrderLimit = dto.MonthlyOrderLimit;
                branch.OpeningHour = NormalizeHour(dto.OpeningHour, branch.OpeningHour);
                branch.ClosingHour = NormalizeHour(dto.ClosingHour, branch.ClosingHour);
                branch.DayShiftEnabled = dto.DayShiftEnabled;
                branch.DayOpeningHour = NormalizeHour(dto.DayOpeningHour, branch.DayOpeningHour);
                branch.DayClosingHour = NormalizeHour(dto.DayClosingHour, branch.DayClosingHour);
                branch.NightShiftEnabled = dto.NightShiftEnabled;
                branch.NightOpeningHour = NormalizeHour(dto.NightOpeningHour, branch.NightOpeningHour);
                branch.NightClosingHour = NormalizeHour(dto.NightClosingHour, branch.NightClosingHour);
                SyncLegacyHours(branch);
                branch.TimeZoneId = string.IsNullOrWhiteSpace(dto.TimeZoneId) ? branch.TimeZoneId : dto.TimeZoneId;
                ApplyMembership(branch, dto);

                _repoBranch.Update(branch);
                _repoBranch.Save(); // ✅ Guardar cambios

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al actualizar: {ex.Message}");
            }
        }

        // DELETE: api/Branch/5
        [HttpDelete("{id}")]
        public ActionResult Delete(long id)
        {
            try
            {
                if (_repoBranch.Get(id) == null) return NotFound("Sucursal no encontrada.");

                _repoBranch.Delete(id);
                _repoBranch.Save(); // ✅ Guardar cambios (Soft Delete)

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al eliminar: {ex.Message}");
            }
        }

        private static void ApplyMembership(Branch branch, BranchCreateDto dto)
        {
            if (!string.IsNullOrWhiteSpace(dto.MembershipPlan) &&
                Enum.TryParse<MembershipPlan>(dto.MembershipPlan, true, out var plan))
            {
                branch.MembershipPlan = plan;
            }

            if (!string.IsNullOrWhiteSpace(dto.MembershipStatus) &&
                Enum.TryParse<MembershipStatus>(dto.MembershipStatus, true, out var status))
            {
                branch.MembershipStatus = status;
            }
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
    }
}
