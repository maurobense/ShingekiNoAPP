using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class ClientCreateDto
    {
        public string Name { get; set; }
        public string LastName { get; set; }
        public int Phone { get; set; }
        public string? Picture { get; set; }
    }
}
