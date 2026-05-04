using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class BranchCreateDto
    {
        public string Name { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string Region { get; set; }
        public int PostalCode { get; set; }
        public string Country { get; set; }
        public int Phone { get; set; }
        public string HomePage { get; set; }
        public string? Slug { get; set; }
        public string? BrandName { get; set; }
        public string? PublicDescription { get; set; }
        public string? LogoUrl { get; set; }
        public string? PrimaryColor { get; set; }
        public string? SecondaryColor { get; set; }
        public string? AccentColor { get; set; }
        public string? BillingEmail { get; set; }
        public string? MembershipPlan { get; set; }
        public string? MembershipStatus { get; set; }
        public bool PublicOrderingEnabled { get; set; } = true;
        public int MonthlyOrderLimit { get; set; }
    }
}
