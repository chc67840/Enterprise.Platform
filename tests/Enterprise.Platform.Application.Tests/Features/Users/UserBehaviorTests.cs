using Enterprise.Platform.Domain.Events.User;
using Enterprise.Platform.Domain.Exceptions;
using Enterprise.Platform.Infrastructure.Persistence.App.Entities;
using FluentAssertions;

namespace Enterprise.Platform.Application.Tests.Features.Users;

/// <summary>
/// Pins the <see cref="User"/> aggregate's behaviour contract — the rules that
/// every <c>IUserRepository</c> caller and every domain-event subscriber relies
/// on. Tests deliberately exercise the <see cref="User.Behavior"/> partial
/// (factory + mutators) without touching EF Core: the aggregate is a pure
/// in-memory POCO and every invariant must hold without persistence.
/// </summary>
/// <remarks>
/// <para>
/// <b>What's covered.</b> Email canonicalisation, idempotent same-value writes
/// (no event raised), business-rule violations (already-active / already-
/// inactive / external-identity re-link), and the audit-trail semantics on
/// <see cref="UserNameChanged"/> + <see cref="UserDeactivated"/>.
/// </para>
/// <para>
/// <b>What's deliberately NOT covered here.</b> EF Core mapping, persistence,
/// concurrency tokens — those belong to the Infrastructure or Architecture
/// test projects.
/// </para>
/// </remarks>
public sealed class UserBehaviorTests
{
    private static readonly DateTimeOffset Now = new(2026, 4, 29, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Register_Should_Canonicalise_Email_Trim_Names_And_Raise_UserRegistered()
    {
        var user = User.Register("  Alice@Example.COM ", " Alice ", " Example ", Now);

        user.Email.Should().Be("alice@example.com");
        user.FirstName.Should().Be("Alice");
        user.LastName.Should().Be("Example");
        user.IsActive.Should().BeTrue();
        user.CreatedAt.Should().Be(Now);
        user.ModifiedAt.Should().Be(Now);

        user.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<UserRegistered>()
            .Which.Email.Should().Be("alice@example.com");
    }

    [Theory]
    [InlineData("", "Alice", "Example")]
    [InlineData("alice@example.com", "", "Example")]
    [InlineData("alice@example.com", "Alice", "")]
    [InlineData("   ", "Alice", "Example")]
    public void Register_Should_Reject_NullOrWhitespace_Inputs(string email, string firstName, string lastName)
    {
        var act = () => User.Register(email, firstName, lastName, Now);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Rename_Should_Be_Idempotent_When_Name_Already_Matches()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);
        user.ClearDomainEvents();

        user.Rename("Alice", "Example", Now.AddMinutes(1));

        user.DomainEvents.Should().BeEmpty("identical rename must not raise an event");
        user.ModifiedAt.Should().Be(Now, "modification timestamp must not move on a no-op");
    }

    [Fact]
    public void Rename_Should_Update_Both_Parts_And_Raise_UserNameChanged()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);
        user.ClearDomainEvents();
        var renameAt = Now.AddMinutes(5);

        user.Rename("Alicia", "Examplova", renameAt);

        user.FirstName.Should().Be("Alicia");
        user.LastName.Should().Be("Examplova");
        user.DisplayName.Should().Be("Alicia Examplova");
        user.ModifiedAt.Should().Be(renameAt);

        var nameEvent = user.DomainEvents.Should().ContainSingle().Which.Should().BeOfType<UserNameChanged>().Which;
        nameEvent.PreviousDisplayName.Should().Be("Alice Example");
        nameEvent.NewDisplayName.Should().Be("Alicia Examplova");
    }

    [Fact]
    public void ChangeEmail_Should_Be_Idempotent_For_Same_Canonical_Value_Even_With_Different_Casing()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);
        user.ClearDomainEvents();

        user.ChangeEmail("ALICE@example.COM", Now.AddMinutes(1));

        user.DomainEvents.Should().BeEmpty();
        user.Email.Should().Be("alice@example.com");
    }

    [Fact]
    public void ChangeEmail_Should_Canonicalise_And_Raise_UserEmailChanged_On_Real_Change()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);
        user.ClearDomainEvents();
        var changeAt = Now.AddMinutes(10);

        user.ChangeEmail("  Alice.Example@CONTOSO.com  ", changeAt);

        user.Email.Should().Be("alice.example@contoso.com");
        user.ModifiedAt.Should().Be(changeAt);

        var evt = user.DomainEvents.Should().ContainSingle().Which.Should().BeOfType<UserEmailChanged>().Which;
        evt.PreviousEmail.Should().Be("alice@example.com");
        evt.NewEmail.Should().Be("alice.example@contoso.com");
    }

    [Fact]
    public void Activate_Should_Throw_When_Already_Active()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);

        var act = () => user.Activate(Now.AddMinutes(1));

        act.Should().Throw<BusinessRuleViolationException>()
            .WithMessage("*already active*");
    }

    [Fact]
    public void Deactivate_Then_Activate_Should_Round_Trip_With_Both_Events()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);
        user.ClearDomainEvents();
        var deactivateAt = Now.AddMinutes(5);
        var activateAt = Now.AddMinutes(15);

        user.Deactivate("violated AUP", deactivateAt);
        user.IsActive.Should().BeFalse();
        user.DomainEvents.Should().ContainSingle().Which.Should().BeOfType<UserDeactivated>()
            .Which.Reason.Should().Be("violated AUP");

        user.ClearDomainEvents();

        user.Activate(activateAt);
        user.IsActive.Should().BeTrue();
        user.DomainEvents.Should().ContainSingle().Which.Should().BeOfType<UserActivated>();
        user.ModifiedAt.Should().Be(activateAt);
    }

    [Fact]
    public void Deactivate_Should_Throw_When_Already_Inactive()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);
        user.Deactivate("first", Now.AddMinutes(5));

        var act = () => user.Deactivate("second", Now.AddMinutes(10));

        act.Should().Throw<BusinessRuleViolationException>()
            .WithMessage("*already inactive*");
    }

    [Fact]
    public void Deactivate_Should_Reject_Empty_Reason()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);

        var act = () => user.Deactivate("   ", Now.AddMinutes(1));

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void LinkExternalIdentity_Should_Be_Idempotent_For_Same_Subject()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);
        var subject = Guid.NewGuid();

        user.LinkExternalIdentity(subject, Now.AddMinutes(1));
        user.ClearDomainEvents();

        user.LinkExternalIdentity(subject, Now.AddMinutes(2));

        user.ExternalIdentityId.Should().Be(subject);
        user.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void LinkExternalIdentity_Should_Throw_When_Different_Subject_Already_Linked()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);
        user.LinkExternalIdentity(Guid.NewGuid(), Now.AddMinutes(1));

        var act = () => user.LinkExternalIdentity(Guid.NewGuid(), Now.AddMinutes(2));

        act.Should().Throw<BusinessRuleViolationException>()
            .WithMessage("*already linked*");
    }

    [Fact]
    public void RecordLogin_Should_Update_LastLoginAt_Without_Raising_Events()
    {
        var user = User.Register("alice@example.com", "Alice", "Example", Now);
        user.ClearDomainEvents();
        var loginAt = Now.AddHours(3);

        user.RecordLogin(loginAt);

        user.LastLoginAt.Should().Be(loginAt);
        user.ModifiedAt.Should().Be(loginAt);
        user.DomainEvents.Should().BeEmpty(
            "login telemetry is emitted by the auth pipeline, not the aggregate");
    }
}
