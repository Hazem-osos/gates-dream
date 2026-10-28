#!/usr/bin/env bash
# Recreates the disposable local target gates_mig_e2e on the verified local container
# (gates_local_dev_mysql, 127.0.0.1:3307) from the current schema, then seeds it.
set -uo pipefail
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$TOOLS/../../../.." && pwd)"
S="${GATES_E2E_WORK:-$HOME/.gates-migration-e2e}"
N="$S"
mkdir -p "$S/e2e-out"
H=127.0.0.1; P=3307; DB=gates_mig_e2e

# Positive isolation check: the port must belong to the local dev container.
mapped=$(docker port gates_local_dev_mysql 3306/tcp 2>/dev/null)
if [[ "$mapped" != "127.0.0.1:3307" ]]; then echo "REFUSE: 3307 is not gates_local_dev_mysql ($mapped)"; exit 1; fi

mq() { mysql -h $H -P $P -uroot -plocal_dev_only_not_secret "$@" 2>&1 | grep -v "Using a password"; }
mq -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -h $H -P $P -uroot -plocal_dev_only_not_secret $DB < $S/full-schema.e2e.sql > $S/apply.log 2>&1 || { echo "schema apply failed"; grep -v "Using a password" $S/apply.log | head; exit 1; }
echo "tables: $(mq -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB'")"
cd "$REPO/gates-backend" && DATABASE_URL="mysql://root:local_dev_only_not_secret@$H:$P/$DB" SEED_OWNER_PASSWORD="$(cat $S/owner.pw)" npx tsx prisma/seed.ts > $S/seed.log 2>&1 && echo "seed ok" || { echo "seed failed"; exit 1; }
mq -N $DB -e "SELECT CONCAT('owner=', id) FROM users WHERE username='owner'"
