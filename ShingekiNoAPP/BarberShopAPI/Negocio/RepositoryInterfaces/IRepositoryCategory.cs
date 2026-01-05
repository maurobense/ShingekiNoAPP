using Business.BusinessEntities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.RepositoryInterfaces
{
    public interface IRepositoryCategory : IRepository<Category>
    {
        // Obtener categorías con sus productos cargados
        IEnumerable<Category> GetCategoriesWithProducts();
    }
}
