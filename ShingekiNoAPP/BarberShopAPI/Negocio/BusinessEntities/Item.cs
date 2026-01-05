using Business.BusinessInterfaces;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class Item : IValidable // Asumo que IValidable es la interfaz
    {
        [Key]
        public long Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; } // Usar decimal para moneda
        public bool IsAvailable { get; set; } // Para habilitar/deshabilitar ítems

        // Relación con Branch si los ítems son específicos de una sucursal
        public long BranchId { get; set; }
        public Branch Branch { get; set; }

        public void Validate()
        {
            // Lógica de validación: Nombre, Precio > 0, etc.
            if (String.IsNullOrEmpty(this.Name) || this.Price <= 0)
            {
                throw new Exception("El Item debe tener un Nombre y un Precio válido.");
            }
        }
    }
}
