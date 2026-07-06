using System.Data.Common;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Data.Sqlite;

namespace Backend.Data;

public class SqliteImmediateTransactionInterceptor : DbTransactionInterceptor
{
    public override InterceptionResult<DbTransaction> TransactionStarting(
        DbConnection connection,
        TransactionStartingEventData eventData,
        InterceptionResult<DbTransaction> result)
    {
        if (connection is SqliteConnection sqliteConn)
        {
            // In Microsoft.Data.Sqlite, specifying IsolationLevel.Serializable begins an IMMEDIATE transaction
            var tx = sqliteConn.BeginTransaction(System.Data.IsolationLevel.Serializable);
            return InterceptionResult<DbTransaction>.SuppressWithResult(tx);
        }

        return result;
    }

    public override async ValueTask<InterceptionResult<DbTransaction>> TransactionStartingAsync(
        DbConnection connection,
        TransactionStartingEventData eventData,
        InterceptionResult<DbTransaction> result,
        CancellationToken cancellationToken = default)
    {
        if (connection is SqliteConnection sqliteConn)
        {
            // In Microsoft.Data.Sqlite, specifying IsolationLevel.Serializable begins an IMMEDIATE transaction
            var tx = await sqliteConn.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken);
            return InterceptionResult<DbTransaction>.SuppressWithResult(tx);
        }

        return result;
    }
}
