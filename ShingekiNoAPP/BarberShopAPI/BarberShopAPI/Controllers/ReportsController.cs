using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DTO;
using System;
using System.Collections.Generic;
using System.Linq;
using Business.RepositoryInterfaces;
using Business.BusinessEntities;
using Business.BusinessInterfaces;
using Datos.EF;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/reports")]
    [ApiController]
    public class ReportsController : ControllerBase
    {
        private readonly IRepositoryOrder _repoOrder;
        private readonly IRepositoryBranchStock _repoStock;
        private readonly ShingekiContext _context;
        private readonly ITenantService _tenantService;

        public ReportsController(IRepositoryOrder repoOrder, IRepositoryBranchStock repoStock, ShingekiContext context, ITenantService tenantService)
        {
            _repoOrder = repoOrder;
            _repoStock = repoStock;
            _context = context;
            _tenantService = tenantService;
        }

        [HttpGet("dashboard")]
        public IActionResult GetDashboardStats([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                // =================================================================================
                // 🕒 CONFIGURACIÓN DE HORARIOS
                // =================================================================================
                var branchConfig = GetBranchOperationalConfig();

                var nowUy = DateTime.UtcNow.AddHours(-3);

                // 1. DEFINIR RANGO DE FECHAS
                DateTime filterStartUtc, filterEndUtc;

                if (!startDate.HasValue || !endDate.HasValue)
                {
                    var operationalDate = GetOperationalDate(nowUy, branchConfig);
                    var startUy = BuildOperationalStart(operationalDate, branchConfig);
                    var endUy = BuildOperationalEnd(operationalDate, branchConfig);

                    filterStartUtc = startUy.AddHours(3);
                    filterEndUtc = endUy.AddHours(3);
                }
                else
                {
                    var startUy = BuildOperationalStart(startDate.Value.Date, branchConfig);
                    var endUy = BuildOperationalEnd(endDate.Value.Date, branchConfig);

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
                    .ToList()
                    .Where(o => IsDateInsideAnyWindow(o.OrderDate.AddHours(-3), branchConfig))
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
                        .Where(x => IsHourInsideWindow(x.Hour, branchConfig))
                        .GroupBy(x => x.Hour)
                        .Select(g => new {
                            Hour = g.Key,
                            Total = g.Sum(x => x.Amount),
                            SortKey = GetOperationalSortKey(g.Key, branchConfig)
                        })
                        .OrderBy(x => x.SortKey)
                        .Select(x => new ChartDataDto { Label = $"{x.Hour}:00", Value = x.Total })
                        .ToList();
                }
                else
                {
                    salesChart = rawOrders
                        .Select(o => new {
                            OpDate = GetOperationalDate(o.OrderDate.AddHours(-3), branchConfig),
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
                    .Where(d => IsDateInsideAnyWindow(d, branchConfig))
                    .ToList();

                decimal activeDays = validHistoryOrders
                    .Select(d => GetOperationalDate(d, branchConfig))
                    .Distinct()
                    .Count();

                if (activeDays < 1) activeDays = 1;

                var peakHours = validHistoryOrders
                    .GroupBy(d => d.Hour)
                    .Select(g => new {
                        Hour = g.Key,
                        AvgOrders = Math.Round((decimal)g.Count() / activeDays, 1),
                        SortKey = GetOperationalSortKey(g.Key, branchConfig)
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
                var paymentMix = rawOrders
                    .GroupBy(o => o.PaymentMethod)
                    .Select(g => new ChartDataDto { Label = TranslatePaymentMethod(g.Key), Value = g.Sum(o => o.TotalAmount) })
                    .OrderByDescending(x => x.Value)
                    .ToList();

                var statusMix = rawOrders
                    .GroupBy(o => o.CurrentStatus)
                    .Select(g => new ChartDataDto { Label = TranslateStatus(g.Key), Value = g.Count() })
                    .OrderByDescending(x => x.Value)
                    .ToList();

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
                    PaymentMix = paymentMix,
                    StatusMix = statusMix,
                    OperatingHoursLabel = branchConfig.Label,
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

        private OperationalConfig GetBranchOperationalConfig()
        {
            var branchId = _tenantService.GetBranchId();
            if (branchId <= 0) return OperationalConfig.Default();

            var branch = _context.Branches
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefault(b => b.Id == branchId && !b.IsDeleted);

            if (branch == null) return OperationalConfig.Default();

            return OperationalConfig.FromBranch(branch);
        }

        private static int NormalizeHour(int value, int fallback)
        {
            return value >= 0 && value <= 23 ? value : fallback;
        }

        private static DateTime BuildOperationalStart(DateTime operationalDate, OperationalConfig config)
        {
            return config.Windows
                .Select(w => operationalDate.Date.AddHours(w.OpenHour))
                .Min();
        }

        private static DateTime BuildOperationalEnd(DateTime operationalDate, OperationalConfig config)
        {
            return config.Windows
                .Select(w => BuildWindowEnd(operationalDate.Date, w))
                .Max();
        }

        private static DateTime BuildWindowEnd(DateTime operationalDate, OperationalWindow window)
        {
            return window.CloseHour <= window.OpenHour
                ? operationalDate.AddDays(1).AddHours(window.CloseHour)
                : operationalDate.AddHours(window.CloseHour);
        }

        private static bool IsDateInsideAnyWindow(DateTime localDate, OperationalConfig config)
        {
            var today = localDate.Date;
            return config.Windows.Any(w => IsInsideWindow(localDate, today, w))
                || config.Windows.Any(w => IsInsideWindow(localDate, today.AddDays(-1), w));
        }

        private static bool IsInsideWindow(DateTime localDate, DateTime operationalDate, OperationalWindow window)
        {
            var start = operationalDate.AddHours(window.OpenHour);
            var end = BuildWindowEnd(operationalDate, window);
            return localDate >= start && localDate < end;
        }

        private static bool IsHourInsideWindow(int hour, OperationalConfig config)
        {
            return config.OrderedHours.Contains(hour);
        }

        private static int GetOperationalSortKey(int hour, OperationalConfig config)
        {
            var index = config.OrderedHours.IndexOf(hour);
            return index >= 0 ? index : hour + 100;
        }

        private static DateTime GetOperationalDate(DateTime localDate, OperationalConfig config)
        {
            var today = localDate.Date;

            foreach (var window in config.Windows)
            {
                if (IsInsideWindow(localDate, today, window)) return today;
            }

            var yesterday = today.AddDays(-1);
            foreach (var window in config.Windows)
            {
                if (IsInsideWindow(localDate, yesterday, window)) return yesterday;
            }

            return today;
        }

        private static string FormatHour(int hour)
        {
            return $"{hour:00}:00";
        }

        private sealed class OperationalWindow
        {
            public string Name { get; init; } = string.Empty;
            public int OpenHour { get; init; }
            public int CloseHour { get; init; }
        }

        private sealed class OperationalConfig
        {
            public List<OperationalWindow> Windows { get; init; } = new();
            public List<int> OrderedHours { get; init; } = new();
            public string Label { get; init; } = string.Empty;

            public static OperationalConfig Default()
            {
                return Build(new List<OperationalWindow>
                {
                    new() { Name = "Dia", OpenHour = 10, CloseHour = 16 },
                    new() { Name = "Noche", OpenHour = 21, CloseHour = 2 }
                });
            }

            public static OperationalConfig FromBranch(Branch branch)
            {
                var windows = new List<OperationalWindow>();

                if (branch.DayShiftEnabled)
                {
                    windows.Add(new OperationalWindow
                    {
                        Name = "Dia",
                        OpenHour = NormalizeHour(branch.DayOpeningHour, 10),
                        CloseHour = NormalizeHour(branch.DayClosingHour, 16)
                    });
                }

                if (branch.NightShiftEnabled)
                {
                    windows.Add(new OperationalWindow
                    {
                        Name = "Noche",
                        OpenHour = NormalizeHour(branch.NightOpeningHour, 21),
                        CloseHour = NormalizeHour(branch.NightClosingHour, 2)
                    });
                }

                if (!windows.Any())
                {
                    windows.Add(new OperationalWindow
                    {
                        Name = "Turno",
                        OpenHour = NormalizeHour(branch.OpeningHour, 18),
                        CloseHour = NormalizeHour(branch.ClosingHour, 2)
                    });
                }

                return Build(windows);
            }

            private static OperationalConfig Build(List<OperationalWindow> windows)
            {
                var orderedHours = new List<int>();

                foreach (var window in windows)
                {
                    var hour = window.OpenHour;
                    var guard = 0;
                    while (guard < 24)
                    {
                        if (hour == window.CloseHour) break;
                        if (!orderedHours.Contains(hour)) orderedHours.Add(hour);
                        hour = (hour + 1) % 24;
                        guard++;
                    }
                }

                if (!orderedHours.Any()) orderedHours.AddRange(Enumerable.Range(0, 24));

                return new OperationalConfig
                {
                    Windows = windows,
                    OrderedHours = orderedHours,
                    Label = string.Join(" / ", windows.Select(w => $"{w.Name} {FormatHour(w.OpenHour)}-{FormatHour(w.CloseHour)}"))
                };
            }
        }

        private static string TranslatePaymentMethod(PaymentMethod method)
        {
            return method switch
            {
                PaymentMethod.Cash => "Efectivo",
                PaymentMethod.MercadoPago => "MercadoPago",
                PaymentMethod.Transfer => "Transferencia",
                PaymentMethod.Pos => "POS",
                _ => method.ToString()
            };
        }

        private static string TranslateStatus(OrderStatus status)
        {
            return status switch
            {
                OrderStatus.Pending => "Pendiente",
                OrderStatus.Confirmed => "Confirmado",
                OrderStatus.Cooking => "En cocina",
                OrderStatus.Ready => "Listo",
                OrderStatus.OnTheWay => "En camino",
                OrderStatus.Delivered => "Entregado",
                OrderStatus.Cancelled => "Cancelado",
                _ => status.ToString()
            };
        }
    }
}
