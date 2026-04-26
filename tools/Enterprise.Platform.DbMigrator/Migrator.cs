using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

namespace Enterprise.Platform.DbMigrator;

/// <summary>
/// Orchestrates a single migrate run for one logical database. Steps:
/// <list type="number">
///   <item>Bootstrap <c>__SchemaHistory</c> if missing.</item>
///   <item>Read history.</item>
///   <item>List <c>*.sql</c> files in the script folder, sort by name.</item>
///   <item>For each historical row, recompute on-disk hash; abort with
///   <see cref="SchemaIntegrityException"/> if any differ.</item>
///   <item>For each new file, run inside a transaction; record on success.</item>
/// </list>
/// </summary>
internal sealed class Migrator(string connectionString, string scriptFolder, bool dryRun)
{
    private readonly string _connectionString = connectionString;
    private readonly string _scriptFolder = scriptFolder;
    private readonly bool _dryRun = dryRun;

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var history = new ScriptHistoryStore(_connectionString);

        if (_dryRun)
        {
            Console.WriteLine("DRY-RUN — no changes will be applied.");
        }
        else
        {
            await history.EnsureCreatedAsync(cancellationToken).ConfigureAwait(false);
        }

        var applied = _dryRun
            ? new Dictionary<string, AppliedScript>(StringComparer.OrdinalIgnoreCase)
            : (Dictionary<string, AppliedScript>)await history.ReadAllAsync(cancellationToken).ConfigureAwait(false);

        var diskScripts = Directory
            .EnumerateFiles(_scriptFolder, "*.sql", SearchOption.TopDirectoryOnly)
            .OrderBy(p => Path.GetFileName(p), StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (diskScripts.Count == 0)
        {
            Console.WriteLine($"No *.sql files in {_scriptFolder}. Nothing to do.");
            return;
        }

        // Step 4 — integrity check on already-applied scripts.
        VerifyHashesOrThrow(diskScripts, applied);

        // Step 5 — apply new scripts in order.
        var pending = diskScripts
            .Where(p => !applied.ContainsKey(Path.GetFileName(p)))
            .ToList();

        if (pending.Count == 0)
        {
            Console.WriteLine($"All {diskScripts.Count} script(s) already applied. Database is up to date.");
            return;
        }

        Console.WriteLine($"{applied.Count} script(s) already applied. {pending.Count} pending.");
        foreach (var scriptPath in pending)
        {
            await ApplyScriptAsync(scriptPath, history, cancellationToken).ConfigureAwait(false);
        }

        Console.WriteLine($"Done. {pending.Count} script(s) applied successfully.");
    }

    private static void VerifyHashesOrThrow(IReadOnlyList<string> diskScripts, Dictionary<string, AppliedScript> applied)
    {
        foreach (var scriptPath in diskScripts)
        {
            var name = Path.GetFileName(scriptPath);
            if (!applied.TryGetValue(name, out var historical))
            {
                continue;
            }

            var diskHash = ComputeSha256(File.ReadAllBytes(scriptPath));
            if (!string.Equals(diskHash, historical.ScriptHash, StringComparison.OrdinalIgnoreCase))
            {
                throw new SchemaIntegrityException(
                    $"'{name}' was applied at {historical.AppliedAtUtc:O} with hash " +
                    $"{historical.ScriptHash} but the file on disk now hashes to {diskHash}. " +
                    "Editing applied scripts is forbidden — write a new script instead. " +
                    "See infra/db/CONVENTIONS.md §10.");
            }
        }
    }

    private async Task ApplyScriptAsync(string scriptPath, ScriptHistoryStore history, CancellationToken cancellationToken)
    {
        var name = Path.GetFileName(scriptPath);
        var bytes = await File.ReadAllBytesAsync(scriptPath, cancellationToken).ConfigureAwait(false);
        var hash = ComputeSha256(bytes);
        var content = Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF');     // strip UTF-8 BOM if present

        if (_dryRun)
        {
            Console.WriteLine($"  [dry-run] would apply: {name}  ({bytes.Length} bytes, sha256={hash[..16]}…)");
            return;
        }

        Console.Write($"  applying {name} … ");
        var stopwatch = Stopwatch.StartNew();

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);

        try
        {
            // SQL Server's `GO` separator is a sqlcmd-only directive; the SqlClient driver
            // doesn't recognise it. Split on it (case-insensitive, line-anchored) so each
            // batch executes as a separate command — same semantics as running the file
            // through `sqlcmd -i`. Empty batches are skipped.
            foreach (var batch in SplitOnGo(content))
            {
                if (string.IsNullOrWhiteSpace(batch))
                {
                    continue;
                }

                await using var command = new SqlCommand(batch, connection, transaction)
                {
                    CommandTimeout = 300,                    // 5 min — long enough for index rebuilds
                };
                await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            }

            await ScriptHistoryStore.RecordAppliedAsync(connection, transaction, name, hash, (int)stopwatch.ElapsedMilliseconds, cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            stopwatch.Stop();
            Console.WriteLine($"ok ({stopwatch.ElapsedMilliseconds} ms)");
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
            Console.WriteLine("FAILED — transaction rolled back.");
            throw;
        }
    }

    private static string[] SplitOnGo(string sqlContent)
    {
        // Match a line containing only `GO` (with optional surrounding whitespace).
        // Avoids matching `GO` inside a string literal or identifier — those don't
        // start a new line on their own.
        return System.Text.RegularExpressions.Regex.Split(
            sqlContent,
            @"^\s*GO\s*;?\s*$",
            System.Text.RegularExpressions.RegexOptions.Multiline | System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    private static string ComputeSha256(byte[] bytes)
    {
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);              // upper-case hex; CHAR(64) in __SchemaHistory
    }
}
