// En Datos/EF/Repositories/RepositoryIngredient.cs
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;

namespace Datos.Repositories
{
    public class RepositoryIngredient : Repository<Ingredient>, IRepositoryIngredient
    {
        public RepositoryIngredient(ShingekiContext context) : base(context) { }
    }
}