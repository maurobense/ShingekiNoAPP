// En Datos/EF/Repositories/RepositoryOrder.cs
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Datos.Repositories
{
    public class RepositoryOrder : Repository<Order>, IRepositoryOrder
    {
        public RepositoryOrder(ShingekiContext context) : base(context) { }

        // ✅ MÉTODO CORREGIDO: Usa ThenInclude(ai => ai.Product)
        public Order GetOrderDetails(long orderId)
        {
            return _dbSet
                .Include(o => o.Client)
                .Include(o => o.DeliveryAddress)
                .Include(o => o.OrderItems)
                    .ThenInclude(ai => ai.Product) // ESTA ERA LA CORRECCIÓN CLAVE
                .FirstOrDefault(o => o.Id == orderId);
        }
        public IQueryable<Order> GetAll()
        {
            // 🚨 CAMBIO AQUÍ 🚨
            // Forzamos el Include a nivel de repositorio para que siempre cargue los ítems
            // cuando se llame a GetAll()
            return _context.Orders.Include(o => o.OrderItems);
        }
        public ICollection<Order> GetOrdersByBranch(long branchId)
        {
            return _dbSet
                .Where(o => o.BranchId == branchId)
                .OrderByDescending(o => o.OrderDate)
                .ToList();
        }
    }
}