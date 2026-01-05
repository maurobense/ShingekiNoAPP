using DTO;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace WebAPI
{
    public class ManejadorJWT
    {
        // Adaptamos para recibir el rol
        public static string GenerarToken(UserDTO usu, string role)
        {
            JwtSecurityTokenHandler tokenHandler = new JwtSecurityTokenHandler();

            // ⚠️ La clave secreta debe ser leída desde la configuración (IConfiguration)
            // Para mantener la consistencia con el código original:
            byte[] clave = Encoding.ASCII.GetBytes("ZWRpw6fDo28gZW0gY29tcHV0YWRvcmE=");

            SecurityTokenDescriptor tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.NameIdentifier, usu.Id.ToString()), // ID del usuario
                    new Claim(ClaimTypes.Name, usu.Name),                    // Nombre del usuario
                    
                    // ✅ CORRECCIÓN CLAVE: Agregamos el ClaimTypes.Role
                    new Claim(ClaimTypes.Role, role)
                }),
                // Duración del token: 7 días
                Expires = DateTime.UtcNow.AddDays(7),

                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(clave),
                SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);

            return tokenHandler.WriteToken(token);
        }
    }
}