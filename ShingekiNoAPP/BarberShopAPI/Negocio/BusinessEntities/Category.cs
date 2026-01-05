using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class Category : BaseEntity
    {
        [Required, MaxLength(100)]
        public string Name { get; set; } // Ej: "Hamburguesas de Titán"
        public string? Description { get; set; }
        public ICollection<Product> Products { get; set; }
    }
}
