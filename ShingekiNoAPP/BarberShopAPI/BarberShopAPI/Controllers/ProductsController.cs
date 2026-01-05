using Microsoft.AspNetCore.Mvc;
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using DTO;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // [Authorize(Roles = "Admin, Kitchen")] 
    public class ProductsController : ControllerBase
    {
        private readonly IRepositoryProduct _repoProduct;
        private readonly IRepositoryCategory _repoCategory;

        public ProductsController(IRepositoryProduct repoProduct, IRepositoryCategory repoCategory)
        {
            _repoProduct = repoProduct;
            _repoCategory = repoCategory;
        }

        // =========================================================
        // 🍔 GET: LISTAR PRODUCTOS (MENÚ)
        // =========================================================
        [HttpGet]
        public ActionResult<IEnumerable<ProductResponseDto>> GetAll()
        {
            try
            {
                var products = _repoProduct.GetAll();

                var dtos = products.Select(p => new ProductResponseDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Description = p.Description,
                    Price = p.Price,
                    ImageUrl = p.ImageUrl,

                    // ✅ CORRECCIÓN CRÍTICA: Devolver el ID para que el front sepa cuál seleccionar
                    CategoryId = p.CategoryId,

                    CategoryName = _repoCategory.Get(p.CategoryId)?.Name ?? "Sin Categoría"
                });

                return Ok(dtos);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno: {ex.Message}");
            }
        }

        // =========================================================
        // 🔍 GET: UN PRODUCTO POR ID
        // =========================================================
        [HttpGet("{id}")]
        public ActionResult<ProductResponseDto> Get(long id)
        {
            var p = _repoProduct.Get(id);

            if (p == null) return NotFound($"Producto {id} no encontrado.");

            var dto = new ProductResponseDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                Price = p.Price,
                ImageUrl = p.ImageUrl,

                // ✅ CORRECCIÓN CRÍTICA
                CategoryId = p.CategoryId,

                CategoryName = _repoCategory.Get(p.CategoryId)?.Name ?? "Sin Categoría"
            };

            return Ok(dto);
        }

        // =========================================================
        // ➕ POST: CREAR PRODUCTO
        // =========================================================
        [HttpPost]
        public ActionResult Create([FromBody] ProductCreateDto dto)
        {
            try
            {
                if (_repoCategory.Get(dto.CategoryId) == null)
                {
                    return BadRequest("La categoría especificada no existe.");
                }

                var newProduct = new Product
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    Price = dto.Price,
                    ImageUrl = dto.ImageUrl,
                    CategoryId = dto.CategoryId,
                    IsActive = true,
                    IsDeleted = false
                };

                _repoProduct.Add(newProduct);
                _repoProduct.Save();

                return CreatedAtAction(nameof(Get), new { id = newProduct.Id }, newProduct.Id);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al crear producto: {ex.Message}");
            }
        }

        // =========================================================
        // ✏️ PUT: ACTUALIZAR PRODUCTO
        // =========================================================
        [HttpPut("{id}")]
        public ActionResult Update(long id, [FromBody] ProductCreateDto dto)
        {
            try
            {
                var product = _repoProduct.Get(id);
                if (product == null) return NotFound("Producto no encontrado.");

                if (product.CategoryId != dto.CategoryId && _repoCategory.Get(dto.CategoryId) == null)
                {
                    return BadRequest("La nueva categoría no existe.");
                }

                product.Name = dto.Name;
                product.Description = dto.Description;
                product.Price = dto.Price;
                product.ImageUrl = dto.ImageUrl;
                product.CategoryId = dto.CategoryId;

                _repoProduct.Update(product);
                _repoProduct.Save();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al actualizar: {ex.Message}");
            }
        }

        // =========================================================
        // 🗑️ DELETE: ELIMINAR PRODUCTO
        // =========================================================
        [HttpDelete("{id}")]
        public ActionResult Delete(long id)
        {
            try
            {
                if (_repoProduct.Get(id) == null) return NotFound("Producto no encontrado.");

                _repoProduct.Delete(id);
                _repoProduct.Save();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al eliminar: {ex.Message}");
            }
        }
    }
}