using Microsoft.AspNetCore.Mvc;
using Business.BusinessEntities;
using Business.RepositoryInterfaces;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // [Authorize(Roles = "Admin, Kitchen")]
    public class IngredientsController : ControllerBase
    {
        private readonly IRepositoryIngredient _repoIngredient;

        public IngredientsController(IRepositoryIngredient repoIngredient)
        {
            _repoIngredient = repoIngredient;
        }

        // GET: api/Ingredients
        [HttpGet]
        public ActionResult<IEnumerable<Ingredient>> GetAll()
        {
            // Nota: Aquí se devuelve la entidad Ingredient directamente si no creaste DTOs
            return Ok(_repoIngredient.GetAll());
        }

        // POST: api/Ingredients
        [HttpPost]
        public IActionResult Create([FromBody] Ingredient ingredient)
        {
            try
            {
                _repoIngredient.Add(ingredient);
                _repoIngredient.Save();

                return CreatedAtAction(nameof(Get), new { id = ingredient.Id }, ingredient.Id);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al crear ingrediente: {ex.Message}");
            }
        }

        // GET: api/Ingredients/5
        [HttpGet("{id}")]
        public ActionResult<Ingredient> Get(long id)
        {
            var ingredient = _repoIngredient.Get(id);
            if (ingredient == null) return NotFound();
            return Ok(ingredient);
        }

        // El resto del CRUD (PUT y DELETE) seguiría el mismo patrón que CategoriesController.
    }
}