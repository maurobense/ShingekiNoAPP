using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // [Authorize(Roles = "Admin")] // Descomentar cuando la seguridad esté lista
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
                    PublicOrderingUrl = $"/order.html?tenant={Uri.EscapeDataString(b.Slug)}"
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
                PublicOrderingUrl = $"/order.html?tenant={Uri.EscapeDataString(branch.Slug)}"
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
                    IsDeleted = false
                };
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
    }
}
