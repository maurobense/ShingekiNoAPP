using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/stock")]
    [ApiController]
    [Authorize(Roles = "Admin, BranchManager")]
    public class StockController : ControllerBase
    {
        private readonly IRepositoryBranchStock _repoStock;
        private readonly IRepositoryIngredient _repoIngredient;

        // 🔥 Eliminamos IRepositoryBranch porque ya no validamos sucursales a mano
        public StockController(
            IRepositoryBranchStock repoStock,
            IRepositoryIngredient repoIngredient)
        {
            _repoStock = repoStock;
            _repoIngredient = repoIngredient;
        }

        // =========================================================
        // 🔍 GET: OBTENER INVENTARIO (Multi-Tenant)
        // =========================================================
        [HttpGet] // 🔥 CAMBIO CLAVE: Ya no pide "branch/{branchId}" en la URL
        public IActionResult GetStock()
        {
            try
            {
                // El GetAll() ya viene filtrado mágicamente por la sucursal del JWT
                var inventory = _repoStock.GetAll();

                var dtos = inventory.Select(bs => new
                {
                    IngredientId = bs.IngredientId,
                    CurrentStock = bs.CurrentStock,
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
            if (_repoIngredient.Get(dto.IngredientId) == null)
                return BadRequest("Ingrediente no válido.");

            try
            {
                // Buscamos sin filtrar por BranchId, el GetAll() ya lo hace
                var existingStock = _repoStock.GetAll()
                    .FirstOrDefault(bs => bs.IngredientId == dto.IngredientId);

                if (existingStock != null)
                {
                    // ACTUALIZACIÓN
                    existingStock.CurrentStock = dto.CurrentStock;
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
                        BranchId = 0, // 🔥 Se manda en 0, el Contexto le asigna el ID real
                        IngredientId = dto.IngredientId,
                        CurrentStock = dto.CurrentStock,
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