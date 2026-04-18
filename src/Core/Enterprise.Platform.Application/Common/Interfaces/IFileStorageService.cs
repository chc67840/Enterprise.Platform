namespace Enterprise.Platform.Application.Common.Interfaces;

/// <summary>
/// Blob-store abstraction used for user uploads, exported reports, and generated
/// documents. Infrastructure implementations: <c>AzureBlobStorageService</c> (prod),
/// <c>LocalFileStorageService</c> (dev-only).
/// </summary>
public interface IFileStorageService
{
    /// <summary>Uploads a stream to <paramref name="container"/>/<paramref name="blobName"/>. Returns the blob URI.</summary>
    Task<Uri> UploadAsync(
        string container,
        string blobName,
        Stream content,
        string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>Downloads a blob. Returns <c>null</c> when absent.</summary>
    Task<Stream?> DownloadAsync(
        string container,
        string blobName,
        CancellationToken cancellationToken = default);

    /// <summary>Deletes a blob. Returns <c>true</c> when the blob existed and was removed.</summary>
    Task<bool> DeleteAsync(
        string container,
        string blobName,
        CancellationToken cancellationToken = default);

    /// <summary>Issues a short-lived pre-signed URL for direct browser download.</summary>
    Task<Uri> GetPresignedUrlAsync(
        string container,
        string blobName,
        TimeSpan validity,
        CancellationToken cancellationToken = default);
}
