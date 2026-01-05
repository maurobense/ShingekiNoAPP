using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class BranchStock : BaseEntity
    {
        // Claves foráneas compuestas (definidas en DbContext)
        public long BranchId { get; set; }
        public long IngredientId { get; set; }

        // La cantidad actual de este ingrediente en esta sucursal
        [Column(TypeName = "decimal(18,2)")]
        public decimal CurrentStock { get; set; }

        // Cantidad mínima para generar una alerta
        [Column(TypeName = "decimal(18,2)")]
        public decimal MinimumStockAlert { get; set; }

        // Propiedades de Navegación
        public Branch Branch { get; set; }
        public Ingredient Ingredient { get; set; }
    }
}
