using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO; // Para UserDTO y UserCreateDto
using DTO.DTO;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography; // Necesario para el Hash
using System.Text; // Necesario para el Hash
using WebAPI; // Para el ManejadorJWT

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly IRepositoryUser _repoUser;
        private readonly IRepositoryBranch _repoBranch;

        public UserController(IRepositoryUser repoUser, IRepositoryBranch repoBranch)
        {
            _repoUser = repoUser;
            _repoBranch = repoBranch;
        }

        // =========================================================
        // 🔐 AUTENTICACIÓN (LOGIN)
        // =========================================================
        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequestDto loginDto)
        {
            string passwordHash = EncryptPassword(loginDto.Password);
            var user = _repoUser.Login(loginDto.Username, passwordHash);

            if (user == null)
            {
                return Unauthorized("Credenciales incorrectas (Sasageyo denegado).");
            }

            var userDto = new DTO.UserDTO(
                user.Id,
                user.Name,
                user.LastName,
                user.Phone,
                user.Picture
            )
            {
                Username = user.Username,
                BranchId = user.BranchId,
                TenantSlug = user.Branch?.Slug ?? string.Empty,
                TenantFolder = user.Branch?.TenantFolder ?? string.Empty
            };

            string userRoleString = user.Role.ToString();
            var tokenString = ManejadorJWT.GenerarToken(userDto, userRoleString);

            return Ok(new LoginResponseDto
            {
                Id = user.Id,
                Username = user.Username,
                Token = tokenString,
                Role = userRoleString,
                BranchId = user.BranchId,
                TenantSlug = user.Branch?.Slug ?? string.Empty,
                TenantFolder = user.Branch?.TenantFolder ?? string.Empty,
                PublicOrderingUrl = $"/order.html?tenant={Uri.EscapeDataString(user.Branch?.Slug ?? string.Empty)}"
            });
        }

        // =========================================================
        // 👤 CRUD DE USUARIOS
        // =========================================================

        [HttpGet]
        public ActionResult<IEnumerable<UserDTO>> GetAll()
        {
            try
            {
                var users = _repoUser.GetAll()
                    .Select(u => new UserDTO(
                        u.Id,
                        u.Name,
                        u.LastName,
                        u.Phone,
                        u.Picture
                    )
                    {
                        Username = u.Username,
                        Role = u.Role.ToString(),
                        BranchId = u.BranchId
                    });

                return Ok(users);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno: {ex.Message}");
            }
        }

        [HttpGet("{id}")]
        public ActionResult<UserDTO> Get(long id)
        {
            try
            {
                User user = _repoUser.Get(id);
                if (user == null) return NotFound($"Usuario {id} no encontrado.");

                return Ok(new UserDTO(user.Id, user.Name, user.LastName, user.Phone, user.Picture)
                {
                    Username = user.Username,
                    Role = user.Role.ToString(),
                    BranchId = user.BranchId
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost]
        public ActionResult Post([FromBody] UserCreateDto dto)
        {
            try
            {
                // 🔥 BORRAMOS LA VALIDACIÓN DE SUCURSAL AQUÍ 🔥

                if (!Enum.IsDefined(typeof(UserRole), dto.Role))
                {
                    return BadRequest("Rol inválido. Use: 1=Admin, 2=Kitchen, 3=Delivery");
                }

                bool userExists = _repoUser.GetAll().Any(u => u.Username.ToLower() == dto.Username.ToLower());
                if (userExists)
                {
                    return BadRequest($"El usuario '{dto.Username}' ya está en uso.");
                }

                var newUser = new User
                {
                    Username = dto.Username,
                    Name = dto.Name,
                    LastName = dto.LastName,
                    Phone = int.Parse(dto.Phone),
                    Picture = dto.Picture,
                    BranchId = 0, // 🔥 El ShingekiContext le pone el de la sucursal actual
                    IsDeleted = false,
                    Role = (UserRole)dto.Role
                };

                newUser.Password = EncryptPassword(dto.Password);

                _repoUser.Add(newUser);
                _repoUser.Save();

                return CreatedAtAction(nameof(Get), new { id = newUser.Id }, newUser.Id);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al crear usuario: {ex.Message}");
            }
        }

        [HttpPut("{id}")]
        public ActionResult Put(long id, [FromBody] User user)
        {
            if (id != user.Id) return BadRequest("ID no coincide.");

            try
            {
                var existingUser = _repoUser.Get(id);
                if (existingUser == null) return NotFound("Usuario no existe.");

                // 🔥 BORRAMOS LA VALIDACIÓN DE SUCURSAL AQUÍ 🔥

                if (!string.IsNullOrEmpty(user.Username) && user.Username != existingUser.Username)
                {
                    bool userExists = _repoUser.GetAll().Any(u => u.Username.ToLower() == user.Username.ToLower());
                    if (userExists)
                    {
                        return BadRequest($"El nombre de usuario '{user.Username}' ya está ocupado.");
                    }
                    existingUser.Username = user.Username;
                }

                existingUser.Name = user.Name;
                existingUser.LastName = user.LastName;
                existingUser.Phone = user.Phone;
                existingUser.Picture = user.Picture;
                // No tocamos el BranchId, se mantiene en la sucursal actual

                if (user.Role != 0)
                {
                    existingUser.Role = user.Role;
                }

                if (!string.IsNullOrEmpty(user.Password) && user.Password.Length > 0)
                {
                    existingUser.Password = EncryptPassword(user.Password);
                }

                _repoUser.Update(existingUser);
                _repoUser.Save();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al actualizar: {ex.Message}");
            }
        }

        [HttpDelete("{id}")]
        public ActionResult Delete(long id)
        {
            try
            {
                if (_repoUser.Get(id) == null) return NotFound("Usuario no existe.");

                _repoUser.Delete(id);
                _repoUser.Save();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al eliminar: {ex.Message}");
            }
        }

        private string EncryptPassword(string password)
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
    }
}
