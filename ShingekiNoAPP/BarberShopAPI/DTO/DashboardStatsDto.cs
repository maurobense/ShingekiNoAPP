using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class DashboardStatsDto
    {
        public decimal TotalRevenue { get; set; }     // Ingreso Total Histórico
        public int TotalOrders { get; set; }          // Total Pedidos
        public List<DailySalesDto> Last7DaysSales { get; set; }
        public List<TopProductDto> TopSellingProducts { get; set; }
    }
}
