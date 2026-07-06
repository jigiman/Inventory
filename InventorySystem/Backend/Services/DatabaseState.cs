namespace Backend.Services;

/// <summary>
/// Singleton that tracks which SQLite database the app is currently using.
/// The database path is not known until the user selects or creates one
/// from the launcher screen, so this is set at runtime after startup.
/// </summary>
public class DatabaseState
{
    private string? _dbPath;
    private string? _password;

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

    /// <summary>Optional password for an encrypted database.</summary>
    public string? Password
    {
        get => _password;
        set => _password = value;
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
                DataSource = _dbPath
            };

            if (!string.IsNullOrEmpty(_password))
            {
                builder.Password = _password;
            }

            return builder.ToString();
        }
    }
}
