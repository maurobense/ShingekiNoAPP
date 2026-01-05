using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DTO;
using System;
using System.Collections.Generic;
using System.Linq;
using Business.RepositoryInterfaces;
using Business.BusinessEntities;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/reports")]
    [ApiController]
    public class ReportsController : ControllerBase
    {
        private readonly IRepositoryOrder _repoOrder;
        private readonly IRepositoryBranchStock _repoStock;

        public ReportsController(IRepositoryOrder repoOrder, IRepositoryBranchStock repoStock)
        {
            _repoOrder = repoOrder;
            _repoStock = repoStock;
        }

        [HttpGet("dashboard")]
        public IActionResult GetDashboardStats([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                // =================================================================================
                // 🕒 CONFIGURACIÓN DE HORARIOS
                // =================================================================================
                int closingHour = 2;   // Cierre a las 02:00 AM
                int openingHour = 18;  // Apertura a las 18:00 PM

                var nowUy = DateTime.UtcNow.AddHours(-3);

                // 1. DEFINIR RANGO DE FECHAS
                DateTime filterStartUtc, filterEndUtc;

                if (!startDate.HasValue || !endDate.HasValue)
                {
                    // "Hoy Operativo"
                    var operationalDate = nowUy.Hour < closingHour ? nowUy.Date.AddDays(-1) : nowUy.Date;

                    var startUy = operationalDate.AddHours(closingHour);
                    var endUy = startUy.AddDays(1);

                    filterStartUtc = startUy.AddHours(3);
                    filterEndUtc = endUy.AddHours(3);
                }
                else
                {
                    var startUy = startDate.Value.Date.AddHours(closingHour);
                    var endUy = endDate.Value.Date.AddDays(1).AddHours(closingHour);

                    filterStartUtc = startUy.AddHours(3);
                    filterEndUtc = endUy.AddHours(3);
                }

                // =================================================================================
                // 2. OBTENCIÓN DE DATOS (Incluyendo OrderStatusHistories)
                // =================================================================================
                var rawOrders = _repoOrder.GetAll()
                    .Where(o => o.CurrentStatus != OrderStatus.Cancelled &&
                                o.OrderDate >= filterStartUtc &&
                                o.OrderDate <= filterEndUtc)
                    .Include(o => o.OrderItems)
                        .ThenInclude(oi => oi.Product)
                    // 🔥 CORRECCIÓN AQUÍ: Usamos el nombre correcto de la relación
                    .Include(o => o.StatusHistory)
                    .ToList();

                // --- KPIs ---
                var totalRevenue = rawOrders.Sum(o => o.TotalAmount);
                var totalCount = rawOrders.Count;
                var avgTicket = totalCount > 0 ? totalRevenue / totalCount : 0;
                var pendingCount = _repoOrder.GetAll()
                    .Count(o => o.CurrentStatus == OrderStatus.Pending ||
                                o.CurrentStatus == OrderStatus.Confirmed ||
                                o.CurrentStatus == OrderStatus.Cooking);

                // =============================================================================
                // 🔥 CÁLCULO TIEMPO PROMEDIO (Usando OrderStatusHistories)
                // =============================================================================
                var deliveryTimes = new List<double>();

                foreach (var order in rawOrders.Where(o => o.CurrentStatus == OrderStatus.Delivered))
                {
                    // Accedemos a la tabla correcta
                    var history = order.StatusHistory;

                    if (history != null && history.Any())
                    {
                        // Buscamos cuándo se confirmó (Inicio)
                        // Ajusta 'ChangeDate' si tu propiedad se llama 'Date', 'CreatedAt', etc.
                        var confirmedTime = history
                            .Where(h => h.Status == OrderStatus.Confirmed)
                            .OrderBy(h => h.ChangeDate)
                            .Select(h => (DateTime?)h.ChangeDate)
                            .FirstOrDefault();

                        // Buscamos cuándo se entregó (Fin)
                        var deliveredTime = history
                            .Where(h => h.Status == OrderStatus.Delivered)
                            .OrderBy(h => h.ChangeDate)
                            .Select(h => (DateTime?)h.ChangeDate)
                            .FirstOrDefault();

                        // Calculamos diferencia
                        if (confirmedTime.HasValue && deliveredTime.HasValue)
                        {
                            var minutes = (deliveredTime.Value - confirmedTime.Value).TotalMinutes;
                            // Filtro de seguridad: entre 1 min y 5 horas (para evitar datos corruptos)
                            if (minutes > 0 && minutes < 300)
                            {
                                deliveryTimes.Add(minutes);
                            }
                        }
                    }
                }

                string avgDeliveryText = deliveryTimes.Any()
                    ? $"{Math.Round(deliveryTimes.Average())} min"
                    : "-";

                // --- GRÁFICO 1: EVOLUCIÓN VENTAS ---
                List<ChartDataDto> salesChart;
                var daysDiff = (filterEndUtc - filterStartUtc).TotalDays;

                if (daysDiff <= 2)
                {
                    salesChart = rawOrders
                        .Select(o => new { Hour = o.OrderDate.AddHours(-3).Hour, Amount = o.TotalAmount })
                        .Where(x => x.Hour >= openingHour || x.Hour < closingHour)
                        .GroupBy(x => x.Hour)
                        .Select(g => new {
                            Hour = g.Key,
                            Total = g.Sum(x => x.Amount),
                            SortKey = g.Key < closingHour ? g.Key + 24 : g.Key
                        })
                        .OrderBy(x => x.SortKey)
                        .Select(x => new ChartDataDto { Label = $"{x.Hour}:00", Value = x.Total })
                        .ToList();
                }
                else
                {
                    salesChart = rawOrders
                        .Select(o => new {
                            OpDate = o.OrderDate.AddHours(-3).AddHours(-closingHour).Date,
                            Amount = o.TotalAmount
                        })
                        .GroupBy(x => x.OpDate)
                        .Select(g => new ChartDataDto { Label = g.Key.ToString("dd/MM"), Value = g.Sum(x => x.Amount) })
                        .OrderBy(x => DateTime.ParseExact(x.Label, "dd/MM", null))
                        .ToList();
                }

                // --- GRÁFICO 2: HORAS PICO (Realista) ---
                var cutOffDate = new DateTime(2025, 12, 17, 0, 0, 0, DateTimeKind.Utc);
                var historyDates = _repoOrder.GetAll()
                    .Where(o => o.OrderDate >= cutOffDate && o.CurrentStatus != OrderStatus.Cancelled)
                    .Select(o => o.OrderDate)
                    .ToList();

                var validHistoryOrders = historyDates
                    .Select(d => d.AddHours(-3))
                    .Where(d => d.Hour >= openingHour || d.Hour < closingHour)
                    .ToList();

                decimal activeDays = validHistoryOrders
                    .Select(d => d.AddHours(-closingHour).Date)
                    .Distinct()
                    .Count();

                if (activeDays < 1) activeDays = 1;

                var peakHours = validHistoryOrders
                    .GroupBy(d => d.Hour)
                    .Select(g => new {
                        Hour = g.Key,
                        AvgOrders = Math.Round((decimal)g.Count() / activeDays, 1),
                        SortKey = g.Key < closingHour ? g.Key + 24 : g.Key
                    })
                    .OrderBy(x => x.SortKey)
                    .Select(g => new ChartDataDto { Label = $"{g.Hour}:00", Value = g.AvgOrders })
                    .ToList();

                // --- TOP PRODUCTOS ---
                var topProducts = rawOrders
                     .SelectMany(o => o.OrderItems)
                     .GroupBy(i => i.Product.Name)
                     .Select(g => new ChartDataDto
                     {
                         Label = g.Key,
                         Value = g.Sum(i => i.Quantity)
                     })
                     .OrderByDescending(x => x.Value)
                     .Take(5)
                     .ToList();

                var lowStockCount = _repoStock.GetAll().Count(s => s.CurrentStock <= s.MinimumStockAlert);

                // --- RESPUESTA ---
                var response = new DashboardFullDto
                {
                    TodayRevenue = totalRevenue,
                    TodayOrdersCount = totalCount,
                    AverageTicket = Math.Round(avgTicket, 2),
                    PendingOrders = pendingCount,
                    AverageDeliveryTime = avgDeliveryText,
                    Last7DaysSales = salesChart,
                    PeakHours = peakHours,
                    SalesByCategory = topProducts,
                    LowStockCount = lowStockCount
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                var inner = ex.InnerException != null ? ex.InnerException.Message : "";
                return StatusCode(500, $"Error Dashboard: {ex.Message} {inner}");
            }
        }
    }
}