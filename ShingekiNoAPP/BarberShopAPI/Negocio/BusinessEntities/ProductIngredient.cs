using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    // Tabla intermedia: Receta
    public class ProductIngredient : BaseEntity
    {
        public long ProductId { get; set; }
        public Product Product { get; set; }

        public long IngredientId { get; set; }
        public Ingredient Ingredient { get; set; }

        // ✅ ASEGÚRATE QUE ESTO SEA DECIMAL
        [Column(TypeName = "decimal(18, 2)")] // Opcional, ayuda a EF con SQL
        public decimal Quantity { get; set; }
    }
}
