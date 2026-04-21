using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography; // Usar para el hashing, aunque BCrypt es mejor

namespace Datos.Repositories
{
    // Hereda del Repositorio Genérico para obtener Add, Update, Get, etc.
    // Solo implementamos IRepositoryUser para los métodos ESPECÍFICOS (Login, FindByUserName)
    public class RepositoryUser : Repository<User>, IRepositoryUser
    {
        // El constructor llama al constructor base del Repositorio<T>
        public RepositoryUser(ShingekiContext ctx) : base(ctx)
        {
        }

        // ------------------------------------------------------------------
        // MÉTODOS ESPECÍFICOS DE IRepositoryUser
        // ------------------------------------------------------------------

        // 1. Método para encontrar por Nombre (Búsqueda parcial)
        public IEnumerable<User> FindByName(string name)
        {
            string searchLower = name.ToLower();

            return _dbSet
                .Include(u => u.Branch)
                .Where(u => u.Name.ToLower().Contains(searchLower) || u.LastName.ToLower().Contains(searchLower))
                .ToList();
        }

        // 2. Método para el Login (Encuentra un único usuario por identificador)
        public User? FindByUserName(string userName)
        {
            // Usamos FirstOrDefault, asumiendo que Name o un campo similar es un identificador
            return _dbSet
                .Include(u => u.Branch)
                .FirstOrDefault(u => u.Username.ToLower() == userName.ToLower());
        }

        // 3. Método de Autenticación
        public User? Login(string username, string password)
        {
            // 1. Buscamos al usuario ignorando el filtro de BranchId del DbContext
            // Esto es vital para que admin2 (Sucursal 2) pueda loguearse aunque el sistema esté en Sucursal 1
            var user = _context.Users
                               .IgnoreQueryFilters()
                               .FirstOrDefault(u => u.Username == username && !u.IsDeleted);

            // 2. Si no existe, cortamos acá
            if (user == null)
            {
                return null;
            }

            // 3. Comparamos los hashes (ya que me confirmás que 'password' ya viene hasheada)
            if (user.Password == password)
            {
                return user; // Éxito: El token posterior llevará su BranchId real
            }

            return null; // Contraseña incorrecta
        }
    }
}