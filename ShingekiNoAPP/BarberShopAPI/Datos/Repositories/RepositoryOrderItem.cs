// Datos.Repositories/RepositoryOrderItem.cs
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Datos.Repositories
{
    public class RepositoryOrderItem : Repository<OrderItem>, IRepositoryOrderItem
    {
        public RepositoryOrderItem(ShingekiContext context) : base(context) { }

        public IEnumerable<OrderItem> GetItemsByOrder(long orderId)
        {
            return _dbSet
                .Where(oi => oi.OrderId == orderId)
                .Include(oi => oi.Product) // Incluir la información del producto asociado
                .ToList();
        }
    }
}