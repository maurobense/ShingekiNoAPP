using Business.BusinessEntities;
using Business.BusinessInterfaces;
using Datos.EF;
using DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Text.RegularExpressions;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/branch-settings")]
    [ApiController]
    [Authorize(Roles = "Admin,BranchManager")]
    public class BranchSettingsController : ControllerBase
    {
        private readonly ShingekiContext _context;
        private readonly ITenantService _tenantService;

        public BranchSettingsController(ShingekiContext context, ITenantService tenantService)
        {
            _context = context;
            _tenantService = tenantService;
        }

        [HttpGet]
        public async Task<ActionResult<BranchSettingsDto>> GetCurrent()
        {
            var branch = await GetCurrentBranch();
            if (branch == null) return NotFound("No se encontro la configuracion del local.");

            return Ok(ToDto(branch));
        }

        [HttpPut]
        public async Task<ActionResult<BranchSettingsDto>> UpdateCurrent([FromBody] BranchSettingsDto dto)
        {
            var branch = await GetCurrentBranch();
            if (branch == null) return NotFound("No se encontro la configuracion del local.");

            branch.BrandName = string.IsNullOrWhiteSpace(dto.BrandName) ? branch.Name : dto.BrandName.Trim();
            branch.PublicDescription = dto.PublicDescription?.Trim();
            branch.LogoUrl = dto.LogoUrl?.Trim();
            branch.PrimaryColor = NormalizeColor(dto.PrimaryColor, branch.PrimaryColor);
            branch.SecondaryColor = NormalizeColor(dto.SecondaryColor, branch.SecondaryColor);
            branch.AccentColor = NormalizeColor(dto.AccentColor, branch.AccentColor);
            branch.Phone = dto.Phone;
            branch.HomePage = dto.HomePage?.Trim() ?? string.Empty;
            branch.PublicOrderingEnabled = dto.PublicOrderingEnabled;
            ApplySchedule(branch, dto);
            branch.TimeZoneId = string.IsNullOrWhiteSpace(dto.TimeZoneId) ? "America/Montevideo" : dto.TimeZoneId.Trim();
            branch.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(ToDto(branch));
        }

        private async Task<Branch?> GetCurrentBranch()
        {
            var branchId = _tenantService.GetBranchId();
            if (branchId <= 0) return null;

            return await _context.Branches
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(b => b.Id == branchId && !b.IsDeleted);
        }

        private static BranchSettingsDto ToDto(Branch branch)
        {
            return new BranchSettingsDto
            {
                Id = branch.Id,
                Name = branch.Name,
                BrandName = branch.BrandName ?? branch.Name,
                PublicDescription = branch.PublicDescription ?? string.Empty,
                LogoUrl = branch.LogoUrl ?? string.Empty,
                PrimaryColor = branch.PrimaryColor,
                SecondaryColor = branch.SecondaryColor,
                AccentColor = branch.AccentColor,
                Phone = branch.Phone,
                HomePage = branch.HomePage ?? string.Empty,
                PublicOrderingEnabled = branch.PublicOrderingEnabled,
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
        }

        private static void ApplySchedule(Branch branch, BranchSettingsDto dto)
        {
            var dayEnabled = dto.DayShiftEnabled;
            var nightEnabled = dto.NightShiftEnabled;

            if (!dayEnabled && !nightEnabled)
            {
                dayEnabled = true;
            }

            branch.DayShiftEnabled = dayEnabled;
            branch.DayOpeningHour = NormalizeHour(dto.DayOpeningHour, branch.DayOpeningHour);
            branch.DayClosingHour = NormalizeHour(dto.DayClosingHour, branch.DayClosingHour);
            branch.NightShiftEnabled = nightEnabled;
            branch.NightOpeningHour = NormalizeHour(dto.NightOpeningHour, branch.NightOpeningHour);
            branch.NightClosingHour = NormalizeHour(dto.NightClosingHour, branch.NightClosingHour);

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

        private static int NormalizeHour(int value, int fallback)
        {
            return value >= 0 && value <= 23 ? value : fallback;
        }

        private static string NormalizeColor(string? value, string fallback)
        {
            var color = (value ?? string.Empty).Trim();
            return Regex.IsMatch(color, "^#[0-9a-fA-F]{6}$") ? color : fallback;
        }

        private static string GetPublicHandle(Branch branch)
        {
            var slug = NormalizePublicHandle(branch.Slug);
            if (!slug.StartsWith("tenant-", StringComparison.OrdinalIgnoreCase)) return slug;

            return NormalizePublicHandle(branch.BrandName ?? branch.Name);
        }

        private static string NormalizePublicHandle(string? value)
        {
            var slug = Regex.Replace((value ?? string.Empty).Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
            return string.IsNullOrWhiteSpace(slug) ? $"tenant-{Guid.NewGuid():N}".Substring(0, 16) : slug;
        }
    }
}
