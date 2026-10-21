#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-./gates-mysql-dump.sql}"
URL="${DATABASE_URL:-}"

if [[ -z "$URL" ]]; then
  echo "Set DATABASE_URL (e.g. from gates-backend/.env)" >&2
  exit 1
fi

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "Install mysql client (mysqldump). On macOS: brew install mysql-client" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
META="$(DATABASE_URL="$URL" node "$SCRIPT_DIR/mysql-url-parse.mjs")"
HOST="$(node -e "console.log(JSON.parse(process.argv[1]).host)" "$META")"
PORT="$(node -e "console.log(JSON.parse(process.argv[1]).port)" "$META")"
USER="$(node -e "console.log(JSON.parse(process.argv[1]).user)" "$META")"
PASS="$(node -e "console.log(JSON.parse(process.argv[1]).password)" "$META")"
DB="$(node -e "console.log(JSON.parse(process.argv[1]).database)" "$META")"

echo "Dumping $DB @ $HOST:$PORT → $OUT"
mkdir -p "$(dirname "$OUT")"
export MYSQL_PWD="$PASS"
mysqldump -h "$HOST" -P "$PORT" -u "$USER" \
  --single-transaction --routines --triggers --set-gtid-purged=OFF \
  "$DB" > "$OUT"
unset MYSQL_PWD
echo "Done ($(wc -c < "$OUT" | tr -d ' ') bytes)"
