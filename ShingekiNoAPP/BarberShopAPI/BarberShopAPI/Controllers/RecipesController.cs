using Microsoft.AspNetCore.Mvc;
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/recipes")] // URL más amigable para recetas
    [ApiController]
    // [Authorize(Roles = "Admin")]
    public class RecipesController : ControllerBase
    {
        private readonly IRepositoryProductIngredient _repoRecipe;
        private readonly IRepositoryProduct _repoProduct;
        private readonly IRepositoryIngredient _repoIngredient;

        public RecipesController(
            IRepositoryProductIngredient repoRecipe,
            IRepositoryProduct repoProduct,
            IRepositoryIngredient repoIngredient)
        {
            _repoRecipe = repoRecipe;
            _repoProduct = repoProduct;
            _repoIngredient = repoIngredient;
        }

        // GET: api/recipes/product/5
        // Obtiene la receta completa de un producto
        [HttpGet("product/{productId}")]
        public IActionResult GetRecipeByProductId(long productId)
        {
            if (_repoProduct.Get(productId) == null)
                return NotFound($"Producto {productId} no encontrado.");

            var recipe = _repoRecipe.GetRecipeByProductId(productId);

            // Mapeo para devolver solo datos relevantes del ingrediente
            var dtos = recipe.Select(ri => new
            {
                IngredientId = ri.IngredientId,
                IngredientName = ri.Ingredient.Name,
                QuantityRequired = ri.Quantity, // Cantidad que lleva el producto
                UnitOfMeasure = ri.Ingredient.UnitOfMeasure // Unidad del ingrediente
            });

            return Ok(dtos);
        }

        // POST: api/recipes (Agregar o actualizar un ingrediente en una receta)
        [HttpPost]
        public IActionResult AddIngredientToRecipe([FromBody] ProductIngredient recipeItem)
        {
            if (_repoProduct.Get(recipeItem.ProductId) == null)
                return BadRequest("Producto no válido.");
            if (_repoIngredient.Get(recipeItem.IngredientId) == null)
                return BadRequest("Ingrediente no válido.");

            try
            {
                // NOTA: La lógica de si es Add o Update debe manejarse en el repositorio o servicio.
                // Aquí usamos la función genérica Add, asumiendo que el repositorio maneja la inserción/actualización de la clave compuesta.

                _repoRecipe.Add(recipeItem); // Esto fallará si la receta ya existe (Unique key violation)
                _repoRecipe.Save();

                return Created("Receta actualizada", recipeItem);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al actualizar receta: {ex.Message}");
            }
        }
    }
}