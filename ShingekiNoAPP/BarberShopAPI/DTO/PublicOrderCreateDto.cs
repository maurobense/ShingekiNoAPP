using Business.BusinessEntities;
using System.Collections.Generic;

namespace DTO
{
    public class PublicOrderCreateDto
    {
        public string CustomerName { get; set; }
        public string CustomerLastName { get; set; }
        public string CustomerPhone { get; set; }
        public string Street { get; set; }
        public string City { get; set; }
        public string? Region { get; set; }
        public int PostalCode { get; set; }
        public string? Country { get; set; }
        public string? AddressLabel { get; set; }
        public string? Note { get; set; }
        public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Cash;
        public List<OrderItemCreateDto> Items { get; set; }
    }
}
