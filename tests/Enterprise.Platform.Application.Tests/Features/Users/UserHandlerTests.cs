using Enterprise.Platform.Application.Abstractions.Persistence;
using Enterprise.Platform.Application.Common.Models;
using Enterprise.Platform.Application.Features.Users.Commands;
using Enterprise.Platform.Application.Features.Users.Queries;
using Enterprise.Platform.Contracts.DTOs.App;
using Enterprise.Platform.Shared.Results;
using FluentAssertions;
using Moq;

namespace Enterprise.Platform.Application.Tests.Features.Users;

/// <summary>
/// Pins each User-feature handler's contract: success path, error mapping, and
/// any handler-level guards that exist <i>before</i> the repository call (e.g.
/// the email-uniqueness pre-flight in <see cref="ChangeUserEmailHandler"/>).
/// Handlers are deliberately thin in this codebase — most rules live on the
/// aggregate or in FluentValidation — so the tests focus on the slim layer
/// each handler adds: input null-checks, pre-flight conflicts, and Result
/// shape from repository return values.
/// </summary>
public sealed class UserHandlerTests
{
    private static readonly Guid Alice = Guid.NewGuid();
    private static readonly Guid Bob = Guid.NewGuid();

    private static UserDto MakeDto(Guid id, string email, bool isActive = true) => new(
        Email: email,
        FirstName: "First",
        LastName: "Last",
        ExternalIdentityId: null,
        IsActive: isActive,
        LastLoginAt: null,
        IsDeleted: false,
        DeletedAt: null,
        DeletedBy: null,
        CreatedBy: "system",
        CreatedAt: DateTimeOffset.UtcNow,
        ModifiedBy: null,
        ModifiedAt: null,
        Id: id);

    // ── CreateUserHandler ───────────────────────────────────────────────────

    [Fact]
    public async Task CreateUser_Should_Return_Conflict_When_Email_Already_Exists()
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.EmailExistsAsync("dup@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        var handler = new CreateUserHandler(repo.Object);

        var result = await handler.HandleAsync(
            new CreateUserCommand("Dup@Example.COM", "First", "Last", null), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Code.Should().Be(ErrorCodes.Conflict);
        repo.Verify(r => r.RegisterAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task CreateUser_Should_Delegate_To_Register_When_Email_Is_Free()
    {
        var dto = MakeDto(Alice, "alice@example.com");
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.EmailExistsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        repo.Setup(r => r.RegisterAsync("alice@example.com", "Alice", "Example", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success(dto));
        var handler = new CreateUserHandler(repo.Object);

        var result = await handler.HandleAsync(
            new CreateUserCommand("alice@example.com", "Alice", "Example", null), default);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(dto);
    }

    [Fact]
    public async Task CreateUser_Should_Throw_On_Null_Command()
    {
        var handler = new CreateUserHandler(Mock.Of<IUserRepository>());
        var act = () => handler.HandleAsync(null!, default);
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    // ── ChangeUserEmailHandler ──────────────────────────────────────────────

    [Fact]
    public async Task ChangeUserEmail_Should_Return_Conflict_When_Email_Owned_By_Another_User()
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetByEmailAsync("taken@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeDto(Bob, "taken@example.com"));
        var handler = new ChangeUserEmailHandler(repo.Object);

        var result = await handler.HandleAsync(new ChangeUserEmailCommand(Alice, "Taken@example.com"), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Code.Should().Be(ErrorCodes.Conflict);
        repo.Verify(r => r.ChangeEmailAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ChangeUserEmail_Should_Delegate_When_Lookup_Returns_Same_User_Same_Email()
    {
        // Same-email no-op case: GetByEmailAsync returns the *target* user, the
        // pre-flight ignores the match (it's the same user), and the call falls
        // through to the repository — domain method itself is then idempotent.
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetByEmailAsync("alice@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeDto(Alice, "alice@example.com"));
        repo.Setup(r => r.ChangeEmailAsync(Alice, "alice@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());
        var handler = new ChangeUserEmailHandler(repo.Object);

        var result = await handler.HandleAsync(new ChangeUserEmailCommand(Alice, "alice@example.com"), default);

        result.IsSuccess.Should().BeTrue();
        repo.Verify(r => r.ChangeEmailAsync(Alice, "alice@example.com", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ChangeUserEmail_Should_Delegate_When_Email_Is_Free()
    {
        // Pre-flight canonicalises for the GetByEmailAsync lookup, but the handler
        // hands the *raw* command value to ChangeEmailAsync — the repository (or
        // the entity behaviour) owns final canonicalisation. The mock and verify
        // must mirror that contract, otherwise Moq returns default(Task<Result>)
        // and the await NREs.
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetByEmailAsync("new@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserDto?)null);
        repo.Setup(r => r.ChangeEmailAsync(Alice, " New@Example.COM ", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());
        var handler = new ChangeUserEmailHandler(repo.Object);

        var result = await handler.HandleAsync(new ChangeUserEmailCommand(Alice, " New@Example.COM "), default);

        result.IsSuccess.Should().BeTrue();
        repo.Verify(r => r.GetByEmailAsync("new@example.com", It.IsAny<CancellationToken>()), Times.Once);
        repo.Verify(r => r.ChangeEmailAsync(Alice, " New@Example.COM ", It.IsAny<CancellationToken>()), Times.Once);
    }

    // ── RenameUserHandler ───────────────────────────────────────────────────

    [Fact]
    public async Task RenameUser_Should_Delegate_Inputs_To_Repository()
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.RenameAsync(Alice, "Alicia", "Examplova", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());
        var handler = new RenameUserHandler(repo.Object);

        var result = await handler.HandleAsync(new RenameUserCommand(Alice, "Alicia", "Examplova"), default);

        result.IsSuccess.Should().BeTrue();
        repo.Verify(r => r.RenameAsync(Alice, "Alicia", "Examplova", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RenameUser_Should_Return_NotFound_When_Repository_Reports_Missing_User()
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.RenameAsync(Alice, "A", "B", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure(Error.NotFound($"User {Alice} not found.")));
        var handler = new RenameUserHandler(repo.Object);

        var result = await handler.HandleAsync(new RenameUserCommand(Alice, "A", "B"), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Code.Should().Be(ErrorCodes.NotFound);
    }

    // ── ActivateUserHandler ─────────────────────────────────────────────────

    [Fact]
    public async Task ActivateUser_Should_Bubble_Conflict_From_Repository()
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.ActivateAsync(Alice, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Failure(Error.Conflict("User is already active.")));
        var handler = new ActivateUserHandler(repo.Object);

        var result = await handler.HandleAsync(new ActivateUserCommand(Alice), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Code.Should().Be(ErrorCodes.Conflict);
    }

    // ── DeactivateUserHandler ───────────────────────────────────────────────

    [Fact]
    public async Task DeactivateUser_Should_Pass_Reason_Through_Verbatim()
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.DeactivateAsync(Alice, "violated AUP", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Success());
        var handler = new DeactivateUserHandler(repo.Object);

        var result = await handler.HandleAsync(new DeactivateUserCommand(Alice, "violated AUP"), default);

        result.IsSuccess.Should().BeTrue();
        repo.Verify(r => r.DeactivateAsync(Alice, "violated AUP", It.IsAny<CancellationToken>()), Times.Once);
    }

    // ── GetUserByIdHandler ──────────────────────────────────────────────────

    [Fact]
    public async Task GetUserById_Should_Return_NotFound_When_Repository_Returns_Null()
    {
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetByIdAsync(Alice, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserDto?)null);
        var handler = new GetUserByIdHandler(repo.Object);

        var result = await handler.HandleAsync(new GetUserByIdQuery(Alice), default);

        result.IsSuccess.Should().BeFalse();
        result.Error.Code.Should().Be(ErrorCodes.NotFound);
    }

    [Fact]
    public async Task GetUserById_Should_Wrap_Repository_Hit_In_Result_Success()
    {
        var dto = MakeDto(Alice, "alice@example.com");
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.GetByIdAsync(Alice, It.IsAny<CancellationToken>())).ReturnsAsync(dto);
        var handler = new GetUserByIdHandler(repo.Object);

        var result = await handler.HandleAsync(new GetUserByIdQuery(Alice), default);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be(dto);
    }

    // ── ListUsersHandler ────────────────────────────────────────────────────

    [Fact]
    public async Task ListUsers_Should_Forward_Every_Query_Field_To_Repository()
    {
        var page = new PagedResult<UserDto>
        {
            Items = [],
            PageNumber = 2,
            PageSize = 50,
            TotalCount = 0,
        };
        var repo = new Mock<IUserRepository>();
        repo.Setup(r => r.ListAsync(2, 50, "alice", true, It.IsAny<CancellationToken>())).ReturnsAsync(page);
        var handler = new ListUsersHandler(repo.Object);

        var result = await handler.HandleAsync(new ListUsersQuery(2, 50, "alice", true), default);

        result.Should().Be(page);
        repo.Verify(r => r.ListAsync(2, 50, "alice", true, It.IsAny<CancellationToken>()), Times.Once);
    }
}
