using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
namespace Datos.Repositories
{
    public class RepositoryProductIngredient : Repository<ProductIngredient>, IRepositoryProductIngredient
    {
        public RepositoryProductIngredient(ShingekiContext ctx) : base(ctx) { }

        public IEnumerable<ProductIngredient> GetRecipeByProductId(long productId)
        {
            // Carga los ingredientes asociados a un producto específico
            // El método .Include() es reconocido gracias a 'using Microsoft.EntityFrameworkCore;'
            return _dbSet
                .Where(pi => pi.ProductId == productId)
                .Include(pi => pi.Ingredient)
                .ToList();
        }
    }
}