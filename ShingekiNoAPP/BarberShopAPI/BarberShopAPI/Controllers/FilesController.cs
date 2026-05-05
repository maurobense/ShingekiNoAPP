using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Amazon.S3;
using ShingekiNoAPPI.Services.Storage;

namespace ShingekiNoAPPI.Controllers
{
    [Route("api/files")]
    [ApiController]
    [Authorize(Roles = "Admin,BranchManager,SuperAdmin")]
    public sealed class FilesController : ControllerBase
    {
        private readonly IFileStorageService _storage;

        public FilesController(IFileStorageService storage)
        {
            _storage = storage;
        }

        [HttpPost("images")]
        [RequestSizeLimit(15_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = 15_000_000)]
        public async Task<IActionResult> UploadImage(
            [FromForm] IFormFile file,
            [FromQuery] string folder = "products",
            [FromQuery] string? tenantFolder = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var tenantOverride = User.IsInRole("SuperAdmin") ? tenantFolder : null;
                var url = await _storage.UploadImageAsync(file, folder, tenantOverride, cancellationToken);
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
            catch (AmazonS3Exception ex)
            {
                var message = ex.ErrorCode == "AccessDenied"
                    ? "AWS S3 rechazo la subida. Revisa que el usuario IAM tenga permiso s3:PutObject sobre el bucket configurado."
                    : "No se pudo subir la imagen a AWS S3.";

                return StatusCode(502, new { error = message, awsError = ex.ErrorCode });
            }
        }
    }
}
