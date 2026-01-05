using Business.BusinessEntities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class OrderCreateDto
    {
        public long? ClientId { get; set; }
        public long BranchId { get; set; }
        public long ClientAddressId { get; set; }
        public string Note { get; set; } // Nota general del pedido

        // NUEVO: Descuento general al total del pedido (ej: Cupón)
        public decimal GlobalDiscount { get; set; }
        public PaymentMethod PaymentMethod { get; set; }
        public List<OrderItemCreateDto> Items { get; set; }
    }
}
