using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class AddressResponseDto
    {
        public long Id { get; set; }
        public string FullAddress { get; set; }
        public string Label { get; set; }
    }
}
