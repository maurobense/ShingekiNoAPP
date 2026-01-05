using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class ClientAddress : BaseEntity
    {
        [Key]
        public long Id { get; set; }
        public string Street { get; set; }
        public string City { get; set; }
        public string Region { get; set; }
        public int PostalCode { get; set; } // Si lo quieres como int
        public string Country { get; set; }
        public string Label { get; set; }
        public long ClientId { get; set; }
        public Client Client { get; set; }
    }
}
