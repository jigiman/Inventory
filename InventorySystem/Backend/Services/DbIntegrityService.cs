using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Backend.Data;

namespace Backend.Services;

public class DbIntegrityService
{
    private readonly AppDbContext _context;

    public DbIntegrityService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<(bool Passed, List<string> Errors)> RunIntegrityCheckAsync()
    {
        var errors = new List<string>();
        bool passed = true;

        try
        {
            // 1. Run SQLite integrity check
            // PRAGMA integrity_check returns "ok" or list of errors
            var conn = _context.Database.GetDbConnection();
            var alreadyOpen = conn.State == System.Data.ConnectionState.Open;
            if (!alreadyOpen) await conn.OpenAsync();

            try
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA integrity_check;";
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var result = reader.GetString(0);
                            if (!string.Equals(result, "ok", StringComparison.OrdinalIgnoreCase))
                            {
                                passed = false;
                                errors.Add($"Integrity issue: {result}");
                            }
                        }
                    }
                }

                // 2. Run SQLite foreign key check
                // PRAGMA foreign_key_check returns a row for each violation: [table, rowid, parent_table, fkid]
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "PRAGMA foreign_key_check;";
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            passed = false;
                            var table = reader.GetString(0);
                            var rowId = reader.GetInt64(1);
                            var parentTable = reader.GetString(2);
                            var fkid = reader.GetInt32(3);
                            errors.Add($"Foreign key violation in table '{table}' (rowid {rowId}) referencing parent table '{parentTable}' (fkid {fkid}).");
                        }
                    }
                }
            }
            finally
            {
                if (!alreadyOpen) await conn.CloseAsync();
            }
        }
        catch (Exception ex)
        {
            passed = false;
            errors.Add($"Integrity verification execution failed: {ex.Message}");
        }

        return (passed, errors);
    }
}
