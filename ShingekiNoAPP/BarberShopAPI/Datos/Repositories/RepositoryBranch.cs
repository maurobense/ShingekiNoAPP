// En Datos/Repositories/RepositoryBranch.cs

using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Datos.Repositories
{
    // Heredamos del Repositorio Genérico para el CRUD básico
    public class RepositoryBranch : Repository<Branch>, IRepositoryBranch
    {
        // Solo necesitamos el constructor
        public RepositoryBranch(ShingekiContext ctx) : base(ctx)
        {
        }

        // --- Métodos Específicos que NO están en el genérico ---

        // Tienes que implementar FindByName en tu IRepositoryBranch
        public IEnumerable<Branch> FindByName(string name)
        {
            return _dbSet
                .Where(b => b.Name.ToLower().Contains(name.ToLower()))
                .ToList();
        }

        // Si necesitas un método para obtener con stock (ejemplo de composición):
        public Branch GetBranchWithStock(long id)
        {
            return _dbSet
                .Include(b => b.BranchStocks)
                .ThenInclude(bs => bs.Ingredient)
                .FirstOrDefault(b => b.Id == id);
        }
    }
}