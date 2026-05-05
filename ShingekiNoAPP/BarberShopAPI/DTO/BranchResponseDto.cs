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
        public string Slug { get; set; }
        public string TenantFolder { get; set; }
        public string BrandName { get; set; }
        public string PublicDescription { get; set; }
        public string LogoUrl { get; set; }
        public string PrimaryColor { get; set; }
        public string SecondaryColor { get; set; }
        public string AccentColor { get; set; }
        public string BillingEmail { get; set; }
        public string MembershipPlan { get; set; }
        public string MembershipStatus { get; set; }
        public bool PublicOrderingEnabled { get; set; }
        public int MonthlyOrderLimit { get; set; }
        public int OpeningHour { get; set; }
        public int ClosingHour { get; set; }
        public bool DayShiftEnabled { get; set; }
        public int DayOpeningHour { get; set; }
        public int DayClosingHour { get; set; }
        public bool NightShiftEnabled { get; set; }
        public int NightOpeningHour { get; set; }
        public int NightClosingHour { get; set; }
        public string TimeZoneId { get; set; }
        public string PublicOrderingUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? TrialEndsAt { get; set; }
        public int InternalUsersCount { get; set; }
        public int CustomerUsersCount { get; set; }
        public int TotalUsersCount { get; set; }
        public int OrdersCount { get; set; }
        public int OrdersThisMonthCount { get; set; }
        public int OpenOrdersCount { get; set; }
        public int DeliveredOrdersCount { get; set; }
        public int CancelledOrdersCount { get; set; }
        public decimal RevenueTotal { get; set; }
        public decimal RevenueThisMonth { get; set; }
        public DateTime? LastOrderAt { get; set; }
        public int ProductsCount { get; set; }
        public int CategoriesCount { get; set; }
        public int IngredientsCount { get; set; }
        public int StockItemsCount { get; set; }
        public int OrderItemsCount { get; set; }
        public int MediaAssetsCount { get; set; }
        public int DataRowsEstimate { get; set; }
        public long S3ObjectCount { get; set; }
        public long S3BytesUsed { get; set; }
        public string S3BytesHuman { get; set; }
        public bool S3UsageAvailable { get; set; }
    }
}
