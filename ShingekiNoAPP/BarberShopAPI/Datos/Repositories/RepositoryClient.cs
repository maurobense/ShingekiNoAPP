// En Datos/Repositories/RepositoryClient.cs
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Datos.Repositories
{
    // Heredamos de Repository<Client> para el CRUD (Get, GetAll, Delete, etc.)
    // La clase base Repository<T> ya implementa IRepository<T>
    public class RepositoryClient : Repository<Client>, IRepositoryClient
    {
        // Se usa _context y _dbSet de la clase base Repository<T>

        public RepositoryClient(ShingekiContext ctx) : base(ctx)
        {
        }

        public IEnumerable<Client> FindByName(string name)
        {
            string searchLower = name.ToLower();

            return _dbSet
                .Where(c => c.Name.ToLower().Contains(searchLower) ||
                            c.LastName.ToLower().Contains(searchLower))
                .ToList();
        }

        public IEnumerable<Client> FindByPhone(int phone)
        {
            return _dbSet
                .Where(c => c.Phone == phone)
                .ToList();
        }

        public IEnumerable<ClientAddress> GetAddresses(long clientId)
        {
            // Usamos el _context inyectado en la clase base para acceder a otros DbSets
            return _context.ClientAddresses
                .Where(a => a.ClientId == clientId && !a.IsDeleted)
                .ToList();
        }

        public IEnumerable<Order> GetOrderHistory(long clientId)
        {
            return _context.Orders
                .Where(o => o.ClientId == clientId)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .OrderByDescending(o => o.OrderDate)
                .ToList();
        }
    }
}