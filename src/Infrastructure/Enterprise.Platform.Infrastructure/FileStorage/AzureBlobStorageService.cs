using Enterprise.Platform.Application.Common.Interfaces;

namespace Enterprise.Platform.Infrastructure.FileStorage;

/// <summary>
/// <b>Placeholder.</b> Azure Blob Storage-backed <see cref="IFileStorageService"/>.
/// Uses <c>Azure.Storage.Blobs</c> (already in CPM) + Managed Identity via
/// <c>Azure.Identity.DefaultAzureCredential</c>. Real wiring lands when an Azure
/// storage account is provisioned — until then hosts compose
/// <see cref="LocalFileStorageService"/> so the pipeline stays runnable in dev.
/// </summary>
/// <remarks>
/// Expected shape:
/// <code>
/// public AzureBlobStorageService(BlobServiceClient client, ILogger&lt;...&gt; logger) { ... }
/// // UploadAsync -> GetBlobContainerClient(container).GetBlobClient(blobName).UploadAsync(content)
/// // GetPresignedUrlAsync -> user-delegation SAS via DefaultAzureCredential
/// </code>
/// </remarks>
public sealed class AzureBlobStorageService : IFileStorageService
{
    /// <inheritdoc />
    public Task<Uri> UploadAsync(string container, string blobName, Stream content, string contentType, CancellationToken cancellationToken = default)
        => throw new NotSupportedException("AzureBlobStorageService is a placeholder until an Azure storage account is provisioned.");

    /// <inheritdoc />
    public Task<Stream?> DownloadAsync(string container, string blobName, CancellationToken cancellationToken = default)
        => throw new NotSupportedException("AzureBlobStorageService is a placeholder until an Azure storage account is provisioned.");

    /// <inheritdoc />
    public Task<bool> DeleteAsync(string container, string blobName, CancellationToken cancellationToken = default)
        => throw new NotSupportedException("AzureBlobStorageService is a placeholder until an Azure storage account is provisioned.");

    /// <inheritdoc />
    public Task<Uri> GetPresignedUrlAsync(string container, string blobName, TimeSpan validity, CancellationToken cancellationToken = default)
        => throw new NotSupportedException("AzureBlobStorageService is a placeholder until an Azure storage account is provisioned.");
}
