using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class UserDTO
    {
        public long Id { get; set; }
        public string Name { get; set; }
        public string LastName { get; set; }
        public string Username { get; set; }
        public string Role { get; set; }
        public int Phone { get; set; }
        public string Picture { get; set; }

        // Constructor vacío (necesario para serialización en algunos casos)
        public UserDTO() { }

        // Constructor que usa tu controlador en el .Select()
        public UserDTO(long id, string name, string lastName, int phone, string picture)
        {
            Id = id;
            Name = name;
            LastName = lastName;
            Phone = phone;
            Picture = picture;
        }
    }
}
