using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Business.BusinessEntities;
using Datos.EF;
using DTO;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CashRegisterController : ControllerBase
    {
        private readonly ShingekiContext _context;

        public CashRegisterController(ShingekiContext context)
        {
            _context = context;
        }

        // =================================================================
        // 1. OBTENER ESTADO ACTUAL (Para la vista en tiempo real)
        // =================================================================
        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var currentSession = await _context.CashSessions
                .Where(c => !c.IsClosed)
                .OrderByDescending(c => c.Id)
                .FirstOrDefaultAsync();

            if (currentSession == null) return Ok(new { isOpen = false });

            // 1. Movimientos
            var movements = await _context.CashMovements
                .Where(m => m.CashSessionId == currentSession.Id)
                .Select(m => new { m.Description, m.Amount, m.Type, Time = m.MovementDate })
                .ToListAsync();

            // 2. Pedidos: LÓGICA HÍBRIDA
            var sessionOrders = await _context.Orders
                .Include(o => o.Client)
                .Where(o => o.OrderDate >= currentSession.OpenTime &&
                            o.CurrentStatus != OrderStatus.Cancelled && // Nunca sumar cancelados
                            (
                                // A) Si es EFECTIVO: Solo sumar si ya se entregó
                                (o.PaymentMethod == PaymentMethod.Cash && o.CurrentStatus == OrderStatus.Delivered)
                                ||
                                // B) Si es DIGITAL (MP/Transfer): Sumar desde que se CONFIRMA (cualquier estado menos Pendiente)
                                ((o.PaymentMethod == PaymentMethod.MercadoPago || o.PaymentMethod == PaymentMethod.Transfer)
                                  && o.CurrentStatus != OrderStatus.Pending)
                            ))
                .Select(o => new
                {
                    ClientName = o.Client != null ? o.Client.Name + " " + o.Client.LastName : "Cliente Casual",
                    o.TotalAmount,
                    o.PaymentMethod
                })
                .ToListAsync();

            return Ok(new
            {
                isOpen = true,
                openTime = currentSession.OpenTime,
                initialBalance = currentSession.InitialBalance,
                sessionId = currentSession.Id,
                movements = movements,
                orders = sessionOrders
            });
        }

        // POST: api/CashRegister/open
        [HttpPost("open")]
        public async Task<IActionResult> OpenRegister([FromBody] CashSessionOpenRequest request)
        {
            if (await _context.CashSessions.AnyAsync(c => !c.IsClosed))
                return BadRequest("Ya hay una caja abierta.");

            var session = new CashSession
            {
                OpenTime = request.OpenTime,
                OperationalDate = request.OperationalDate,
                InitialBalance = request.InitialBalance,
                IsClosed = false,
                Notes = ""
            };

            _context.CashSessions.Add(session);
            await _context.SaveChangesAsync();

            return Ok(session);
        }

        // =================================================================
        // 2. CERRAR CAJA (Cálculo Final)
        // =================================================================
        // POST: api/CashRegister/close
        [HttpPost("close")]
        public async Task<IActionResult> CloseRegister([FromBody] CashSessionCloseRequest request)
        {
            var session = await _context.CashSessions
                .Where(c => !c.IsClosed)
                .OrderByDescending(c => c.Id)
                .FirstOrDefaultAsync();

            if (session == null) return BadRequest("No hay caja abierta.");

            // =========================================================================
            // CORRECCIÓN MATEMÁTICA: 
            // Para el arqueo físico, SOLO sumamos lo que sea EFECTIVO y esté ENTREGADO.
            // Ignoramos MercadoPago y Transferencias porque esa plata no está en el cajón.
            // =========================================================================

            var cashSales = await _context.Orders
                .Where(o => o.OrderDate >= session.OpenTime &&
                            o.CurrentStatus == OrderStatus.Delivered && // Solo entregados
                            o.PaymentMethod == PaymentMethod.Cash)      // SOLO EFECTIVO
                .SumAsync(o => o.TotalAmount);

            // 2. Movimientos de Caja (Entradas/Salidas manuales de efectivo)
            var movementsIn = await _context.CashMovements
                .Where(m => m.CashSessionId == session.Id && m.Type == "IN")
                .SumAsync(m => m.Amount);

            var movementsOut = await _context.CashMovements
                .Where(m => m.CashSessionId == session.Id && m.Type == "OUT")
                .SumAsync(m => m.Amount);

            // 3. Cálculo de lo que DEBERÍA haber en el cajón
            decimal expected = session.InitialBalance + cashSales + movementsIn - movementsOut;

            // 4. Guardar cierre
            session.CloseTime = request.CloseTime;
            session.FinalBalance = request.FinalBalance; // Lo que tú contaste
            session.ExpectedBalance = expected;          // Lo que el sistema calculó (solo cash)
            session.Difference = request.FinalBalance - expected; // Diferencia real
            session.Notes = request.Notes;
            session.IsClosed = true;

            await _context.SaveChangesAsync();
            return Ok(session);
        }

        // POST: api/CashRegister/movement
        [HttpPost("movement")]
        public async Task<IActionResult> AddMovement([FromBody] CashMovementRequest request)
        {
            var session = await _context.CashSessions
                .Where(c => !c.IsClosed)
                .OrderByDescending(c => c.Id)
                .FirstOrDefaultAsync();

            if (session == null) return BadRequest("No hay caja abierta.");

            var movement = new CashMovement
            {
                CashSession = session,
                CashSessionId = (int)session.Id,
                Type = request.Type,
                Amount = request.Amount,
                Description = request.Description,
                MovementDate = DateTime.Now
            };

            _context.CashMovements.Add(movement);
            await _context.SaveChangesAsync();

            return Ok(movement);
        }

        // GET: api/CashRegister/history
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory()
        {
            var history = await _context.CashSessions
                .Where(c => c.IsClosed)
                .OrderByDescending(c => c.CloseTime)
                .Take(30)
                .Select(c => new
                {
                    c.Id,
                    c.OpenTime,
                    c.CloseTime,
                    c.FinalBalance,
                    c.Difference,
                    User = "Admin"
                })
                .ToListAsync();

            return Ok(history);
        }

        // =================================================================
        // 3. DETALLE DE SESIÓN PASADA (Historial)
        // =================================================================
        [HttpGet("session/{id}")]
        public async Task<IActionResult> GetSessionDetail(long id)
        {
            var session = await _context.CashSessions.FindAsync(id);
            if (session == null) return NotFound("Sesión no encontrada");

            var movements = await _context.CashMovements
                .Where(m => m.CashSessionId == session.Id)
                .Select(m => new { m.Description, m.Amount, m.Type, Time = m.MovementDate })
                .ToListAsync();

            var endTime = session.CloseTime ?? DateTime.Now;

            // Misma lógica híbrida para ver el historial tal cual fue calculado
            var sessionOrders = await _context.Orders
                .Include(o => o.Client)
                .Where(o => o.OrderDate >= session.OpenTime &&
                            o.OrderDate <= endTime &&
                            o.CurrentStatus != OrderStatus.Cancelled &&
                            (
                                (o.PaymentMethod == PaymentMethod.Cash && o.CurrentStatus == OrderStatus.Delivered)
                                ||
                                ((o.PaymentMethod == PaymentMethod.MercadoPago || o.PaymentMethod == PaymentMethod.Transfer)
                                  && o.CurrentStatus != OrderStatus.Pending)
                            ))
                .Select(o => new
                {
                    ClientName = o.Client != null ? o.Client.Name + " " + o.Client.LastName : "Cliente Casual",
                    o.TotalAmount,
                    o.PaymentMethod
                })
                .ToListAsync();

            return Ok(new
            {
                isOpen = false,
                isHistory = true,
                openTime = session.OpenTime,
                closeTime = session.CloseTime,
                initialBalance = session.InitialBalance,
                sessionId = session.Id,
                notes = session.Notes,
                movements = movements,
                orders = sessionOrders
            });
        }
    }
}