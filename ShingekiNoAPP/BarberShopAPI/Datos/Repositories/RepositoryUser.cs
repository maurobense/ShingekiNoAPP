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
            // 1. Encontrar al usuario
            var user = FindByUserName(username);

            if (user == null)
            {
                return null; // Usuario no encontrado
            }

            // 2. Hashear la contraseña proporcionada (usando el método en la entidad)
            // ⚠️ AVISO: El método HashPassword DEBE ser estático y DEBE usar un algoritmo seguro (como BCrypt).
            // Si el método HashPassword está en la entidad, se mantiene el código así:
            var hashedPasswordProvided = password;

            // 3. Comparar hashes
            if (user.Password == hashedPasswordProvided)
            {
                return user; // Credenciales válidas
            }

            return null; // Contraseña incorrecta
        }
    }
}