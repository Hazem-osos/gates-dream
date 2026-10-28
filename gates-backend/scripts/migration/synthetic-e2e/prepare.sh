#!/usr/bin/env bash
# One-time (or after a reboot) setup for the synthetic migration E2E harness.
# Creates the working folder ($GATES_E2E_WORK, default ~/.gates-migration-e2e) with:
#   mssql-sa.pw   read from the LOCAL test container's environment (never printed)
#   reader.pw / owner.pw   fresh random local test passwords
#   schema.sql    legacy table DDL generated from erp/erp_schema.txt
#   full-schema.e2e.sql    target MySQL schema from the CURRENT schema.prisma
# Local disposable containers only: gates_mig_synthetic_mssql (127.0.0.1:14333) and
# gates_local_dev_mysql (127.0.0.1:3307).
set -euo pipefail
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$TOOLS/../../../.." && pwd)"
S="${GATES_E2E_WORK:-$HOME/.gates-migration-e2e}"
mkdir -p "$S/e2e-out"
umask 077

[[ "$(docker port gates_mig_synthetic_mssql 1433/tcp 2>/dev/null)" == "127.0.0.1:14333" ]] ||
  { echo "REFUSE: gates_mig_synthetic_mssql is not published on 127.0.0.1:14333"; exit 1; }
[[ "$(docker port gates_local_dev_mysql 3306/tcp 2>/dev/null)" == "127.0.0.1:3307" ]] ||
  { echo "REFUSE: gates_local_dev_mysql is not published on 127.0.0.1:3307"; exit 1; }

docker inspect gates_mig_synthetic_mssql --format '{{range .Config.Env}}{{println .}}{{end}}' |
  grep -E '^MSSQL_SA_PASSWORD=' | head -1 | cut -d= -f2- | tr -d '\n' > "$S/mssql-sa.pw"
[[ -s "$S/mssql-sa.pw" ]] || { echo "could not read the test container's sa password"; exit 1; }
[[ -s "$S/reader.pw" ]] || printf 'Rd%s9!' "$(openssl rand -hex 12)" > "$S/reader.pw"
[[ -s "$S/owner.pw" ]] || printf 'Ow%s9!' "$(openssl rand -hex 12)" > "$S/owner.pw"

node "$TOOLS/gen-schema.mjs" "$REPO/erp/erp_schema.txt" > "$S/schema.sql"
( cd "$REPO/gates-backend" && npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script ) > "$S/full-schema.sql"
# MySQL rejects a literal default on TEXT; the expression form is accepted. Scratch copy only.
sed "s/TEXT NOT NULL DEFAULT '',/TEXT NOT NULL DEFAULT (''),/" "$S/full-schema.sql" > "$S/full-schema.e2e.sql"
echo "ready: $S ($(grep -c 'CREATE TABLE' "$S/schema.sql") legacy tables, $(grep -c 'CREATE TABLE' "$S/full-schema.e2e.sql") target tables)"
