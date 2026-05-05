using Microsoft.Extensions.Caching.Memory;

namespace ShingekiNoAPPI.Services.Security
{
    public sealed class InMemoryCustomerRateLimitService : ICustomerRateLimitService
    {
        private readonly IMemoryCache _cache;
        private readonly object _sync = new();

        public InMemoryCustomerRateLimitService(IMemoryCache cache)
        {
            _cache = cache;
        }

        public bool IsAllowed(string key, int limit, TimeSpan window)
        {
            lock (_sync)
            {
                var cacheKey = $"customer-rate:{key}";
                var current = _cache.Get<int?>(cacheKey) ?? 0;
                if (current >= limit) return false;

                _cache.Set(cacheKey, current + 1, new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = window
                });
                return true;
            }
        }
    }
}
