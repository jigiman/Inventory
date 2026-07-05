namespace Backend.Services;

/// <summary>
/// Singleton that tracks which SQLite database the app is currently using.
/// The database path is not known until the user selects or creates one
/// from the launcher screen, so this is set at runtime after startup.
/// </summary>
public class DatabaseState
{
    private string? _dbPath;

    /// <summary>Full file path to the active SQLite database.</summary>
    public string? DbPath
    {
        get => _dbPath;
        set
        {
            _dbPath = value;
            IsInitialized = value is not null;
        }
    }

    /// <summary>True once the user has selected/created a database.</summary>
    public bool IsInitialized { get; private set; }

    public string ConnectionString =>
        IsInitialized
            ? $"Data Source={_dbPath}"
            : throw new InvalidOperationException("Database has not been initialized yet.");
}
