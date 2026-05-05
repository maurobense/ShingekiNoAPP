namespace DTO
{
    public class DriverLocationUpdateDto
    {
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public double? AccuracyMeters { get; set; }
        public double? SpeedMetersPerSecond { get; set; }
        public double? HeadingDegrees { get; set; }
    }
}
