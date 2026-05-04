using Business.BusinessEntities;
using Datos.EF;
using DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ShingekiNoAPPI.Hubs;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/public")]
    [ApiController]
    [AllowAnonymous]
    public sealed class PublicController : ControllerBase
    {
        private readonly ShingekiContext _context;
        private readonly IHubContext<DeliveryHub> _hubContext;

        public PublicController(ShingekiContext context, IHubContext<DeliveryHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        [HttpGet("tenants/{slug}")]
        public async Task<IActionResult> GetTenant(string slug)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");

            return Ok(new
            {
                branch.Id,
                branch.Name,
                BrandName = branch.BrandName ?? branch.Name,
                branch.PublicDescription,
                branch.LogoUrl,
                branch.PrimaryColor,
                branch.SecondaryColor,
                branch.AccentColor,
                branch.Phone,
                branch.Address,
                branch.City,
                branch.Slug,
                branch.PublicOrderingEnabled,
                MembershipStatus = branch.MembershipStatus.ToString()
            });
        }

        [HttpGet("tenants/{slug}/menu")]
        public async Task<IActionResult> GetMenu(string slug)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");
            if (!CanReceiveOrders(branch)) return StatusCode(423, "Este restaurante no esta recibiendo pedidos online.");

            var categories = await _context.Categories
                .Where(c => c.BranchId == branch.Id && !c.IsDeleted)
                .OrderBy(c => c.Name)
                .Select(c => new { c.Id, c.Name, c.Description })
                .ToListAsync();

            var products = await _context.Products
                .Include(p => p.Category)
                .Where(p => p.BranchId == branch.Id && !p.IsDeleted && p.IsActive)
                .OrderBy(p => p.Category.Name)
                .ThenBy(p => p.Name)
                .Select(p => new ProductResponseDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Description = p.Description,
                    Price = p.Price,
                    ImageUrl = p.ImageUrl,
                    CategoryId = p.CategoryId,
                    CategoryName = p.Category != null ? p.Category.Name : "Sin categoria"
                })
                .ToListAsync();

            return Ok(new { categories, products });
        }

        [HttpPost("tenants/{slug}/orders")]
        public async Task<IActionResult> CreateOrder(string slug, [FromBody] PublicOrderCreateDto dto)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");
            if (!CanReceiveOrders(branch)) return StatusCode(423, "Este restaurante no esta recibiendo pedidos online.");
            if (dto.Items == null || !dto.Items.Any()) return BadRequest("El pedido debe tener al menos un item.");

            var phone = OnlyDigits(dto.CustomerPhone);
            if (string.IsNullOrWhiteSpace(dto.CustomerName) || string.IsNullOrWhiteSpace(phone))
            {
                return BadRequest("Nombre y telefono son obligatorios.");
            }

            var client = await _context.Clients
                .FirstOrDefaultAsync(c => c.BranchId == branch.Id && c.Phone.ToString() == phone && !c.IsDeleted);

            if (client == null)
            {
                client = new Client
                {
                    BranchId = branch.Id,
                    Name = dto.CustomerName.Trim(),
                    LastName = string.IsNullOrWhiteSpace(dto.CustomerLastName) ? "-" : dto.CustomerLastName.Trim(),
                    Phone = int.TryParse(phone, out var parsedPhone) ? parsedPhone : 0,
                    IsDeleted = false
                };
                _context.Clients.Add(client);
                await _context.SaveChangesAsync();
            }

            var address = new ClientAddress
            {
                ClientId = client.Id,
                Street = dto.Street.Trim(),
                City = string.IsNullOrWhiteSpace(dto.City) ? branch.City : dto.City.Trim(),
                Region = string.IsNullOrWhiteSpace(dto.Region) ? branch.Region : dto.Region.Trim(),
                PostalCode = dto.PostalCode > 0 ? dto.PostalCode : branch.PostalCode,
                Country = string.IsNullOrWhiteSpace(dto.Country) ? branch.Country : dto.Country.Trim(),
                Label = string.IsNullOrWhiteSpace(dto.AddressLabel) ? "Entrega" : dto.AddressLabel.Trim(),
                IsDeleted = false
            };
            _context.ClientAddresses.Add(address);
            await _context.SaveChangesAsync();

            var order = new Order
            {
                ClientId = client.Id,
                ClientAddressId = address.Id,
                BranchId = branch.Id,
                Note = dto.Note,
                OrderDate = DateTime.UtcNow,
                CurrentStatus = OrderStatus.Pending,
                TrackingNumber = Guid.NewGuid(),
                PaymentMethod = dto.PaymentMethod,
                OrderItems = new List<OrderItem>(),
                StatusHistory = new List<OrderStatusHistory>(),
                Discount = 0,
                TotalAmount = 0,
                IsDeleted = false
            };

            decimal total = 0;
            foreach (var item in dto.Items)
            {
                if (item.Quantity <= 0) return BadRequest("La cantidad de cada item debe ser mayor a cero.");

                var product = await _context.Products
                    .Include(p => p.ProductIngredients)
                    .FirstOrDefaultAsync(p => p.Id == item.ProductId && p.BranchId == branch.Id && p.IsActive && !p.IsDeleted);

                if (product == null) return BadRequest($"Producto {item.ProductId} no disponible.");

                foreach (var recipeItem in product.ProductIngredients ?? Enumerable.Empty<ProductIngredient>())
                {
                    var stock = await _context.BranchStocks
                        .FirstOrDefaultAsync(s => s.BranchId == branch.Id && s.IngredientId == recipeItem.IngredientId && !s.IsDeleted);
                    if (stock != null) stock.CurrentStock -= recipeItem.Quantity * item.Quantity;
                }

                var subtotal = product.Price * item.Quantity;
                total += subtotal;
                order.OrderItems.Add(new OrderItem
                {
                    ProductId = product.Id,
                    Quantity = item.Quantity,
                    UnitPrice = product.Price,
                    Observation = item.Observation ?? string.Empty,
                    Discount = 0,
                    IsDeleted = false
                });
            }

            order.TotalAmount = total;
            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            _context.OrderStatusHistories.Add(new OrderStatusHistory
            {
                OrderId = order.Id,
                Status = OrderStatus.Pending,
                ChangeDate = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            await _hubContext.Clients.Group("Kitchen").SendAsync("ReceiveNewOrder", order.Id);

            var trackingUrl = BuildFrontendUrl($"/track.html?code={Uri.EscapeDataString(order.TrackingNumber.ToString())}");
            return Ok(new
            {
                message = "Pedido recibido.",
                orderId = order.Id,
                tracking = order.TrackingNumber,
                trackingUrl,
                total = order.TotalAmount
            });
        }

        private async Task<Branch?> FindTenant(string slug)
        {
            var normalized = slug.Trim().ToLowerInvariant();
            return await _context.Branches
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(b => !b.IsDeleted && b.Slug == normalized);
        }

        private static bool CanReceiveOrders(Branch branch)
        {
            return branch.PublicOrderingEnabled &&
                branch.MembershipStatus is MembershipStatus.Active or MembershipStatus.Trial;
        }

        private static string OnlyDigits(string? value)
        {
            return new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
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
    }
}
