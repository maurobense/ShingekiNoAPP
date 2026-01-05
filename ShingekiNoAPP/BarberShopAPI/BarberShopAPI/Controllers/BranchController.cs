using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;

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
                    HomePage = b.HomePage
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
                HomePage = branch.HomePage
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
                    IsDeleted = false
                };

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
    }
}