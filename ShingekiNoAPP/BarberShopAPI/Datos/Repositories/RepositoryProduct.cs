// En Datos/EF/Repositories/RepositoryProduct.cs
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Datos.Repositories
{
    public class RepositoryProduct : Repository<Product>, IRepositoryProduct
    {
        public RepositoryProduct(ShingekiContext context) : base(context) { }

        public ICollection<Product> GetProductsByCategory(long categoryId)
        {
            // Implementación de método específico
            return _dbSet.Where(p => p.CategoryId == categoryId).ToList();
        }
        public Product GetWithRecipe(long id)
        {
            // Eager Loading: Traemos el producto, su lista de ingredientes (receta)
            // y el detalle del ingrediente (para saber el nombre si hace falta)
            return _dbSet
                .Include(p => p.ProductIngredients)
                .ThenInclude(pi => pi.Ingredient)
                .FirstOrDefault(p => p.Id == id);
        }
    }
}