using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class ProductIngredientDto
    {
        public long Id { get; set; } // 👈 Tiene que estar aquí
        public long ProductId { get; set; }
        public long IngredientId { get; set; }
        public decimal Quantity { get; set; } // Cuánto de este ingrediente usa el producto
    }
}
