using Business.BusinessEntities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Business.RepositoryInterfaces
{
    public interface IRepositoryBranchStock : IRepository<BranchStock>
    {
        // ----------------------------------------------------
        // ✅ MÉTODOS REQUERIDOS POR BranchStockController
        // ----------------------------------------------------

        // 1. Obtener todo el stock de una sucursal (para la vista de la tabla Admin)
        IEnumerable<BranchStock> GetByBranchId(long branchId);

        // 2. Obtener un registro específico (para crear o actualizar movimientos)
        BranchStock GetByBranchAndIngredient(long branchId, long ingredientId);

        // ----------------------------------------------------
        // MÉTODOS ORIGINALES (Lógica de Negocio)
        // ----------------------------------------------------

        // Verifica si hay suficiente stock de un ingrediente en una sucursal
        bool IsStockAvailable(long branchId, long ingredientId, decimal quantityNeeded);

        // Intenta restar la cantidad de stock (usado en el checkout)
        bool DecreaseStock(long branchId, long ingredientId, decimal quantityToDecrease);
    }
}