using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    namespace DTO
    {
        public class UserCreateDto
        {
            public string Name { get; set; }

            public string LastName { get; set; }
            public string Username { get; set; }
            public string Password { get; set; }
            public string Phone { get; set; }
            public string Picture { get; set; }
            public int BranchId { get; set; }

            public int Role { get; set; }
        }
    }
}
