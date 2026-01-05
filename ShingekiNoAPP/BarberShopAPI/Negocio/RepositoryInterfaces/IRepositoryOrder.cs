using System;
using System.Collections.Generic;
using System.Linq; // Necesario para IQueryable
using System.Text;
using System.Threading.Tasks;

using Business.BusinessEntities;

namespace Business.RepositoryInterfaces
{
    public interface IRepositoryOrder : IRepository<Order>
    {
        // Métodos específicos que ya tenías
        Order GetOrderDetails(long orderId);
        ICollection<Order> GetOrdersByBranch(long branchId);

        // 🔥 LA CORRECCIÓN MÁGICA:
        // Definimos GetAll devolviendo IQueryable para permitir el .Include() en el controlador.
        // Usamos 'new' para ocultar la versión de la interfaz base que devuelve List/IEnumerable.
        new IQueryable<Order> GetAll();
    }
}