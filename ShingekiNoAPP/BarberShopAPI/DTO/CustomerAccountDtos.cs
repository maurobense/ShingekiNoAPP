using System;
using System.Collections.Generic;

namespace DTO
{
    public class CustomerRegisterDto
    {
        public string Name { get; set; }
        public string LastName { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
    }

    public class CustomerLoginDto
    {
        public string Email { get; set; }
        public string Password { get; set; }
    }

    public class CustomerVerifyEmailDto
    {
        public string Email { get; set; }
        public string Code { get; set; }
    }

    public class CustomerResendCodeDto
    {
        public string Email { get; set; }
    }

    public class CustomerProfileUpdateDto
    {
        public string Name { get; set; }
        public string LastName { get; set; }
        public string Phone { get; set; }
    }

    public class CustomerChangePasswordDto
    {
        public string CurrentPassword { get; set; }
        public string NewPassword { get; set; }
    }

    public class CustomerSessionDto
    {
        public string Token { get; set; }
        public CustomerProfileDto Customer { get; set; }
    }

    public class CustomerProfileDto
    {
        public long Id { get; set; }
        public string Name { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public int Phone { get; set; }
        public bool IsEmailVerified { get; set; }
        public long BranchId { get; set; }
        public string TenantSlug { get; set; }
        public string BrandName { get; set; }
        public string PublicOrderingUrl { get; set; }
        public CustomerOrderSummaryDto? CurrentOrder { get; set; }
    }

    public class CustomerAddressDto
    {
        public long Id { get; set; }
        public string Street { get; set; }
        public string City { get; set; }
        public string Region { get; set; }
        public int PostalCode { get; set; }
        public string Country { get; set; }
        public string Label { get; set; }
    }

    public class CustomerOrderSummaryDto
    {
        public long Id { get; set; }
        public DateTime OrderDate { get; set; }
        public string Status { get; set; }
        public string PaymentMethod { get; set; }
        public decimal TotalAmount { get; set; }
        public string TrackingNumber { get; set; }
        public string TrackingUrl { get; set; }
        public List<OrderItemResponseDto> Items { get; set; }
    }
}
