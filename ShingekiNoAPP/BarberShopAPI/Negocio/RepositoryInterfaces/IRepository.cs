using Business.BusinessEntities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.RepositoryInterfaces
{
    /// <summary>
    /// Interfaz genérica para operaciones CRUD básicas (Create, Read, Update, Delete).
    /// Asegura que todas las entidades persisibles cumplan con este contrato.
    /// </summary>
    /// <typeparam name="T">Debe ser una clase de entidad que herede de BaseEntity.</typeparam>
    public interface IRepository<T> where T : BaseEntity
    {
        // Obtiene una entidad por su clave primaria (Id).
        public T? Get(long id);

        // Obtiene todas las entidades.
        IEnumerable<T> GetAll();

        // Agrega una nueva entidad a la capa de persistencia (no guarda en BD todavía).
        T Add(T entity);

        // Marca una entidad como modificada (usada para soft delete y actualizaciones).
        void Update(T entity);

        // Marca una entidad para ser eliminada (implementa Soft Delete en la clase base).
        void Delete(long id);

        // Persiste todos los cambios pendientes en la base de datos.
        void Save();
    }
}