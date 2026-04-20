using Enterprise.Platform.Domain.Entities;
using FluentAssertions;

namespace Enterprise.Platform.Domain.Tests.Entities;

/// <summary>
/// <see cref="BaseEntity"/> declares entity identity rules — equality by concrete
/// type + <see cref="BaseEntity.Id"/>. These tests pin the two subtle cases that
/// bite in practice: different subclasses sharing an Id must not equal each other,
/// and null-safe operator overloads must not throw.
/// </summary>
public sealed class BaseEntityTests
{
    private sealed class Foo : BaseEntity { }

    private sealed class Bar : BaseEntity { }

    [Fact]
    public void Entities_With_Same_Id_And_Same_Type_Should_Be_Equal()
    {
        var left = new Foo();
        var right = new Foo();
        right.GetType().GetProperty(nameof(BaseEntity.Id))!
            .SetValue(right, left.Id);

        left.Should().Be(right);
        (left == right).Should().BeTrue();
        left.GetHashCode().Should().Be(right.GetHashCode());
    }

    [Fact]
    public void Entities_Of_Different_Types_With_Same_Id_Should_Not_Be_Equal()
    {
        var foo = new Foo();
        var bar = new Bar();
        typeof(BaseEntity).GetProperty(nameof(BaseEntity.Id))!
            .SetValue(bar, foo.Id);

        foo.Equals(bar).Should().BeFalse();
    }

    [Fact]
    public void Equality_Operators_Should_Handle_Nulls()
    {
        Foo? left = null;
        Foo? right = null;

        (left == right).Should().BeTrue();
        (left != new Foo()).Should().BeTrue();
        (new Foo() != right).Should().BeTrue();
    }

    [Fact]
    public void New_Entity_Should_Receive_Non_Empty_Id()
    {
        var entity = new Foo();
        entity.Id.Should().NotBe(Guid.Empty);
    }
}
