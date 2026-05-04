using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessInterfaces
{
    public interface ITenantService
    {
        long GetBranchId();
        string GetTenantSlug();
        string GetTenantFolder();
    }
}
