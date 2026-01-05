using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class CashMovement : BaseEntity
    {
        public int CashSessionId { get; set; }
        public string Type { get; set; } // "IN" (Ingreso) o "OUT" (Egreso/Gasto)
        public decimal Amount { get; set; }
        public string Description { get; set; }
        public DateTime MovementDate { get; set; }

        // Navegación
        public CashSession CashSession { get; set; }
    }
}
