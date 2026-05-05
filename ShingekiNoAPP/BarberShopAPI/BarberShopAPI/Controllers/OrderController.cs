using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO;
using DTO.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ShingekiNoAPPI.Hubs;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

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

        // 📡 Variable para el Hub de SignalR
        private readonly IHubContext<DeliveryHub> _hubContext;

        public OrdersController(
            IRepositoryOrder repoOrder,
            IRepositoryProduct repoProduct,
            IRepositoryClient repoClient,
            IRepositoryClientAddress repoAddress,
            IRepositoryOrderStatusHistory repoHistory,
            IRepositoryBranchStock repoStock,
            IHubContext<DeliveryHub> hubContext) // 💉 Inyección
        {
            _repoOrder = repoOrder;
            _repoProduct = repoProduct;
            _repoClient = repoClient;
            _repoAddress = repoAddress;
            _repoHistory = repoHistory;
            _repoStock = repoStock;
            _hubContext = hubContext;
        }

        private static OrderStatus GetNextStatus(OrderStatus currentStatus)
        {
            return currentStatus switch
            {
                OrderStatus.Pending => OrderStatus.Confirmed,
                OrderStatus.Confirmed => OrderStatus.Cooking,
                OrderStatus.Cooking => OrderStatus.Ready,
                OrderStatus.Ready => OrderStatus.OnTheWay,
                OrderStatus.OnTheWay => OrderStatus.Delivered,
                _ => currentStatus
            };
        }

        private static DateTime GetBusinessNow()
        {
            try
            {
                var timeZone = TimeZoneInfo.FindSystemTimeZoneById("Montevideo Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZone);
            }
            catch (TimeZoneNotFoundException)
            {
                return DateTime.UtcNow.AddHours(-3);
            }
            catch (InvalidTimeZoneException)
            {
                return DateTime.UtcNow.AddHours(-3);
            }
        }

        // =========================================================
        // 🛍️ POST: CREAR PEDIDO
        // =========================================================
        [HttpPost]
        public async Task<IActionResult> CreateOrder([FromBody] OrderCreateDto dto)
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
                BranchId = 0, // 🔥 El ShingekiContext pondrá la correcta
                ClientAddressId = dto.ClientAddressId,
                Note = dto.Note,
                OrderDate = GetBusinessNow(),
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

                        // 🔥 MODIFICADO PARA MULTI-TENANT 🔥
                        var stockRecord = _repoStock.GetAll()
                            .FirstOrDefault(s => s.IngredientId == recipeItem.IngredientId);

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

                // 🔥 SIGNALR: NOTIFICAR A LA COCINA 🔥
                await _hubContext.Clients.Group("Kitchen").SendAsync("ReceiveNewOrder", newOrder.Id);

                return Ok(new
                {
                    Message = "¡Pedido Enviado a la Cocina!",
                    OrderId = newOrder.Id,
                    Tracking = newOrder.TrackingNumber,
                    TrackingUrl = BuildFrontendUrl($"/track.html?code={Uri.EscapeDataString(newOrder.TrackingNumber.ToString())}"),
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
        // 🔍 GET: DETALLE DEL PEDIDO (Por ID - Legacy/Interno)
        // =========================================================
        [HttpGet("{id}")]
        [AllowAnonymous]
        public IActionResult GetOrderDetails(long id)
        {
            var order = _repoOrder.GetOrderDetails(id);

            if (order == null) return NotFound("Pedido no encontrado.");

            var responseDto = new OrderResponseDto
            {
                Id = order.Id,
                OrderDate = order.OrderDate,
                Status = order.CurrentStatus.ToString(),
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
                TenantSlug = order.Branch == null ? string.Empty : GetPublicHandle(order.Branch),
                PublicOrderingUrl = order.Branch == null ? string.Empty : BuildFrontendUrl($"/order.html?negocio={Uri.EscapeDataString(GetPublicHandle(order.Branch))}"),
                DeliveryAddressText = BuildDeliveryAddressText(order.DeliveryAddress),
                DeliveryAddressLabel = order.DeliveryAddress?.Label,
                DeliveryStreet = order.DeliveryAddress?.Street,
                DeliveryCity = order.DeliveryAddress?.City,
                DeliveryRegion = order.DeliveryAddress?.Region,
                DeliveryCountry = order.DeliveryAddress?.Country,
                DriverLatitude = order.LastDriverLatitude,
                DriverLongitude = order.LastDriverLongitude,
                DriverAccuracyMeters = order.LastDriverAccuracyMeters,
                DriverSpeedMetersPerSecond = order.LastDriverSpeedMetersPerSecond,
                DriverHeadingDegrees = order.LastDriverHeadingDegrees,
                DriverLocationAtUtc = order.LastDriverLocationAtUtc,
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
        // 🌍 GET: RASTREO PÚBLICO (Por GUID Seguro)
        // =========================================================
        [HttpGet("track/{trackingNumber}")]
        [AllowAnonymous] // Público
        public IActionResult GetByTracking(Guid trackingNumber)
        {
            var order = _repoOrder.GetAll()
                .Include(o => o.Client)
                .Include(o => o.Branch)
                .Include(o => o.DeliveryAddress)
                .Include(o => o.OrderItems)
                .ThenInclude(oi => oi.Product)
                .FirstOrDefault(o => o.TrackingNumber == trackingNumber);

            if (order == null) return NotFound("Pedido no encontrado o enlace inválido.");

            var responseDto = new OrderResponseDto
            {
                Id = order.Id,
                OrderDate = order.OrderDate,
                Status = order.CurrentStatus.ToString(),
                ClientName = order.Client != null ? $"{order.Client.Name} {order.Client.LastName}" : "Cliente Casual",
                ClientPhone = order.Client != null ? order.Client.Phone.ToString() : "-",
                PaymentMethod = order.PaymentMethod.ToString(),
                TotalAmount = order.TotalAmount,
                Discount = order.Discount,
                TrackingNumber = order.TrackingNumber.ToString(),
                BranchName = order.Branch?.Name ?? "Central",
                TenantSlug = order.Branch == null ? string.Empty : GetPublicHandle(order.Branch),
                PublicOrderingUrl = order.Branch == null ? string.Empty : BuildFrontendUrl($"/order.html?negocio={Uri.EscapeDataString(GetPublicHandle(order.Branch))}"),
                DeliveryAddressText = BuildDeliveryAddressText(order.DeliveryAddress),
                DeliveryAddressLabel = order.DeliveryAddress?.Label,
                DeliveryStreet = order.DeliveryAddress?.Street,
                DeliveryCity = order.DeliveryAddress?.City,
                DeliveryRegion = order.DeliveryAddress?.Region,
                DeliveryCountry = order.DeliveryAddress?.Country,
                DriverLatitude = order.LastDriverLatitude,
                DriverLongitude = order.LastDriverLongitude,
                DriverAccuracyMeters = order.LastDriverAccuracyMeters,
                DriverSpeedMetersPerSecond = order.LastDriverSpeedMetersPerSecond,
                DriverHeadingDegrees = order.LastDriverHeadingDegrees,
                DriverLocationAtUtc = order.LastDriverLocationAtUtc,
                Items = order.OrderItems.Select(oi => new OrderItemResponseDto
                {
                    ProductName = oi.Product?.Name ?? "Ítem",
                    Quantity = oi.Quantity,
                    UnitPrice = oi.UnitPrice,
                    Subtotal = (oi.Quantity * oi.UnitPrice) - oi.Discount,
                    Observation = oi.Observation,
                    Discount = oi.Discount
                }).ToList()
            };

            return Ok(responseDto);
        }

        [HttpPost("track/{trackingNumber}/driver-location")]
        [Authorize(Roles = "Delivery,Admin,BranchManager")]
        public async Task<IActionResult> UpdateDriverLocation(Guid trackingNumber, [FromBody] DriverLocationUpdateDto dto)
        {
            if (!IsValidCoordinate(dto.Latitude, dto.Longitude))
                return BadRequest("Coordenadas invalidas.");

            var order = _repoOrder.GetAll()
                .FirstOrDefault(o => o.TrackingNumber == trackingNumber);

            if (order == null) return NotFound("Pedido no encontrado.");

            if (order.CurrentStatus is OrderStatus.Delivered or OrderStatus.Cancelled)
                return BadRequest("No se puede transmitir ubicacion para un pedido finalizado.");

            order.LastDriverLatitude = dto.Latitude;
            order.LastDriverLongitude = dto.Longitude;
            order.LastDriverAccuracyMeters = dto.AccuracyMeters;
            order.LastDriverSpeedMetersPerSecond = dto.SpeedMetersPerSecond;
            order.LastDriverHeadingDegrees = dto.HeadingDegrees;
            order.LastDriverLocationAtUtc = DateTime.UtcNow;
            order.LastDriverUserId = GetCurrentUserId();

            _repoOrder.Update(order);
            _repoOrder.Save();

            await _hubContext.Clients.Group(order.TrackingNumber.ToString())
                .SendAsync("ReceiveDriverLocation", dto.Latitude, dto.Longitude);

            await _hubContext.Clients.Group(order.TrackingNumber.ToString())
                .SendAsync("ReceiveDriverLocationDetails", new
                {
                    latitude = dto.Latitude,
                    longitude = dto.Longitude,
                    accuracyMeters = dto.AccuracyMeters,
                    speedMetersPerSecond = dto.SpeedMetersPerSecond,
                    headingDegrees = dto.HeadingDegrees,
                    locationAtUtc = order.LastDriverLocationAtUtc,
                    orderId = order.Id
                });

            return Ok(new
            {
                orderId = order.Id,
                trackingNumber = order.TrackingNumber,
                latitude = dto.Latitude,
                longitude = dto.Longitude,
                locationAtUtc = order.LastDriverLocationAtUtc
            });
        }

        [HttpPost("track/driver-location/batch")]
        [Authorize(Roles = "Delivery,Admin,BranchManager")]
        public async Task<IActionResult> UpdateDriverLocationBatch([FromBody] DriverLocationBatchUpdateDto dto)
        {
            if (dto.TrackingNumbers == null || dto.TrackingNumbers.Count == 0)
                return BadRequest("Debe indicar al menos un pedido para transmitir ubicacion.");

            if (!IsValidCoordinate(dto.Latitude, dto.Longitude))
                return BadRequest("Coordenadas invalidas.");

            var trackingNumbers = dto.TrackingNumbers
                .Where(value => value != Guid.Empty)
                .Distinct()
                .Take(12)
                .ToList();

            var orders = _repoOrder.GetAll()
                .Where(o => trackingNumbers.Contains(o.TrackingNumber))
                .ToList();

            if (orders.Count == 0) return NotFound("No se encontraron pedidos para transmitir ubicacion.");

            var now = DateTime.UtcNow;
            var activeOrders = orders
                .Where(o => o.CurrentStatus != OrderStatus.Delivered && o.CurrentStatus != OrderStatus.Cancelled)
                .ToList();

            foreach (var order in activeOrders)
            {
                order.LastDriverLatitude = dto.Latitude;
                order.LastDriverLongitude = dto.Longitude;
                order.LastDriverAccuracyMeters = dto.AccuracyMeters;
                order.LastDriverSpeedMetersPerSecond = dto.SpeedMetersPerSecond;
                order.LastDriverHeadingDegrees = dto.HeadingDegrees;
                order.LastDriverLocationAtUtc = now;
                order.LastDriverUserId = GetCurrentUserId();
                _repoOrder.Update(order);
            }

            _repoOrder.Save();

            foreach (var order in activeOrders)
            {
                await _hubContext.Clients.Group(order.TrackingNumber.ToString())
                    .SendAsync("ReceiveDriverLocation", dto.Latitude, dto.Longitude);

                await _hubContext.Clients.Group(order.TrackingNumber.ToString())
                    .SendAsync("ReceiveDriverLocationDetails", new
                    {
                        latitude = dto.Latitude,
                        longitude = dto.Longitude,
                        accuracyMeters = dto.AccuracyMeters,
                        speedMetersPerSecond = dto.SpeedMetersPerSecond,
                        headingDegrees = dto.HeadingDegrees,
                        locationAtUtc = order.LastDriverLocationAtUtc,
                        orderId = order.Id
                    });
            }

            return Ok(new
            {
                updatedOrders = activeOrders.Count,
                ignoredOrders = orders.Count - activeOrders.Count,
                latitude = dto.Latitude,
                longitude = dto.Longitude,
                locationAtUtc = now
            });
        }

        // =========================================================
        // 🚫 POST: CANCELAR PEDIDO
        // =========================================================
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelOrder(long id)
        {
            var order = _repoOrder.Get(id);
            if (order == null) return NotFound("Pedido no encontrado");

            if (order.CurrentStatus == OrderStatus.Delivered)
                return BadRequest("No se puede cancelar un pedido que ya fue entregado.");

            if (order.CurrentStatus == OrderStatus.Cancelled)
                return BadRequest("El pedido ya está cancelado.");

            order.CurrentStatus = OrderStatus.Cancelled;
            _repoOrder.Update(order);

            _repoHistory.AddNewStatus(id, OrderStatus.Cancelled, 1);
            _repoOrder.Save();

            await _hubContext.Clients.Group(id.ToString()).SendAsync("ReceiveStatusUpdate", "Cancelled");
            await _hubContext.Clients.Group(order.TrackingNumber.ToString()).SendAsync("ReceiveStatusUpdate", "Cancelled");
            await _hubContext.Clients.Group("Kitchen").SendAsync("ReceiveStatusUpdate", id, "Cancelled");

            return Ok(new { Message = "Pedido cancelado correctamente." });
        }

        // =========================================================
        // 👨‍🍳 GET: PEDIDOS POR ESTADO
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
                o.TrackingNumber,
                o.Client?.Phone,
                ClientName = o.Client != null ? $"{o.Client.Name} {o.Client.LastName}" : "Cliente Casual",
                ItemsCount = o.OrderItems?.Count ?? 0,
                CurrentStatus = o.CurrentStatus.ToString(),
                PaymentMethod = o.PaymentMethod.ToString(),
                NextStatus = GetNextStatus(o.CurrentStatus).ToString()
            });

            return Ok(result);
        }

        // =========================================================
        // 🔄 PUT: ACTUALIZAR ESTADO (CON SIGNALR 📡)
        // =========================================================
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(long id, [FromBody] UpdateStatusDto dto)
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

                await _hubContext.Clients.Group(id.ToString())
                    .SendAsync("ReceiveStatusUpdate", dto.NewStatus.ToString());

                await _hubContext.Clients.Group(order.TrackingNumber.ToString())
                    .SendAsync("ReceiveStatusUpdate", dto.NewStatus.ToString());

                await _hubContext.Clients.Group("Kitchen")
                    .SendAsync("ReceiveStatusUpdate", id, dto.NewStatus.ToString());

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

        // =========================================================
        // 📅 PUT: ACTUALIZAR FECHA
        // =========================================================
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
        // 👤 GET: HISTORIAL POR CLIENTE
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

        private string BuildFrontendUrl(string path)
        {
            var origin = Request.Headers.Referer.FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(origin) && Uri.TryCreate(origin, UriKind.Absolute, out var referer))
            {
                return $"{referer.Scheme}://{referer.Authority}{path}";
            }

            return path;
        }

        private static string GetPublicHandle(Branch branch)
        {
            var slug = NormalizePublicHandle(branch.Slug);
            if (!slug.StartsWith("tenant-", StringComparison.OrdinalIgnoreCase)) return slug;

            return NormalizePublicHandle(branch.BrandName ?? branch.Name);
        }

        private static string BuildDeliveryAddressText(ClientAddress? address)
        {
            if (address == null) return string.Empty;

            var parts = new[]
            {
                address.Street,
                address.City,
                address.Region,
                address.Country
            }
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .Select(part => part.Trim());

            return string.Join(", ", parts);
        }

        private static string NormalizePublicHandle(string? value)
        {
            var slug = Regex.Replace((value ?? string.Empty).Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
            return string.IsNullOrWhiteSpace(slug) ? "negocio" : slug;
        }

        private long? GetCurrentUserId()
        {
            var id = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return long.TryParse(id, out var userId) ? userId : null;
        }

        private static bool IsValidCoordinate(double lat, double lng)
        {
            return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        }
    }
}
