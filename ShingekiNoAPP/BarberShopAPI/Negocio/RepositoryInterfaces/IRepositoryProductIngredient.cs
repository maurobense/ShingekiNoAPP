using Business.BusinessEntities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.RepositoryInterfaces
{
    public interface IRepositoryProductIngredient : IRepository<ProductIngredient>
    {
        // Obtiene la "receta" completa para un producto específico
        IEnumerable<ProductIngredient> GetRecipeByProductId(long productId);
    }
}
