using Business.BusinessEntities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Business.RepositoryInterfaces;
using System.Collections.Generic; // Necesario para IEnumerable

namespace Business.RepositoryInterfaces
{
    public interface IRepositoryOrderItem : IRepository<OrderItem>
    {
        /// <summary>
        /// Obtiene todos los objetos OrderItem (detalle de ítems) que pertenecen a un pedido específico.
        /// </summary>
        /// <param name="orderId">El ID del pedido cuyos ítems se desean obtener.</param>
        /// <returns>Una colección de OrderItem asociados al pedido.</returns>
        IEnumerable<OrderItem> GetItemsByOrder(long orderId);
    }
}
