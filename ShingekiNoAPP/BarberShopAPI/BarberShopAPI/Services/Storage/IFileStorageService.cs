namespace ShingekiNoAPPI.Services.Storage
{
    public interface IFileStorageService
    {
        Task<string> UploadImageAsync(IFormFile file, string folder, CancellationToken cancellationToken = default);
    }
}
