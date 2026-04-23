namespace Enterprise.Platform.Application.Common.Interfaces;

/// <summary>
/// Renders PDF documents from a named template + view model. Implementations
/// live in Infrastructure (e.g. <c>QuestPdfGenerator</c>, <c>PuppeteerPdfGenerator</c>);
/// Application handlers depend only on this abstraction so the underlying
/// PDF engine is swappable.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why an abstraction in Application.</b> PDF generation is a presentation
/// concern with non-trivial dependencies (HTML rendering, font subsystems,
/// SkiaSharp on QuestPDF, headless Chromium on Puppeteer). Hiding the
/// engine behind an interface keeps Application handlers testable and lets
/// us swap engines without touching business logic.
/// </para>
/// <para>
/// <b>Template resolution.</b> The <paramref name="templateName"/> is a
/// logical identifier (e.g. <c>"OrderConfirmation"</c>, <c>"GrantStatement"</c>).
/// The implementation maps it to a physical template file (Razor view,
/// .docx, JSON layout) per its own conventions.
/// </para>
/// <para>
/// <b>View model.</b> <paramref name="model"/> is the data passed to the
/// template — anything serializable. Use a strongly-typed record per
/// template; the implementation is responsible for binding it.
/// </para>
/// </remarks>
public interface IPdfGenerator
{
    /// <summary>Renders a PDF as a byte array.</summary>
    /// <param name="templateName">Logical template id (e.g. <c>"OrderConfirmation"</c>).</param>
    /// <param name="model">View-model data for the template.</param>
    /// <param name="cancellationToken">Cancellation token; respected during render.</param>
    /// <returns>The rendered PDF bytes.</returns>
    /// <exception cref="PdfGenerationException">
    /// When the template can't be resolved, the model is incompatible, or
    /// the rendering engine fails.
    /// </exception>
    Task<byte[]> RenderAsync(
        string templateName,
        object model,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Renders a PDF directly to a stream — cheaper for large documents
    /// (avoids the byte[] allocation). Implementations write to the stream
    /// in-place and flush; callers are responsible for stream lifetime.
    /// </summary>
    Task RenderToStreamAsync(
        string templateName,
        object model,
        Stream destination,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when PDF generation fails for any reason — template not found,
/// model binding failure, rendering engine error. Carries the template name
/// for diagnosis.
/// </summary>
public sealed class PdfGenerationException : Exception
{
    /// <summary>The logical template id that was being rendered.</summary>
    public string TemplateName { get; }

    /// <inheritdoc />
    public PdfGenerationException(string templateName, string message)
        : base(message)
    {
        TemplateName = templateName;
    }

    /// <inheritdoc />
    public PdfGenerationException(string templateName, string message, Exception innerException)
        : base(message, innerException)
    {
        TemplateName = templateName;
    }
}
