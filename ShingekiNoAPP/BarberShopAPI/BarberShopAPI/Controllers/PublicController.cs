using Business.BusinessEntities;
using Datos.EF;
using DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ShingekiNoAPPI.Hubs;
using ShingekiNoAPPI.Services.Email;
using ShingekiNoAPPI.Services.Security;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using WebAPI;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/public")]
    [ApiController]
    [AllowAnonymous]
    public sealed class PublicController : ControllerBase
    {
        private readonly ShingekiContext _context;
        private readonly IHubContext<DeliveryHub> _hubContext;
        private readonly IEmailSender _emailSender;
        private readonly ICustomerRateLimitService _rateLimit;

        public PublicController(
            ShingekiContext context,
            IHubContext<DeliveryHub> hubContext,
            IEmailSender emailSender,
            ICustomerRateLimitService rateLimit)
        {
            _context = context;
            _hubContext = hubContext;
            _emailSender = emailSender;
            _rateLimit = rateLimit;
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
                Slug = GetPublicHandle(branch),
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

        [HttpPost("tenants/{slug}/customers/register")]
        public async Task<IActionResult> RegisterCustomer(string slug, [FromBody] CustomerRegisterDto dto)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");
            if (!CanReceiveOrders(branch)) return StatusCode(423, "Este restaurante no esta recibiendo registros online.");

            var ip = GetClientIp();
            if (!AllowRate($"register:ip:{ip}", 6, TimeSpan.FromHours(1)) ||
                !AllowRate($"register:tenant:{branch.Id}:ip:{ip}", 3, TimeSpan.FromMinutes(10)))
            {
                return StatusCode(429, "Demasiados registros desde esta conexion. Proba mas tarde.");
            }

            var email = NormalizeEmail(dto.Email);
            var phone = NormalizePhoneNumber(dto.Phone);
            var validationError = ValidateCustomerAccount(dto.Name, email, phone, dto.Password);
            if (validationError != null) return BadRequest(validationError);

            var existingByEmail = await _context.Clients
                .FirstOrDefaultAsync(c => c.BranchId == branch.Id && c.Email == email && !c.IsDeleted);
            if (existingByEmail != null)
            {
                return Conflict("Ya existe una cuenta para este email en este restaurante.");
            }

            var client = await _context.Clients
                .FirstOrDefaultAsync(c => c.BranchId == branch.Id && c.Phone == phone && !c.IsDeleted);

            if (client != null && !string.IsNullOrWhiteSpace(client.Email))
            {
                return Conflict("Ya existe una cuenta para este telefono en este restaurante.");
            }

            client ??= new Client
            {
                BranchId = branch.Id,
                IsDeleted = false
            };

            client.Name = dto.Name.Trim();
            client.LastName = string.IsNullOrWhiteSpace(dto.LastName) ? "-" : dto.LastName.Trim();
            client.Phone = phone;
            client.Email = email;
            client.PasswordHash = HashPassword(dto.Password);
            client.IsEmailVerified = false;
            SetVerificationCode(client, email, branch.Id, out var code);

            if (client.Id == 0) _context.Clients.Add(client);
            await _context.SaveChangesAsync();
            var emailError = await TrySendVerificationEmail(email, client.Name, code, branch);
            if (emailError != null) return emailError;

            return Ok(new
            {
                requiresVerification = true,
                email,
                message = "Te enviamos un codigo por email. Vence en 1 minuto."
            });
        }

        [HttpPost("tenants/{slug}/customers/login")]
        public async Task<IActionResult> LoginCustomer(string slug, [FromBody] CustomerLoginDto dto)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");

            var ip = GetClientIp();
            if (!AllowRate($"login:ip:{ip}", 20, TimeSpan.FromMinutes(10)))
            {
                return StatusCode(429, "Demasiados intentos. Proba mas tarde.");
            }

            var email = NormalizeEmail(dto.Email);
            var client = await _context.Clients
                .FirstOrDefaultAsync(c => c.BranchId == branch.Id && c.Email == email && !c.IsDeleted);

            if (client == null || string.IsNullOrWhiteSpace(client.PasswordHash) || !VerifyPassword(dto.Password, client.PasswordHash))
            {
                return Unauthorized("Email o contrasena incorrectos.");
            }

            if (!client.IsEmailVerified)
            {
                if (CanResendCode(client))
                {
                    SetVerificationCode(client, email, branch.Id, out var code);
                    await _context.SaveChangesAsync();
                    var emailError = await TrySendVerificationEmail(email, client.Name, code, branch);
                    if (emailError != null) return emailError;
                }

                return Ok(new
                {
                    requiresVerification = true,
                    email,
                    message = "Necesitamos confirmar tu email. Te enviamos un codigo nuevo."
                });
            }

            client.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(BuildCustomerSession(client, branch));
        }

        [HttpPost("tenants/{slug}/customers/verify")]
        public async Task<IActionResult> VerifyCustomerEmail(string slug, [FromBody] CustomerVerifyEmailDto dto)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");

            var ip = GetClientIp();
            var email = NormalizeEmail(dto.Email);
            if (!AllowRate($"verify:ip:{ip}", 15, TimeSpan.FromMinutes(10)) ||
                !AllowRate($"verify:email:{branch.Id}:{email}", 8, TimeSpan.FromMinutes(10)))
            {
                return StatusCode(429, "Demasiados intentos. Reenvia el codigo o proba mas tarde.");
            }

            var client = await _context.Clients
                .FirstOrDefaultAsync(c => c.BranchId == branch.Id && c.Email == email && !c.IsDeleted);
            if (client == null) return NotFound("Cuenta no encontrada.");
            if (client.IsEmailVerified) return Ok(BuildCustomerSession(client, branch));
            if (client.EmailVerificationCodeExpiresAt < DateTime.UtcNow) return BadRequest("El codigo vencio. Pedi uno nuevo.");
            if (client.EmailVerificationFailedAttempts >= 5) return StatusCode(429, "Demasiados intentos para este codigo. Reenvialo.");

            var expectedHash = HashVerificationCode(dto.Code, email, branch.Id);
            if (!SlowEquals(expectedHash, client.EmailVerificationCodeHash ?? string.Empty))
            {
                client.EmailVerificationFailedAttempts += 1;
                await _context.SaveChangesAsync();
                return BadRequest("Codigo incorrecto.");
            }

            client.IsEmailVerified = true;
            client.EmailVerificationCodeHash = null;
            client.EmailVerificationCodeExpiresAt = null;
            client.EmailVerificationFailedAttempts = 0;
            client.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(BuildCustomerSession(client, branch));
        }

        [HttpPost("tenants/{slug}/customers/resend-code")]
        public async Task<IActionResult> ResendCustomerCode(string slug, [FromBody] CustomerResendCodeDto dto)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");

            var ip = GetClientIp();
            var email = NormalizeEmail(dto.Email);
            if (!AllowRate($"resend:ip:{ip}", 8, TimeSpan.FromMinutes(10)) ||
                !AllowRate($"resend:email:{branch.Id}:{email}", 3, TimeSpan.FromMinutes(5)))
            {
                return StatusCode(429, "Demasiados reenvios. Espera unos minutos.");
            }

            var client = await _context.Clients
                .FirstOrDefaultAsync(c => c.BranchId == branch.Id && c.Email == email && !c.IsDeleted);
            if (client == null || client.IsEmailVerified)
            {
                return Ok(new { message = "Si la cuenta existe y falta verificarla, te enviaremos un codigo." });
            }

            if (!CanResendCode(client))
            {
                return StatusCode(429, "Espera unos segundos antes de pedir otro codigo.");
            }

            SetVerificationCode(client, email, branch.Id, out var code);
            await _context.SaveChangesAsync();
            var emailError = await TrySendVerificationEmail(email, client.Name, code, branch);
            if (emailError != null) return emailError;

            return Ok(new { message = "Codigo reenviado. Vence en 1 minuto." });
        }

        [HttpGet("tenants/{slug}/customers/me")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> GetCustomerProfile(string slug)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");
            var client = await GetAuthenticatedCustomer(branch.Id);
            if (client == null) return Unauthorized();

            return Ok(await BuildCustomerProfile(client, branch));
        }

        [HttpGet("tenants/{slug}/customers/me/orders")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> GetCustomerOrders(string slug)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");
            var client = await GetAuthenticatedCustomer(branch.Id);
            if (client == null) return Unauthorized();

            var orders = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(i => i.Product)
                .Where(o => o.BranchId == branch.Id && o.ClientId == client.Id && !o.IsDeleted)
                .OrderByDescending(o => o.OrderDate)
                .Take(50)
                .ToListAsync();

            return Ok(orders.Select(MapCustomerOrder));
        }

        [HttpGet("tenants/{slug}/customers/me/addresses")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> GetCustomerAddresses(string slug)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");
            var client = await GetAuthenticatedCustomer(branch.Id);
            if (client == null) return Unauthorized();

            var addresses = await _context.ClientAddresses
                .Where(a => a.ClientId == client.Id && !a.IsDeleted)
                .OrderByDescending(a => a.Id)
                .Select(a => new CustomerAddressDto
                {
                    Id = a.Id,
                    Street = a.Street,
                    City = a.City,
                    Region = a.Region,
                    PostalCode = a.PostalCode,
                    Country = a.Country,
                    Label = a.Label
                })
                .ToListAsync();

            return Ok(addresses);
        }

        [HttpPut("tenants/{slug}/customers/me")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> UpdateCustomerProfile(string slug, [FromBody] CustomerProfileUpdateDto dto)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");
            var client = await GetAuthenticatedCustomer(branch.Id);
            if (client == null) return Unauthorized();

            var phone = NormalizePhoneNumber(dto.Phone);
            if (string.IsNullOrWhiteSpace(dto.Name) || phone <= 0) return BadRequest("Nombre y telefono valido son obligatorios.");

            var phoneTaken = await _context.Clients
                .AnyAsync(c => c.BranchId == branch.Id && c.Phone == phone && c.Id != client.Id && !c.IsDeleted);
            if (phoneTaken) return Conflict("Ese telefono ya esta asociado a otra cuenta de este restaurante.");

            client.Name = dto.Name.Trim();
            client.LastName = string.IsNullOrWhiteSpace(dto.LastName) ? "-" : dto.LastName.Trim();
            client.Phone = phone;
            await _context.SaveChangesAsync();

            return Ok(await BuildCustomerProfile(client, branch));
        }

        [HttpPost("tenants/{slug}/customers/me/change-password")]
        [Authorize(Roles = "Customer")]
        public async Task<IActionResult> ChangeCustomerPassword(string slug, [FromBody] CustomerChangePasswordDto dto)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");
            var client = await GetAuthenticatedCustomer(branch.Id);
            if (client == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(client.PasswordHash) || !VerifyPassword(dto.CurrentPassword, client.PasswordHash))
            {
                return BadRequest("La contrasena actual no es correcta.");
            }

            if (!IsStrongPassword(dto.NewPassword))
            {
                return BadRequest("La nueva contrasena debe tener al menos 8 caracteres.");
            }

            client.PasswordHash = HashPassword(dto.NewPassword);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Contrasena actualizada." });
        }

        [HttpPost("tenants/{slug}/orders")]
        public async Task<IActionResult> CreateOrder(string slug, [FromBody] PublicOrderCreateDto dto)
        {
            var branch = await FindTenant(slug);
            if (branch == null) return NotFound("Restaurante no encontrado.");
            if (!CanReceiveOrders(branch)) return StatusCode(423, "Este restaurante no esta recibiendo pedidos online.");
            if (dto.Items == null || !dto.Items.Any()) return BadRequest("El pedido debe tener al menos un item.");

            var client = await GetAuthenticatedCustomer(branch.Id);
            if (client == null)
            {
                return Unauthorized("Para confirmar el pedido necesitas iniciar sesion o crear una cuenta.");
            }

            ClientAddress? address = null;
            if (dto.ClientAddressId.HasValue && dto.ClientAddressId.Value > 0)
            {
                address = await _context.ClientAddresses
                    .FirstOrDefaultAsync(a => a.Id == dto.ClientAddressId.Value && a.ClientId == client.Id && !a.IsDeleted);
                if (address == null) return BadRequest("La direccion seleccionada no esta disponible.");
            }
            else
            {
                if (string.IsNullOrWhiteSpace(dto.Street))
                {
                    return BadRequest("La direccion de entrega es obligatoria.");
                }

                address = new ClientAddress
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
            }

            var order = new Order
            {
                ClientId = client.Id,
                ClientAddressId = address.Id,
                BranchId = branch.Id,
                Note = dto.Note,
                OrderDate = GetBusinessNow(),
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
                ChangeDate = GetBusinessNow()
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

        private async Task<Client?> GetAuthenticatedCustomer(long branchId)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (!string.Equals(role, "Customer", StringComparison.OrdinalIgnoreCase)) return null;

            var idValue = User.FindFirstValue("CustomerId") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            var branchValue = User.FindFirstValue("BranchId");
            if (!long.TryParse(idValue, out var clientId) || !long.TryParse(branchValue, out var tokenBranchId)) return null;
            if (tokenBranchId != branchId) return null;

            return await _context.Clients.FirstOrDefaultAsync(c => c.Id == clientId && c.BranchId == branchId && !c.IsDeleted);
        }

        private async Task<IActionResult?> TrySendVerificationEmail(string email, string name, string code, Branch branch)
        {
            try
            {
                await _emailSender.SendVerificationCodeAsync(email, name, code, branch.BrandName ?? branch.Name);
                return null;
            }
            catch (Exception)
            {
                return StatusCode(502, "No pudimos enviar el email de verificacion. Si usas Gmail, configura una contrasena de aplicacion y volve a intentar.");
            }
        }

        private async Task<CustomerProfileDto> BuildCustomerProfile(Client client, Branch branch)
        {
            var currentOrder = await _context.Orders
                .Include(o => o.OrderItems)
                .ThenInclude(i => i.Product)
                .Where(o => o.BranchId == branch.Id &&
                    o.ClientId == client.Id &&
                    o.CurrentStatus != OrderStatus.Delivered &&
                    o.CurrentStatus != OrderStatus.Cancelled &&
                    !o.IsDeleted)
                .OrderByDescending(o => o.OrderDate)
                .FirstOrDefaultAsync();

            return new CustomerProfileDto
            {
                Id = client.Id,
                Name = client.Name,
                LastName = client.LastName,
                Email = client.Email ?? string.Empty,
                Phone = client.Phone,
                IsEmailVerified = client.IsEmailVerified,
                BranchId = branch.Id,
                TenantSlug = GetPublicHandle(branch),
                BrandName = branch.BrandName ?? branch.Name,
                PublicOrderingUrl = $"/order.html?negocio={Uri.EscapeDataString(GetPublicHandle(branch))}",
                CurrentOrder = currentOrder == null ? null : MapCustomerOrder(currentOrder)
            };
        }

        private CustomerSessionDto BuildCustomerSession(Client client, Branch branch)
        {
            return new CustomerSessionDto
            {
                Token = ManejadorJWT.GenerarTokenCliente(client, branch),
                Customer = new CustomerProfileDto
                {
                    Id = client.Id,
                    Name = client.Name,
                    LastName = client.LastName,
                    Email = client.Email ?? string.Empty,
                    Phone = client.Phone,
                    IsEmailVerified = client.IsEmailVerified,
                    BranchId = branch.Id,
                    TenantSlug = GetPublicHandle(branch),
                    BrandName = branch.BrandName ?? branch.Name,
                    PublicOrderingUrl = $"/order.html?negocio={Uri.EscapeDataString(GetPublicHandle(branch))}"
                }
            };
        }

        private CustomerOrderSummaryDto MapCustomerOrder(Order order)
        {
            return new CustomerOrderSummaryDto
            {
                Id = order.Id,
                OrderDate = order.OrderDate,
                Status = order.CurrentStatus.ToString(),
                PaymentMethod = order.PaymentMethod.ToString(),
                TotalAmount = order.TotalAmount,
                TrackingNumber = order.TrackingNumber.ToString(),
                TrackingUrl = BuildFrontendUrl($"/track.html?code={Uri.EscapeDataString(order.TrackingNumber.ToString())}"),
                Items = (order.OrderItems ?? new List<OrderItem>()).Select(i => new OrderItemResponseDto
                {
                    ProductName = i.Product?.Name ?? "Producto",
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    Subtotal = i.UnitPrice * i.Quantity,
                    Observation = i.Observation ?? string.Empty,
                    Discount = i.Discount
                }).ToList()
            };
        }

        private async Task<Branch?> FindTenant(string slug)
        {
            var normalized = NormalizePublicHandle(slug);
            var branch = await _context.Branches
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(b => !b.IsDeleted && b.Slug == normalized);

            if (branch != null) return branch;

            var branches = await _context.Branches
                .IgnoreQueryFilters()
                .Where(b => !b.IsDeleted)
                .ToListAsync();

            return branches.FirstOrDefault(b => GetPublicHandle(b) == normalized);
        }

        private static bool CanReceiveOrders(Branch branch)
        {
            return branch.PublicOrderingEnabled &&
                branch.MembershipStatus is MembershipStatus.Active or MembershipStatus.Trial;
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
            return string.IsNullOrWhiteSpace(slug) ? "negocio" : slug;
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

        private static string OnlyDigits(string? value)
        {
            return new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
        }

        private static string NormalizeEmail(string? value)
        {
            return (value ?? string.Empty).Trim().ToLowerInvariant();
        }

        private static int NormalizePhoneNumber(string? value)
        {
            var digits = OnlyDigits(value);
            if (digits.StartsWith("598") && digits.Length > 8)
            {
                digits = digits[3..];
            }

            if (digits.Length > 9)
            {
                digits = digits[^9..];
            }

            return int.TryParse(digits, out var parsedPhone) ? parsedPhone : 0;
        }

        private static string? ValidateCustomerAccount(string? name, string email, int phone, string? password)
        {
            if (string.IsNullOrWhiteSpace(name)) return "El nombre es obligatorio.";
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@') || email.Length > 256) return "Email invalido.";
            if (phone <= 0) return "Telefono invalido.";
            if (!IsStrongPassword(password)) return "La contrasena debe tener al menos 8 caracteres.";
            return null;
        }

        private static bool IsStrongPassword(string? password)
        {
            return !string.IsNullOrWhiteSpace(password) && password.Length >= 8;
        }

        private bool AllowRate(string key, int limit, TimeSpan window)
        {
            return _rateLimit.IsAllowed(key, limit, window);
        }

        private string GetClientIp()
        {
            var forwarded = Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(forwarded))
            {
                return forwarded.Split(',')[0].Trim();
            }

            return HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        }

        private static bool CanResendCode(Client client)
        {
            return client.EmailVerificationLastSentAt == null ||
                client.EmailVerificationLastSentAt.Value.AddSeconds(20) <= DateTime.UtcNow;
        }

        private static void SetVerificationCode(Client client, string email, long branchId, out string code)
        {
            code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            client.EmailVerificationCodeHash = HashVerificationCode(code, email, branchId);
            client.EmailVerificationCodeExpiresAt = DateTime.UtcNow.AddMinutes(1);
            client.EmailVerificationLastSentAt = DateTime.UtcNow;
            client.EmailVerificationFailedAttempts = 0;
        }

        private static string HashVerificationCode(string code, string email, long branchId)
        {
            var raw = $"{OnlyDigits(code)}|{email}|{branchId}";
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            return Convert.ToHexString(bytes);
        }

        private static string HashPassword(string password)
        {
            var salt = RandomNumberGenerator.GetBytes(16);
            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, 120000, HashAlgorithmName.SHA256);
            var hash = pbkdf2.GetBytes(32);
            return $"PBKDF2$120000${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
        }

        private static bool VerifyPassword(string password, string storedHash)
        {
            var parts = storedHash.Split('$');
            if (parts.Length != 4 || parts[0] != "PBKDF2") return false;
            if (!int.TryParse(parts[1], out var iterations)) return false;

            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
            var actual = pbkdf2.GetBytes(expected.Length);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }

        private static bool SlowEquals(string a, string b)
        {
            var aBytes = Encoding.UTF8.GetBytes(a);
            var bBytes = Encoding.UTF8.GetBytes(b);
            return aBytes.Length == bBytes.Length && CryptographicOperations.FixedTimeEquals(aBytes, bBytes);
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
