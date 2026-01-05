using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class Product : BaseEntity
    {
        [Required, MaxLength(150)]
        public string Name { get; set; }
        public string? Description { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal Price { get; set; }
        public string? ImageUrl { get; set; }
        public bool IsActive { get; set; } = true;
        public long CategoryId { get; set; }
        public Category Category { get; set; } // Asegúrate que sea tipo Category
        public ICollection<ProductIngredient> ProductIngredients { get; set; }
    }
}
