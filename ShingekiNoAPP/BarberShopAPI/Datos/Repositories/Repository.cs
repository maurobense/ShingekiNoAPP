using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;

namespace Datos.Repositories
{
    public class Repository<T> : IRepository<T> where T : BaseEntity
    {
        protected readonly ShingekiContext _context;
        protected readonly DbSet<T> _dbSet;

        public Repository(ShingekiContext context)
        {
            _context = context;
            _dbSet = context.Set<T>();
        }

        public T Add(T entity)
        {
            _dbSet.Add(entity);
            return entity;
        }

        public void Delete(long id)
        {
            T entity = Get(id);
            if (entity != null)
            {
                entity.IsDeleted = true;
                Update(entity);
            }
        }

        public T Get(long id)
        {
            return _dbSet.FirstOrDefault(e => e.Id == id);
        }

        public IEnumerable<T> GetAll()
        {
            return _dbSet.ToList();
        }

        public void Save()
        {
            _context.SaveChanges();
        }

        // ✅ MÉTODO UPDATE MEJORADO
        public void Update(T entity)
        {
            // 1. Si el objeto no está siendo rastreado por EF, lo adjuntamos.
            if (_context.Entry(entity).State == EntityState.Detached)
            {
                _dbSet.Attach(entity);
            }

            // 2. Marcamos el estado como Modificado explícitamente.
            _context.Entry(entity).State = EntityState.Modified;

            // 3. Actualizamos fecha de modificación (si aplica)
            // entity.UpdatedAt = System.DateTime.UtcNow; 
        }
    }
}