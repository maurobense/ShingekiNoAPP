namespace ShingekiNoAPPI.Services.Security
{
    public interface ICustomerRateLimitService
    {
        bool IsAllowed(string key, int limit, TimeSpan window);
    }
}
