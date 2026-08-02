using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Services;

namespace Backend.Features;

/// <summary>Represents one entry in the recently-used database list.</summary>
public record RecentDatabase(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("path")] string Path,
    [property: JsonPropertyName("lastOpened")] DateTime LastOpened
);

/// <summary>Root model for launcher.json.</summary>
public class LauncherConfig
{
    [JsonPropertyName("recentDatabases")]
    public List<RecentDatabase> RecentDatabases { get; set; } = [];

    [JsonPropertyName("theme")]
    public string Theme { get; set; } = "light";

    // ── static helpers ────────────────────────────────────────────────────────

    private static readonly JsonSerializerOptions _json = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
    };

    public static string ConfigFilePath { get; } = GetConfigFilePath();

    private static string GetConfigFilePath()
    {
        var primaryPath = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "InventorySystem",
            "launcher.json"
        );

        if (File.Exists(primaryPath))
            return primaryPath;

        // Candidate fallback paths to check (e.g. previous version folders or working dirs)
        var candidatePaths = new List<string>
        {
            Path.Combine(AppContext.BaseDirectory, "launcher.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "launcher.json"),
            Path.Combine(AppContext.BaseDirectory, "..", "launcher.json"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "InventorySystem", "current", "launcher.json")
        };

        // Scan sibling app-* directories under %LocalAppData%\InventorySystem (Velopack update folders)
        try
        {
            var appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "InventorySystem");
            if (Directory.Exists(appDataDir))
            {
                var siblingDirs = Directory.GetDirectories(appDataDir, "app-*")
                    .OrderByDescending(Directory.GetLastWriteTimeUtc);
                foreach (var dir in siblingDirs)
                {
                    candidatePaths.Add(Path.Combine(dir, "launcher.json"));
                }
            }
        }
        catch
        {
            // Ignore directory enumeration errors
        }

        foreach (var candidate in candidatePaths)
        {
            if (File.Exists(candidate))
            {
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(primaryPath)!);
                    File.Copy(candidate, primaryPath, overwrite: true);
                    Serilog.Log.Information("Migrated launcher.json from {Candidate} to {PrimaryPath}", candidate, primaryPath);
                    return primaryPath;
                }
                catch (Exception ex)
                {
                    Serilog.Log.Warning(ex, "Failed to copy launcher.json from {Candidate}", candidate);
                    return candidate;
                }
            }
        }

        return primaryPath;
    }

    public static LauncherConfig Load()
    {
        if (!File.Exists(ConfigFilePath))
            return new LauncherConfig();

        try
        {
            var json = File.ReadAllText(ConfigFilePath);
            var config = JsonSerializer.Deserialize<LauncherConfig>(json, _json) ?? new LauncherConfig();
            
            // Decrypt paths on load
            config.RecentDatabases = config.RecentDatabases
                .Select(r =>
                {
                    try
                    {
                        return r with { Path = PersistentSecurity.Decrypt(r.Path) };
                    }
                    catch (Exception ex)
                    {
                        Serilog.Log.Error(ex, "Failed to decrypt recent database path: {Path}", r.Path);
                        return r;
                    }
                })
                .ToList();

            return config;
        }
        catch
        {
            return new LauncherConfig();
        }
    }

    public void Save()
    {
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(ConfigFilePath)!);

        // Encrypt paths on save
        var encryptedDatabases = RecentDatabases
            .Select(r =>
            {
                try
                {
                    return r with { Path = PersistentSecurity.Encrypt(r.Path) };
                }
                catch (Exception ex)
                {
                    Serilog.Log.Error(ex, "Failed to encrypt database path: {Path}", r.Path);
                    return r;
                }
            })
            .ToList();

        var configToSave = new LauncherConfig
        {
            Theme = this.Theme,
            RecentDatabases = encryptedDatabases
        };

        File.WriteAllText(ConfigFilePath, JsonSerializer.Serialize(configToSave, _json));
    }

    /// <summary>
    /// Adds or updates a recent database entry and moves it to the top of the list.
    /// Keeps at most 10 recent entries.
    /// </summary>
    public void Touch(string name, string path)
    {
        RecentDatabases.RemoveAll(r => string.Equals(r.Path, path, StringComparison.OrdinalIgnoreCase));
        RecentDatabases.Insert(0, new RecentDatabase(name, path, DateTime.UtcNow));
        if (RecentDatabases.Count > 10)
            RecentDatabases.RemoveRange(10, RecentDatabases.Count - 10);
        Save();
    }
}

public static class PersistentSecurity
{
    private static byte[]? _key;
    private static readonly byte[] Entropy = { 0xa5, 0x43, 0xf1, 0x89, 0xd2, 0xcc, 0x07, 0x51 };

    private static byte[] GetKey()
    {
        if (_key != null) return _key;

        if (OperatingSystem.IsWindows())
        {
            return Array.Empty<byte>();
        }

        const string keyPath = "SystemLauncherKey";
        var savedKeyHex = CredentialManager.GetCredential(keyPath);
        if (string.IsNullOrEmpty(savedKeyHex))
        {
            var keyBytes = RandomNumberGenerator.GetBytes(32);
            savedKeyHex = Convert.ToHexString(keyBytes);
            CredentialManager.SaveCredential(keyPath, savedKeyHex);
        }

        _key = Convert.FromHexString(savedKeyHex);
        return _key;
    }

    public static string Encrypt(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return plaintext;
        var bytes = Encoding.UTF8.GetBytes(plaintext);

        if (OperatingSystem.IsWindows())
        {
            var encrypted = ProtectedData.Protect(bytes, Entropy, DataProtectionScope.CurrentUser);
            return Convert.ToBase64String(encrypted);
        }

        var key = GetKey();
        var iv = RandomNumberGenerator.GetBytes(16);
        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = iv;

        using var ms = new MemoryStream();
        ms.Write(iv, 0, iv.Length);
        using (var cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
        {
            cs.Write(bytes, 0, bytes.Length);
            cs.FlushFinalBlock();
        }
        return Convert.ToBase64String(ms.ToArray());
    }

    public static string Decrypt(string ciphertext)
    {
        if (string.IsNullOrEmpty(ciphertext)) return ciphertext;
        
        // Return plaintext directly if not valid base64 (e.g. legacy configs before encryption)
        Span<byte> buffer = new Span<byte>(new byte[ciphertext.Length]);
        if (!Convert.TryFromBase64String(ciphertext, buffer, out int bytesParsed))
        {
            return ciphertext;
        }

        var bytes = Convert.FromBase64String(ciphertext);

        if (OperatingSystem.IsWindows())
        {
            try
            {
                var decrypted = ProtectedData.Unprotect(bytes, Entropy, DataProtectionScope.CurrentUser);
                return Encoding.UTF8.GetString(decrypted);
            }
            catch
            {
                // Fallback for legacy database paths that are plain text
                return ciphertext;
            }
        }

        var key = GetKey();
        if (bytes.Length < 16) return ciphertext;

        var iv = new byte[16];
        Array.Copy(bytes, 0, iv, 0, 16);

        using var aes = Aes.Create();
        aes.Key = key;
        aes.IV = iv;

        try
        {
            using var ms = new MemoryStream();
            using (var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Write))
            {
                cs.Write(bytes, 16, bytes.Length - 16);
                cs.FlushFinalBlock();
            }
            return Encoding.UTF8.GetString(ms.ToArray());
        }
        catch
        {
            return ciphertext;
        }
    }
}
