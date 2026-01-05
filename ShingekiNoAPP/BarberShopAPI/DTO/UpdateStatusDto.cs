using Business.BusinessEntities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DTO
{
    public class UpdateStatusDto
    {
        // El nuevo estado al que queremos pasar el pedido (Pending, Cooking, etc.)
        public OrderStatus NewStatus { get; set; }

        // El ID del usuario (Cocinero/Admin) que realiza la acción
        public long UserId { get; set; }
    }
}
