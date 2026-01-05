using Microsoft.AspNetCore.Mvc;
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using System;
using System.Linq;
using System.Collections.Generic;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/history")]
    [ApiController]
    // [Authorize(Roles = "Admin, Kitchen, Client")] 
    public class OrderStatusHistoryController : ControllerBase
    {
        private readonly IRepositoryOrderStatusHistory _repoHistory;

        public OrderStatusHistoryController(IRepositoryOrderStatusHistory repoHistory)
        {
            _repoHistory = repoHistory;
        }

        // GET: api/history/order/5
        // Devuelve toda la trazabilidad de un pedido específico
        [HttpGet("order/{orderId}")]
        public IActionResult GetHistoryByOrder(long orderId)
        {
            try
            {
                var history = _repoHistory.GetAll()
                                          .Where(h => h.OrderId == orderId)
                                          .OrderBy(h => h.ChangeDate)
                                          .Select(h => new
                                          {
                                              h.Id,

                                              // ✅ CORREGIDO: Usamos h.Status para el Enum
                                              Status = h.Status.ToString(),

                                              h.ChangeDate,

                                              // ✅ CORREGIDO: Usamos el nombre de propiedad exacto
                                              ChangedByUserId = h.ChangedByUserId
                                          })
                                          .ToList();

                if (history == null || !history.Any())
                {
                    return NotFound($"No se encontró historial para el pedido {orderId}.");
                }

                return Ok(history);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al obtener el historial: {ex.Message}");
            }
        }
    }
}