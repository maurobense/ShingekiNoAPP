using Business.BusinessEntities;
using Business.BusinessInterfaces;
using Microsoft.EntityFrameworkCore; // <--- NECESARIO PARA [Index]
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Security.Cryptography;
using System.Text;

namespace Business.BusinessEntities
{
    // Agregamos el índice único aquí arriba para el Username
    [Index(nameof(Username), IsUnique = true)]
    public class User : BaseEntity, IValidable
    {
        [Key]
        public long Id { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public bool IsDeleted { get; set; } = false;

        // --- NUEVO CAMPO USERNAME ---
        [Required]
        [Column(TypeName = "nvarchar(100)")] // Opcional: define largo máximo
        public string Username { get; set; } = " "; // Valor por defecto: espacio vacío

        [Required]
        public string Name { get; set; }

        [Required]
        public string LastName { get; set; }

        [Required]
        public string Password { get; set; }

        public int Phone { get; set; }

        // Relación con Branch
        public long BranchId { get; set; }
        public Branch? Branch { get; set; }

        public string? Picture { get; set; }

        public UserRole Role { get; set; }

        // Mantenemos tu método HashPassword (aunque idealmente iría en un servicio)
        public string HashPassword(string password)
        {
            if (string.IsNullOrEmpty(password)) return "";

            using (var sha256 = SHA256.Create())
            {
                var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
                var builder = new StringBuilder();
                for (int i = 0; i < bytes.Length; i++)
                {
                    builder.Append(bytes[i].ToString("x2"));
                }
                return builder.ToString();
            }
        }

        public void Validate()
        {
            // Validaciones extra si son necesarias
            if (string.IsNullOrWhiteSpace(Username))
                throw new Exception("El nombre de usuario es obligatorio.");
        }
    }
}