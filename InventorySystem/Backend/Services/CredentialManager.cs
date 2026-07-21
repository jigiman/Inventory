using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace Backend.Services;

public class CredentialManager
{
    private const string AppIdentifier = "InventorySystem";

    public static bool SaveCredential(string dbPath, string password)
    {
        if (OperatingSystem.IsMacOS())
        {
            return SaveMacCredential(dbPath, password);
        }
        else if (OperatingSystem.IsWindows())
        {
            return SaveWindowsCredential(dbPath, password);
        }
        return false;
    }

    public static string? GetCredential(string dbPath)
    {
        if (OperatingSystem.IsMacOS())
        {
            return GetMacCredential(dbPath);
        }
        else if (OperatingSystem.IsWindows())
        {
            return GetWindowsCredential(dbPath);
        }
        return null;
    }

    public static bool DeleteCredential(string dbPath)
    {
        if (OperatingSystem.IsMacOS())
        {
            return DeleteMacCredential(dbPath);
        }
        else if (OperatingSystem.IsWindows())
        {
            return DeleteWindowsCredential(dbPath);
        }
        return false;
    }

    // ── macOS Keychain implementation via 'security' CLI ─────────────────────

    private static bool SaveMacCredential(string dbPath, string password)
    {
        // Delete old one first if exists
        DeleteMacCredential(dbPath);

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "security",
                Arguments = $"add-generic-password -a \"{AppIdentifier}\" -s \"{dbPath}\" -w \"{password}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var process = Process.Start(psi);
            process?.WaitForExit();
            return process?.ExitCode == 0;
        }
        catch (Exception ex)
        {
            Serilog.Log.Error(ex, "Failed to save credential to macOS Keychain.");
            return false;
        }
    }

    private static string? GetMacCredential(string dbPath)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "security",
                Arguments = $"find-generic-password -a \"{AppIdentifier}\" -s \"{dbPath}\" -w",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var process = Process.Start(psi);
            if (process == null) return null;
            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();
            if (process.ExitCode == 0)
            {
                return output.TrimEnd('\r', '\n');
            }
        }
        catch (Exception ex)
        {
            Serilog.Log.Error(ex, "Failed to get credential from macOS Keychain.");
        }
        return null;
    }

    private static bool DeleteMacCredential(string dbPath)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "security",
                Arguments = $"delete-generic-password -a \"{AppIdentifier}\" -s \"{dbPath}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var process = Process.Start(psi);
            process?.WaitForExit();
            return process?.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    // ── Windows Credential Locker implementation via Advapi32.dll ───────────

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct CREDENTIAL
    {
        public uint Flags;
        public uint Type; // 1 = Generic
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist; // 2 = Local machine persistent
        public uint AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredWrite(ref CREDENTIAL userCredential, uint flags);

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredDelete(string target, uint type, uint reservedFlag);

    [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    private static extern void CredFree(IntPtr credentialPtr);

    private static string GetWindowsTargetName(string dbPath)
    {
        return $"{AppIdentifier}:{dbPath}";
    }

    private static bool SaveWindowsCredential(string dbPath, string password)
    {
        var target = GetWindowsTargetName(dbPath);
        var passBytes = Encoding.Unicode.GetBytes(password);
        var blobPtr = Marshal.AllocCoTaskMem(passBytes.Length);

        try
        {
            Marshal.Copy(passBytes, 0, blobPtr, passBytes.Length);

            var cred = new CREDENTIAL
            {
                Type = 1, // Generic
                TargetName = target,
                CredentialBlobSize = (uint)passBytes.Length,
                CredentialBlob = blobPtr,
                Persist = 2, // Session/Machine persistent
                UserName = AppIdentifier
            };

            return CredWrite(ref cred, 0);
        }
        catch (Exception ex)
        {
            Serilog.Log.Error(ex, "Failed to save credential to Windows Credential Manager.");
            return false;
        }
        finally
        {
            Marshal.FreeCoTaskMem(blobPtr);
        }
    }

    private static string? GetWindowsCredential(string dbPath)
    {
        var target = GetWindowsTargetName(dbPath);
        if (CredRead(target, 1, 0, out var credPtr))
        {
            try
            {
                var cred = Marshal.PtrToStructure<CREDENTIAL>(credPtr);
                var passBytes = new byte[cred.CredentialBlobSize];
                Marshal.Copy(cred.CredentialBlob, passBytes, 0, (int)cred.CredentialBlobSize);
                return Encoding.Unicode.GetString(passBytes);
            }
            catch (Exception ex)
            {
                Serilog.Log.Error(ex, "Failed to read credential structure from Windows Credential Manager.");
            }
            finally
            {
                CredFree(credPtr);
            }
        }
        return null;
    }

    private static bool DeleteWindowsCredential(string dbPath)
    {
        var target = GetWindowsTargetName(dbPath);
        return CredDelete(target, 1, 0);
    }
}
