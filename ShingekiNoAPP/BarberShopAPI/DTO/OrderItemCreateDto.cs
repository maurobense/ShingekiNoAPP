using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class OrderItemCreateDto
    {
        public long ProductId { get; set; }
        public int Quantity { get; set; }

        // NUEVO: Personalización (Ej: "Sin pepinillo, carne jugosa")
        public string Observation { get; set; }

        // NUEVO: Descuento específico para este ítem (Ej: Promo 2x1)
        public decimal Discount { get; set; }
    }
}
