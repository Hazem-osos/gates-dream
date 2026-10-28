# Windows PC — what to run (internal)

Unsigned EXE. Do not send it to customers. Do **not** point it at production Gates. Do **not** restore over your existing legacy database.

Use **mode 1** (existing database, read-only). Mode 2 is only for the separate synthetic names `GatesSyntheticSrc` / `GatesAgentRestore_*`.

## Copy the EXE

From this Mac repo (after packing):

`gates-migration-connector/dist-exe/GatesMigrationAgent.exe`

Put it in `C:\GatesMigrationTest\GatesMigrationAgent.exe`.

Expected identity for this build:

- Version: `GatesMigrationAgent 0.2.4` (full setup + troubleshooting: `SETUP_AND_TROUBLESHOOTING.md`)
- `--self-test` must print `self-test ok`
- SHA-256 (0.2.4 pack, 2026-10-28): `0928df450cd3f806609f2657e8a54c146fbd272ea84df79cf46db736502c7ae0`

## 1. Smoke (does not touch SQL)

```powershell
New-Item -ItemType Directory -Force -Path C:\GatesMigrationTest | Out-Null
Set-Location C:\GatesMigrationTest
.\GatesMigrationAgent.exe --version
.\GatesMigrationAgent.exe --self-test
```

Stop if version is not `0.2.4` or self-test is not ok. Do not Run as administrator. After SQL answers the window must stay open and print `Connected to legacy SQL Server`. If it closes, run from this PowerShell session (not double-click) so the last line stays visible. Do not create the wizard job while the window is closed.

## 2. Read-only login on the existing SQL Server (does not install SQL)

In SSMS, on your **existing** instance, create a SQL login that is **not** `sa` and can only read your legacy database. Replace names:

```sql
-- Does not alter your data. Does not restore. Does not drop anything.
CREATE LOGIN [gates_reader] WITH PASSWORD = N'choose-a-local-password';
USE [YOUR_EXISTING_LEGACY_DB];
CREATE USER [gates_reader] FOR LOGIN [gates_reader];
ALTER ROLE [db_datareader] ADD MEMBER [gates_reader];
```

If `CREATE LOGIN` already exists, skip that line. Do not grant `dbcreator` / `sysadmin` for mode 1.

Check version (read-only):

```sql
SELECT @@VERSION;
SELECT name FROM sys.databases WHERE name = N'YOUR_EXISTING_LEGACY_DB';
```

Do not install another SQL Server unless `@@VERSION` is older than SQL Server **2008**. The agent retries encrypt off and TDS 7.2 for 2008-era instances.

## 3. Launch — mode 1 only

Do **not** use a production Railway API. Pairing writes device rows on whichever Gates backend you type.

If you have a **non-production** Gates API:

```powershell
.\GatesMigrationAgent.exe
```

Prompts:

1. API: `https://<non-prod-backend>/api/v1/migration-engine`  
   In the wizard: ترحيل قواعد البيانات → **الترحيل من جهازي** → إنشاء رمز الربط.
2. Paste the pairing code (15 minutes, one use).
3. Mode: **1**
4. SQL Server: `localhost` or `localhost\INSTANCENAME` (whatever SSMS uses)
5. Login: `gates_reader` (not `sa`)
6. Password
7. Database: **your existing legacy database name**

Expected: `Paired.` then `Connected to legacy SQL Server (encrypt=false)` or another attempt label. Leave the window open.

In the wizard press اختبار / ترحيل الآن only against a **non-production** MySQL destination. The current developer `.env` `DATABASE_URL` is Railway production — **do not** run `auto`/`execute` there.

## 4. Optional synthetic restore (separate names only)

Skip this if you only want to read the existing database.

Mode 2 restores into `GatesAgentRestore_*` with `WITH MOVE`. It will not drop or `REPLACE` your legacy database. Still: do not point mode 2 at a `.bak` of a database you care about until the synthetic fixture has passed.

Fixture: `SYNTHETIC_SQL_TEST.sql` (creates only `GatesSyntheticSrc`). Then agent mode **2** with `C:\GatesMigrationTest\GSyn251025T1.bak`. After restore, `GatesSyntheticSrc` must still be ONLINE.

## Do not

- Install a second SQL Server unless 2008+ is proven incompatible
- Choose mode 2 against the live legacy `.bak` first
- Use `sa`
- Drop or restore over the existing database
- Pair or migrate into production Railway MySQL
