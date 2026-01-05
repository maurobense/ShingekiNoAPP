// En Datos/EF/Repositories/RepositoryCategory.cs
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Datos.Repositories
{
    public class RepositoryCategory : Repository<Category>, IRepositoryCategory
    {
        public RepositoryCategory(ShingekiContext context) : base(context) { }

        public IEnumerable<Category> GetCategoriesWithProducts()
        {
            // Método específico para el menú: cargar categoría con sus productos
            return _dbSet.Include(c => c.Products).ToList();
        }
    }
}