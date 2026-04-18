# 02 — Healthcare Domain Architecture

> HIPAA-compliant architecture for Protected Health Information (PHI) management  
> Applicable to RIMS domains: Medical screening, domestic medical enrollment, participation tracking

---

## Table of Contents

1. [PHI Data Classification](#1-phi-data-classification)
2. [Technical Safeguards Implementation](#2-technical-safeguards-implementation)
3. [PHI Encryption Strategy](#3-phi-encryption-strategy)
4. [Audit Trail for PHI Access](#4-audit-trail-for-phi-access)
5. [Consent & Authorization Management](#5-consent--authorization-management)
6. [Healthcare Folder Structure](#6-healthcare-folder-structure)
7. [Healthcare-Specific Patterns](#7-healthcare-specific-patterns)
8. [Breach Notification Support](#8-breach-notification-support)

---

## 1. PHI Data Classification

### 1.1 HIPAA's 18 PHI Identifiers Mapped to RIMS

| # | PHI Identifier | RIMS Entity/Field | Risk Level |
|---|---|---|---|
| 1 | Name | `ApplicationMember.FirstName/LastName`, `RefugeeClientDetail.FirstName/LastName` | HIGH |
| 2 | Address | `ApplicationAddress.*`, `RefugeeClientAddress.*` | HIGH |
| 3 | Dates (DOB, admission, etc.) | `ApplicationMember.DateOfBirth`, `NewArrivalCaseManagement.DateOfArrival` | HIGH |
| 4 | Phone | `ApplicationContact.Value` (type=phone) | MEDIUM |
| 5 | Email | `ApplicationContact.Value` (type=email), `Application.AuthRepEmail` | MEDIUM |
| 6 | SSN | `ApplicationMember.Ssn`, `CaseComposition.Ssn` | CRITICAL |
| 7 | Medical Record # | `NewArrivalDomesticMedicalScreening.*` | HIGH |
| 8 | Account # | `CaseManagement.CaseNumber` | MEDIUM |
| 9 | Certificate/License # | `ApplicationMember.AlienNumber`, `PassportNumber` | HIGH |
| 10 | Vehicle IDs | Not applicable | — |
| 11 | Device IDs | `UserTrustedDevice.*` | LOW |
| 12 | Web URLs | Not applicable | — |
| 13 | IP Addresses | Logged in `Action` table | MEDIUM |
| 14 | Biometric IDs | Not applicable | — |
| 15 | Photos | Not applicable | — |
| 16 | Any other unique ID | `RefugeeClientDetail.Id`, `CaseManagement.Id` | MEDIUM |
| 17 | Country of origin | `ApplicationMember.CountryOfOrigin` | MEDIUM |
| 18 | Immigration status | `ApplicationMember.ImmigrationStatusId` | HIGH |

### 1.2 Data Classification Matrix

```csharp
// NEW: PHI classification interface
public interface IContainsPHI
{
    /// <summary>
    /// Returns the names of properties that contain PHI.
    /// Used for enhanced audit logging and encryption targeting.
    /// </summary>
    IReadOnlyList<string> GetPHIFieldNames();

    /// <summary>
    /// Classification level for minimum necessary standard.
    /// </summary>
    PHIClassification Classification { get; }
}

public enum PHIClassification
{
    /// <summary>No PHI — safe for logging, caching, etc.</summary>
    None = 0,
    /// <summary>Contains de-identified data — aggregates, counts</summary>
    DeIdentified = 1,
    /// <summary>Contains limited PHI — dates, zip codes, ages</summary>
    LimitedDataSet = 2,
    /// <summary>Contains full PHI — names, SSN, addresses</summary>
    FullPHI = 3,
    /// <summary>Contains sensitive PHI — mental health, substance abuse</summary>
    SensitivePHI = 4
}

// Applied to domain entities
public partial class ApplicationMember : IAuditable, IContainsPHI
{
    public PHIClassification Classification => PHIClassification.FullPHI;

    public IReadOnlyList<string> GetPHIFieldNames() => new[]
    {
        nameof(FirstName), nameof(LastName), nameof(Ssn),
        nameof(DateOfBirth), nameof(AlienNumber), nameof(PassportNumber)
    };
}
```

---

## 2. Technical Safeguards Implementation

### 2.1 Access Control (§164.312(a))

```csharp
// Role-based access with PHI-level restrictions
public enum RimsRole
{
    Viewer,                // View de-identified data only
    CaseWorker,           // View/edit assigned cases (limited PHI)
    Supervisor,           // View all cases in county
    Administrator,        // Full system access
    AuditReviewer,        // Read-only access to audit logs
    SystemAdmin           // Configuration + user management
}

// NEW: Attribute-based PHI access control
[AttributeUsage(AttributeTargets.Method)]
public class RequiresPHIAccessAttribute : Attribute
{
    public PHIClassification MinimumLevel { get; }
    public string Justification { get; }

    public RequiresPHIAccessAttribute(
        PHIClassification level, 
        string justification = "Case management operation")
    {
        MinimumLevel = level;
        Justification = justification;
    }
}

// Usage in endpoint
[RequiresPHIAccess(PHIClassification.FullPHI, "Viewing referral member details")]
public static async Task<IResult> GetReferralSection(
    ReferralApplicationDetailCdto cdto,
    [FromServices] IMediator mediator,
    CancellationToken ct)
{
    var result = await mediator.Send(new GetReferralSectionQuery(cdto), ct);
    return Results.Ok(Response.Success(result));
}
```

### 2.2 Minimum Necessary Standard

```csharp
// NEW: PHI field masking in responses based on user role
public class PHIMaskingBehavior<TRequest, TResponse> 
    : IPipelineBehavior<TRequest, TResponse>
{
    private readonly IHttpContextAccessor _contextAccessor;

    public async Task<TResponse> Handle(TRequest request, 
        RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var response = await next();

        var userRole = GetUserRole(_contextAccessor.HttpContext);
        if (userRole == RimsRole.Viewer)
        {
            MaskPHIFields(response); // Replaces SSN with ***-**-1234, etc.
        }

        return response;
    }

    private void MaskPHIFields(object response)
    {
        // Recursively find IContainsPHI objects and mask PHI fields
        // SSN ? ***-**-{last4}
        // Name ? {first initial}.***
        // DOB ? **/**/****
        // AlienNumber ? ***{last3}
    }
}
```

### 2.3 Automatic Logoff (§164.312(a)(2)(iii))

```csharp
// EXISTING: JWT expiration handles server-side
// Angular RequestInterceptor handles client-side
// ENHANCED: Activity-based timeout

// Web.UI — sliding session timeout
builder.Services.Configure<WebSettings>(config);
// WebSettings.AuthAccessTokenExpiration = 15 (minutes)
// WebSettings.AuthRefreshTokenExpiration = 30 (minutes)

// Angular — idle detection
// TimeoutDialog shown at 13 minutes
// Auto-logout at 15 minutes
// Session storage cleared on logout
```

---

## 3. PHI Encryption Strategy

### 3.1 Encryption at Rest

```csharp
// Database-level: SQL Server TDE (Transparent Data Encryption)
// + Column-level encryption for PHI fields

// Application-level: Value converter for PHI fields
public class EncryptedStringConverter : ValueConverter<string, string>
{
    public EncryptedStringConverter(IDataProtector protector)
        : base(
            v => protector.Protect(v),           // Encrypt on write
            v => protector.Unprotect(v))          // Decrypt on read
    { }
}

// Applied in DbContext configuration
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    var protector = _serviceProvider
        .GetRequiredService<IDataProtectionProvider>()
        .CreateProtector("PHI-Protection-v1");

    modelBuilder.Entity<ApplicationMember>(entity =>
    {
        entity.Property(e => e.Ssn)
            .HasConversion(new EncryptedStringConverter(protector));
        entity.Property(e => e.AlienNumber)
            .HasConversion(new EncryptedStringConverter(protector));
        entity.Property(e => e.PassportNumber)
            .HasConversion(new EncryptedStringConverter(protector));
    });
}
```

### 3.2 Encryption in Transit

```csharp
// EXISTING: HTTPS enforced
app.UseHttpsRedirection();
app.UseHsts();

// ENHANCED: Minimum TLS version
builder.WebHost.ConfigureKestrel(options =>
{
    options.ConfigureHttpsDefaults(httpsOptions =>
    {
        httpsOptions.SslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13;
    });
});

// SOAP service connections — mutual TLS where supported
// Windows Negotiate — Kerberos encryption
```

### 3.3 Encryption Key Management

```csharp
// NEW: Key rotation strategy
public class PHIKeyManagementService
{
    private readonly IDataProtectionProvider _provider;

    // Keys auto-rotate every 90 days
    // Old keys retained for 6 years (HIPAA retention)
    // Keys stored in Azure Key Vault (production)
    // Keys stored in file system (development)

    public IDataProtector CreateProtector(string purpose)
    {
        return _provider.CreateProtector(purpose);
    }
}

// Program.cs
builder.Services.AddDataProtection()
    .SetApplicationName("RIMS")
    .SetDefaultKeyLifetime(TimeSpan.FromDays(90))
    .PersistKeysToAzureBlobStorage(/* ... */)
    .ProtectKeysWithAzureKeyVault(/* ... */);
```

---

## 4. Audit Trail for PHI Access

### 4.1 HIPAA Audit Requirements

Every PHI access must log:
- **Who** accessed the data (UserId, SessionId)
- **What** data was accessed (entity, field names, record IDs)
- **When** the access occurred (UTC timestamp)
- **Where** the access originated (IP address, endpoint path)
- **Why** the access was needed (operation type, justification)

### 4.2 Enhanced Audit Implementation

```csharp
// NEW: PHI-specific audit entry
public class PHIAuditEntry
{
    public long Id { get; set; }
    public DateTime TimestampUtc { get; set; }
    public long UserId { get; set; }
    public long SessionId { get; set; }
    public string IpAddress { get; set; }
    public string EndpointPath { get; set; }
    public string EntityName { get; set; }
    public long EntityId { get; set; }
    public PHIAccessType AccessType { get; set; }
    public string FieldsAccessed { get; set; } // JSON array of field names
    public string Justification { get; set; }
    public string CorrelationId { get; set; }
}

public enum PHIAccessType
{
    View,
    Create,
    Update,
    Delete,
    Export,
    Print,
    Search
}

// Automatic PHI audit via EF interceptor
public class PHIAuditInterceptor : SaveChangesInterceptor
{
    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, 
        InterceptionResult<int> result, 
        CancellationToken ct = default)
    {
        var context = eventData.Context;
        var phiEntities = context.ChangeTracker.Entries()
            .Where(e => e.Entity is IContainsPHI && 
                   e.State != EntityState.Unchanged);

        foreach (var entry in phiEntities)
        {
            var phi = (IContainsPHI)entry.Entity;
            // Create audit entry for each PHI entity change
            var audit = new PHIAuditEntry
            {
                EntityName = entry.Entity.GetType().Name,
                FieldsAccessed = JsonSerializer.Serialize(phi.GetPHIFieldNames()),
                AccessType = entry.State switch
                {
                    EntityState.Added => PHIAccessType.Create,
                    EntityState.Modified => PHIAccessType.Update,
                    EntityState.Deleted => PHIAccessType.Delete,
                    _ => PHIAccessType.View
                }
            };
            // ... persist audit
        }

        return await base.SavingChangesAsync(eventData, result, ct);
    }
}
```

### 4.3 Audit Retention

```csharp
// HIPAA requires 6-year retention of audit logs
// Implemented via batch process
public class AuditRetentionBatchJob : IBatchJob
{
    public async Task Execute(CancellationToken ct)
    {
        var retentionDate = DateTime.UtcNow.AddYears(-6);

        // Archive to cold storage before deletion
        await ArchiveAuditLogs(retentionDate, ct);

        // Purge archived records
        await PurgeArchivedAuditLogs(retentionDate, ct);
    }
}
```

---

## 5. Consent & Authorization Management

### 5.1 Consent Tracking

```csharp
// NEW: Track consent for PHI use/disclosure
public class ConsentRecord
{
    public long Id { get; set; }
    public long ClientId { get; set; }
    public ConsentType Type { get; set; }
    public DateTime GrantedDate { get; set; }
    public DateTime? RevokedDate { get; set; }
    public DateTime? ExpirationDate { get; set; }
    public string GrantedBy { get; set; }  // Worker who recorded consent
    public string Purpose { get; set; }
    public bool IsActive => RevokedDate == null && 
                            (ExpirationDate == null || ExpirationDate > DateTime.UtcNow);
}

public enum ConsentType
{
    TreatmentPaymentOperations,  // TPO — generally implied
    StateAgencyDisclosure,        // Sharing with other state agencies
    ResearchUse,                  // De-identified data for research
    ThirdPartyDisclosure          // Sharing with external parties
}
```

### 5.2 Break-the-Glass Access

```csharp
// Emergency PHI access with enhanced audit
public class EmergencyAccessHandler
{
    public async Task<TResult> ExecuteWithEmergencyAccess<TResult>(
        Func<Task<TResult>> operation,
        string justification,
        CancellationToken ct)
    {
        // Log emergency access attempt
        await _auditService.LogEmergencyAccess(new EmergencyAccessEntry
        {
            UserId = _currentUser.Id,
            Justification = justification,
            TimestampUtc = DateTime.UtcNow,
            RequiresReview = true  // Flagged for supervisor review
        });

        // Execute operation with elevated permissions
        var result = await operation();

        // Notify supervisors
        await _notificationService.NotifyEmergencyAccess(/* ... */);

        return result;
    }
}
```

---

## 6. Healthcare Folder Structure

```
App/Dss.Rims.App.Application/
??? Features/
?   ??? Healthcare/
?       ??? MedicalScreening/
?       ?   ??? Commands/
?       ?   ?   ??? SaveMedicalScreeningCommand.cs
?       ?   ?   ??? SaveMedicalScreeningHandler.cs
?       ?   ?   ??? SaveMedicalScreeningValidator.cs
?       ?   ??? Queries/
?       ?   ?   ??? GetMedicalScreeningQuery.cs
?       ?   ?   ??? GetMedicalScreeningHandler.cs
?       ?   ??? Models/
?       ?       ??? MedicalScreeningResponse.cs
?       ??? MedicalEnrollment/
?       ?   ??? Commands/
?       ?   ??? Queries/
?       ?   ??? Models/
?       ??? ParticipationTracking/
?       ?   ??? Commands/
?       ?   ??? Queries/
?       ?   ??? Models/
?       ??? PHI/
?           ??? Services/
?           ?   ??? PHIMaskingService.cs
?           ?   ??? PHIEncryptionService.cs
?           ?   ??? PHIAuditService.cs
?           ??? Interfaces/
?           ?   ??? IPHIMaskingService.cs
?           ?   ??? IPHIAuditService.cs
?           ??? Models/
?               ??? PHIAuditEntry.cs
?               ??? ConsentRecord.cs

App/Dss.Rims.App.Domain/
??? Entities/
?   ??? Healthcare/
?   ?   ??? NewArrivalDomesticMedicalScreening.cs
?   ?   ??? NewArrivalMedicalEnrollment.cs
?   ?   ??? RefugeeClientParticipation.cs
?   ??? Common/
?       ??? IContainsPHI.cs

App/Dss.Rims.App.Infrastructure/
??? Persistence/
?   ??? Interceptors/
?       ??? PHIAuditInterceptor.cs
??? Security/
?   ??? DataEncryption/
?   ?   ??? EncryptedStringConverter.cs
?   ?   ??? PHIKeyManagementService.cs
?   ??? PHIProtection/
?       ??? PHIFieldMasker.cs
?       ??? BreakTheGlassService.cs
```

---

## 7. Healthcare-Specific Patterns

### 7.1 Medical Screening Workflow

```
New Arrival ? Medical Screening Assessment ? Referral to Services
                     ?
              Domestic Medical Screening
                     ?
              Medical Enrollment (Medicaid/Insurance)
                     ?
              Participation Tracking
                     ?
              Outcomes Reporting (ORR Reports)
```

### 7.2 RSSFSSP Integration (Refugee Social Services)

```csharp
// Domain model for RSS/FSSP tracking
public partial class NewArrivalRssfssp : IAuditable, IContainsPHI
{
    // Employment services, English language training
    // Must track: enrollment date, service type, provider, outcomes
    // PHI: Links back to refugee identity

    public PHIClassification Classification => PHIClassification.FullPHI;
}
```

---

## 8. Breach Notification Support

### 8.1 Breach Detection

```csharp
// NEW: Anomaly detection in PHI access patterns
public class PHIAccessAnomalyDetector
{
    public async Task<bool> IsAnomalous(PHIAccessEvent accessEvent)
    {
        // Rule 1: Bulk PHI access (>50 records in 5 minutes)
        var recentAccess = await GetRecentAccessCount(accessEvent.UserId, TimeSpan.FromMinutes(5));
        if (recentAccess > 50) return true;

        // Rule 2: Access outside business hours
        if (accessEvent.Timestamp.Hour < 6 || accessEvent.Timestamp.Hour > 22) return true;

        // Rule 3: Access to records outside assigned caseload
        if (!await IsAssignedCase(accessEvent.UserId, accessEvent.EntityId)) return true;

        return false;
    }
}
```

### 8.2 Breach Response Data

```csharp
// All data needed for HIPAA breach notification
public class BreachAssessmentReport
{
    public DateTime DiscoveryDate { get; set; }
    public string NatureOfBreach { get; set; }
    public List<PHIAuditEntry> AffectedRecords { get; set; }
    public int AffectedIndividualsCount { get; set; }
    public List<string> PHITypesExposed { get; set; }
    public string MitigationSteps { get; set; }

    // HIPAA requires notification within 60 days of discovery
    public DateTime NotificationDeadline => DiscoveryDate.AddDays(60);
}
```
