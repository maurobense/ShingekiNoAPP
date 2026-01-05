using Business.BusinessEntities;
using System.Collections.Generic;

namespace Business.RepositoryInterfaces
{
    public interface IRepositoryProduct : IRepository<Product>
    {
        ICollection<Product> GetProductsByCategory(long categoryId);

        // 👇 AGREGAR ESTO: Para poder traer el producto con su receta
        Product GetWithRecipe(long id);
    }
}