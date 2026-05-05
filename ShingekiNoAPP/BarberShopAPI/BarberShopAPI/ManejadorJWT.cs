using Business.BusinessEntities;
using DTO;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace WebAPI
{
    public class ManejadorJWT
    {
        public static string GenerarToken(UserDTO usu, string role)
        {
            JwtSecurityTokenHandler tokenHandler = new JwtSecurityTokenHandler();
            byte[] clave = Encoding.ASCII.GetBytes("ZWRpw6fDo28gZW0gY29tcHV0YWRvcmE=");

            SecurityTokenDescriptor tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, usu.Id.ToString()),
                    new Claim(ClaimTypes.Name, usu.Name),
                    new Claim(ClaimTypes.Role, role),
                    new Claim("BranchId", usu.BranchId.ToString()),
                    new Claim("TenantSlug", usu.TenantSlug ?? string.Empty),
                    new Claim("TenantFolder", usu.TenantFolder ?? string.Empty)
                }),
                Expires = DateTime.UtcNow.AddDays(7),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(clave),
                SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        public static string GenerarTokenCliente(Client client, Branch branch)
        {
            JwtSecurityTokenHandler tokenHandler = new JwtSecurityTokenHandler();
            byte[] clave = Encoding.ASCII.GetBytes("ZWRpw6fDo28gZW0gY29tcHV0YWRvcmE=");

            SecurityTokenDescriptor tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, client.Id.ToString()),
                    new Claim(ClaimTypes.Name, client.Name ?? string.Empty),
                    new Claim(ClaimTypes.Email, client.Email ?? string.Empty),
                    new Claim(ClaimTypes.Role, "Customer"),
                    new Claim("BranchId", branch.Id.ToString()),
                    new Claim("TenantSlug", branch.Slug ?? string.Empty),
                    new Claim("TenantFolder", branch.TenantFolder ?? string.Empty),
                    new Claim("CustomerId", client.Id.ToString())
                }),
                Expires = DateTime.UtcNow.AddDays(30),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(clave),
                SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}
