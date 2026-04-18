namespace Enterprise.Platform.Shared.Enumerations;

/// <summary>
/// Sort direction for list/pagination queries. Serialized as a string
/// (<c>"Asc"</c> / <c>"Desc"</c>) at API boundaries so casing stays stable across
/// Angular, BFF, and the Api.
/// </summary>
public enum SortDirection
{
    /// <summary>Ascending — smallest/earliest first.</summary>
    Asc = 0,

    /// <summary>Descending — largest/latest first.</summary>
    Desc = 1,
}
