using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class ProductIngredientController : ControllerBase
    {
        private readonly IRepositoryProductIngredient _repoRecipe;
        private readonly IRepositoryProduct _repoProduct;
        private readonly IRepositoryIngredient _repoIngredient;

        public ProductIngredientController(
            IRepositoryProductIngredient repoRecipe,
            IRepositoryProduct repoProduct,
            IRepositoryIngredient repoIngredient)
        {
            _repoRecipe = repoRecipe;
            _repoProduct = repoProduct;
            _repoIngredient = repoIngredient;
        }

        // GET: api/ProductIngredient/product/{productId}
        [HttpGet("product/{productId}")]
        public ActionResult GetByProduct(long productId)
        {
            try
            {
                // PASO 1: Traer los datos crudos de la tabla intermedia
                // Al hacer .ToList() aquí, forzamos a que traiga los IDs reales de la base de datos
                var rawItems = _repoRecipe.GetAll()
                    .Where(pi => pi.ProductId == productId && !pi.IsDeleted)
                    .ToList();

                // PASO 2: Mapear los nombres en memoria (LINQ to Objects)
                // Ahora que los datos están en memoria, podemos buscar los nombres sin romper la query
                var recipeItems = rawItems.Select(pi => new
                {
                    pi.Id, // <-- Aquí ya debería venir el número correcto (ej. 54)
                    pi.ProductId,
                    pi.IngredientId,
                    IngredientName = _repoIngredient.Get(pi.IngredientId)?.Name ?? "Desconocido",
                    Unit = _repoIngredient.Get(pi.IngredientId)?.UnitOfMeasure ?? "u",
                    pi.Quantity
                })
                .ToList();

                return Ok(recipeItems);
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
        // DELETE: api/ProductIngredient/product/{productId}/ingredient/{ingredientId}
        [HttpDelete("product/{productId}/ingredient/{ingredientId}")]
        public ActionResult RemoveByRelation(long productId, long ingredientId)
        {
            try
            {
                // Buscamos por la PAREJA DE IDs
                var item = _repoRecipe.GetAll()
                    .FirstOrDefault(x => x.ProductId == productId && x.IngredientId == ingredientId && !x.IsDeleted);

                if (item == null) return NotFound("El ingrediente no existe en esta receta.");

                // Borrado Lógico
                item.IsDeleted = true;
                _repoRecipe.Update(item);
                _repoRecipe.Save();

                return NoContent();
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
        // POST: api/ProductIngredient
        [HttpPost]
        public ActionResult AddIngredientToProduct([FromBody] ProductIngredientDto dto)
        {
            try
            {
                if (dto.Quantity <= 0) return BadRequest("La cantidad debe ser mayor a 0.");
                if (_repoProduct.Get(dto.ProductId) == null) return BadRequest("Producto no existe.");
                if (_repoIngredient.Get(dto.IngredientId) == null) return BadRequest("Ingrediente no existe.");

                // 1. BUSCAR SI YA EXISTE (INCLUYENDO BORRADOS)
                // Obtenemos todos y filtramos en memoria para encontrar la coincidencia exacta de IDs
                var existing = _repoRecipe.GetAll()
                    .FirstOrDefault(x => x.ProductId == dto.ProductId && x.IngredientId == dto.IngredientId);

                if (existing != null)
                {
                    // CASO A: Ya existe y está activo -> Error
                    if (!existing.IsDeleted)
                    {
                        return BadRequest("Este ingrediente ya está en la receta. Bórralo primero si quieres cambiarlo.");
                    }

                    // CASO B: Existe pero estaba "borrado" -> LO REVIVIMOS
                    existing.IsDeleted = false;
                    existing.Quantity = dto.Quantity; // Actualizamos la cantidad

                    _repoRecipe.Update(existing);
                    _repoRecipe.Save();

                    return Ok(new { Message = "Ingrediente restaurado y actualizado." });
                }

                // CASO C: No existe -> CREAR NUEVO
                var newItem = new ProductIngredient
                {
                    ProductId = dto.ProductId,
                    IngredientId = dto.IngredientId,
                    Quantity = dto.Quantity,
                    IsDeleted = false
                };

                _repoRecipe.Add(newItem);
                _repoRecipe.Save();

                return Ok(new { Message = "Ingrediente agregado." });
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }

        // DELETE: api/ProductIngredient/{id}
        [HttpDelete("{id}")]
        public ActionResult RemoveIngredient(long id)
        {
            try
            {
                var item = _repoRecipe.Get(id);
                if (item == null) return NotFound("Ítem no encontrado.");

                item.IsDeleted = true;
                _repoRecipe.Update(item);
                _repoRecipe.Save();

                return NoContent();
            }
            catch (Exception ex) { return StatusCode(500, ex.Message); }
        }
    }
}