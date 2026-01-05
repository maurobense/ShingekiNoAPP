using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class OrderResponseDto
    {
        public long Id { get; set; }

        // --- AGREGAR ESTAS DOS LÍNEAS ---
        public string ClientName { get; set; }
        public string ClientPhone { get; set; }
        // --------------------------------

        public DateTime OrderDate { get; set; }
        public string Status { get; set; }
        public string PaymentMethod { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal Discount { get; set; }
        public string TrackingNumber { get; set; }
        public string BranchName { get; set; }
        public List<OrderItemResponseDto> Items { get; set; }
    }
}
