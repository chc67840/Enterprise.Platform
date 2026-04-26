using Enterprise.Platform.Domain.Events.User;
using Enterprise.Platform.Domain.Exceptions;
using Enterprise.Platform.Domain.Interfaces;

namespace Enterprise.Platform.Infrastructure.Persistence.App.Entities;

/// <summary>
/// Domain behaviour for the <see cref="User"/> aggregate. Lives in a sibling
/// partial so the scaffolded <c>User.cs</c> can be regenerated without losing
/// hand-authored mutation logic.
/// </summary>
/// <remarks>
/// <para>
/// <b>The partial-class trick.</b> Db-first scaffold produces an anaemic POCO
/// (just properties). We add behaviour in this sibling file by re-declaring
/// the type as <c>partial</c>. Across the two partial declarations:
/// <list type="bullet">
///   <item>The scaffolded file declares the base class (<c>: AggregateRoot</c>)
///   via the customised T4 template.</item>
///   <item>This file adds the <see cref="ISoftDeletable"/> interface — the
///   scaffolded soft-delete properties already satisfy it.</item>
///   <item>This file owns every method (factory + mutators + invariants).
///   Properties stay on the scaffolded side so re-scaffold doesn't lose them.</item>
/// </list>
/// </para>
/// <para>
/// <b>Convention.</b> Methods only set instance state and raise events — never
/// open transactions, never resolve services. The MediatR command handler is
/// the orchestration point; the aggregate is pure domain logic.
/// </para>
/// </remarks>
public partial class User : ISoftDeletable
{
    /// <summary>
    /// Factory for new users. Bypasses the public parameterless ctor so callers
    /// can't construct a partially-initialised aggregate from outside the domain.
    /// </summary>
    /// <remarks>
    /// Email format / name length validation lives in the
    /// <c>CreateUserCommandValidator</c> — by the time this method runs, inputs
    /// are already shape-valid. We still lower-case the email to maintain the
    /// canonical form.
    /// </remarks>
    public static User Register(
        string email,
        string firstName,
        string lastName,
        DateTimeOffset utcNow,
        Guid? externalIdentityId = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(firstName);
        ArgumentException.ThrowIfNullOrWhiteSpace(lastName);

        var canonicalEmail = email.Trim().ToLowerInvariant();

        var user = new User
        {
            Email = canonicalEmail,
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            ExternalIdentityId = externalIdentityId,
            IsActive = true,
            CreatedAt = utcNow,
            ModifiedAt = utcNow,
        };
        // Id + audit fields are set by AuditableEntity / BaseEntity ctors and
        // the AuditableEntityInterceptor on save; we set CreatedAt/ModifiedAt
        // here too so the in-memory aggregate is consistent before the flush.

        user.AddDomainEvent(new UserRegistered(user.Id, canonicalEmail, utcNow));
        return user;
    }

    /// <summary>Replaces the user's first / last name. Idempotent if both parts match the current value.</summary>
    public void Rename(string firstName, string lastName, DateTimeOffset utcNow)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(firstName);
        ArgumentException.ThrowIfNullOrWhiteSpace(lastName);

        var newFirst = firstName.Trim();
        var newLast = lastName.Trim();
        if (newFirst == FirstName && newLast == LastName)
        {
            return;
        }

        var previous = DisplayName;
        FirstName = newFirst;
        LastName = newLast;
        ModifiedAt = utcNow;

        AddDomainEvent(new UserNameChanged(Id, previous, DisplayName, utcNow));
    }

    /// <summary>Replaces the user's canonical email. Lower-cased on write.</summary>
    public void ChangeEmail(string newEmail, DateTimeOffset utcNow)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(newEmail);
        var canonical = newEmail.Trim().ToLowerInvariant();
        if (canonical == Email)
        {
            return;
        }

        var previous = Email;
        Email = canonical;
        ModifiedAt = utcNow;

        AddDomainEvent(new UserEmailChanged(Id, previous, canonical, utcNow));
    }

    /// <summary>Reactivates a deactivated user. Throws if already active.</summary>
    public void Activate(DateTimeOffset utcNow)
    {
        if (IsActive)
        {
            throw new BusinessRuleViolationException("User is already active.");
        }

        IsActive = true;
        ModifiedAt = utcNow;
        AddDomainEvent(new UserActivated(Id, utcNow));
    }

    /// <summary>Deactivates an active user. Throws if already inactive. Reason is captured on the event.</summary>
    public void Deactivate(string reason, DateTimeOffset utcNow)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(reason);

        if (!IsActive)
        {
            throw new BusinessRuleViolationException("User is already inactive.");
        }

        IsActive = false;
        ModifiedAt = utcNow;
        AddDomainEvent(new UserDeactivated(Id, reason, utcNow));
    }

    /// <summary>
    /// Records a successful sign-in. Updates <see cref="LastLoginAt"/>; intentionally
    /// does NOT raise a domain event because login signals are emitted by the auth
    /// pipeline (BFF), not the user aggregate.
    /// </summary>
    public void RecordLogin(DateTimeOffset utcNow)
    {
        LastLoginAt = utcNow;
        ModifiedAt = utcNow;
    }

    /// <summary>
    /// Links an external identity (Entra subject id) to this user. Idempotent
    /// when the same id is supplied twice. Throws if a different id was already
    /// linked — re-linking is a deliberate, audited operation that requires
    /// admin tooling.
    /// </summary>
    public void LinkExternalIdentity(Guid externalIdentityId, DateTimeOffset utcNow)
    {
        if (ExternalIdentityId == externalIdentityId)
        {
            return;
        }

        if (ExternalIdentityId is not null)
        {
            throw new BusinessRuleViolationException(
                $"User {Id} is already linked to external identity {ExternalIdentityId}; " +
                "use the dedicated re-link admin operation if a switch is required.");
        }

        ExternalIdentityId = externalIdentityId;
        ModifiedAt = utcNow;
    }

    /// <summary>
    /// Convenience: <c>"FirstName LastName"</c>. Computed (not persisted) — exists
    /// here rather than on the scaffolded class because re-scaffold would lose it.
    /// </summary>
    public string DisplayName => $"{FirstName} {LastName}";
}
