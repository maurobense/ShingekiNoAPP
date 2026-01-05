using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Business.BusinessEntities
{
    // Asegúrate de que herede de la clase base si la usas
    public class Ingredient : BaseEntity
    {
        // Propiedades de la Entidad
        // [Key] // Si usas BaseEntity, esto ya está implícito
        // public long Id { get; set; } 

        [Required]
        [StringLength(100)]
        public string Name { get; set; }

        [StringLength(10)]
        // Usamos UnitOfMeasure según lo que detectamos en el Front, 
        // pero mantén Unit si lo usas en otro lado
        public string UnitOfMeasure { get; set; }

        // Si tu base de datos usa "Unit" en lugar de "UnitOfMeasure", descomenta esto:
        // public string Unit { get; set; } 

        // public bool IsDeleted { get; set; } // Si usas BaseEntity, esto ya está implícito


        // ==========================================================
        // COLECCIONES DE NAVEGACIÓN (FIX para el error 400 Bad Request)
        // ==========================================================

        // Inicializar las colecciones evita que el Model Binder/EF Core las marque como requeridas (NOT NULL).

        /// <summary>
        /// Colección de entradas de stock en diferentes sucursales que usan este ingrediente.
        /// </summary>
        public virtual ICollection<BranchStock> BranchStocks { get; set; } = new List<BranchStock>();

        /// <summary>
        /// Colección de recetas que usan este ingrediente.
        /// </summary>
        public virtual ICollection<ProductIngredient> ProductIngredients { get; set; } = new List<ProductIngredient>();
    }
}