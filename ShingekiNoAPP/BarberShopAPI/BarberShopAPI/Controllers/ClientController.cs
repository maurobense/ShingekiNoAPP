using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ClientController : ControllerBase
    {
        private readonly IRepositoryClient _repoClient;
        private readonly IRepositoryClientAddress _repoAddress;

        public ClientController(IRepositoryClient repoClient, IRepositoryClientAddress repoAddress)
        {
            _repoClient = repoClient;
            _repoAddress = repoAddress;
        }

        // =========================================================
        // 👤 GESTIÓN DE CLIENTES
        // =========================================================

        // GET: api/Client
        [HttpGet]
        public ActionResult<IEnumerable<ClientResponseDto>> GetAll()
        {
            try
            {
                var clients = _repoClient.GetAll();

                var dtos = clients.Select(c => new ClientResponseDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    LastName = c.LastName,
                    Phone = c.Phone,
                    Addresses = c.Addresses?.Select(a => new AddressResponseDto
                    {
                        Id = a.Id,
                        FullAddress = $"{a.Street}, {a.City}",
                        Label = a.Label
                    }).ToList() ?? new List<AddressResponseDto>()
                });

                return Ok(dtos);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno: {ex.Message}");
            }
        }

        // GET: api/Client/5
        [HttpGet("{id}")]
        public ActionResult<ClientResponseDto> Get(long id)
        {
            var client = _repoClient.Get(id);

            if (client == null) return NotFound($"Cliente {id} no encontrado.");

            var dto = new ClientResponseDto
            {
                Id = client.Id,
                Name = client.Name,
                LastName = client.LastName,
                Phone = client.Phone,
                Addresses = client.Addresses?.Select(a => new AddressResponseDto
                {
                    Id = a.Id,
                    FullAddress = $"{a.Street}, {a.City}",
                    Label = a.Label
                }).ToList()
            };

            return Ok(dto);
        }

        // POST: api/Client
        [HttpPost]
        public ActionResult Create([FromBody] ClientCreateDto dto)
        {
            try
            {
                var newClient = new Client
                {
                    Name = dto.Name,
                    LastName = dto.LastName,
                    Phone = dto.Phone,
                    IsDeleted = false
                };

                _repoClient.Add(newClient);
                _repoClient.Save();

                // 🔥 CORRECCIÓN IMPORTANTE AQUÍ:
                // Devolvemos 'newClient' (el objeto completo) en lugar de 'newClient.Id'.
                // Así el frontend recibe un JSON: { "id": 1, "name": "...", ... }
                return CreatedAtAction(nameof(Get), new { id = newClient.Id }, newClient);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al crear cliente: {ex.Message}");
            }
        }

        // =========================================================
        // 🏠 GESTIÓN DE DIRECCIONES (CREAR / LEER)
        // =========================================================

        // GET api/Client/5/Addresses
        [HttpGet("{id}/addresses")]
        public ActionResult<IEnumerable<AddressResponseDto>> GetAddresses(long id)
        {
            if (_repoClient.Get(id) == null) return NotFound("Cliente no encontrado.");

            var addresses = _repoClient.GetAddresses(id);

            var dtos = addresses.Select(a => new AddressResponseDto
            {
                Id = a.Id,
                FullAddress = $"{a.Street}, {a.City}, {a.Region}",
                Label = a.Label,
                // Mapeamos propiedades individuales por si el front las necesita separadas
            });

            return Ok(dtos);
        }

        // POST api/Client/5/Addresses
        [HttpPost("{clientId}/addresses")]
        public ActionResult AddAddress(long clientId, [FromBody] AddressCreateDto dto)
        {
            if (_repoClient.Get(clientId) == null) return NotFound("Cliente no encontrado.");

            try
            {
                var newAddress = new ClientAddress
                {
                    ClientId = clientId,
                    Street = dto.Street,
                    City = dto.City,
                    Region = dto.Region,
                    PostalCode = dto.PostalCode,
                    Country = dto.Country,
                    Label = dto.Label
                };

                _repoAddress.Add(newAddress);
                _repoAddress.Save();

                return Ok(new { Message = "Dirección agregada", AddressId = newAddress.Id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al agregar dirección: {ex.Message}");
            }
        }

        // =========================================================
        // ✏️ GESTIÓN DE DIRECCIONES (EDITAR / BORRAR)
        // =========================================================

        // PUT api/Client/address/5
        [HttpPut("address/{id}")]
        public IActionResult UpdateAddress(long id, [FromBody] AddressCreateDto dto)
        {
            try
            {
                var address = _repoAddress.Get(id);
                if (address == null) return NotFound("Dirección no encontrada.");

                // Actualizamos campos
                address.Street = dto.Street;
                address.City = dto.City;
                address.Region = dto.Region;
                address.PostalCode = dto.PostalCode;
                address.Label = dto.Label;
                // No cambiamos el ClientId ni el Country si no es necesario

                _repoAddress.Update(address);
                _repoAddress.Save();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al actualizar: {ex.Message}");
            }
        }

        // DELETE api/Client/address/5
        [HttpDelete("address/{id}")]
        public IActionResult DeleteAddress(long id)
        {
            try
            {
                var address = _repoAddress.Get(id);
                if (address == null) return NotFound("Dirección no encontrada.");

                _repoAddress.Delete(id);
                _repoAddress.Save();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al eliminar: {ex.Message}");
            }
        }
    }
}