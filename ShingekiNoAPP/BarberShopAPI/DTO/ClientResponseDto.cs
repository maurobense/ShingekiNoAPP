using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class ClientResponseDto
    {
        public long Id { get; set; }
        public string Name { get; set; }
        public string LastName { get; set; }
        public int Phone { get; set; }
        // Devolvemos también las direcciones para que sea útil
        public List<AddressResponseDto> Addresses { get; set; }
    }
}
