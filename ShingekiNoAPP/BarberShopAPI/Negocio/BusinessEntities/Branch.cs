using Business.BusinessInterfaces;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Business.BusinessEntities
{
    public class Branch : BaseEntity, IValidable // Asumo que Branch hereda de BaseEntity
    {
        [Required]
        public string Name { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string Region { get; set; }
        public int PostalCode { get; set; }
        public string Country { get; set; }
        public int Phone { get; set; }
        public string HomePage { get; set; }
        public ICollection<BranchStock> BranchStocks { get; set; } = new List<BranchStock>();

        // --- RELACIÓN CORREGIDA ---
        // Usamos ICollection<Product> en lugar de ICollection<Item>
        public ICollection<Product> Products { get; set; }

        public Branch() { }

        public void Validate()
        {
            throw new NotImplementedException();
        }

        // ... (constructores y Validate omitidos para brevedad)
    }
}