using System;
using System.Collections.Generic;
using Enterprise.Platform.Infrastructure.Persistence.EventShopper.Entities;
using Microsoft.EntityFrameworkCore;

namespace Enterprise.Platform.Infrastructure.Persistence.EventShopper.Contexts;

public partial class EventShopperDbContext : DbContext
{
    public EventShopperDbContext(DbContextOptions<EventShopperDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AiPreviews> AiPreviews { get; set; }

    public virtual DbSet<Appointments> Appointments { get; set; }

    public virtual DbSet<AuditLogs> AuditLogs { get; set; }

    public virtual DbSet<ChatMessages> ChatMessages { get; set; }

    public virtual DbSet<ChatSessions> ChatSessions { get; set; }

    public virtual DbSet<CustomerProfiles> CustomerProfiles { get; set; }

    public virtual DbSet<Events> Events { get; set; }

    public virtual DbSet<FamilyMembers> FamilyMembers { get; set; }

    public virtual DbSet<FulfillmentOrders> FulfillmentOrders { get; set; }

    public virtual DbSet<GarmentMeasurementMaps> GarmentMeasurementMaps { get; set; }

    public virtual DbSet<Garments> Garments { get; set; }

    public virtual DbSet<Guests> Guests { get; set; }

    public virtual DbSet<JobCardStageLogs> JobCardStageLogs { get; set; }

    public virtual DbSet<JobCards> JobCards { get; set; }

    public virtual DbSet<MeasurementAttributes> MeasurementAttributes { get; set; }

    public virtual DbSet<MemberMeasurements> MemberMeasurements { get; set; }

    public virtual DbSet<OrderMilestones> OrderMilestones { get; set; }

    public virtual DbSet<Orders> Orders { get; set; }

    public virtual DbSet<OtpEntries> OtpEntries { get; set; }

    public virtual DbSet<OutboxMessages> OutboxMessages { get; set; }

    public virtual DbSet<Payments> Payments { get; set; }

    public virtual DbSet<Permissions> Permissions { get; set; }

    public virtual DbSet<ProductionRequestStageLogs> ProductionRequestStageLogs { get; set; }

    public virtual DbSet<ProductionRequests> ProductionRequests { get; set; }

    public virtual DbSet<PromoCodes> PromoCodes { get; set; }

    public virtual DbSet<Referrals> Referrals { get; set; }

    public virtual DbSet<RefreshTokens> RefreshTokens { get; set; }

    public virtual DbSet<Reviews> Reviews { get; set; }

    public virtual DbSet<RolePermissions> RolePermissions { get; set; }

    public virtual DbSet<Roles> Roles { get; set; }

    public virtual DbSet<ScreenMappings> ScreenMappings { get; set; }

    public virtual DbSet<Sessions> Sessions { get; set; }

    public virtual DbSet<SystemCategories> SystemCategories { get; set; }

    public virtual DbSet<SystemCodes> SystemCodes { get; set; }

    public virtual DbSet<SystemSettings> SystemSettings { get; set; }

    public virtual DbSet<UserPasswordHistory> UserPasswordHistory { get; set; }

    public virtual DbSet<UserRoles> UserRoles { get; set; }

    public virtual DbSet<Users> Users { get; set; }

    public virtual DbSet<VehicleLocations> VehicleLocations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AiPreviews>(entity =>
        {
            entity.HasIndex(e => e.GarmentId, "IX_AiPreviews_GarmentId");

            entity.HasIndex(e => e.PromptHash, "IX_AiPreviews_PromptHash");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.ImageUrl).HasMaxLength(2048);
            entity.Property(e => e.PromptHash).HasMaxLength(256);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();

            entity.HasOne(d => d.Garment).WithMany(p => p.AiPreviews).HasForeignKey(d => d.GarmentId);
        });

        modelBuilder.Entity<Appointments>(entity =>
        {
            entity.HasIndex(e => e.EventId, "IX_Appointments_EventId");

            entity.HasIndex(e => e.GuestTrackingCode, "IX_Appointments_GuestTrackingCode").IsUnique();

            entity.HasIndex(e => e.StatusCode, "IX_Appointments_StatusCode");

            entity.HasIndex(e => e.StylistId, "IX_Appointments_StylistId");

            entity.HasIndex(e => new { e.StartTime, e.EndTime }, "IX_Appointments_TimeRange");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AddressCity).HasMaxLength(100);
            entity.Property(e => e.AddressCountry).HasMaxLength(10);
            entity.Property(e => e.AddressPostalCode).HasMaxLength(20);
            entity.Property(e => e.AddressState).HasMaxLength(100);
            entity.Property(e => e.AddressStreet).HasMaxLength(250);
            entity.Property(e => e.GuestTrackingCode).HasMaxLength(20);
            entity.Property(e => e.LocationLatitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.LocationLongitude).HasColumnType("decimal(9, 6)");
            entity.Property(e => e.Notes).HasMaxLength(2000);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.StatusCode).HasMaxLength(50);

            entity.HasOne(d => d.Event).WithMany(p => p.Appointments).HasForeignKey(d => d.EventId);
        });

        modelBuilder.Entity<AuditLogs>(entity =>
        {
            entity.HasIndex(e => e.Action, "IX_AuditLogs_Action");

            entity.HasIndex(e => e.CreatedAt, "IX_AuditLogs_CreatedAt");

            entity.HasIndex(e => new { e.ResourceType, e.ResourceId }, "IX_AuditLogs_ResourceType_ResourceId");

            entity.HasIndex(e => e.UserId, "IX_AuditLogs_UserId");

            entity.Property(e => e.Action).HasMaxLength(100);
            entity.Property(e => e.Details).HasMaxLength(2000);
            entity.Property(e => e.IpAddress).HasMaxLength(45);
            entity.Property(e => e.ResourceId).HasMaxLength(100);
            entity.Property(e => e.ResourceType).HasMaxLength(100);
            entity.Property(e => e.UserAgent).HasMaxLength(500);
            entity.Property(e => e.Username).HasMaxLength(256);
        });

        modelBuilder.Entity<ChatMessages>(entity =>
        {
            entity.HasIndex(e => e.ChatSessionId, "IX_ChatMessages_ChatSessionId");

            entity.HasIndex(e => e.SentAt, "IX_ChatMessages_SentAt");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AttachmentUrl).HasMaxLength(500);
            entity.Property(e => e.MessageText).HasMaxLength(2000);
            entity.Property(e => e.SenderId).HasMaxLength(128);

            entity.HasOne(d => d.ChatSession).WithMany(p => p.ChatMessages).HasForeignKey(d => d.ChatSessionId);
        });

        modelBuilder.Entity<ChatSessions>(entity =>
        {
            entity.HasIndex(e => e.CustomerProfileId, "IX_ChatSessions_CustomerProfileId");

            entity.HasIndex(e => e.IsActive, "IX_ChatSessions_IsActive");

            entity.HasIndex(e => e.JobCardId, "IX_ChatSessions_JobCardId");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.TailorId).HasMaxLength(50);

            entity.HasOne(d => d.CustomerProfile).WithMany(p => p.ChatSessions).HasForeignKey(d => d.CustomerProfileId);

            entity.HasOne(d => d.JobCard).WithMany(p => p.ChatSessions).HasForeignKey(d => d.JobCardId);
        });

        modelBuilder.Entity<CustomerProfiles>(entity =>
        {
            entity.HasIndex(e => e.AuthUserId, "IX_CustomerProfiles_AuthUserId")
                .IsUnique()
                .HasFilter("([AuthUserId] IS NOT NULL)");

            entity.HasIndex(e => e.EmailNormalized, "IX_CustomerProfiles_EmailNormalized");

            entity.HasIndex(e => e.GuestToken, "IX_CustomerProfiles_GuestToken")
                .IsUnique()
                .HasFilter("([GuestToken] IS NOT NULL)");

            entity.HasIndex(e => e.PhoneNormalized, "IX_CustomerProfiles_PhoneNormalized");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.EmailNormalized).HasMaxLength(255);
            entity.Property(e => e.FirstName).HasMaxLength(100);
            entity.Property(e => e.GuestToken).HasMaxLength(100);
            entity.Property(e => e.LastName).HasMaxLength(100);
            entity.Property(e => e.PhoneNormalized).HasMaxLength(15);
            entity.Property(e => e.PhoneValue).HasMaxLength(30);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
        });

        modelBuilder.Entity<Events>(entity =>
        {
            entity.HasIndex(e => e.CustomerProfileId, "IX_Events_CustomerProfileId");

            entity.HasIndex(e => e.EventDate, "IX_Events_EventDate");

            entity.HasIndex(e => e.EventTypeCode, "IX_Events_EventTypeCode");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.EventTypeCode).HasMaxLength(50);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.Title).HasMaxLength(200);

            entity.HasOne(d => d.CustomerProfile).WithMany(p => p.Events).HasForeignKey(d => d.CustomerProfileId);
        });

        modelBuilder.Entity<FamilyMembers>(entity =>
        {
            entity.HasIndex(e => e.CustomerProfileId, "IX_FamilyMembers_CustomerProfileId");

            entity.HasIndex(e => new { e.CustomerProfileId, e.Name }, "IX_FamilyMembers_ProfileId_Name");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.GenderCode).HasMaxLength(50);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.RelationCode).HasMaxLength(50);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();

            entity.HasOne(d => d.CustomerProfile).WithMany(p => p.FamilyMembers).HasForeignKey(d => d.CustomerProfileId);
        });

        modelBuilder.Entity<FulfillmentOrders>(entity =>
        {
            entity.HasIndex(e => e.CustomerProfileId, "IX_FulfillmentOrders_CustomerProfileId");

            entity.HasIndex(e => e.PickupCode, "IX_FulfillmentOrders_PickupCode");

            entity.HasIndex(e => e.StatusCode, "IX_FulfillmentOrders_Status");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Notes).HasMaxLength(500);
            entity.Property(e => e.PickupCode).HasMaxLength(10);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.StatusCode).HasMaxLength(50);
            entity.Property(e => e.TrackingNumber).HasMaxLength(100);

            entity.HasOne(d => d.CustomerProfile).WithMany(p => p.FulfillmentOrders)
                .HasForeignKey(d => d.CustomerProfileId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<GarmentMeasurementMaps>(entity =>
        {
            entity.HasKey(e => new { e.GarmentTypeCode, e.MeasurementAttributeId });

            entity.HasIndex(e => e.GarmentTypeCode, "IX_GarmentMeasurementMaps_GarmentTypeCode");

            entity.HasIndex(e => e.MeasurementAttributeId, "IX_GarmentMeasurementMaps_MeasurementAttributeId");

            entity.Property(e => e.GarmentTypeCode).HasMaxLength(50);

            entity.HasOne(d => d.MeasurementAttribute).WithMany(p => p.GarmentMeasurementMaps).HasForeignKey(d => d.MeasurementAttributeId);
        });

        modelBuilder.Entity<Garments>(entity =>
        {
            entity.HasIndex(e => e.EventId, "IX_Garments_EventId");

            entity.HasIndex(e => e.FamilyMemberId, "IX_Garments_FamilyMemberId");

            entity.HasIndex(e => e.GarmentTypeCode, "IX_Garments_GarmentTypeCode");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.FabricNotes).HasMaxLength(2000);
            entity.Property(e => e.GarmentTypeCode).HasMaxLength(50);
            entity.Property(e => e.Price).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();

            entity.HasOne(d => d.Event).WithMany(p => p.Garments)
                .HasForeignKey(d => d.EventId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.FamilyMember).WithMany(p => p.Garments)
                .HasForeignKey(d => d.FamilyMemberId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<Guests>(entity =>
        {
            entity.HasIndex(e => e.GuestToken, "IX_Guests_GuestToken").IsUnique();

            entity.Property(e => e.GuestToken).HasMaxLength(64);
        });

        modelBuilder.Entity<JobCardStageLogs>(entity =>
        {
            entity.HasIndex(e => e.CompletedAt, "IX_JobCardStageLogs_CompletedAt");

            entity.HasIndex(e => e.JobCardId, "IX_JobCardStageLogs_JobCardId");

            entity.HasIndex(e => e.StageCode, "IX_JobCardStageLogs_StageCode");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.LoggedById).HasMaxLength(100);
            entity.Property(e => e.StageCode).HasMaxLength(50);

            entity.HasOne(d => d.JobCard).WithMany(p => p.JobCardStageLogs).HasForeignKey(d => d.JobCardId);
        });

        modelBuilder.Entity<JobCards>(entity =>
        {
            entity.HasIndex(e => e.CurrentStageCode, "IX_JobCards_CurrentStageCode");

            entity.HasIndex(e => e.GarmentId, "IX_JobCards_GarmentId");

            entity.HasIndex(e => e.TailorId, "IX_JobCards_TailorId");

            entity.HasIndex(e => e.TargetDate, "IX_JobCards_TargetDate");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CurrentStageCode).HasMaxLength(50);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.TailorId).HasMaxLength(100);

            entity.HasOne(d => d.Garment).WithMany(p => p.JobCards).HasForeignKey(d => d.GarmentId);
        });

        modelBuilder.Entity<MeasurementAttributes>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_MeasurementAttributes_Code").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.Unit).HasMaxLength(20);
        });

        modelBuilder.Entity<MemberMeasurements>(entity =>
        {
            entity.HasIndex(e => e.MeasurementAttributeId, "IX_MemberMeasurements_AttributeId");

            entity.HasIndex(e => e.FamilyMemberId, "IX_MemberMeasurements_FamilyMemberId");

            entity.HasIndex(e => new { e.FamilyMemberId, e.MeasurementAttributeId }, "IX_MemberMeasurements_MemberId_AttributeId").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.MeasuredValue).HasColumnType("decimal(10, 2)");
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();

            entity.HasOne(d => d.FamilyMember).WithMany(p => p.MemberMeasurements).HasForeignKey(d => d.FamilyMemberId);
        });

        modelBuilder.Entity<OrderMilestones>(entity =>
        {
            entity.HasIndex(e => e.OrderId, "IX_OrderMilestones_OrderId");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AmountDue).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.AmountDueCurrency).HasMaxLength(3);
            entity.Property(e => e.AmountPaid).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.AmountPaidCurrency).HasMaxLength(3);
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.Percentage).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.StatusCode).HasMaxLength(50);

            entity.HasOne(d => d.Order).WithMany(p => p.OrderMilestones).HasForeignKey(d => d.OrderId);
        });

        modelBuilder.Entity<Orders>(entity =>
        {
            entity.HasIndex(e => e.CustomerProfileId, "IX_Orders_CustomerProfileId");

            entity.HasIndex(e => e.OccasionEventId, "IX_Orders_OccasionEventId");

            entity.HasIndex(e => e.StatusCode, "IX_Orders_StatusCode");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Notes).HasMaxLength(2000);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.StatusCode).HasMaxLength(50);
            entity.Property(e => e.TotalAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TotalCurrency).HasMaxLength(3);
        });

        modelBuilder.Entity<OtpEntries>(entity =>
        {
            entity.HasIndex(e => e.PhoneNumber, "IX_OtpEntries_PhoneNumber");

            entity.HasIndex(e => new { e.PhoneNumber, e.IsUsed }, "IX_OtpEntries_PhoneNumber_IsUsed");

            entity.Property(e => e.CodeHash).HasMaxLength(128);
            entity.Property(e => e.PhoneNumber).HasMaxLength(20);
        });

        modelBuilder.Entity<OutboxMessages>(entity =>
        {
            entity.Property(e => e.Type).HasMaxLength(512);
        });

        modelBuilder.Entity<Payments>(entity =>
        {
            entity.HasIndex(e => e.OrderMilestoneId, "IX_Payments_OrderMilestoneId");

            entity.HasIndex(e => e.TransactionId, "IX_Payments_TransactionId").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Amount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.Currency).HasMaxLength(3);
            entity.Property(e => e.PaymentMethodCode).HasMaxLength(50);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.TransactionId).HasMaxLength(100);

            entity.HasOne(d => d.OrderMilestone).WithMany(p => p.Payments)
                .HasForeignKey(d => d.OrderMilestoneId)
                .OnDelete(DeleteBehavior.ClientSetNull);
        });

        modelBuilder.Entity<Permissions>(entity =>
        {
            entity.HasIndex(e => e.Action, "IX_Permissions_Action");

            entity.HasIndex(e => e.DeletedAt, "IX_Permissions_DeletedAt");

            entity.HasIndex(e => e.IsActive, "IX_Permissions_IsActive");

            entity.HasIndex(e => e.Module, "IX_Permissions_Module");

            entity.HasIndex(e => new { e.Module, e.Action }, "IX_Permissions_Module_Action");

            entity.HasIndex(e => e.Name, "IX_Permissions_Name")
                .IsUnique()
                .HasFilter("([DeletedAt] IS NULL)");

            entity.Property(e => e.Action).HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Module).HasMaxLength(50);
            entity.Property(e => e.Name).HasMaxLength(100);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
        });

        modelBuilder.Entity<ProductionRequestStageLogs>(entity =>
        {
            entity.HasIndex(e => e.CompletedAt, "IX_ProductionRequestStageLogs_CompletedAt");

            entity.HasIndex(e => e.ProductionRequestId, "IX_ProductionRequestStageLogs_ProductionRequestId");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.LoggedByAuthUserId).HasMaxLength(100);
            entity.Property(e => e.StageCode).HasMaxLength(50);

            entity.HasOne(d => d.ProductionRequest).WithMany(p => p.ProductionRequestStageLogs).HasForeignKey(d => d.ProductionRequestId);
        });

        modelBuilder.Entity<ProductionRequests>(entity =>
        {
            entity.HasIndex(e => e.EventId, "IX_ProductionRequests_EventId");

            entity.HasIndex(e => e.FamilyMemberId, "IX_ProductionRequests_FamilyMemberId");

            entity.HasIndex(e => e.FulfillmentOrderId, "IX_ProductionRequests_FulfillmentOrderId");

            entity.HasIndex(e => e.CurrentStatusCode, "IX_ProductionRequests_Status");

            entity.HasIndex(e => e.TargetDate, "IX_ProductionRequests_TargetDate");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AssignedWorkerId).HasMaxLength(100);
            entity.Property(e => e.CurrentStatusCode).HasMaxLength(50);
            entity.Property(e => e.DesignNotes).HasMaxLength(2000);
            entity.Property(e => e.FabricDetails).HasMaxLength(1000);
            entity.Property(e => e.GarmentTypeCode).HasMaxLength(50);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();

            entity.HasOne(d => d.Event).WithMany(p => p.ProductionRequests)
                .HasForeignKey(d => d.EventId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(d => d.FamilyMember).WithMany(p => p.ProductionRequests)
                .HasForeignKey(d => d.FamilyMemberId)
                .OnDelete(DeleteBehavior.ClientSetNull);

            entity.HasOne(d => d.FulfillmentOrder).WithMany(p => p.ProductionRequests)
                .HasForeignKey(d => d.FulfillmentOrderId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PromoCodes>(entity =>
        {
            entity.HasIndex(e => new { e.IsActive, e.ValidFrom, e.ValidUntil }, "IX_PromoCodes_Active_Validity");

            entity.HasIndex(e => e.Code, "IX_PromoCodes_Code").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.CurrencyCode).HasMaxLength(3);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.DiscountType).HasMaxLength(20);
            entity.Property(e => e.DiscountValue).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.MaximumDiscountAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.MinimumOrderAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
        });

        modelBuilder.Entity<Referrals>(entity =>
        {
            entity.HasIndex(e => e.ReferralCode, "IX_Referrals_ReferralCode");

            entity.HasIndex(e => e.ReferrerProfileId, "IX_Referrals_ReferrerProfileId");

            entity.HasIndex(e => e.StatusCode, "IX_Referrals_StatusCode");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.ReferralCode).HasMaxLength(20);
            entity.Property(e => e.ReferredName).HasMaxLength(200);
            entity.Property(e => e.ReferredPhone).HasMaxLength(20);
            entity.Property(e => e.RewardAmount).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.RewardCurrency).HasMaxLength(3);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.StatusCode).HasMaxLength(50);
            entity.Property(e => e.StatusDisplay).HasMaxLength(50);
        });

        modelBuilder.Entity<RefreshTokens>(entity =>
        {
            entity.HasIndex(e => e.ExpiresAt, "IX_RefreshTokens_ExpiresAt");

            entity.HasIndex(e => e.IsRevoked, "IX_RefreshTokens_IsRevoked");

            entity.HasIndex(e => e.Token, "IX_RefreshTokens_Token").IsUnique();

            entity.HasIndex(e => e.UserId, "IX_RefreshTokens_UserId");

            entity.HasIndex(e => new { e.UserId, e.IsRevoked, e.IsUsed }, "IX_RefreshTokens_UserId_IsRevoked_IsUsed");

            entity.Property(e => e.ClientId).HasMaxLength(128);
            entity.Property(e => e.IpAddress).HasMaxLength(45);
            entity.Property(e => e.Platform).HasMaxLength(32);
            entity.Property(e => e.ReplacedByToken).HasMaxLength(500);
            entity.Property(e => e.RevokedReason).HasMaxLength(200);
            entity.Property(e => e.Token).HasMaxLength(500);
            entity.Property(e => e.TokenFamilyId).HasDefaultValue(new Guid("abe5f451-bd5f-4e75-a4c8-75d84f9e69f0"));
            entity.Property(e => e.UserAgent).HasMaxLength(500);

            entity.HasOne(d => d.User).WithMany(p => p.RefreshTokens).HasForeignKey(d => d.UserId);
        });

        modelBuilder.Entity<Reviews>(entity =>
        {
            entity.HasIndex(e => e.CustomerProfileId, "IX_Reviews_CustomerProfileId");

            entity.HasIndex(e => e.IdempotencyKey, "IX_Reviews_IdempotencyKey").IsUnique();

            entity.HasIndex(e => e.OrderId, "IX_Reviews_OrderId");

            entity.HasIndex(e => new { e.IsPublished, e.Rating }, "IX_Reviews_Published_Rating");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.GarmentTypeCode).HasMaxLength(50);
            entity.Property(e => e.IdempotencyKey).HasMaxLength(100);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.Title).HasMaxLength(200);
        });

        modelBuilder.Entity<RolePermissions>(entity =>
        {
            entity.HasIndex(e => e.GrantedAt, "IX_RolePermissions_GrantedAt");

            entity.HasIndex(e => e.PermissionId, "IX_RolePermissions_PermissionId");

            entity.HasIndex(e => e.RoleId, "IX_RolePermissions_RoleId");

            entity.HasIndex(e => new { e.RoleId, e.PermissionId }, "IX_RolePermissions_RoleId_PermissionId").IsUnique();

            entity.HasOne(d => d.Permission).WithMany(p => p.RolePermissions).HasForeignKey(d => d.PermissionId);

            entity.HasOne(d => d.Role).WithMany(p => p.RolePermissions).HasForeignKey(d => d.RoleId);
        });

        modelBuilder.Entity<Roles>(entity =>
        {
            entity.HasIndex(e => e.DeletedAt, "IX_Roles_DeletedAt");

            entity.HasIndex(e => e.IsActive, "IX_Roles_IsActive");

            entity.HasIndex(e => e.Name, "IX_Roles_Name")
                .IsUnique()
                .HasFilter("([DeletedAt] IS NULL)");

            entity.HasIndex(e => e.Priority, "IX_Roles_Priority");

            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Name).HasMaxLength(50);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
        });

        modelBuilder.Entity<ScreenMappings>(entity =>
        {
            entity.HasIndex(e => new { e.RoleId, e.IsVisible }, "IX_ScreenMappings_RoleId_IsVisible");

            entity.HasIndex(e => new { e.RoleId, e.ScreenKey }, "IX_ScreenMappings_RoleId_ScreenKey").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.IsVisible).HasDefaultValue(true);
            entity.Property(e => e.ScreenKey).HasMaxLength(100);
        });

        modelBuilder.Entity<Sessions>(entity =>
        {
            entity.HasIndex(e => e.ExpiresAt, "IX_Sessions_ExpiresAt");

            entity.HasIndex(e => e.IsActive, "IX_Sessions_IsActive");

            entity.HasIndex(e => e.SessionToken, "IX_Sessions_SessionToken").IsUnique();

            entity.HasIndex(e => e.UserId, "IX_Sessions_UserId");

            entity.HasIndex(e => new { e.UserId, e.IsActive }, "IX_Sessions_UserId_IsActive");

            entity.Property(e => e.ClientId).HasMaxLength(128);
            entity.Property(e => e.DeviceInfo).HasMaxLength(500);
            entity.Property(e => e.IpAddress).HasMaxLength(45);
            entity.Property(e => e.Platform).HasMaxLength(32);
            entity.Property(e => e.SessionToken).HasMaxLength(500);
            entity.Property(e => e.TerminationReason).HasMaxLength(200);
            entity.Property(e => e.UserAgent).HasMaxLength(500);

            entity.HasOne(d => d.User).WithMany(p => p.Sessions).HasForeignKey(d => d.UserId);
        });

        modelBuilder.Entity<SystemCategories>(entity =>
        {
            entity.HasIndex(e => e.Code, "IX_SystemCategories_Code").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Name).HasMaxLength(100);
        });

        modelBuilder.Entity<SystemCodes>(entity =>
        {
            entity.HasIndex(e => new { e.CategoryId, e.Code }, "IX_SystemCodes_CategoryId_Code").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.DisplayValue).HasMaxLength(100);

            entity.HasOne(d => d.Category).WithMany(p => p.SystemCodes).HasForeignKey(d => d.CategoryId);
        });

        modelBuilder.Entity<SystemSettings>(entity =>
        {
            entity.HasIndex(e => e.Key, "IX_SystemSettings_Key").IsUnique();

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.DataType)
                .HasMaxLength(50)
                .HasDefaultValue("Boolean");
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.Key).HasMaxLength(100);
            entity.Property(e => e.Value).HasMaxLength(2000);
        });

        modelBuilder.Entity<UserPasswordHistory>(entity =>
        {
            entity.HasIndex(e => e.UserId, "IX_UserPasswordHistory_UserId");

            entity.Property(e => e.PasswordHash).HasMaxLength(500);

            entity.HasOne(d => d.User).WithMany(p => p.UserPasswordHistory).HasForeignKey(d => d.UserId);
        });

        modelBuilder.Entity<UserRoles>(entity =>
        {
            entity.HasIndex(e => e.AssignedAt, "IX_UserRoles_AssignedAt");

            entity.HasIndex(e => e.RoleId, "IX_UserRoles_RoleId");

            entity.HasIndex(e => e.UserId, "IX_UserRoles_UserId");

            entity.HasIndex(e => new { e.UserId, e.RoleId }, "IX_UserRoles_UserId_RoleId").IsUnique();

            entity.HasOne(d => d.Role).WithMany(p => p.UserRoles).HasForeignKey(d => d.RoleId);

            entity.HasOne(d => d.User).WithMany(p => p.UserRoles).HasForeignKey(d => d.UserId);
        });

        modelBuilder.Entity<Users>(entity =>
        {
            entity.HasIndex(e => e.CreatedAt, "IX_Users_CreatedAt");

            entity.HasIndex(e => e.DeletedAt, "IX_Users_DeletedAt");

            entity.HasIndex(e => e.Email, "IX_Users_Email")
                .IsUnique()
                .HasFilter("([DeletedAt] IS NULL)");

            entity.HasIndex(e => e.IsActive, "IX_Users_IsActive");

            entity.HasIndex(e => e.Username, "IX_Users_Username")
                .IsUnique()
                .HasFilter("([DeletedAt] IS NULL)");

            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.EmailVerificationToken).HasMaxLength(500);
            entity.Property(e => e.FirstName).HasMaxLength(100);
            entity.Property(e => e.LastLoginIp).HasMaxLength(45);
            entity.Property(e => e.LastName).HasMaxLength(100);
            entity.Property(e => e.PasswordHash).HasMaxLength(500);
            entity.Property(e => e.PasswordResetToken).HasMaxLength(500);
            entity.Property(e => e.PhoneNumber).HasMaxLength(20);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
            entity.Property(e => e.TwoFactorSecret).HasMaxLength(500);
            entity.Property(e => e.Username).HasMaxLength(50);
        });

        modelBuilder.Entity<VehicleLocations>(entity =>
        {
            entity.HasIndex(e => e.AppointmentId, "IX_VehicleLocations_AppointmentId");

            entity.HasIndex(e => new { e.AppointmentId, e.IsActive }, "IX_VehicleLocations_Appointment_Active");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.RowVersion)
                .IsRowVersion()
                .IsConcurrencyToken();
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
