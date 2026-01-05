using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class CashSession : BaseEntity
    {
        public DateTime OpenTime { get; set; }
        public DateTime? CloseTime { get; set; }
        public DateTime OperationalDate { get; set; } // Para la lógica de la madrugada
        public decimal InitialBalance { get; set; }
        public decimal? FinalBalance { get; set; }    // Lo que cuentas en la mano
        public decimal? ExpectedBalance { get; set; } // Lo que dice el sistema
        public decimal? Difference { get; set; }      // Sobrante o Faltante
        public string Notes { get; set; }
        public bool IsClosed { get; set; }

        // Relación con movimientos
        public ICollection<CashMovement> Movements { get; set; }
    }
}
