using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class DashboardFullDto
    {
        // KPIs del Día (Lo operativo inmediato)
        public decimal TodayRevenue { get; set; }
        public int TodayOrdersCount { get; set; }
        public decimal AverageTicket { get; set; }
        public int PendingOrders { get; set; }

        // Gráficos y Tendencias
        public List<ChartDataDto> Last7DaysSales { get; set; } // Evolución
        public List<ChartDataDto> SalesByCategory { get; set; } // ¿Qué vendemos?
        public List<ChartDataDto> PeakHours { get; set; }      // ¿A qué hora nos preparmos?

        // Stock Crítico (Resumen)
        public int LowStockCount { get; set; }
    }
}
