using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Business.BusinessEntities
{
    public class Client : BaseEntity
    {
        [Key]
        public long Id { get; set; }
        public string Name { get; set; }
        public string LastName { get; set; }
        public int Phone { get; set; }
        public string? Email { get; set; }
        public string? PasswordHash { get; set; }
        public bool IsEmailVerified { get; set; } = false;
        public string? EmailVerificationCodeHash { get; set; }
        public DateTime? EmailVerificationCodeExpiresAt { get; set; }
        public DateTime? EmailVerificationLastSentAt { get; set; }
        public int EmailVerificationFailedAttempts { get; set; } = 0;
        public DateTime? LastLoginAt { get; set; }
        [JsonIgnore]
        public ICollection<ClientAddress> Addresses { get; set; }
        [JsonIgnore]
        public ICollection<Order> Orders { get; set; }
        public bool IsDeleted { get; set; } = false; // Soft Delete
        public long BranchId { get; set; }
        public Client() { }
        public Client(string name, string lastName, int phone)
        {
            Name = name;
            LastName = lastName;
            Phone = phone;
        }
    }
}
