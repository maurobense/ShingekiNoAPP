using Business.BusinessEntities;
using System.Collections.Generic;

namespace Business.RepositoryInterfaces
{
    public interface IRepositoryUser : IRepository<User>
    {
        // ❌ CORRECCIÓN: Login debe recibir un identificador (ej. name) además de la password.
        // Asumiendo que usas el Name como identificador de inicio de sesión (username/email).
        User? Login(string name, string password);

        // Método para encontrar usuarios por nombre de usuario/email
        User? FindByUserName(string name);
    }
}