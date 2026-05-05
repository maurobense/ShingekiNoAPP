namespace DTO
{
    public class BranchSettingsDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string BrandName { get; set; } = string.Empty;
        public string PublicDescription { get; set; } = string.Empty;
        public string LogoUrl { get; set; } = string.Empty;
        public string PrimaryColor { get; set; } = "#111827";
        public string SecondaryColor { get; set; } = "#f59e0b";
        public string AccentColor { get; set; } = "#10b981";
        public int Phone { get; set; }
        public string HomePage { get; set; } = string.Empty;
        public bool PublicOrderingEnabled { get; set; } = true;
        public int OpeningHour { get; set; } = 18;
        public int ClosingHour { get; set; } = 2;
        public bool DayShiftEnabled { get; set; } = true;
        public int DayOpeningHour { get; set; } = 10;
        public int DayClosingHour { get; set; } = 16;
        public bool NightShiftEnabled { get; set; } = true;
        public int NightOpeningHour { get; set; } = 21;
        public int NightClosingHour { get; set; } = 2;
        public string TimeZoneId { get; set; } = "America/Montevideo";
        public string PublicOrderingUrl { get; set; } = string.Empty;
    }
}
