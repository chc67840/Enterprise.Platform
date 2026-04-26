using Enterprise.Platform.Application.Common.Interfaces;
using Enterprise.Platform.Infrastructure.Common;
using Microsoft.Extensions.Logging;

namespace Enterprise.Platform.Infrastructure.FileStorage;

/// <summary>
/// Filesystem-backed <see cref="IFileStorageService"/>. Writes under
/// <c>{rootPath}/{container}/{blobName}</c>. <b>Dev-only</b> — production uses
/// <see cref="AzureBlobStorageService"/>. Pre-signed URLs are synthesised as
/// <c>file://</c> URIs; callers on a web host that serves the root directory can
/// use them, but most flows should download through the service instead.
/// </summary>
public sealed class LocalFileStorageService(string rootPath, ILogger<LocalFileStorageService> logger) : IFileStorageService
{
    private readonly string _rootPath = string.IsNullOrWhiteSpace(rootPath)
        ? throw new ArgumentException("Root path is required.", nameof(rootPath))
        : Path.GetFullPath(rootPath);

    private readonly ILogger<LocalFileStorageService> _logger = logger ?? throw new ArgumentNullException(nameof(logger));

    /// <inheritdoc />
    public async Task<Uri> UploadAsync(
        string container,
        string blobName,
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(container);
        ArgumentException.ThrowIfNullOrWhiteSpace(blobName);
        ArgumentNullException.ThrowIfNull(content);

        var targetDir = Path.Combine(_rootPath, container);
        Directory.CreateDirectory(targetDir);
        var targetPath = Path.Combine(targetDir, blobName);

        var file = File.Create(targetPath);
        await using (file.ConfigureAwait(false))
        {
            await content.CopyToAsync(file, cancellationToken).ConfigureAwait(false);
        }

        _logger.LocalFileOp("Upload", container, blobName);
        return new Uri(targetPath);
    }

    /// <inheritdoc />
    public Task<Stream?> DownloadAsync(string container, string blobName, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(container);
        ArgumentException.ThrowIfNullOrWhiteSpace(blobName);

        var path = Path.Combine(_rootPath, container, blobName);
        if (!File.Exists(path))
        {
            return Task.FromResult<Stream?>(null);
        }

        _logger.LocalFileOp("Download", container, blobName);
        return Task.FromResult<Stream?>(File.OpenRead(path));
    }

    /// <inheritdoc />
    public Task<bool> DeleteAsync(string container, string blobName, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(container);
        ArgumentException.ThrowIfNullOrWhiteSpace(blobName);

        var path = Path.Combine(_rootPath, container, blobName);
        if (!File.Exists(path))
        {
            return Task.FromResult(false);
        }

        File.Delete(path);
        _logger.LocalFileOp("Delete", container, blobName);
        return Task.FromResult(true);
    }

    /// <inheritdoc />
    public Task<Uri> GetPresignedUrlAsync(
        string container,
        string blobName,
        TimeSpan validity,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(container);
        ArgumentException.ThrowIfNullOrWhiteSpace(blobName);

        // Local storage has no notion of presigned URLs — just return the file URI. Callers
        // must not rely on validity for security.
        var path = Path.Combine(_rootPath, container, blobName);
        return Task.FromResult(new Uri(path));
    }
}
