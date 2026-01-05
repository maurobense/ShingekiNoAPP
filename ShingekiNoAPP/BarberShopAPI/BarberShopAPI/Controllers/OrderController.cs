using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO;
using DTO.DTO; // Asegúrate de tener el namespace correcto para tus DTOs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OrdersController : ControllerBase
    {
        private readonly IRepositoryOrder _repoOrder;
        private readonly IRepositoryProduct _repoProduct;
        private readonly IRepositoryClient _repoClient;
        private readonly IRepositoryClientAddress _repoAddress;
        private readonly IRepositoryOrderStatusHistory _repoHistory;
        private readonly IRepositoryBranchStock _repoStock;

        public OrdersController(
            IRepositoryOrder repoOrder,
            IRepositoryProduct repoProduct,
            IRepositoryClient repoClient,
            IRepositoryClientAddress repoAddress,
            IRepositoryOrderStatusHistory repoHistory,
            IRepositoryBranchStock repoStock)
        {
            _repoOrder = repoOrder;
            _repoProduct = repoProduct;
            _repoClient = repoClient;
            _repoAddress = repoAddress;
            _repoHistory = repoHistory;
            _repoStock = repoStock;
        }

        // =========================================================
        // 🔄 LÓGICA DE TRANSICIÓN DE ESTADOS (CAMBIO CLAVE)
        // =========================================================
        private static OrderStatus GetNextStatus(OrderStatus currentStatus)
        {
            return currentStatus switch
            {
                OrderStatus.Pending => OrderStatus.Confirmed,
                OrderStatus.Confirmed => OrderStatus.Cooking,
                OrderStatus.Cooking => OrderStatus.Ready,

                // 🔥 FLUJO CORREGIDO: De Listo -> En Camino -> Entregado
                OrderStatus.Ready => OrderStatus.OnTheWay,
                OrderStatus.OnTheWay => OrderStatus.Delivered,

                _ => currentStatus // En Delivered o Cancelled se queda igual
            };
        }

        // =========================================================
        // 🛍️ POST: CREAR PEDIDO
        // =========================================================
        [HttpPost]
        public IActionResult CreateOrder([FromBody] OrderCreateDto dto)
        {
            if (dto.Items == null || !dto.Items.Any())
                return BadRequest("El pedido debe contener al menos un ítem.");

            if (dto.ClientId.HasValue && _repoClient.Get(dto.ClientId.Value) == null)
                return BadRequest("El cliente especificado no existe.");

            if (_repoAddress.Get(dto.ClientAddressId) == null)
                return BadRequest("La dirección de envío no es válida.");

            var newOrder = new Order
            {
                ClientId = dto.ClientId,
                BranchId = dto.BranchId,
                ClientAddressId = dto.ClientAddressId,
                Note = dto.Note,
                OrderDate = DateTime.UtcNow,
                CurrentStatus = OrderStatus.Pending,
                TrackingNumber = Guid.NewGuid(),
                OrderItems = new List<OrderItem>(),
                PaymentMethod = dto.PaymentMethod,
                TotalAmount = 0,
                Discount = dto.GlobalDiscount
            };

            decimal subtotalAcumulado = 0;

            foreach (var itemDto in dto.Items)
            {
                var product = _repoProduct.GetWithRecipe(itemDto.ProductId);

                if (product == null) return BadRequest($"El producto con ID {itemDto.ProductId} no existe.");
                if (!product.IsActive) return BadRequest($"El producto '{product.Name}' no está disponible.");

                // Descuento de Stock
                if (product.ProductIngredients != null)
                {
                    foreach (var recipeItem in product.ProductIngredients)
                    {
                        decimal amountToDeduct = recipeItem.Quantity * itemDto.Quantity;
                        var stockRecord = _repoStock.GetByBranchAndIngredient(dto.BranchId, recipeItem.IngredientId);

                        if (stockRecord != null)
                        {
                            stockRecord.CurrentStock -= amountToDeduct;
                            _repoStock.Update(stockRecord);
                        }
                    }
                }

                decimal itemSubtotal = (product.Price * itemDto.Quantity);

                if (itemDto.Discount > 0)
                {
                    if (itemDto.Discount > itemSubtotal) itemDto.Discount = itemSubtotal;
                    itemSubtotal -= itemDto.Discount;
                }

                var orderItem = new OrderItem
                {
                    ProductId = product.Id,
                    Quantity = itemDto.Quantity,
                    UnitPrice = product.Price,
                    Observation = itemDto.Observation,
                    Discount = itemDto.Discount
                };

                subtotalAcumulado += itemSubtotal;
                newOrder.OrderItems.Add(orderItem);
            }

            decimal totalFinal = subtotalAcumulado;

            if (dto.GlobalDiscount > 0)
            {
                if (dto.GlobalDiscount > totalFinal) totalFinal = 0;
                else totalFinal -= dto.GlobalDiscount;
            }

            newOrder.TotalAmount = totalFinal;

            try
            {
                _repoOrder.Add(newOrder);
                _repoOrder.Save();
                _repoStock.Save();
                _repoHistory.AddNewStatus(newOrder.Id, OrderStatus.Pending, 0);

                return Ok(new
                {
                    Message = "¡Pedido Enviado a la Cocina!",
                    OrderId = newOrder.Id,
                    Tracking = newOrder.TrackingNumber,
                    Total = newOrder.TotalAmount,
                    ItemsCount = newOrder.OrderItems.Count
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al procesar el pedido: {ex.Message}");
            }
        }

        // =========================================================
        // 🔍 GET: DETALLE DEL PEDIDO (Con Nombre y Teléfono)
        // =========================================================
        [HttpGet("{id}")]
        public IActionResult GetOrderDetails(long id)
        {
            var order = _repoOrder.GetOrderDetails(id);

            if (order == null) return NotFound("Pedido no encontrado.");

            var responseDto = new OrderResponseDto
            {
                Id = order.Id,
                OrderDate = order.OrderDate,
                Status = order.CurrentStatus.ToString(),

                // DATOS DEL CLIENTE
                ClientName = order.Client != null
                             ? $"{order.Client.Name} {order.Client.LastName}"
                             : "Cliente Casual / Invitado",

                ClientPhone = order.Client != null
                              ? order.Client.Phone.ToString()
                              : "Sin teléfono",

                PaymentMethod = order.PaymentMethod.ToString(),
                TotalAmount = order.TotalAmount,
                Discount = order.Discount,
                TrackingNumber = order.TrackingNumber.ToString(),
                BranchName = order.Branch != null ? order.Branch.Name : "N/A",
                Items = order.OrderItems.Select(oi => new OrderItemResponseDto
                {
                    ProductName = oi.Product?.Name ?? "Producto Desconocido",
                    Quantity = oi.Quantity,
                    UnitPrice = oi.UnitPrice,
                    Subtotal = (oi.Quantity * oi.UnitPrice) - oi.Discount,
                    Observation = oi.Observation,
                    Discount = oi.Discount
                }).ToList()
            };

            return Ok(responseDto);
        }

        // =========================================================
        // 🚫 POST: CANCELAR PEDIDO
        // =========================================================
        [HttpPost("{id}/cancel")]
        public IActionResult CancelOrder(long id)
        {
            var order = _repoOrder.Get(id);
            if (order == null) return NotFound("Pedido no encontrado");

            if (order.CurrentStatus == OrderStatus.Delivered)
                return BadRequest("No se puede cancelar un pedido que ya fue entregado.");

            if (order.CurrentStatus == OrderStatus.Cancelled)
                return BadRequest("El pedido ya está cancelado.");

            order.CurrentStatus = OrderStatus.Cancelled;
            _repoOrder.Update(order);

            // Usuario 1 = Admin por defecto (si tienes el ID del usuario en el token, úsalo aquí)
            _repoHistory.AddNewStatus(id, OrderStatus.Cancelled, 1);

            _repoOrder.Save();

            return Ok(new { Message = "Pedido cancelado correctamente." });
        }

        // =========================================================
        // 👨‍🍳 GET: PEDIDOS POR ESTADO (RESUMEN)
        // =========================================================
        [HttpGet("status/{status}")]
        public IActionResult GetOrdersByStatus(OrderStatus status)
        {
            var ordersDb = _repoOrder.GetAll()
                .Include(o => o.OrderItems)
                .Where(o => o.CurrentStatus == status)
                .OrderBy(o => o.OrderDate)
                .ToList();

            var result = ordersDb.Select(o => new
            {
                o.Id,
                o.OrderDate,
                o.TotalAmount,
                ItemsCount = o.OrderItems?.Count ?? 0,
                CurrentStatus = o.CurrentStatus.ToString(),
                PaymentMethod = o.PaymentMethod.ToString(),

                // 🔥 ESTO HACE QUE EL BOTÓN "AVANZAR" SEPA A DÓNDE IR
                NextStatus = GetNextStatus(o.CurrentStatus).ToString()
            });

            return Ok(result);
        }

        // =========================================================
        // 🔄 PUT: ACTUALIZAR ESTADO
        // =========================================================
        [HttpPut("{id}/status")]
        public IActionResult UpdateStatus(long id, [FromBody] UpdateStatusDto dto)
        {
            var order = _repoOrder.Get(id);
            if (order == null) return NotFound();

            try
            {
                if (order.CurrentStatus == OrderStatus.Delivered || order.CurrentStatus == OrderStatus.Cancelled)
                {
                    return BadRequest("No se puede cambiar el estado de un pedido finalizado.");
                }

                order.CurrentStatus = dto.NewStatus;
                _repoOrder.Update(order);
                _repoHistory.AddNewStatus(id, dto.NewStatus, dto.UserId);
                _repoOrder.Save();

                return Ok(new
                {
                    Message = $"Estado actualizado a {dto.NewStatus}",
                    NewStatus = dto.NewStatus.ToString()
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPut("{id}/date")]
        public IActionResult UpdateOrderDate(long id, [FromBody] UpdateDateDto dto)
        {
            try
            {
                var order = _repoOrder.Get(id);
                if (order == null) return NotFound();

                order.OrderDate = dto.NewDate;
                _repoOrder.Update(order);
                _repoOrder.Save();

                return Ok(new { Message = "Fecha actualizada" });
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // =========================================================
        // 👤 GET: PEDIDOS POR CLIENTE (HISTORIAL)
        // =========================================================
        [HttpGet("client/{clientId}")]
        public IActionResult GetByClient(long clientId)
        {
            try
            {
                var orders = _repoOrder.GetAll()
                    .Where(o => o.ClientId == clientId)
                    .OrderByDescending(o => o.OrderDate)
                    .Select(o => new
                    {
                        o.Id,
                        o.OrderDate,
                        CurrentStatus = o.CurrentStatus.ToString(),
                        o.TotalAmount
                    })
                    .ToList();

                return Ok(orders);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}