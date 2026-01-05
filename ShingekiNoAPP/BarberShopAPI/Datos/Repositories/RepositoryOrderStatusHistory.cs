using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using System.Collections.Generic;
using System.Linq;

namespace Datos.Repositories
{
    // Maneja la trazabilidad del estado del pedido
    public class RepositoryOrderStatusHistory : Repository<OrderStatusHistory>, IRepositoryOrderStatusHistory
    {
        public RepositoryOrderStatusHistory(ShingekiContext ctx) : base(ctx) { }

        public IEnumerable<OrderStatusHistory> GetHistoryByOrderId(long orderId)
        {
            // Obtiene todos los cambios de estado para un pedido, ordenados por fecha
            return _dbSet
                .Where(osh => osh.OrderId == orderId)
                .OrderBy(osh => osh.ChangeDate)
                .ToList();
        }

        public OrderStatusHistory AddNewStatus(long orderId, OrderStatus newStatus, long userId)
        {
            var newEntry = new OrderStatusHistory
            {
                OrderId = orderId,
                Status = newStatus,
                ChangeDate = System.DateTime.UtcNow,
                // ChangedByUserId = userId // Si agregaste este campo a la entidad
            };

            // Usamos el método Add de la clase base
            Add(newEntry);
            Save();

            return newEntry;
        }
    }
}