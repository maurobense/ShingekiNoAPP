using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public enum OrderStatus
    {
        Cancelled = 0,
        Pending = 1,
        Confirmed = 2,
        Cooking = 3,
        Ready = 4,
        Delivered = 5,
        OnTheWay = 6
    }
}
