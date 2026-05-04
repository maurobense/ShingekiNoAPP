using Business.BusinessInterfaces;
using Microsoft.AspNetCore.Http;
using System.Linq;
using System.Security.Claims;

namespace ShingekiNoAPPI.Services
{
    public class TenantService : ITenantService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public TenantService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public long GetBranchId()
        {
            var user = _httpContextAccessor.HttpContext?.User;
            var roleClaim = user?.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role");
            if (roleClaim != null && roleClaim.Value.Equals("SuperAdmin", System.StringComparison.OrdinalIgnoreCase))
            {
                return 0;
            }

            var branchClaim = user?.Claims.FirstOrDefault(c => c.Type == "BranchId" || c.Type.Contains("BranchId"));
            if (branchClaim != null && long.TryParse(branchClaim.Value, out long branchId))
            {
                return branchId;
            }

            return 0;
        }

        public string GetTenantSlug()
        {
            var user = _httpContextAccessor.HttpContext?.User;
            var claim = user?.Claims.FirstOrDefault(c => c.Type == "TenantSlug");
            return string.IsNullOrWhiteSpace(claim?.Value) ? "platform" : claim.Value;
        }

        public string GetTenantFolder()
        {
            var user = _httpContextAccessor.HttpContext?.User;
            var claim = user?.Claims.FirstOrDefault(c => c.Type == "TenantFolder");
            if (!string.IsNullOrWhiteSpace(claim?.Value))
            {
                return claim.Value;
            }

            var branchId = GetBranchId();
            return branchId > 0 ? $"tenant-{branchId}" : "platform";
        }
    }
}
