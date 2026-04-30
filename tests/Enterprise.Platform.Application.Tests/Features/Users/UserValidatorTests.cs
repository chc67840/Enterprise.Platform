using Enterprise.Platform.Application.Features.Users.Commands;
using Enterprise.Platform.Application.Features.Users.Queries;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace Enterprise.Platform.Application.Tests.Features.Users;

/// <summary>
/// Pins the FluentValidation rules for every User-feature command + query. The
/// validators run in the MediatR pipeline ahead of the handlers, so a failure
/// here means a 400-with-field-errors response rather than the handler ever
/// running. Tests use FluentValidation's <c>TestHelper</c> extensions which
/// produce focused assertions per property.
/// </summary>
public sealed class UserValidatorTests
{
    private static readonly Guid AnyId = Guid.NewGuid();

    // ── CreateUserValidator ─────────────────────────────────────────────────

    [Fact]
    public void CreateUser_Should_Pass_For_Valid_Inputs()
    {
        var v = new CreateUserValidator();
        var result = v.TestValidate(new CreateUserCommand("alice@example.com", "Alice", "Example", null));
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void CreateUser_Should_Reject_Bad_Email(string email)
    {
        var v = new CreateUserValidator();
        var result = v.TestValidate(new CreateUserCommand(email, "Alice", "Example", null));
        result.ShouldHaveValidationErrorFor(c => c.Email);
    }

    [Fact]
    public void CreateUser_Should_Cap_Email_Length_At_254()
    {
        var v = new CreateUserValidator();
        var oversized = new string('a', 250) + "@x.io"; // 256 chars
        var result = v.TestValidate(new CreateUserCommand(oversized, "Alice", "Example", null));
        result.ShouldHaveValidationErrorFor(c => c.Email);
    }

    [Fact]
    public void CreateUser_Should_Cap_Name_Length_At_100()
    {
        var v = new CreateUserValidator();
        var tooLong = new string('A', 101);
        var result = v.TestValidate(new CreateUserCommand("alice@example.com", tooLong, tooLong, null));
        result.ShouldHaveValidationErrorFor(c => c.FirstName);
        result.ShouldHaveValidationErrorFor(c => c.LastName);
    }

    // ── RenameUserValidator ─────────────────────────────────────────────────

    [Fact]
    public void RenameUser_Should_Reject_Empty_UserId()
    {
        var v = new RenameUserValidator();
        var result = v.TestValidate(new RenameUserCommand(Guid.Empty, "Alice", "Example"));
        result.ShouldHaveValidationErrorFor(c => c.UserId);
    }

    [Fact]
    public void RenameUser_Should_Reject_Empty_Names()
    {
        var v = new RenameUserValidator();
        var result = v.TestValidate(new RenameUserCommand(AnyId, "", ""));
        result.ShouldHaveValidationErrorFor(c => c.FirstName);
        result.ShouldHaveValidationErrorFor(c => c.LastName);
    }

    // ── ChangeUserEmailValidator ────────────────────────────────────────────

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void ChangeUserEmail_Should_Reject_Bad_Email(string email)
    {
        var v = new ChangeUserEmailValidator();
        var result = v.TestValidate(new ChangeUserEmailCommand(AnyId, email));
        result.ShouldHaveValidationErrorFor(c => c.NewEmail);
    }

    [Fact]
    public void ChangeUserEmail_Should_Reject_Empty_UserId()
    {
        var v = new ChangeUserEmailValidator();
        var result = v.TestValidate(new ChangeUserEmailCommand(Guid.Empty, "alice@example.com"));
        result.ShouldHaveValidationErrorFor(c => c.UserId);
    }

    // ── ActivateUserValidator ───────────────────────────────────────────────

    [Fact]
    public void ActivateUser_Should_Reject_Empty_UserId()
    {
        var v = new ActivateUserValidator();
        var result = v.TestValidate(new ActivateUserCommand(Guid.Empty));
        result.ShouldHaveValidationErrorFor(c => c.UserId);
    }

    // ── DeactivateUserValidator ─────────────────────────────────────────────

    [Fact]
    public void DeactivateUser_Should_Reject_Empty_Reason()
    {
        var v = new DeactivateUserValidator();
        var result = v.TestValidate(new DeactivateUserCommand(AnyId, ""));
        result.ShouldHaveValidationErrorFor(c => c.Reason);
    }

    [Fact]
    public void DeactivateUser_Should_Cap_Reason_Length_At_500()
    {
        var v = new DeactivateUserValidator();
        var tooLong = new string('x', 501);
        var result = v.TestValidate(new DeactivateUserCommand(AnyId, tooLong));
        result.ShouldHaveValidationErrorFor(c => c.Reason);
    }

    // ── ListUsersValidator ──────────────────────────────────────────────────

    [Theory]
    [InlineData(0, 25)]
    [InlineData(-1, 25)]
    public void ListUsers_Should_Reject_Page_Below_One(int page, int pageSize)
    {
        var v = new ListUsersValidator();
        var result = v.TestValidate(new ListUsersQuery(page, pageSize));
        result.ShouldHaveValidationErrorFor(q => q.Page);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(201)]
    public void ListUsers_Should_Reject_Page_Size_Outside_1_to_200(int pageSize)
    {
        var v = new ListUsersValidator();
        var result = v.TestValidate(new ListUsersQuery(1, pageSize));
        result.ShouldHaveValidationErrorFor(q => q.PageSize);
    }

    [Fact]
    public void ListUsers_Should_Cap_Search_Length_At_100()
    {
        var v = new ListUsersValidator();
        var tooLong = new string('q', 101);
        var result = v.TestValidate(new ListUsersQuery(1, 25, tooLong));
        result.ShouldHaveValidationErrorFor(q => q.Search);
    }

    [Fact]
    public void ListUsers_Should_Allow_Null_Search()
    {
        var v = new ListUsersValidator();
        var result = v.TestValidate(new ListUsersQuery(1, 25, Search: null));
        result.IsValid.Should().BeTrue();
    }
}
