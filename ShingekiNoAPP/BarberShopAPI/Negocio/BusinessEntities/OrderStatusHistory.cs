using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class OrderStatusHistory : BaseEntity
    {
        public long OrderId { get; set; }
        public Order Order { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime ChangeDate { get; set; } = DateTime.UtcNow;
        public long? ChangedByUserId { get; set; } // Qué empleado cambió el estado
    }
}
