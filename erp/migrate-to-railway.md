# Moving real ERP data to Railway SQL Server

The mobile app talks to **Microsoft SQL Server** (tenant `connectionString` in Super Admin), not MySQL on Railway.

Typical mapping:

| Railway database   | Tenant (example) | `.env` helper |
|--------------------|------------------|---------------|
| `GatesImprove`     | `eldo`           | `db2`         |
| `SolarMasterDB`    | `ss`             | `db`          |

## What you have on Railway today

Both databases usually already have **hundreds of tables** (schema shell) but **stub** stored procedures (`SaveInvoices` body ~100 characters) and little or no business data. The app needs at least:

1. **Full `dbo.SaveInvoices`** (and related procs from desktop — see `erp_procedures.txt`)
2. **Master data**: `Company`, `Branch`, `Year`, `Account` / customers, `Store`, `Item`, `Currency`, safes, etc.

Mock seed (`npm run db:seed:erp`) only fills demo rows; it does **not** replace a desktop ERP database.

---

## Recommended: BACPAC from desktop (full database)

On the **desktop SQL Server** where ERP works:

1. SSMS → right‑click the database (e.g. `GatesImprove`) → **Tasks** → **Export Data-tier Application…**
2. Save `GatesImprove.bacpac` (and repeat for `SolarMasterDB` if needed).

On your Mac (install [SqlPackage](https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage-download)):

```bash
# Target = Railway URL (use env var — never commit passwords)
export SQLSERVER_TARGET_URL='sqlserver://HOST:PORT;database=GatesImprove;user=sa;password=***;encrypt=true;trustServerCertificate=true;'

# Import into an EMPTY database name on the server, or drop/recreate the DB first if import fails on existing objects
sqlpackage /Action:Import \
  /SourceFile:/path/to/GatesImprove.bacpac \
  /TargetConnectionString:"Server=HOST,PORT;Database=GatesImprove;User Id=sa;Password=***;Encrypt=True;TrustServerCertificate=True;"
```

**Note:** Importing on top of an existing schema often fails. Safest: create a **new** database on Railway, import there, then point the tenant connection string to it (or drop `gatesimprove` and re-import — **destructive**).

Verify:

```bash
SQLSERVER_SEED_URL="$SQLSERVER_TARGET_URL" npm run erp:check-procedures
```

You want: `OK: SaveInvoices is present and looks deployed.` (not STUB).

---

## Alternative: `.bak` backup

If you only have `.bak` files:

1. Copy the `.bak` to a place SQL Server can read (Railway volume, or Azure Blob + `RESTORE FROM URL` if your host supports it).
2. In SSMS or `sqlcmd` connected to **Railway**:

```sql
RESTORE DATABASE GatesImprove
FROM DISK = N'/var/opt/mssql/backup/GatesImprove.bak'
WITH REPLACE, MOVE N'LogicalDataName' TO N'/var/opt/mssql/data/GatesImprove.mdf',
     MOVE N'LogicalLogName' TO N'/var/opt/mssql/data/GatesImprove_log.ldf';
```

Logical file names come from:

```sql
RESTORE FILELISTONLY FROM DISK = N'/path/to/GatesImprove.bak';
```

Railway’s SQL plugin may not expose a disk path for `.bak`; **BACPAC is usually easier** on hosted SQL.

---

## Minimum fix (procedures only, keep current tables)

If desktop and Railway share the same schema but procedures are empty:

1. On desktop SSMS: **Programmability** → **Stored Procedures** → right‑click `SaveInvoices` → **Script as CREATE**.
2. Run the script on Railway (both DBs if both tenants need invoices).
3. Repeat for `GetAllItemsInStore`, `SaveReturnInvoices`, etc. (list in `docs/erp/erp_procedures.txt`).

Then copy **data** only if tables are empty (customers, items, years) — use SSMS **Generate Scripts** (data only) for selected tables, or a one‑time linked-server / export tool from your DBA.

---

## After data is on Railway

1. Super Admin → tenant → SQL connection string must match the database you filled (`GatesImprove` vs `SolarMasterDB`).
2. Company `0001`, branch `01` (app maps to ERP `0001` where needed), year `2026` → resolves to `YearCode`.
3. Optional env on the app host: `ERP_DEFAULT_USER_CODE=Admin`.
4. Test: save a sales invoice from the rep app.

---

## One-command push from project folders (Mac + Docker)

If you have **`GatesImprove/`** (`.mdf` + `.ldf`) and **`DataBase21-5-2026/`** (`.bak`) in the repo root:

1. Start **Docker Desktop**.
2. Set **`db2`** and **`db`** in `.env` to your Railway SQL URLs.
3. Run:

```bash
npm run erp:push-railway
```

This restores locally in Docker, exports BACPACs, **drops and recreates** the Railway databases, imports, and runs `erp:check-procedures`.

If BACPACs already exist under `.tools/bacpac/`:

```bash
bash scripts/railway-import-bacpac-only.sh
```

Mapping used by the script:

| Local source | Railway target (`.env`) |
|--------------|-------------------------|
| `GatesImprove/*.mdf` | `db2` → database **GatesImprove** |
| `DataBase21-5-2026.bak` | `db` → database **SolarMasterDB** |

Confirm tenant Super Admin connection strings match these databases.

---

## What to share when asking for help (not in git)

- BACPAC or `.bak` **on your machine** (too large for the repo).
- Desktop **database name** and SQL Server version.
- Which tenant uses which Railway database.
- Output of `npm run erp:check-procedures` with `SQLSERVER_SEED_URL` set.

Do **not** commit `.env`, passwords, or `.bak`/`.bacpac` files to GitHub.
