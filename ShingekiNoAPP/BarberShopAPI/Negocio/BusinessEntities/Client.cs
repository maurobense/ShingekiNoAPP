using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class Client : BaseEntity
    {
        [Key]
        public long Id { get; set; }
        public string Name { get; set; }
        public string LastName { get; set; }
        public int Phone { get; set; }
        public ICollection<ClientAddress> Addresses { get; set; }
        public ICollection<Order> Orders { get; set; }
        public bool IsDeleted { get; set; } = false; // Soft Delete
        public Client() { }
        public Client(string name, string lastName, int phone)
        {
            Name = name;
            LastName = lastName;
            Phone = phone;
        }
    }
}
