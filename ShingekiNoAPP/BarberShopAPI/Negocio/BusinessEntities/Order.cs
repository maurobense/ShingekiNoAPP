using Business.BusinessEntities;
using Business.BusinessInterfaces;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Business.BusinessEntities
{
    public class Order : BaseEntity
    {
        public Guid TrackingNumber { get; set; } = Guid.NewGuid();

        // 🗓️ PROPIEDAD AGREGADA: Fecha de creación del pedido
        public DateTime OrderDate { get; set; } = DateTime.UtcNow;

        public OrderStatus CurrentStatus { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalAmount { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal Discount { get; set; } // Descuento global del pedido

        public string? Note { get; set; }

        // --- RELACIONES ---

        // Relación 1:1 con la dirección de envío
        public long ClientAddressId { get; set; }
        public ClientAddress DeliveryAddress { get; set; } // Propiedad de Navegación (tipo CLASE)

        public long BranchId { get; set; }
        public Branch Branch { get; set; }
        public PaymentMethod PaymentMethod { get; set; } // 🔥 NUEVO
        public long? ClientId { get; set; }
        public Client? Client { get; set; }

        // Colecciones
        public ICollection<OrderItem> OrderItems { get; set; }
        public ICollection<OrderStatusHistory> StatusHistory { get; set; }
    }

    // Nota: Si moviste este Enum a un archivo separado (UserRole.cs), bórralo de aquí.

}