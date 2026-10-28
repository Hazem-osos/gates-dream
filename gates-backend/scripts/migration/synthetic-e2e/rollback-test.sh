#!/usr/bin/env bash
# Rollback test on the job left by full-run.sh: undo the import, check every migrated table is empty again.
set -uo pipefail
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$TOOLS/../../../.." && pwd)"
S="${GATES_E2E_WORK:-$HOME/.gates-migration-e2e}"
N="$S"
mkdir -p "$S/e2e-out"
BE="$REPO/gates-backend"
ENVS=(DATABASE_URL="mysql://root:local_dev_only_not_secret@127.0.0.1:3307/gates_mig_e2e?connection_limit=10"
      NODE_ENV=development REDIS_ENABLED=false MIGRATION_ENGINE_ENABLED=true MIGRATION_RUN_INLINE=true
      MIGRATION_ALLOW_PRODUCTION_TARGET=false MIGRATION_CUSTOMER_EXECUTE_ENABLED=true MIGRATION_LEGACY_WRITABLE=false LEGACY_FORENSIC_URL=)
J=$(cat $S/e2e.job)
q() { mysql -h 127.0.0.1 -P 3307 -uroot -plocal_dev_only_not_secret -t gates_mig_e2e -e "$1" 2>&1 | grep -v "Using a password"; }
COUNTS="SELECT (SELECT COUNT(*) FROM journal_entries) je, (SELECT COUNT(*) FROM accounts) acc, (SELECT COUNT(*) FROM account_period_balances) apb, (SELECT COUNT(*) FROM partner_running_balances) prb, (SELECT COUNT(*) FROM customers) cust, (SELECT COUNT(*) FROM suppliers) sup, (SELECT COUNT(*) FROM items) it, (SELECT COUNT(*) FROM invoices) inv, (SELECT COUNT(*) FROM cash_transactions) cash, (SELECT COUNT(*) FROM payment_allocations) alloc, (SELECT COUNT(*) FROM cheques) chq, (SELECT COUNT(*) FROM inventory_movements) mov, (SELECT COUNT(*) FROM warehouses) wh, (SELECT COUNT(*) FROM branches) br"
echo "after import:"; q "$COUNTS"
( cd "$BE" && env "${ENVS[@]}" PORT=4055 npx tsx src/index.ts > $S/backend-rb.log 2>&1 & echo $! > $S/backend.pid )
node -e 'const end=Date.now()+240000;(async()=>{for(;;){try{const r=await fetch("http://127.0.0.1:4055/health/live");if(r.ok){return}}catch{} if(Date.now()>end){process.exit(1)} await new Promise(r=>setTimeout(r,2000))}})()' || exit 1
TOKEN=$(cat $S/e2e.token)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:4055/api/v1/migration-engine/jobs/$J/rollback > $S/e2e-out/rollback.json
node -e 'const j=require(process.argv[1]); console.log("response:", JSON.stringify(j).slice(0,300))' $S/e2e-out/rollback.json
node -e '
const [J, T] = process.argv.slice(1); const end = Date.now() + 900000;
(async () => { for (;;) {
  const r = await fetch(`http://127.0.0.1:4055/api/v1/migration-engine/jobs/${J}`, { headers: { Authorization: `Bearer ${T}` } });
  const rb = (await r.json()).data?.job?.progress?.rollback;
  if (rb && rb.status !== "RUNNING") { console.log("rollback", rb.status, rb.error ?? "", JSON.stringify(rb.result ?? {}).slice(0, 700)); return; }
  if (Date.now() > end) { console.log("rollback still running after 15 min"); return; }
  await new Promise((res) => setTimeout(res, 3000));
} })();' $J $TOKEN
echo "after rollback:"; q "$COUNTS"
kill $(cat $S/backend.pid) 2>/dev/null; P=$(lsof -nP -iTCP:4055 -sTCP:LISTEN -t); [ -n "$P" ] && kill $P; echo stopped
