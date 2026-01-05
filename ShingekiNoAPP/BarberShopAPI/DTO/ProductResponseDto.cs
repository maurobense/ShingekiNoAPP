using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class ProductResponseDto
    {
        public long Id { get; set; }
        public string Name { get; set; }
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public string? ImageUrl { get; set; }

        // 👇 ESTA PROPIEDAD DEBE EXISTIR PARA EL FRONTEND
        public long CategoryId { get; set; }

        public string CategoryName { get; set; }
    }
}
