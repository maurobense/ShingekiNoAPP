using System.Text.RegularExpressions;
using Amazon.S3;
using Amazon.S3.Model;
using Business.BusinessInterfaces;
using Microsoft.Extensions.Options;
using ShingekiNoAPPI.Options;

namespace ShingekiNoAPPI.Services.Storage
{
    public sealed class S3FileStorageService : IFileStorageService
    {
        private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg",
            "image/png",
            "image/webp"
        };

        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
        };

        private readonly IAmazonS3 _s3;
        private readonly S3StorageOptions _options;
        private readonly ITenantService _tenantService;

        public S3FileStorageService(IAmazonS3 s3, IOptions<S3StorageOptions> options, ITenantService tenantService)
        {
            _s3 = s3;
            _options = options.Value;
            _tenantService = tenantService;
        }

        public async Task<string> UploadImageAsync(IFormFile file, string folder, CancellationToken cancellationToken = default)
        {
            Validate(file);

            if (string.IsNullOrWhiteSpace(_options.BucketName))
            {
                throw new InvalidOperationException("El bucket S3 no esta configurado.");
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var safeFolder = Regex.Replace(folder ?? "uploads", @"[^a-zA-Z0-9/_-]", string.Empty).Trim('/');
            if (string.IsNullOrWhiteSpace(safeFolder)) safeFolder = "uploads";

            var tenantFolder = NormalizeTenantFolder(_tenantService.GetTenantFolder());
            var key = $"{tenantFolder}/{safeFolder}/{DateTime.UtcNow:yyyy/MM}/{Guid.NewGuid():N}{extension}";

            await using var stream = file.OpenReadStream();
            var request = new PutObjectRequest
            {
                BucketName = _options.BucketName,
                Key = key,
                InputStream = stream,
                ContentType = file.ContentType,
                ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
            };
            request.Headers.CacheControl = "public, max-age=31536000, immutable";

            await _s3.PutObjectAsync(request, cancellationToken);

            var encodedKey = string.Join("/", key.Split('/').Select(Uri.EscapeDataString));
            if (!string.IsNullOrWhiteSpace(_options.PublicBaseUrl))
            {
                return $"{_options.PublicBaseUrl.TrimEnd('/')}/{encodedKey}";
            }

            return $"https://{_options.BucketName}.s3.{_options.Region}.amazonaws.com/{encodedKey}";
        }

        private void Validate(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                throw new ArgumentException("Selecciona una imagen valida.");
            }

            var maxBytes = _options.MaxFileSizeMb * 1024L * 1024L;
            if (file.Length > maxBytes)
            {
                throw new ArgumentException($"La imagen supera el limite de {_options.MaxFileSizeMb} MB.");
            }

            var extension = Path.GetExtension(file.FileName);
            if (!AllowedContentTypes.Contains(file.ContentType) || !AllowedExtensions.Contains(extension))
            {
                throw new ArgumentException("Formato no permitido. Usa JPG, PNG o WEBP.");
            }
        }

        private static string NormalizeTenantFolder(string tenantFolder)
        {
            var safeTenant = Regex.Replace(tenantFolder ?? "platform", @"[^a-zA-Z0-9/_-]", string.Empty).Trim('/');
            if (string.IsNullOrWhiteSpace(safeTenant)) safeTenant = "platform";
            return safeTenant.StartsWith("tenants/", StringComparison.OrdinalIgnoreCase)
                ? safeTenant
                : $"tenants/{safeTenant}";
        }
    }
}
