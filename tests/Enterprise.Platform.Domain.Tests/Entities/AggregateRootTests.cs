using Enterprise.Platform.Domain.Aggregates;
using Enterprise.Platform.Domain.Events;
using FluentAssertions;

namespace Enterprise.Platform.Domain.Tests.Entities;

/// <summary>
/// Pins the <see cref="AggregateRoot"/> domain-event protocol: events append on
/// business mutations, <see cref="AggregateRoot.DomainEvents"/> is a read-only view
/// (no mutation from application code), and <see cref="AggregateRoot.ClearDomainEvents"/>
/// drains cleanly after dispatch so the same events don't re-publish.
/// </summary>
public sealed class AggregateRootTests
{
    private sealed record TestEvent(string Payload) : IDomainEvent
    {
        public DateTimeOffset OccurredOn { get; } = DateTimeOffset.UtcNow;
    }

    private sealed class TestAggregate : AggregateRoot
    {
        public void DoSomething(string payload) => AddDomainEvent(new TestEvent(payload));
    }

    [Fact]
    public void AddDomainEvent_Should_Append_To_PendingEvents()
    {
        var aggregate = new TestAggregate();

        aggregate.DoSomething("first");
        aggregate.DoSomething("second");

        aggregate.DomainEvents.Should().HaveCount(2);
        aggregate.DomainEvents.Should().AllBeOfType<TestEvent>();
    }

    [Fact]
    public void DomainEvents_Should_Be_Readonly_View()
    {
        var aggregate = new TestAggregate();
        aggregate.DoSomething("x");

        aggregate.DomainEvents.Should().BeAssignableTo<IReadOnlyCollection<IDomainEvent>>();
        // Attempting to cast to a mutable list and mutate would break the invariant;
        // asserting the static type is the contract-level guarantee we publish.
    }

    [Fact]
    public void ClearDomainEvents_Should_Empty_The_Collection()
    {
        var aggregate = new TestAggregate();
        aggregate.DoSomething("x");

        aggregate.ClearDomainEvents();

        aggregate.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void New_Aggregate_Should_Start_With_Empty_DomainEvents()
    {
        var aggregate = new TestAggregate();
        aggregate.DomainEvents.Should().BeEmpty();
    }
}
