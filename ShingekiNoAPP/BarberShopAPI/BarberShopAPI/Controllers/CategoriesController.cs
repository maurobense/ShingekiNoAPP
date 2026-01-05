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
    // [Authorize(Roles = "Admin")]
    public class CategoriesController : ControllerBase
    {
        private readonly IRepositoryCategory _repoCategory;

        public CategoriesController(IRepositoryCategory repoCategory)
        {
            _repoCategory = repoCategory;
        }

        // GET: api/Categories
        [HttpGet]
        public ActionResult<IEnumerable<CategoryDto>> GetAll()
        {
            var categories = _repoCategory.GetAll();

            var dtos = categories.Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description
            });

            return Ok(dtos);
        }

        // GET: api/Categories/5
        [HttpGet("{id}")]
        public ActionResult<CategoryDto> Get(long id)
        {
            var category = _repoCategory.Get(id);
            if (category == null) return NotFound();

            var dto = new CategoryDto
            {
                Id = category.Id,
                Name = category.Name,
                Description = category.Description
            };

            return Ok(dto);
        }

        // POST: api/Categories
        [HttpPost]
        public IActionResult Create([FromBody] CategoryCreateDto dto)
        {
            try
            {
                var newCategory = new Category
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    IsDeleted = false
                };

                _repoCategory.Add(newCategory);
                _repoCategory.Save();

                return CreatedAtAction(nameof(Get), new { id = newCategory.Id }, newCategory.Id);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al crear categoría: {ex.Message}");
            }
        }

        // PUT: api/Categories/5
        [HttpPut("{id}")]
        public IActionResult Update(long id, [FromBody] CategoryCreateDto dto)
        {
            try
            {
                var category = _repoCategory.Get(id);
                if (category == null) return NotFound();

                category.Name = dto.Name;
                category.Description = dto.Description;

                _repoCategory.Update(category);
                _repoCategory.Save();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al actualizar categoría: {ex.Message}");
            }
        }

        // DELETE: api/Categories/5
        [HttpDelete("{id}")]
        public IActionResult Delete(long id)
        {
            try
            {
                if (_repoCategory.Get(id) == null) return NotFound();

                _repoCategory.Delete(id);
                _repoCategory.Save();

                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error al eliminar categoría: {ex.Message}");
            }
        }
    }
}