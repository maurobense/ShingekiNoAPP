using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Datos.EF;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Collections.Generic; // Necesario para IEnumerable

namespace Datos.Repositories
{
    // Maneja el inventario por sucursal
    public class RepositoryBranchStock : Repository<BranchStock>, IRepositoryBranchStock
    {
        public RepositoryBranchStock(ShingekiContext ctx) : base(ctx) { }

        // =========================================================
        // ✅ NUEVOS MÉTODOS DE CONSULTA PARA EL CONTROLLER
        // =========================================================

        /// <summary>
        /// Obtiene todos los registros de stock para una sucursal específica.
        /// </summary>
        /// <param name="branchId">ID de la sucursal.</param>
        /// <returns>Colección de BranchStock.</returns>
        public IEnumerable<BranchStock> GetByBranchId(long branchId)
        {
            // Usamos .Where para filtrar por BranchId. Excluimos borrados lógicamente.
            return _dbSet.Where(bs => bs.BranchId == branchId && !bs.IsDeleted).ToList();
        }

        /// <summary>
        /// Obtiene el registro único de stock para una combinación Sucursal/Ingrediente.
        /// </summary>
        /// <param name="branchId">ID de la sucursal.</param>
        /// <param name="ingredientId">ID del ingrediente.</param>
        /// <returns>Objeto BranchStock o null si no existe.</returns>
        public BranchStock GetByBranchAndIngredient(long branchId, long ingredientId)
        {
            // Usamos FirstOrDefault para obtener el registro único
            return _dbSet.FirstOrDefault(bs =>
                bs.BranchId == branchId &&
                bs.IngredientId == ingredientId &&
                !bs.IsDeleted);
        }

        // =========================================================
        // MÉTODOS DE LÓGICA DE NEGOCIO (Los que ya tenías)
        // =========================================================

        public bool IsStockAvailable(long branchId, long ingredientId, decimal quantityNeeded)
        {
            // Verifica el stock actual en la base de datos
            var stock = _dbSet.FirstOrDefault(bs =>
                bs.BranchId == branchId &&
                bs.IngredientId == ingredientId &&
                !bs.IsDeleted);

            return stock != null && stock.CurrentStock >= quantityNeeded;
        }

        public bool DecreaseStock(long branchId, long ingredientId, decimal quantityToDecrease)
        {
            // ⚠️ ATENCIÓN: Esta operación debe ser envuelta en una transacción 
            // en la capa de Servicio para evitar condiciones de carrera (concurrencia).

            var stock = _dbSet.FirstOrDefault(bs =>
                bs.BranchId == branchId &&
                bs.IngredientId == ingredientId &&
                !bs.IsDeleted);

            if (stock == null || stock.CurrentStock < quantityToDecrease)
            {
                return false; // Stock insuficiente o no encontrado
            }

            stock.CurrentStock -= quantityToDecrease;

            // Usamos el Update de la clase base. Save() ya está incluido.
            Update(stock);
            Save();

            return true;
        }
    }
}