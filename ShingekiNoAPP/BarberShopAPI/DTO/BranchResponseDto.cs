using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class BranchResponseDto
    {
        public long Id { get; set; }
        public string Name { get; set; }
        public string FullAddress { get; set; }
        public string Phone { get; set; }
        public string HomePage { get; set; }
    }
}
