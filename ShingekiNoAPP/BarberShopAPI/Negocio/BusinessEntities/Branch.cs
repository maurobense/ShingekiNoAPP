using Business.BusinessInterfaces;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace Business.BusinessEntities
{
    public class Branch : BaseEntity, IValidable // Asumo que Branch hereda de BaseEntity
    {
        [Required]
        public string Name { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string Region { get; set; }
        public int PostalCode { get; set; }
        public string Country { get; set; }
        public int Phone { get; set; }
        public string HomePage { get; set; }

        [Required, MaxLength(80)]
        public string Slug { get; set; } = string.Empty;

        [Required, MaxLength(120)]
        public string TenantFolder { get; set; } = string.Empty;

        [MaxLength(120)]
        public string? BrandName { get; set; }

        [MaxLength(500)]
        public string? PublicDescription { get; set; }

        [MaxLength(500)]
        public string? LogoUrl { get; set; }

        [MaxLength(24)]
        public string PrimaryColor { get; set; } = "#111827";

        [MaxLength(24)]
        public string SecondaryColor { get; set; } = "#f59e0b";

        [MaxLength(24)]
        public string AccentColor { get; set; } = "#10b981";

        [MaxLength(160)]
        public string? BillingEmail { get; set; }

        public MembershipPlan MembershipPlan { get; set; } = MembershipPlan.Starter;
        public MembershipStatus MembershipStatus { get; set; } = MembershipStatus.Trial;
        public DateTime? TrialEndsAt { get; set; }
        public bool PublicOrderingEnabled { get; set; } = true;
        public int MonthlyOrderLimit { get; set; }

        public ICollection<BranchStock> BranchStocks { get; set; } = new List<BranchStock>();

        // --- RELACIÓN CORREGIDA ---
        // Usamos ICollection<Product> en lugar de ICollection<Item>
        [JsonIgnore]
        public ICollection<Product> Products { get; set; }

        public Branch() { }

        public void Validate()
        {
            throw new NotImplementedException();
        }

        // ... (constructores y Validate omitidos para brevedad)
    }
}
