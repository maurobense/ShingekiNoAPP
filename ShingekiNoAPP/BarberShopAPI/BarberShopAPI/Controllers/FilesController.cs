using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShingekiNoAPPI.Services.Storage;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/files")]
    [ApiController]
    [Authorize(Roles = "Admin,BranchManager")]
    public sealed class FilesController : ControllerBase
    {
        private readonly IFileStorageService _storage;

        public FilesController(IFileStorageService storage)
        {
            _storage = storage;
        }

        [HttpPost("images")]
        [RequestSizeLimit(6_000_000)]
        public async Task<IActionResult> UploadImage([FromForm] IFormFile file, [FromQuery] string folder = "products", CancellationToken cancellationToken = default)
        {
            try
            {
                var url = await _storage.UploadImageAsync(file, folder, cancellationToken);
                return Ok(new { url });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}
