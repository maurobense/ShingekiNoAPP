using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/stock")]
    [ApiController]
    // [Authorize(Roles = "Admin, BranchManager")]
    public class StockController : ControllerBase
    {
        private readonly IRepositoryBranchStock _repoStock;
        private readonly IRepositoryBranch _repoBranch;
        private readonly IRepositoryIngredient _repoIngredient;

        public StockController(
            IRepositoryBranchStock repoStock,
            IRepositoryBranch repoBranch,
            IRepositoryIngredient repoIngredient)
        {
            _repoStock = repoStock;
            _repoBranch = repoBranch;
            _repoIngredient = repoIngredient;
        }

        // =========================================================
        // 🔍 GET: OBTENER INVENTARIO POR SUCURSAL
        // =========================================================
        [HttpGet("branch/{branchId}")]
        public IActionResult GetStockByBranch(long branchId)
        {
            if (_repoBranch.Get(branchId) == null)
                return NotFound("Sucursal no encontrada.");

            try
            {
                var inventory = _repoStock.GetAll()
                                          .Where(bs => bs.BranchId == branchId);

                var dtos = inventory.Select(bs => new
                {
                    IngredientId = bs.IngredientId,
                    // IngredientName = bs.Ingredient?.Name, // Descomentar si usas Include
                    CurrentStock = bs.CurrentStock,

                    // ✅ CORREGIDO: Usamos el nombre correcto de la entidad
                    MinimumStockAlert = bs.MinimumStockAlert
                });

                return Ok(dtos);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al obtener inventario: {ex.Message}");
            }
        }

        // =========================================================
        // 📝 POST: CREAR O ACTUALIZAR STOCK (Upsert)
        // =========================================================
        [HttpPost]
        public IActionResult UpdateOrCreateStock([FromBody] StockUpdateDto dto)
        {
            if (_repoBranch.Get(dto.BranchId) == null)
                return BadRequest("Sucursal no válida.");
            if (_repoIngredient.Get(dto.IngredientId) == null)
                return BadRequest("Ingrediente no válido.");

            try
            {
                // NOTA: El DTO de entrada debe seguir llamándose 'MinimumStock' si así quieres que se vea el JSON (ej. StockUpdateDto.MinimumStock)
                // y aquí lo mapeamos a 'MinimumStockAlert'.

                var existingStock = _repoStock.GetAll()
                                              .FirstOrDefault(bs =>
                                                  bs.BranchId == dto.BranchId &&
                                                  bs.IngredientId == dto.IngredientId);

                if (existingStock != null)
                {
                    // ACTUALIZACIÓN
                    existingStock.CurrentStock = dto.CurrentStock;

                    // ✅ CORREGIDO: Usamos el nombre de propiedad real
                    existingStock.MinimumStockAlert = dto.MinimumStock;

                    _repoStock.Update(existingStock);
                    _repoStock.Save();

                    return Ok(new { Message = "Stock de ingrediente actualizado." });
                }
                else
                {
                    // NUEVO REGISTRO
                    var newStock = new BranchStock
                    {
                        BranchId = dto.BranchId,
                        IngredientId = dto.IngredientId,
                        CurrentStock = dto.CurrentStock,

                        // ✅ CORREGIDO: Usamos el nombre de propiedad real
                        MinimumStockAlert = dto.MinimumStock
                    };
                    _repoStock.Add(newStock);
                    _repoStock.Save();

                    return Created("Stock creado", new { Id = newStock.BranchId });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al procesar el stock: {ex.Message}");
            }
        }
    }
}