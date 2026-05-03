using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Collections.Generic;
using System.Linq;
using System;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class IngredientController : ControllerBase
    {
        private readonly IRepositoryIngredient _repoIngredient;

        // Inyección de Dependencia
        public IngredientController(IRepositoryIngredient repoIngredient)
        {
            _repoIngredient = repoIngredient;
        }

        // =========================================================
        // 🧪 GET ALL (OPTIMIZADO PARA SOMEE)
        // =========================================================
        [HttpGet]
        [Authorize(Roles = "Admin,BranchManager")]
        public ActionResult GetAll()
        {
            try
            {
                // Al usar .Select() forzamos a Entity Framework a traer SOLO los datos básicos
                // ignorando cualquier relación pesada que ahogue a Somee.
                var ingredients = _repoIngredient.GetAll()
                    .Where(i => !i.IsDeleted)
                    .Select(i => new
                    {
                        i.Id,
                        i.Name,
                        i.UnitOfMeasure,
                        i.ImageUrl,
                        i.BranchId
                        // Si tenés más propiedades simples (como precio o unidad), agregalas acá.
                        // ❌ NUNCA pongas acá propiedades de navegación (colecciones o clases virtuales).
                    })
                    .ToList();

                return Ok(ingredients);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno al obtener ingredientes: {ex.Message}");
            }
        }

        // =========================================================
        // 🧪 GET BY ID (OPTIMIZADO PARA SOMEE)
        // =========================================================
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,BranchManager")]
        public ActionResult Get(long id)
        {
            try
            {
                var ingredient = _repoIngredient.Get(id);
                if (ingredient == null || ingredient.IsDeleted) return NotFound($"Ingrediente {id} no encontrado.");

                // Devolvemos un objeto anónimo para evitar la recursividad del JSON
                return Ok(new
                {
                    ingredient.Id,
                    ingredient.Name,
                    ingredient.UnitOfMeasure,
                    ingredient.ImageUrl,
                    ingredient.BranchId
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno: {ex.Message}");
            }
        }

        // =========================================================
        // ➕ POST (CREAR - OPTIMIZADO PARA SOMEE)
        // =========================================================
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public ActionResult Post([FromBody] Ingredient ingredient)
        {
            try
            {
                _repoIngredient.Add(ingredient);
                _repoIngredient.Save();

                // Creamos un objeto ligero para la respuesta en lugar de devolver el 'ingredient' crudo
                var respuestaLigera = new
                {
                    id = ingredient.Id,
                    name = ingredient.Name,
                    unitOfMeasure = ingredient.UnitOfMeasure,
                    imageUrl = ingredient.ImageUrl,
                    branchId = ingredient.BranchId
                };

                return CreatedAtAction(nameof(Get), new { id = ingredient.Id }, respuestaLigera);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al crear el ingrediente: {ex.Message}");
            }
        }

        // =========================================================
        // ✏️ PUT (ACTUALIZAR)
        // =========================================================
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public ActionResult Put(long id, [FromBody] Ingredient ingredient)
        {
            if (id != ingredient.Id) return BadRequest("El ID no coincide.");

            try
            {
                var existingIngredient = _repoIngredient.Get(id);
                if (existingIngredient == null || existingIngredient.IsDeleted) return NotFound("Ingrediente no existe.");

                // Actualizamos solo los campos de texto/valores
                existingIngredient.Name = ingredient.Name;
                existingIngredient.UnitOfMeasure = ingredient.UnitOfMeasure;
                existingIngredient.ImageUrl = ingredient.ImageUrl;

                _repoIngredient.Update(existingIngredient);
                _repoIngredient.Save();

                return NoContent(); // 204 No Content para evitar devolver entidades completas
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al actualizar: {ex.Message}");
            }
        }

        // =========================================================
        // 🗑️ DELETE (Borrado Lógico)
        // =========================================================
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public ActionResult Delete(long id)
        {
            try
            {
                var ingredient = _repoIngredient.Get(id);
                if (ingredient == null || ingredient.IsDeleted) return NotFound("Ingrediente no existe.");

                // Borrado Lógico
                ingredient.IsDeleted = true;
                _repoIngredient.Update(ingredient);
                _repoIngredient.Save();

                return NoContent(); // 204 No Content
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al eliminar: {ex.Message}");
            }
        }
    }
}
