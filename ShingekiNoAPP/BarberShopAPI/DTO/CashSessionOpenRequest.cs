using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class CashSessionOpenRequest
    {
        public decimal InitialBalance { get; set; }
        public DateTime OpenTime { get; set; }
        public DateTime OperationalDate { get; set; }
    }
}
