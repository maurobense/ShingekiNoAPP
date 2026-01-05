using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class LoginResponseDto
    {
        public long Id { get; set; }
        public string Username { get; set; } // Puede ser el nombre o el email
        public string Token { get; set; }
        public string Role { get; set; } // <--- NECESARIO para el frontend
    }
}
