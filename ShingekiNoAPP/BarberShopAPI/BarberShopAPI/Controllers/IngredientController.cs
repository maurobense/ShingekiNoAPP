using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using Microsoft.AspNetCore.Mvc;
using DTO; // Si tienes un DTO específico para Ingredientes, úsalo. Por ahora, asumiré que usas la entidad directa o un DTO simple.
using System.Collections.Generic;
using System.Linq;
using System;
using Microsoft.AspNetCore.Authorization; // Para el atributo [Authorize]

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")] // Esto define la ruta: /api/Ingredient
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
        // 🧪 GET ALL (NECESARIO PARA EL FRONTEND)
        // =========================================================
        [HttpGet]
        [Authorize(Roles = "Admin,BranchManager")] // Solo los autorizados pueden ver ingredientes
        public ActionResult<IEnumerable<Ingredient>> GetAll()
        {
            try
            {
                // Devolvemos la lista completa de ingredientes (excluyendo borrados lógicamente)
                var ingredients = _repoIngredient.GetAll().Where(i => !i.IsDeleted);

                // Si deseas usar un DTO aquí (ej: IngredientDTO), mapearías:
                // .Select(i => new IngredientDTO { ... })

                return Ok(ingredients);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno al obtener ingredientes: {ex.Message}");
            }
        }

        // =========================================================
        // 🧪 GET BY ID
        // =========================================================
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,BranchManager")]
        public ActionResult<Ingredient> Get(long id)
        {
            try
            {
                var ingredient = _repoIngredient.Get(id);
                if (ingredient == null || ingredient.IsDeleted) return NotFound($"Ingrediente {id} no encontrado.");

                return Ok(ingredient);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error interno: {ex.Message}");
            }
        }

        // =========================================================
        // ➕ POST (CREAR)
        // =========================================================
        [HttpPost]
        [Authorize(Roles = "Admin")] // Solo Admins pueden crear nuevos ingredientes en el sistema
        public ActionResult Post([FromBody] Ingredient ingredient)
        {
            try
            {
                // Asumo que tu entidad Ingredient tiene validaciones básicas
                _repoIngredient.Add(ingredient);
                _repoIngredient.Save();

                // 201 Created y devolvemos la URL del nuevo recurso
                return CreatedAtAction(nameof(Get), new { id = ingredient.Id }, ingredient);
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
            if (id != ingredient.Id) return BadRequest("ID no coincide.");

            try
            {
                var existingIngredient = _repoIngredient.Get(id);
                if (existingIngredient == null) return NotFound("Ingrediente no existe.");

                // Mapear solo las propiedades que se permiten actualizar (ej: Nombre, Unidad)
                existingIngredient.Name = ingredient.Name;
                existingIngredient.UnitOfMeasure = ingredient.UnitOfMeasure; // Asumo que existe esta propiedad
                // ... otras propiedades ...

                _repoIngredient.Update(existingIngredient);
                _repoIngredient.Save();

                return NoContent(); // 204 No Content para actualización exitosa
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
                if (ingredient == null) return NotFound("Ingrediente no existe.");

                // Borrado Lógico (Recomendado)
                ingredient.IsDeleted = true;
                _repoIngredient.Update(ingredient);
                _repoIngredient.Save();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al eliminar: {ex.Message}");
            }
        }
    }
}