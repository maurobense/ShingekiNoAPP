using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class ProductCreateDto
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; }
        public string ImageUrl { get; set; }

        // Aquí recibimos el ID, porque el frontend envía el ID seleccionado en un dropdown
        public long CategoryId { get; set; }
    }
}
