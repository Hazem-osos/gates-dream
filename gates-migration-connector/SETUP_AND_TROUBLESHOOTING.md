# Gates Migration Agent 0.2.4 — setup, pairing, restore, troubleshooting

Status (2026-10-28): code reviewed and fixed on macOS. **Nothing in this file has been run on
Windows yet** — see "What is verified" at the end. The EXE is unsigned: internal testing only.

## What the agent does

The agent runs on the customer's Windows PC next to SQL Server. It only makes **outbound**
HTTPS calls to Gates (pair, poll every 2 s, send results). No inbound port, no VPN. The SQL
password never leaves the PC. Gates sends read-only queries; the agent answers from **one**
database only.

Safety enforced by the agent (0.2.4):

| Rule | Where |
|---|---|
| Only one `SELECT`; no writes, `SELECT … INTO`, `OPENROWSET`/`OPENQUERY`, procedures, `WAITFOR`, `USE` | `connector-ops.ts` `assertReadOnlySelectSql` (same rule on the backend) |
| No three-part / cross-database names (`OtherDb.dbo.Customer`) | same |
| Connected database must be exactly the one typed (not the login's default) | `connector-loop.ts` `assertConnectedToChosenDatabase` |
| `sysadmin` logins refused (and the `sa` name) | same / `assertCustomerSqlLogin` |
| Job's commands go only to the agent the job is bound to | backend `connector-command.service.ts` (`deviceId` on enqueue) |
| Source fingerprint includes server name and database creation time — a same-named database elsewhere is a different source and the job refuses it | `connector-ops.ts` `FINGERPRINT` |
| Results sent compressed as hex — legacy text with `;`, `--`, `select`, `<`… reaches Gates unchanged | `connector-loop.ts` / backend `decodeConnectorCompleteBody` |
| `.bak` restore only into a **new** `GatesAgentRestore_<name>_<stamp>` database, `WITH MOVE` for every file, never `REPLACE`, never an existing name or file path | `local-restore-plan.ts` |
| Restores the **newest full** backup inside the `.bak`, shown to the user, confirmed with `YES` | `agent.ts` `restoreBakLocally` |

**Release order:** deploy the backend before giving customers agent 0.2.4 (0.2.4 sends results
in the new format; the backend still accepts 0.2.3 agents).

## 1. SQL Server login (customer IT, in SSMS)

Mode 1 — read an existing database (recommended):

```sql
-- Read-only. Changes no data. Replace the names.
CREATE LOGIN [gates_reader] WITH PASSWORD = N'<strong password>', CHECK_POLICY = ON;
USE [<LEGACY_DB>];
CREATE USER [gates_reader] FOR LOGIN [gates_reader];
ALTER ROLE [db_datareader] ADD MEMBER [gates_reader];
```

Do **not** map this login into any other database, and do not give it `sysadmin`. The agent
refuses `sa` and any `sysadmin` login.

Mode 2 — restore a `.bak` on this PC first: create `gates_reader` as above (server login only;
the agent maps it into the restored copy), and have an **administrator** login ready
(`sa` or another `sysadmin`). The agent asks for it only for the restore step, uses it once, and
never stores it or sends it to Gates. A `dbcreator`-only login is **not enough**: verified on
SQL Server 2022, it can restore but cannot open or grant access to the restored copy (the copy
keeps the backup's own users).

The `.bak` must be readable by the **SQL Server service account** (not just the Windows
user): put it in a folder that account can read, e.g. the instance's `Backup` folder.
`sqlcmd` (SQL Server command-line tools) must be installed for mode 2.

## 2. Pairing

1. Gates wizard → ترحيل قواعد البيانات → الترحيل من جهازي → إنشاء رمز الربط (one use, 15 min).
2. Pairing binds that agent to the company automatically: Gates sends work **only to the most
   recently paired agent**. An older agent (another PC, an old saved pairing) stays idle — pair
   again from the PC that should read the database.
3. Run `GatesMigrationAgent.exe` from PowerShell (not double-click, not as administrator):

```powershell
.\GatesMigrationAgent.exe --version     # GatesMigrationAgent 0.2.4
.\GatesMigrationAgent.exe --self-test   # ... self-test ok
.\GatesMigrationAgent.exe
```

Prompts: API address (`https://<backend>/api/v1/migration-engine`), pairing code, mode,
SQL Server (`localhost` or `localhost\INSTANCE` or `host,port`), login, password (hidden),
database.

The pairing token is saved in `%USERPROFILE%\.gates-migration-agent\session.json`. On the next
start the agent offers to reuse it (`Use the existing pairing … [Y/n]`). If Gates revoked the
device, the agent says so, deletes the saved token and exits — create a new code.

Expected output: `Paired.` → `Connected to legacy SQL Server (encrypt=false), database <name>`.
Keep the window open while Gates analyzes and imports.

## 3. `.bak` (mode 2)

1. Choose mode `2`; enter the read-only login (`gates_reader`) at the login prompts; give the
   full path to the `.bak`; then the administrator login when asked (restore only).
2. The agent reads `RESTORE HEADERONLY`, picks the newest **full** backup in the file and
   prints its database name and finish time. Type `YES` to restore it.
3. It checks free disk on the SQL data drive (when SQL Server is on this PC), restores into a
   new `GatesAgentRestore_<name>_<yyyymmddHHMM>` database with `WITH FILE = n, MOVE …`, maps
   `gates_reader` into it as `db_datareader`, sets the copy `READ_ONLY`, then reads it with
   `gates_reader` like mode 1. If the administrator login cannot grant access, the agent prints
   the exact SQL for the DBA and stops.

The original database and any earlier restore are never touched. Delete old
`GatesAgentRestore_*` databases yourself when the migration is accepted.

Cloud `.bak` upload (wizard → رفع نسخة احتياطية) is the alternative when the customer cannot
run the agent; it needs the isolated restore SQL Server, which is **not provisioned** yet
(`docs/migration/RESTORE_BLOCKER_AUDIT.md`).

## 4. Troubleshooting

| Message | Cause | Fix |
|---|---|---|
| `Pairing failed … Server said: <html…` | Wrong API address | Use `…/api/v1/migration-engine` |
| `Invalid or expired pairing code` | Code used or >15 min old | New code in the wizard |
| `Gates no longer accepts this agent` | Device revoked or replaced | New code; the saved token was deleted |
| `Connected to database "master" instead of "<db>"` | Login cannot open the database, or the name is wrong | Map the login to the database (step 1), check the name |
| `This SQL login is a server administrator` | Using `sa`/an admin login | Create `gates_reader` (step 1) |
| `Login failed for user` | Wrong password, or SQL authentication disabled | Enable "SQL Server and Windows Authentication mode" and restart the service |
| `ConnectionError … ETIMEOUT / ESOCKET` | TCP/IP disabled or wrong instance | SQL Server Configuration Manager → TCP/IP enabled; use `localhost\INSTANCE` |
| `sqlcmd is not installed` | Mode 2 without command-line tools | Install SQL Server command-line tools, or use mode 1 |
| `… cannot give gates_reader read access` after a restore | Restore login is not an administrator | DBA runs the printed SQL, then mode 1 with the restored name |
| `Login failed … Failed to open the explicitly specified database` (repeating) | Read-only login not mapped into that database | Step 1 mapping, or the grant SQL above |
| `Operating system error 5 (Access is denied)` during restore | Service account cannot read the `.bak` | Move the file to the SQL `Backup` folder |
| `The .bak file has no full database backup` | Only differential/log backups in the file | Make a full backup (`BACKUP DATABASE … TO DISK`) |
| `Not enough disk space for the restore` | Data drive too small | Free space or move the default data path |
| `Cross-database read blocked` in the Gates job | Server sent a query outside the database | Report it — this is a bug on the Gates side |
| Window closes immediately | Error before the loop | Run from PowerShell to read the last line |

## 5. What is verified (2026-10-28)

| Path | Status |
|---|---|
| Typecheck (connector, backend migration/connector/restore files), lint, 61 unit tests | PASS |
| Agent 0.2.4 (Node on macOS) → local backend → disposable MySQL, reading SQL Server 2022 (Docker): pair, Analyze, dry-run, import, reconcile | PASS — `COMPLETED`, 0 blockers, independent check **16/16**, 1,424 commands |
| Legacy text with `;`, `--`, `SELECT`, `<b>`, `/* */`, `OR 1=1` | arrived unchanged; 0 input-filter rejections |
| Mode 2 with the real Microsoft `sqlcmd` 18: `.bak` with full / full / differential sets | PASS — newest full (#2) restored to a new stamped database, original and an earlier restore untouched, reader mapped, copy read-only, Analyze `READY_FOR_DRY_RUN` |
| Passwords in agent output | none (admin and reader) |
| `sqlcmd -W -y 0` (0.2.3 behaviour) | confirmed broken: "The W and the y options are mutually exclusive" |
| `GatesMigrationAgent.exe` 0.2.4 | packed (PE32+ x86-64 console), bundle `--version` / `--self-test` pass with Node on macOS |
| Windows-native run (EXE on Windows, Windows SQL Server, service-account file access, Windows console prompts) | **BLOCKED** — no Windows machine/VM |
| Cloud `.bak` restore functions on the real `sqlcmd` 18 (header parse, newest full set #2, `WITH FILE`, reader login via private file, `READ_ONLY`, `-b` error reporting) | PASS (local container) |
| Cloud `.bak` restore as a deployed service | **BLOCKED** — isolated restore SQL Server not provisioned |
