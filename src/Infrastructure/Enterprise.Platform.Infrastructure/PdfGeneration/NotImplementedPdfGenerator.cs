using Enterprise.Platform.Application.Common.Interfaces;

namespace Enterprise.Platform.Infrastructure.PdfGeneration;

/// <summary>
/// Placeholder <see cref="IPdfGenerator"/> implementation that throws on
/// every call. The seam is wired so Application handlers can take a
/// dependency on <see cref="IPdfGenerator"/> today; a real implementation
/// (QuestPDF, PuppeteerSharp, IronPDF, etc.) plugs in later without
/// touching the consuming code.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why not pick a real engine now.</b> The choice depends on requirements
/// we haven't seen yet: pixel-perfect template fidelity (PuppeteerSharp /
/// headless Chromium) vs lightweight programmatic rendering (QuestPDF) vs
/// commercial license (IronPDF). Defer until the first real consumer arrives
/// — the abstraction is what matters today.
/// </para>
/// <para>
/// <b>How to swap.</b> Replace this implementation in
/// <c>Infrastructure/DependencyInjection.cs</c> (or wherever
/// <see cref="IPdfGenerator"/> is registered) with the chosen engine.
/// </para>
/// <para>
/// <b>Engine recommendations (snapshot — re-evaluate when picking).</b>
/// </para>
/// <list type="bullet">
///   <item><b>QuestPDF (community license, paid for commercial)</b> —
///         programmatic Skia-based rendering, ~10MB native deps, great for
///         invoices/statements/receipts. https://www.questpdf.com/</item>
///   <item><b>PuppeteerSharp + headless Chromium</b> — render any HTML/CSS
///         template; use when fidelity to a designer's HTML mock matters.
///         Heavier (Chromium binary).</item>
///   <item><b>iText / IronPDF</b> — commercial, mature, extensive feature set.
///         Pick when commercial support is non-negotiable.</item>
/// </list>
/// </remarks>
public sealed class NotImplementedPdfGenerator : IPdfGenerator
{
    /// <inheritdoc />
    public Task<byte[]> RenderAsync(string templateName, object model, CancellationToken cancellationToken = default)
        => throw new PdfGenerationException(
            templateName,
            $"PDF generation requested for template '{templateName}' but no real " +
            $"IPdfGenerator implementation is registered. Replace " +
            $"{nameof(NotImplementedPdfGenerator)} in Infrastructure DI with the " +
            $"chosen engine (QuestPDF / PuppeteerSharp / etc.).");

    /// <inheritdoc />
    public Task RenderToStreamAsync(string templateName, object model, Stream destination, CancellationToken cancellationToken = default)
        => throw new PdfGenerationException(
            templateName,
            $"PDF generation requested for template '{templateName}' but no real " +
            $"IPdfGenerator implementation is registered. Replace " +
            $"{nameof(NotImplementedPdfGenerator)} in Infrastructure DI with the " +
            $"chosen engine (QuestPDF / PuppeteerSharp / etc.).");
}
