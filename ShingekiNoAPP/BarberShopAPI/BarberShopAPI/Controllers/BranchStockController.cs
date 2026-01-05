using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Collections.Generic;
using System.Linq;
using DTO;


namespace ShingekiNoAPPI.Controllers
{

    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin,BranchManager")]
    public class BranchStockController : ControllerBase
    {
        private readonly IRepositoryBranchStock _repoBranchStock;
        private readonly IRepositoryBranch _repoBranch;

        public BranchStockController(IRepositoryBranchStock repoBranchStock, IRepositoryBranch repoBranch)
        {
            _repoBranchStock = repoBranchStock;
            _repoBranch = repoBranch;
        }

        [HttpGet("branch/{branchId}")]
        public ActionResult<IEnumerable<BranchStock>> GetStockByBranch(long branchId)
        {
            try
            {
                if (_repoBranch.Get(branchId) == null) return NotFound($"Sucursal {branchId} no encontrada.");

                var stockItems = _repoBranchStock.GetByBranchId(branchId)
                                                 .Where(bs => !bs.IsDeleted);
                return Ok(stockItems);
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        [HttpPost("movement")]
        public ActionResult RegisterMovement([FromBody] StockMovementDto movementDto)
        {
            try
            {
                // 1. Validaciones Flexibles
                if (movementDto.Quantity < 0) return BadRequest("La cantidad no puede ser negativa.");

                // Si Quantity es 0 y no hay MinimumStock, no hacemos nada.
                if (movementDto.Quantity == 0 && !movementDto.MinimumStock.HasValue)
                    return BadRequest("Debes ingresar una Cantidad o un Nuevo Mínimo.");

                // Si hay cantidad > 0, debe haber tipo
                if (movementDto.Quantity > 0 && (movementDto.MovementType != "IN" && movementDto.MovementType != "OUT"))
                    return BadRequest("Falta especificar el tipo de movimiento.");

                if (_repoBranch.Get(movementDto.BranchId) == null) return BadRequest("La sucursal no existe.");

                // 2. Buscar o Crear
                var stockEntry = _repoBranchStock.GetByBranchAndIngredient(movementDto.BranchId, movementDto.IngredientId);
                bool isNewEntry = false;

                if (stockEntry == null)
                {
                    if (movementDto.Quantity > 0 && movementDto.MovementType == "OUT")
                        return BadRequest("No hay stock inicial para realizar una salida.");

                    stockEntry = new BranchStock
                    {
                        BranchId = movementDto.BranchId,
                        IngredientId = movementDto.IngredientId,
                        CurrentStock = 0,
                        MinimumStockAlert = movementDto.MinimumStock ?? 0,
                        IsDeleted = false
                    };
                    _repoBranchStock.Add(stockEntry);
                    isNewEntry = true;
                }

                // 3. Actualizar Mínimo (Si el usuario mandó dato)
                if (movementDto.MinimumStock.HasValue)
                {
                    stockEntry.MinimumStockAlert = movementDto.MinimumStock.Value;
                }

                // 4. Actualizar Stock (Solo si Quantity > 0)
                if (movementDto.Quantity > 0)
                {
                    if (movementDto.MovementType == "IN")
                        stockEntry.CurrentStock += movementDto.Quantity;
                    else
                    {
                        if (stockEntry.CurrentStock < movementDto.Quantity)
                            return BadRequest("Stock insuficiente.");
                        stockEntry.CurrentStock -= movementDto.Quantity;
                    }
                }

                // 5. Guardar (Fix Temporary Value)
                if (!isNewEntry)
                {
                    _repoBranchStock.Update(stockEntry);
                }

                _repoBranchStock.Save();

                return Ok(new { Message = "Actualizado correctamente.", NewStock = stockEntry.CurrentStock });
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}