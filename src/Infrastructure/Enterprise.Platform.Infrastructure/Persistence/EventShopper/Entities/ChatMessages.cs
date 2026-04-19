using System;
using System.Collections.Generic;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;

public partial class ChatMessages
{
    public Guid Id { get; set; }

    public Guid ChatSessionId { get; set; }

    public string SenderId { get; set; } = null!;

    public string MessageText { get; set; } = null!;

    public string? AttachmentUrl { get; set; }

    public DateTime SentAt { get; set; }

    public bool IsRead { get; set; }

    public DateTime CreatedAt { get; set; }

    public int CreatedBy { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int UpdatedBy { get; set; }

    public byte[] RowVersion { get; set; } = null!;

    public DateTime? DeletedAt { get; set; }

    public int? DeletedBy { get; set; }

    public virtual ChatSessions ChatSession { get; set; } = null!;
}
