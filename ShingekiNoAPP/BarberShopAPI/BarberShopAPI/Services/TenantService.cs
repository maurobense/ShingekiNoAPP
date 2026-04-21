using Microsoft.AspNetCore.Http;
using System.Linq;
using Business.BusinessInterfaces;

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

            // 🔥 Le agregamos el .Contains para que lo atrape sí o sí, aunque .NET le cambie el nombre
            var branchClaim = user?.Claims.FirstOrDefault(c => c.Type == "BranchId" || c.Type.Contains("BranchId"));

            if (branchClaim != null && long.TryParse(branchClaim.Value, out long branchId))
            {
                return branchId;
            }

            return 0;
        }
    }
}