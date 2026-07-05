using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

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

    public static string ConfigFilePath { get; } = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "InventorySystem",
        "launcher.json"
    );

    public static LauncherConfig Load()
    {
        if (!File.Exists(ConfigFilePath))
            return new LauncherConfig();

        try
        {
            var json = File.ReadAllText(ConfigFilePath);
            return JsonSerializer.Deserialize<LauncherConfig>(json, _json) ?? new LauncherConfig();
        }
        catch
        {
            return new LauncherConfig();
        }
    }

    public void Save()
    {
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(ConfigFilePath)!);
        File.WriteAllText(ConfigFilePath, JsonSerializer.Serialize(this, _json));
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
