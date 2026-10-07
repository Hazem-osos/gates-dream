#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"
BAK_NAME="DataBase21-5-2026.bak"
DB_NAME="${LEGACY_FORENSIC_DB_NAME:-LegacyForensic}"
SA_PASSWORD="${MSSQL_SA_PASSWORD:-GatesForensic_LocalOnly_ChangeMe!}"

mkdir -p "$COMPOSE_DIR/backup" "$COMPOSE_DIR/audit-out"

if [[ ! -f "$COMPOSE_DIR/backup/$BAK_NAME" ]]; then
  if [[ -f "$ROOT/$BAK_NAME" ]]; then
    echo "Copying $ROOT/$BAK_NAME -> backup/"
    cp "$ROOT/$BAK_NAME" "$COMPOSE_DIR/backup/$BAK_NAME"
  else
    echo "BLOCKED: Missing backup file."
    echo "  Expected: $COMPOSE_DIR/backup/$BAK_NAME"
    echo "  Or:       $ROOT/$BAK_NAME"
    exit 2
  fi
fi

export MSSQL_SA_PASSWORD="$SA_PASSWORD"
cd "$COMPOSE_DIR"
docker compose up -d legacy-mssql

echo "Waiting for SQL Server health..."
for i in $(seq 1 90); do
  if docker compose exec -T legacy-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -Q "SELECT 1" &>/dev/null; then
    break
  fi
  sleep 3
done

SQLCMD=(docker compose exec -T legacy-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C)

# Backup metadata (read-only on file)
"${SQLCMD[@]}" -Q "RESTORE HEADERONLY FROM DISK = N'/backup/$BAK_NAME'" -s "|" -W -o /audit-out/restore-headeronly.txt || true
"${SQLCMD[@]}" -Q "RESTORE FILELISTONLY FROM DISK = N'/backup/$BAK_NAME'" -s "|" -W -o /audit-out/restore-filelistonly.txt || true

# Restore database (logical names from FILELISTONLY applied via dynamic SQL)
"${SQLCMD[@]}" -d master -i /dev/stdin <<'EOSQL'
DECLARE @bak NVARCHAR(400) = N'/backup/DataBase21-5-2026.bak';
DECLARE @db SYSNAME = N'LegacyForensic';
DECLARE @data NVARCHAR(128), @log NVARCHAR(128);

CREATE TABLE #fl (
  LogicalName NVARCHAR(128), PhysicalName NVARCHAR(260), Type CHAR(1),
  FileGroupName NVARCHAR(128), Size NUMERIC(20,0), MaxSize NUMERIC(20,0),
  FileId INT, CreateLSN NUMERIC(25,0), DropLSN NUMERIC(25,0), UniqueId UNIQUEIDENTIFIER,
  ReadOnlyLSN NUMERIC(25,0), ReadWriteLSN NUMERIC(25,0), BackupSizeInBytes BIGINT,
  SourceBlockSize INT, FileGroupId INT, LogGroupGUID UNIQUEIDENTIFIER, DifferentialBaseLSN NUMERIC(25,0),
  DifferentialBaseGUID UNIQUEIDENTIFIER, IsReadOnly BIT, IsPresent BIT, TDEThumbprint VARBINARY(32),
  SnapshotUrl NVARCHAR(360)
);
INSERT INTO #fl EXEC('RESTORE FILELISTONLY FROM DISK = ''' + @bak + '''');
SELECT @data = LogicalName FROM #fl WHERE Type = 'D';
SELECT @log = LogicalName FROM #fl WHERE Type = 'L';

DECLARE @sql NVARCHAR(MAX) = N'
RESTORE DATABASE [' + @db + N']
FROM DISK = N''' + @bak + N'''
WITH REPLACE, STATS = 10,
MOVE N''' + @data + N''' TO N''/var/opt/mssql/data/' + @db + N'.mdf'',
MOVE N''' + @log + N''' TO N''/var/opt/mssql/data/' + @db + N'_log.ldf'';';
EXEC (@sql);
DROP TABLE #fl;
EOSQL

# Read-only for audit
"${SQLCMD[@]}" -d "$DB_NAME" -Q "
IF DATABASEPROPERTYEX(DB_NAME(), 'Updateability') = 'READ_WRITE'
  ALTER DATABASE [$DB_NAME] SET READ_ONLY WITH ROLLBACK IMMEDIATE;
"

echo "Restore complete. Running forensic audit (sqlcmd)..."
"$COMPOSE_DIR/run-forensic-sqlcmd.sh"

echo "Done. See audit-out/ — update docs from audit outputs."
