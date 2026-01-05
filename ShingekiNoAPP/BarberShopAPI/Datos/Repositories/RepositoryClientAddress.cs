// Datos.Repositories/RepositoryClientAddress.cs
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using System.Collections.Generic;
using System.Linq;

namespace Datos.Repositories
{
    public class RepositoryClientAddress : Repository<ClientAddress>, IRepositoryClientAddress
    {
        public RepositoryClientAddress(ShingekiContext context) : base(context) { }

        public IEnumerable<ClientAddress> GetAddressesByClient(long clientId)
        {
            return _dbSet
                .Where(ca => ca.ClientId == clientId)
                .ToList();
        }
    }
}