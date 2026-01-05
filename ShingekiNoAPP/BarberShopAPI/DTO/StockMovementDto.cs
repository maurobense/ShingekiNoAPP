using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class StockMovementDto
    {
        public long BranchId { get; set; }
        public long IngredientId { get; set; }
        public decimal Quantity { get; set; }
        public string MovementType { get; set; }

        // 👇 AGREGA EL '?' AQUÍ. Esto permite que sea null si no se envía.
        public decimal? MinimumStock { get; set; }
    }
}
