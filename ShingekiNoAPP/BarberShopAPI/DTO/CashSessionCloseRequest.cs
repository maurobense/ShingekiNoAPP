using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class CashSessionCloseRequest
    {
        public decimal FinalBalance { get; set; }
        public string Notes { get; set; }
        public DateTime CloseTime { get; set; }
    }
}
