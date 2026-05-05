using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class OrderResponseDto
    {
        public long Id { get; set; }

        // --- AGREGAR ESTAS DOS LÍNEAS ---
        public string ClientName { get; set; }
        public string ClientPhone { get; set; }
        // --------------------------------

        public DateTime OrderDate { get; set; }
        public string Status { get; set; }
        public string PaymentMethod { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal Discount { get; set; }
        public string TrackingNumber { get; set; }
        public string BranchName { get; set; }
        public string TenantSlug { get; set; }
        public string PublicOrderingUrl { get; set; }
        public string? DeliveryAddressText { get; set; }
        public string? DeliveryAddressLabel { get; set; }
        public string? DeliveryStreet { get; set; }
        public string? DeliveryCity { get; set; }
        public string? DeliveryRegion { get; set; }
        public string? DeliveryCountry { get; set; }
        public double? DriverLatitude { get; set; }
        public double? DriverLongitude { get; set; }
        public double? DriverAccuracyMeters { get; set; }
        public double? DriverSpeedMetersPerSecond { get; set; }
        public double? DriverHeadingDegrees { get; set; }
        public DateTime? DriverLocationAtUtc { get; set; }
        public bool HasDriverLocation => DriverLatitude.HasValue && DriverLongitude.HasValue;
        public List<OrderItemResponseDto> Items { get; set; }
    }
}
