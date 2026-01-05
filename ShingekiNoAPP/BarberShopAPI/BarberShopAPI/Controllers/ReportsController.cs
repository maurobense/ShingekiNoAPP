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
        private readonly IRepositoryCategory _repoCategory;

        public ReportsController(IRepositoryOrder repoOrder, IRepositoryBranchStock repoStock, IRepositoryCategory repoCategory)
        {
            _repoOrder = repoOrder;
            _repoStock = repoStock;
            _repoCategory = repoCategory;
        }

        [HttpGet("dashboard")]
        public IActionResult GetDashboardStats([FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                // =================================================================================
                // 🕒 CONFIGURACIÓN DEL "DÍA OPERATIVO" (MAURO FIX)
                // =================================================================================
                // Definimos que el día del restaurante termina a las 04:00 AM de la madrugada siguiente.
                // Todo lo que pase antes de las 4 AM pertenece al "ayer".
                int closingHour = 4;

                var nowUtc = DateTime.UtcNow;
                var nowUy = nowUtc.AddHours(-3); // Hora Uruguay

                // 1. DEFINIR RANGO DE FECHAS DE LA CONSULTA
                DateTime filterStartUtc;
                DateTime filterEndUtc;

                if (!startDate.HasValue || !endDate.HasValue)
                {
                    // Si no elige fechas: Calculamos el "Hoy Operativo"
                    // Si son las 02:00 AM, el "Día Operativo" es ayer.
                    var operationalDate = nowUy.Hour < closingHour ? nowUy.Date.AddDays(-1) : nowUy.Date;

                    // El rango va desde hoy a las 04:00 AM hasta mañana a las 04:00 AM
                    var startUy = operationalDate.AddHours(closingHour);
                    var endUy = startUy.AddDays(1); // 24 horas exactas

                    filterStartUtc = startUy.AddHours(3); // Convertir a UTC para BD
                    filterEndUtc = endUy.AddHours(3);
                }
                else
                {
                    // Si elige fechas manuales (ej: 01/12 al 05/12)
                    // Queremos desde el 01/12 a las 04:00 AM hasta el 06/12 a las 04:00 AM
                    var startUy = startDate.Value.Date.AddHours(closingHour);
                    var endUy = endDate.Value.Date.AddDays(1).AddHours(closingHour);

                    filterStartUtc = startUy.AddHours(3);
                    filterEndUtc = endUy.AddHours(3);
                }

                // =================================================================================
                // 2. OBTENCIÓN DE DATOS (FILTRADO SQL)
                // =================================================================================

                // Traemos los pedidos básicos del rango en memoria para procesar la lógica compleja de horas
                // (Nota: Si tienes millones de pedidos, esto se optimiza diferente, pero para <100k está perfecto así)
                var rawOrders = _repoOrder.GetAll()
                    .Where(o => o.CurrentStatus != OrderStatus.Cancelled &&
                                o.OrderDate >= filterStartUtc &&
                                o.OrderDate <= filterEndUtc)
                    .Select(o => new
                    {
                        o.TotalAmount,
                        o.OrderDate,
                        o.CurrentStatus,
                        o.OrderItems // Necesario para categorías
                    })
                    .ToList();

                // =================================================================================
                // 3. PROCESAMIENTO EN MEMORIA (Lógica de Negocio)
                // =================================================================================

                // A. KPIs Generales
                var totalRevenue = rawOrders.Sum(o => o.TotalAmount);
                var totalCount = rawOrders.Count;
                var avgTicket = totalCount > 0 ? totalRevenue / totalCount : 0;

                // Pendientes (Buscamos en la DB general, no solo en el rango, para ver el estado actual real)
                var pendingCount = _repoOrder.GetAll()
                    .Count(o => o.CurrentStatus == OrderStatus.Pending ||
                                o.CurrentStatus == OrderStatus.Confirmed ||
                                o.CurrentStatus == OrderStatus.Cooking);

                // B. GRÁFICO 1: EVOLUCIÓN DE VENTAS (Corregido: Asignar madrugadas al día anterior)
                List<ChartDataDto> salesChart;
                var daysDiff = (filterEndUtc - filterStartUtc).TotalDays;

                if (daysDiff <= 2)
                {
                    // VISTA POR HORA (Para "Hoy" o rangos cortos)
                    salesChart = rawOrders
                        .Select(o => new {
                            // Convertimos a Hora UY
                            Hour = o.OrderDate.AddHours(-3).Hour,
                            Amount = o.TotalAmount
                        })
                        .GroupBy(x => x.Hour)
                        .Select(g => new {
                            Hour = g.Key,
                            Total = g.Sum(x => x.Amount),
                            // 🔥 TRUCO ORDENAMIENTO: Si es 0, 1, 2, 3... sumamos 24 para que queden al final
                            SortKey = g.Key < closingHour ? g.Key + 24 : g.Key
                        })
                        .OrderBy(x => x.SortKey) // Ordenamos por la clave ajustada (19, 20... 23, 24(00), 25(01))
                        .Select(x => new ChartDataDto
                        {
                            Label = $"{x.Hour}:00",
                            Value = x.Total
                        })
                        .ToList();
                }
                else
                {
                    // VISTA POR DÍA (Corregido: La venta de las 02:00 AM cuenta para ayer)
                    salesChart = rawOrders
                        .Select(o => new {
                            // 🔥 TRUCO: Restamos 4 horas (closingHour) antes de sacar la fecha.
                            // 01/12 02:00 AM - 4h = 30/11 22:00 PM -> Fecha: 30/11 (Correcto para el negocio)
                            OpDate = o.OrderDate.AddHours(-3).AddHours(-closingHour).Date,
                            Amount = o.TotalAmount
                        })
                        .GroupBy(x => x.OpDate)
                        .Select(g => new ChartDataDto
                        {
                            Label = g.Key.ToString("dd/MM"),
                            Value = g.Sum(x => x.Amount)
                        })
                        .OrderBy(x => DateTime.ParseExact(x.Label, "dd/MM", null)) // Ordenar cronológicamente
                        .ToList();
                }

                // C. GRÁFICO 2: HORAS PICO (Histórico General 60 días)
                // Aquí aplicamos la misma lógica de ordenamiento visual
                var historyStart = DateTime.UtcNow.AddDays(-60);

                // Hacemos una query ligera separada para el histórico
                var peakHoursRaw = _repoOrder.GetAll()
                    .Where(o => o.OrderDate >= historyStart && o.CurrentStatus != OrderStatus.Cancelled)
                    .Select(o => o.OrderDate)
                    .ToList();

                var peakHours = peakHoursRaw
                    .Select(d => d.AddHours(-3).Hour) // Hora Uruguay
                    .GroupBy(h => h)
                    .Select(g => new {
                        Hour = g.Key,
                        // Promedio simple: Total pedidos / 60 dias (aprox)
                        AvgOrders = Math.Round((decimal)g.Count() / 60m, 1),
                        // 🔥 MISMO TRUCO ORDENAMIENTO
                        SortKey = g.Key < closingHour ? g.Key + 24 : g.Key
                    })
                    .OrderBy(x => x.SortKey)
                    .Select(g => new ChartDataDto
                    {
                        Label = $"{g.Hour}:00",
                        Value = g.AvgOrders
                    })
                    .ToList();

                // D. TOP CATEGORÍAS (Usando los datos en memoria del rango)
                // Nota: Necesitas que tu repositorio incluya OrderItems.Product.Category o usar Lazy Loading
                // Si 'rawOrders' no trajo las relaciones, esta parte fallará. 
                // Asegúrate en el Repo de usar .Include o hacer una query separada aquí si es necesario.

                // Hacemos query separada para asegurar Categorías sin traer todo el grafo antes
                var categorySales = _repoOrder.GetAll()
                     .Where(o => o.CurrentStatus != OrderStatus.Cancelled &&
                                 o.OrderDate >= filterStartUtc &&
                                 o.OrderDate <= filterEndUtc)
                     .SelectMany(o => o.OrderItems)
                     .GroupBy(i => i.Product.Category.Name)
                     .Select(g => new ChartDataDto
                     {
                         Label = g.Key,
                         Value = g.Sum(i => i.Quantity)
                     })
                     .OrderByDescending(x => x.Value)
                     .Take(5)
                     .ToList();

                // E. ALERTAS STOCK
                var lowStockCount = _repoStock.GetAll().Count(s => s.CurrentStock <= s.MinimumStockAlert);

                // F. RESPUESTA FINAL
                var response = new DashboardFullDto
                {
                    TodayRevenue = totalRevenue,
                    TodayOrdersCount = totalCount,
                    AverageTicket = Math.Round(avgTicket, 2),
                    PendingOrders = pendingCount,
                    Last7DaysSales = salesChart,
                    PeakHours = peakHours,
                    SalesByCategory = categorySales,
                    LowStockCount = lowStockCount
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error en Dashboard: {ex.Message} {ex.StackTrace}");
            }
        }
    }
}