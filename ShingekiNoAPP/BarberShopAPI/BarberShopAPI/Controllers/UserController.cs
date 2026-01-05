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
            // 1. Encriptamos la contraseña entrante para compararla con el Hash de la BD
            string passwordHash = EncryptPassword(loginDto.Password);

            // 2. Validar usuario contra base de datos usando el Hash y el Username
            var user = _repoUser.Login(loginDto.Username, passwordHash);

            if (user == null)
            {
                return Unauthorized("Credenciales incorrectas (Sasageyo denegado).");
            }

            // 3. Mapear la entidad User a un UserDTO
            var userDto = new DTO.UserDTO(
                user.Id,
                user.Name,
                user.LastName,
                user.Phone,
                user.Picture
            )
            {
                // Aseguramos enviar también el Username en el login por si se necesita
                Username = user.Username
            };

            // 4. Generar el Token JWT
            string userRoleString = user.Role.ToString();
            var tokenString = ManejadorJWT.GenerarToken(userDto, userRoleString);

            // 5. Devolver datos + Token
            return Ok(new LoginResponseDto
            {
                Id = user.Id,
                Username = user.Username, // Devolvemos el Username real
                Token = tokenString,
                Role = userRoleString
            });
        }

        // =========================================================
        // 👤 CRUD DE USUARIOS
        // =========================================================

        // --- GET ALL ---
        [HttpGet]
        public ActionResult<IEnumerable<UserDTO>> GetAll()
        {
            try
            {
                // 🔥 CORRECCIÓN FINAL: Incluimos Username y Role (como string)
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
                        Role = u.Role.ToString() // <--- ¡ESTO FALTABA PARA QUE FUNCIONE EL FILTRO DE ROLES!
                    });

                return Ok(users);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno: {ex.Message}");
            }
        }

        // --- GET BY ID ---
        [HttpGet("{id}")]
        public ActionResult<UserDTO> Get(long id)
        {
            try
            {
                User user = _repoUser.Get(id);
                if (user == null) return NotFound($"Usuario {id} no encontrado.");

                return Ok(new UserDTO(user.Id, user.Name, user.LastName, user.Phone, user.Picture)
                {
                    Username = user.Username // También lo enviamos aquí
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // --- POST (CREAR / REGISTRO) ---
        [HttpPost]
        public ActionResult Post([FromBody] UserCreateDto dto)
        {
            try
            {
                // 1. Validar Sucursal
                if (_repoBranch.Get(dto.BranchId) == null)
                {
                    return BadRequest("La sucursal indicada no existe.");
                }

                // 2. Validar que el Rol sea válido
                if (!Enum.IsDefined(typeof(UserRole), dto.Role))
                {
                    return BadRequest("Rol inválido. Use: 1=Admin, 2=Kitchen, 3=Delivery");
                }

                // 3. Validar que el Username no exista ya
                bool userExists = _repoUser.GetAll().Any(u => u.Username.ToLower() == dto.Username.ToLower());
                if (userExists)
                {
                    return BadRequest($"El usuario '{dto.Username}' ya está en uso.");
                }

                // 4. Mapear DTO a Entidad
                var newUser = new User
                {
                    Username = dto.Username,
                    Name = dto.Name,
                    LastName = dto.LastName,
                    Phone = int.Parse(dto.Phone),
                    Picture = dto.Picture,
                    BranchId = dto.BranchId,
                    IsDeleted = false,
                    Role = (UserRole)dto.Role
                };

                // 5. Encriptar Password
                newUser.Password = EncryptPassword(dto.Password);

                // 6. Guardar
                _repoUser.Add(newUser);
                _repoUser.Save();

                return CreatedAtAction(nameof(Get), new { id = newUser.Id }, newUser.Id);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al crear usuario: {ex.Message}");
            }
        }

        // --- PUT (ACTUALIZAR) ---
        [HttpPut("{id}")]
        public ActionResult Put(long id, [FromBody] User user)
        {
            if (id != user.Id) return BadRequest("ID no coincide.");

            try
            {
                var existingUser = _repoUser.Get(id);
                if (existingUser == null) return NotFound("Usuario no existe.");

                // Validar Sucursal si cambió
                if (user.BranchId != existingUser.BranchId && _repoBranch.Get(user.BranchId) == null)
                {
                    return BadRequest("La nueva sucursal indicada no existe.");
                }

                // Validar cambio de Username (Unicidad)
                if (!string.IsNullOrEmpty(user.Username) && user.Username != existingUser.Username)
                {
                    bool userExists = _repoUser.GetAll().Any(u => u.Username.ToLower() == user.Username.ToLower());
                    if (userExists)
                    {
                        return BadRequest($"El nombre de usuario '{user.Username}' ya está ocupado.");
                    }
                    existingUser.Username = user.Username;
                }

                // Actualizamos campos básicos
                existingUser.Name = user.Name;
                existingUser.LastName = user.LastName;
                existingUser.Phone = user.Phone;
                existingUser.Picture = user.Picture;
                existingUser.BranchId = user.BranchId;

                // Actualizar Rol si viene
                if (user.Role != 0)
                {
                    existingUser.Role = user.Role;
                }

                // Si viene una nueva contraseña y no está vacía, la encriptamos y actualizamos
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

        // --- DELETE (ELIMINAR) ---
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

        // =========================================================
        // 🔐 MÉTODO PRIVADO DE ENCRIPTACIÓN (SHA256)
        // =========================================================
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