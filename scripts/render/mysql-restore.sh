#!/usr/bin/env bash
set -euo pipefail

DUMP="${1:?Usage: mysql-restore.sh dump.sql [override_database_name]}"
OVERRIDE_DB="${2:-}"

URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "Set DATABASE_URL" >&2
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "Install mysql client. On macOS: brew install mysql-client" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
META="$(DATABASE_URL="$URL" node "$SCRIPT_DIR/mysql-url-parse.mjs")"
HOST="$(node -e "console.log(JSON.parse(process.argv[1]).host)" "$META")"
PORT="$(node -e "console.log(JSON.parse(process.argv[1]).port)" "$META")"
USER="$(node -e "console.log(JSON.parse(process.argv[1]).user)" "$META")"
PASS="$(node -e "console.log(JSON.parse(process.argv[1]).password)" "$META")"
DB="$(node -e "const j=JSON.parse(process.argv[1]); console.log(process.argv[2]||j.database)" "$META" "$OVERRIDE_DB")"

echo "Restoring $DUMP → $DB @ $HOST:$PORT"
export MYSQL_PWD="$PASS"
mysql -h "$HOST" -P "$PORT" -u "$USER" "$DB" < "$DUMP"
unset MYSQL_PWD
echo "Done. Run: cd gates-backend && npx prisma migrate deploy"
