using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using System.Collections.Generic;

namespace Business.RepositoryInterfaces
{
    public interface IRepositoryClient : IRepository<Client>
    {
        /// <summary>
        /// Obtiene todas las direcciones asociadas a un cliente específico.
        /// </summary>
        /// <param name="clientId">El ID del cliente.</param>
        /// <returns>Una colección de ClientAddress.</returns>
        IEnumerable<ClientAddress> GetAddresses(long clientId);

        /// <summary>
        /// Obtiene un historial de pedidos realizados por un cliente específico.
        /// </summary>
        /// <param name="clientId">El ID del cliente.</param>
        /// <returns>Una colección de pedidos (Order).</returns>
        IEnumerable<Order> GetOrderHistory(long clientId);

        /// <summary>
        /// Busca clientes por número de teléfono.
        /// </summary>
        /// <param name="phone">El número de teléfono a buscar.</param>
        /// <returns>Una colección de clientes que coinciden.</returns>
        IEnumerable<Client> FindByPhone(int phone);
    }
}