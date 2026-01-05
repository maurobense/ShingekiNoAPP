using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class CashMovementRequest
    {
        public string Type { get; set; } // "IN" o "OUT"
        public decimal Amount { get; set; }
        public string Description { get; set; }
    }
}
