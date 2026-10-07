# Local legacy database restore (Phase 0.5)

Isolated SQL Server for **read-only** forensic audit of `DataBase21-5-2026.bak`.

## Prerequisites

- Docker Desktop running (Apple Silicon: image uses `linux/amd64`).
- Place the backup at **either**:
  - `scripts/migration/legacy-local-restore/backup/DataBase21-5-2026.bak`, or
  - repo root: `DataBase21-5-2026.bak` (script copies into `backup/`), or
  - known copy: `~/Desktop/gates-mobile/DataBase21-5-2026/DataBase21-5-2026.bak`

The `.bak` is **not** in git (too large / sensitive).

## Quick start

```bash
cd scripts/migration/legacy-local-restore
export MSSQL_SA_PASSWORD='GatesForensic_LocalOnly_ChangeMe!'   # local only
./restore-and-audit.sh
```

Outputs:

- `audit-out/restore-metadata.json`
- `audit-out/forensic-*.json`
- Regenerates `docs/migration/LEGACY_*` reports via `gates-backend` runner.

## Safety

- Script does **not** `EXEC` business procedures (`PostInvoice`, etc.).
- After restore, database is set **READ_ONLY** when supported.
- No connection to Railway or customer live SQL.

## Blockers

| Issue | Action |
|-------|--------|
| `.bak` missing | Copy file from backup storage; re-run |
| Docker not running | Start Docker Desktop |
| RESTORE version mismatch | Use SQL Server version ≥ backup source (try 2019 image tag) |
