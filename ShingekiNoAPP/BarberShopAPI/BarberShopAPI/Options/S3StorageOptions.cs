namespace ShingekiNoAPPI.Options
{
    public sealed class S3StorageOptions
    {
        public string BucketName { get; set; } = string.Empty;
        public string Region { get; set; } = "us-east-1";
        public string? PublicBaseUrl { get; set; }
        public int MaxFileSizeMb { get; set; } = 12;
    }
}
