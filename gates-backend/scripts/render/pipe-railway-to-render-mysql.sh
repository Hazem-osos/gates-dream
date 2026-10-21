#!/usr/bin/env bash
set -euo pipefail

SRC_URL="${DATABASE_URL:-}"
DST_HOST="${RENDER_MYSQL_HOST:-gates-mysql}"
DST_PORT="${RENDER_MYSQL_PORT:-3306}"
DST_DB="${RENDER_MYSQL_DATABASE:-railway}"
DST_USER="${RENDER_MYSQL_USER:-gates}"
DST_PASS="${RENDER_MYSQL_PASSWORD:-}"

if [[ -z "$SRC_URL" || -z "$DST_PASS" ]]; then
  echo "Need DATABASE_URL (Railway) and RENDER_MYSQL_PASSWORD" >&2
  exit 1
fi

if ! command -v mysqldump >/dev/null 2>&1 || ! command -v mysql >/dev/null 2>&1; then
  apk add --no-cache mysql-client
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
META="$(DATABASE_URL="$SRC_URL" node "$ROOT/scripts/render/mysql-url-parse.mjs")"
SRC_HOST="$(node -e "console.log(JSON.parse(process.argv[1]).host)" "$META")"
SRC_PORT="$(node -e "console.log(JSON.parse(process.argv[1]).port)" "$META")"
SRC_USER="$(node -e "console.log(JSON.parse(process.argv[1]).user)" "$META")"
SRC_PASS="$(node -e "console.log(JSON.parse(process.argv[1]).password)" "$META")"
SRC_DB="$(node -e "console.log(JSON.parse(process.argv[1]).database)" "$META")"

echo "Streaming $SRC_DB @ $SRC_HOST:$SRC_PORT → $DST_DB @ $DST_HOST:$DST_PORT"
export MYSQL_PWD="$SRC_PASS"
mysqldump -h "$SRC_HOST" -P "$SRC_PORT" -u "$SRC_USER" \
  --single-transaction --routines --triggers --set-gtid-purged=OFF \
  "$SRC_DB" | MYSQL_PWD="$DST_PASS" mysql -h "$DST_HOST" -P "$DST_PORT" -u "$DST_USER" "$DST_DB"
unset MYSQL_PWD
echo "Import finished."
