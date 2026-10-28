# Local SQL Server restore test (not yet executed)

This is a runbook. Nothing here is a pass result. Do not connect to production Gates, production MySQL, Railway, or a customer SQL Server. Do not distribute the unsigned EXE.

Do this **after** `WINDOWS_TEST_GUIDE.md` `--self-test` prints `self-test ok` on the Windows PC.

The agent restore now runs `RESTORE FILELISTONLY`, then `RESTORE DATABASE ... WITH MOVE` onto unique files under SQL Server’s `InstanceDefaultDataPath` / `InstanceDefaultLogPath`. **Do not drop `GatesSyntheticSrc`.** The source database must stay online.

## Names (fixed for this fixture)

| Object | Name | Why it is unique |
|--------|------|------------------|
| Source database | `GatesSyntheticSrc` | Synthetic only. Script aborts if it exists. **Keep it.** |
| Backup file | `C:\GatesMigrationTest\GSyn251025T1.bak` | Script aborts if the file exists. No `INIT`. |
| Agent restore database | `GatesAgentRestore_GSyn251025T1` | Agent: bak basename → alphanumerics → 16 chars → `GatesAgentRestore_` prefix. No `REPLACE`. Aborts if the name or destination files exist. |
| Restore files | `{InstanceDefaultDataPath}GatesAgentRestore_GSyn251025T1.mdf` and `_log.ldf` | Not the source `.mdf` / `.ldf`. |
| SQL login | `gates_mig_test` | Not `sa`. Agent rejects `sa`. Needs `dbcreator` to create the new database. |

Company code in the fixture rows: `0001`.

## Permissions — Windows admin is not required to run the EXE

The agent (`restoreBakLocally`) spawns `sqlcmd` as the **current Windows user** and logs in with the **SQL login you type**. It does not request UAC, a Windows service, or port 1433 inbound.

| Action | Who needs the right | Windows Administrator? |
|--------|---------------------|------------------------|
| Run `GatesMigrationAgent.exe --self-test` | Windows user who owns the file | No |
| `sqlcmd` on PATH | Same Windows user | No |
| Read the `.bak` (`RESTORE FILELISTONLY`) | **SQL Server service account** (`NT SERVICE\MSSQLSERVER` or `NT SERVICE\MSSQL$SQLEXPRESS`) | No |
| Create files under the instance default data/log directories | Same service account (already has this) | No |
| `RESTORE DATABASE` of a **new** name with `MOVE` | SQL login: `CREATE DATABASE` / `dbcreator` | No |
| Later engine SELECTs | Same SQL login needs `db_datareader` on the **new** database after restore (`dbcreator` is dbo of DBs it creates) | No |

Do **not** run the EXE as Administrator. If restore fails with “Cannot open backup device”, grant the service account read on `C:\GatesMigrationTest` (folder ACL only). Destination files go to the SQL data directory, not that folder.

The agent restore SQL is of the form:

```sql
SET NOCOUNT ON;
IF DB_ID(N'GatesAgentRestore_GSyn251025T1') IS NOT NULL THROW 50000, ...;
IF EXISTS (SELECT 1 FROM sys.master_files WHERE LOWER(physical_name) IN (...unique paths...)) THROW 50001, ...;
RESTORE DATABASE [GatesAgentRestore_GSyn251025T1]
FROM DISK = N'C:\GatesMigrationTest\GSyn251025T1.bak'
WITH
  MOVE N'GatesSyntheticSrc_dat' TO N'<InstanceDefaultDataPath>GatesAgentRestore_GSyn251025T1.mdf',
  MOVE N'GatesSyntheticSrc_log' TO N'<InstanceDefaultLogPath>GatesAgentRestore_GSyn251025T1_log.ldf',
  RECOVERY, STATS = 10;
```

No `REPLACE`. No `DROP DATABASE`. Source files stay where they are.

## 0. One-time folder so SQL Server can **read** the `.bak`

PowerShell (elevate **only** this step if `C:\` creation is denied):

```powershell
New-Item -ItemType Directory -Force -Path C:\GatesMigrationTest\data | Out-Null
icacls C:\GatesMigrationTest /grant "NT SERVICE\MSSQLSERVER:(OI)(CI)RX"
# Express:
# icacls C:\GatesMigrationTest /grant "NT SERVICE\MSSQL`$SQLEXPRESS:(OI)(CI)RX"
```

Copy `SYNTHETIC_SQL_TEST.sql` next to the EXE. Destination `.mdf` files are **not** created here; SQL Server writes those under its own data directory.

## 1. Create the synthetic database and `.bak`

```powershell
Set-Location C:\GatesMigrationTest
sqlcmd -S localhost -E -C -i SYNTHETIC_SQL_TEST.sql `
  -v TestLoginPassword="your-local-only-password"
"sqlcmd_exit=$LASTEXITCODE"
```

Use `-S localhost\SQLEXPRESS` if that is the instance. Pass only if:

- exit `0`
- `RESTORE HEADERONLY` printed a row
- `status` is `synthetic fixture ready — restore not run`
- both names exist as follows:

```powershell
sqlcmd -S localhost -E -C -Q "SELECT name FROM sys.databases WHERE name IN (N'GatesSyntheticSrc', N'GatesAgentRestore_GSyn251025T1');"
```

Expect **only** `GatesSyntheticSrc`. `GatesAgentRestore_GSyn251025T1` must not exist yet.

```powershell
$env:SQLCMDPASSWORD = "your-local-only-password"
sqlcmd -S localhost -U gates_mig_test -C -Q "SELECT SUSER_SNAME() AS login_name, IS_SRVROLEMEMBER('sysadmin') AS is_sysadmin;"
Remove-Item Env:SQLCMDPASSWORD
```

`is_sysadmin` must be `0`.

## 2. Confirm FILELISTONLY (source stays online)

```powershell
sqlcmd -S localhost -E -C -s "|" -W -Q "RESTORE FILELISTONLY FROM DISK = N'C:\GatesMigrationTest\GSyn251025T1.bak';"
sqlcmd -S localhost -E -C -Q "SELECT name, state_desc FROM sys.databases WHERE name = N'GatesSyntheticSrc';"
```

Expect logical names `GatesSyntheticSrc_dat` / `GatesSyntheticSrc_log`, and `GatesSyntheticSrc` still `ONLINE`.

Do **not** run a manual `RESTORE` into `GatesAgentRestore_GSyn251025T1` first. That name must be free for the agent. Do **not** drop `GatesSyntheticSrc`.

## 3. Agent mode 2 — same instance, source database kept

```powershell
# Do not set GATES_API_BASE to production.
# Pairing still needs a NON-production Gates API. If you have none, you can still
# prove sqlcmd FILELISTONLY (section 2) but the EXE will ask for a pairing code
# before restore. Stop rather than pointing at production.
C:\GatesMigrationTest\GatesMigrationAgent.exe
```

Prompts:

1. API base — non-production only, or **stop** if you have none.
2. Pairing code — from wizard **الترحيل من جهازي** on that non-production app.
3. Mode `2`
4. SQL Server `localhost` (or `localhost\SQLEXPRESS`)
5. Login `gates_mig_test` (not `sa`)
6. Password (stays on this PC; agent sets `SQLCMDPASSWORD`, not `-P`)
7. Full path `C:\GatesMigrationTest\GSyn251025T1.bak`

Expected console: `Restoring to a new local database GatesAgentRestore_GSyn251025T1. The original database will not be changed.` Then pairing / poll only if pairing succeeded.

Verify **both** databases exist:

```powershell
sqlcmd -S localhost -E -C -Q @"
SELECT name, state_desc FROM sys.databases
WHERE name IN (N'GatesSyntheticSrc', N'GatesAgentRestore_GSyn251025T1')
ORDER BY name;
SELECT physical_name FROM sys.master_files
WHERE database_id IN (DB_ID(N'GatesSyntheticSrc'), DB_ID(N'GatesAgentRestore_GSyn251025T1'))
ORDER BY database_id, file_id;
SELECT COUNT(*) AS src_branches FROM [GatesSyntheticSrc].dbo.Branch;
SELECT COUNT(*) AS rst_branches FROM [GatesAgentRestore_GSyn251025T1].dbo.Branch;
"@
```

Pass only if:

- both databases `ONLINE`
- physical paths are **different** (restore files contain `GatesAgentRestore_GSyn251025T1`)
- `src_branches = 1` and `rst_branches = 1`

Fail if `GatesSyntheticSrc` is missing or offline. The agent must not have dropped it.

## 4. Ten-stage engine checklist (existing pipeline — do not modify it)

Use a **local** Gates backend (`MIGRATION_ENGINE_ENABLED=true`, `MIGRATION_RUN_INLINE=true` is fine). `DATABASE_URL` must be a disposable local MySQL, not Railway production. `MIGRATION_ALLOW_PRODUCTION_TARGET` must stay unset/false.

Stages (unchanged):

`FOUNDATION → COA → PARTIES → ACCOUNTING → ITEMS → INVENTORY → COMMERCIAL → TREASURY_HISTORICAL → SETTLEMENT_HISTORICAL → CHEQUE_HISTORICAL`

- [ ] Windows `--self-test` captured, exit 0
- [ ] Synthetic `.bak` created; HEADERONLY + FILELISTONLY succeeded
- [ ] Agent mode 2 created `GatesAgentRestore_GSyn251025T1` **and** `GatesSyntheticSrc` is still ONLINE
- [ ] Restore files are under the instance default data directory, not the source `.mdf`
- [ ] Login `gates_mig_test` can `SELECT` from the restored `dbo.Branch`
- [ ] Non-production wizard: **الترحيل من جهازي**, pairing code once, 15-minute expiry
- [ ] Agent paired; `session.json` under `%USERPROFILE%\.gates-migration-agent` has API + `pairedAt` only (no SQL password)
- [ ] Source mode `ON_PREMISE_CONNECTOR` READY
- [ ] Create job; do not treat `DRAFT` / 0% as a running cutover
- [ ] `POST /jobs/:id/run` `{ "mode": "auto", "confirmTargetWrite": true }`
- [ ] Analyze lists all **10** stages
- [ ] Dry-run does not insert live GL on the target
- [ ] Execute is allowed only after READY (never `execute` on `DRAFT`)
- [ ] FOUNDATION can count Branch / Year / Currency / CostCenter / Store / CompanySetting for company `0001`
- [ ] Later stages may import **zero** rows on this stub schema — restore smoke, not Delphi parity
- [ ] Revoke connector; poll with the old token returns 401

Stop if the target MySQL host looks like production (`rlwy.net`, names containing `prod` / `railway`).

## 5. Cleanup (synthetic objects only)

```sql
IF DB_ID(N'GatesAgentRestore_GSyn251025T1') IS NOT NULL
BEGIN
  ALTER DATABASE [GatesAgentRestore_GSyn251025T1] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE [GatesAgentRestore_GSyn251025T1];
END;
IF DB_ID(N'GatesSyntheticSrc') IS NOT NULL
BEGIN
  ALTER DATABASE [GatesSyntheticSrc] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE [GatesSyntheticSrc];
END;
IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'gates_mig_test')
  DROP LOGIN [gates_mig_test];
```

Delete only `C:\GatesMigrationTest\GSyn251025T1.bak` and the unique source files under `C:\GatesMigrationTest\data`. Do not delete SQL Server’s instance `DATA` folder.

## 6. Current result

| Item | Result |
|------|--------|
| Unit tests (FILELISTONLY / MOVE / collisions) | See the agent report from this change |
| Windows EXE start | **Not run** |
| sqlcmd fixture | **Not run** |
| RESTORE on a real SQL Server | **Not run** |
| Agent mode 2 | **Not run** |
| Source database kept | **Not verified on SQL Server** |
| Ten-stage job | **Not run** |
| Production / Railway | Not used (required) |
