using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    // DTOs/BranchStockDTOs.cs
    public class StockUpdateDto
    {
        public long BranchId { get; set; }
        public long IngredientId { get; set; }
        public decimal CurrentStock { get; set; }

        // El JSON que entra
        public decimal MinimumStock { get; set; }
    }
}
