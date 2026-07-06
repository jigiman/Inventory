using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace Backend.Services;

/// <summary>
/// Singleton that tracks which SQLite database the app is currently using.
/// The database path is not known until the user selects or creates one
/// from the launcher screen, so this is set at runtime after startup.
/// </summary>
public class DatabaseState
{
    private string? _dbPath;
    private byte[]? _encryptedPassword;
    private byte[]? _salt;

    /// <summary>Runtime-generated session token to authorize local API requests.</summary>
    public string? SessionToken { get; set; }

    /// <summary>Full file path to the active SQLite database.</summary>
    public string? DbPath
    {
        get => _dbPath;
        set
        {
            _dbPath = value;
            IsInitialized = value is not null;
            _salt = null; // Reset salt cache so it re-evaluates for the new path
            if (value is null)
            {
                SessionToken = null;
            }
        }
    }

    /// <summary>Optional password for an encrypted database.</summary>
    public string? Password
    {
        get => _encryptedPassword != null ? SecureMemory.Unprotect(_encryptedPassword) : null;
        set => _encryptedPassword = value != null ? SecureMemory.Protect(value) : null;
    }

    /// <summary>True once the user has selected/created a database.</summary>
    public bool IsInitialized { get; private set; }

    public string ConnectionString
    {
        get
        {
            if (!IsInitialized)
                throw new InvalidOperationException("Database has not been initialized yet.");

            var builder = new Microsoft.Data.Sqlite.SqliteConnectionStringBuilder
            {
                DataSource = _dbPath,
                // Add busy timeout of 5 seconds to connection string by default
                DefaultTimeout = 5
            };

            var rawPassword = Password;
            if (!string.IsNullOrEmpty(rawPassword))
            {
                var salt = GetOrCreateSalt();
                var key = Rfc2898DeriveBytes.Pbkdf2(rawPassword, salt, 100000, HashAlgorithmName.SHA256, 32);
                var hexKey = Convert.ToHexString(key);
                
                // SQLCipher expects raw hex key as x'HEX_KEY'
                builder.Password = $"x'{hexKey}'";
            }

            return builder.ToString();
        }
    }

    private byte[] GetOrCreateSalt()
    {
        if (_salt != null) return _salt;
        if (string.IsNullOrEmpty(_dbPath))
            throw new InvalidOperationException("DbPath must be set before generating or retrieving a salt.");

        // 1. Try to load from Credential Manager (Secure OS storage)
        try
        {
            var savedSaltHex = CredentialManager.GetCredential(_dbPath + ":salt");
            if (!string.IsNullOrEmpty(savedSaltHex))
            {
                _salt = Convert.FromHexString(savedSaltHex);
                if (_salt.Length == 16) return _salt;
            }
        }
        catch (Exception ex)
        {
            Serilog.Log.Error(ex, "Failed to retrieve salt from secure credential storage.");
        }

        // 2. Fallback to sidecar file for backward compatibility
        var saltPath = _dbPath + ".salt";
        if (File.Exists(saltPath))
        {
            try
            {
                _salt = File.ReadAllBytes(saltPath);
                if (_salt.Length == 16)
                {
                    // Migrate to Credential Manager if possible
                    CredentialManager.SaveCredential(_dbPath + ":salt", Convert.ToHexString(_salt));
                    return _salt;
                }
            }
            catch (Exception ex)
            {
                Serilog.Log.Error(ex, "Failed to read salt file at {SaltPath}, regenerating.", saltPath);
            }
        }

        // 3. Generate new salt
        _salt = RandomNumberGenerator.GetBytes(16);
        try
        {
            CredentialManager.SaveCredential(_dbPath + ":salt", Convert.ToHexString(_salt));
            File.WriteAllBytes(saltPath, _salt);
        }
        catch (Exception ex)
        {
            Serilog.Log.Error(ex, "Failed to write salt file at {SaltPath}.", saltPath);
        }
        return _salt;
    }
}

internal static class SecureMemory
{
    private static readonly byte[] SessionKey = RandomNumberGenerator.GetBytes(32);
    private static readonly byte[] SessionIv = RandomNumberGenerator.GetBytes(16);

    public static byte[] Protect(string value)
    {
        if (value == null) return null!;
        var bytes = Encoding.UTF8.GetBytes(value);
        return Encrypt(bytes);
    }

    public static string Unprotect(byte[] encryptedBytes)
    {
        if (encryptedBytes == null) return null!;
        var raw = Decrypt(encryptedBytes);
        return Encoding.UTF8.GetString(raw);
    }

    private static byte[] Encrypt(byte[] data)
    {
        using var aes = Aes.Create();
        aes.Key = SessionKey;
        aes.IV = SessionIv;
        using var ms = new MemoryStream();
        using (var cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
        {
            cs.Write(data, 0, data.Length);
            cs.FlushFinalBlock();
        }
        return ms.ToArray();
    }

    private static byte[] Decrypt(byte[] encryptedData)
    {
        using var aes = Aes.Create();
        aes.Key = SessionKey;
        aes.IV = SessionIv;
        using var ms = new MemoryStream();
        using (var cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Write))
        {
            cs.Write(encryptedData, 0, encryptedData.Length);
            cs.FlushFinalBlock();
        }
        return ms.ToArray();
    }
}

