using Business.BusinessEntities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.RepositoryInterfaces
{
    public interface IRepositoryOrderStatusHistory : IRepository<OrderStatusHistory>
    {
        // Obtiene la línea de tiempo completa de un pedido
        IEnumerable<OrderStatusHistory> GetHistoryByOrderId(long orderId);

        // Crea un nuevo registro de estado para un pedido (usado por la cocina)
        OrderStatusHistory AddNewStatus(long orderId, OrderStatus newStatus, long userId);
    }
}
