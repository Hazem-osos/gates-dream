#!/usr/bin/env bash
# Full local E2E: synthetic legacy SQL Server  ->  disposable local MySQL target.
set -uo pipefail
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$TOOLS/../../../.." && pwd)"
S="${GATES_E2E_WORK:-$HOME/.gates-migration-e2e}"
N="$S"
mkdir -p "$S/e2e-out"
BE="$REPO/gates-backend"
CID=00000000-0000-0000-0000-000000000001
ENVS=(DATABASE_URL="mysql://root:local_dev_only_not_secret@127.0.0.1:3307/gates_mig_e2e?connection_limit=10"
      NODE_ENV=development REDIS_ENABLED=false MIGRATION_ENGINE_ENABLED=true MIGRATION_RUN_INLINE=true
      MIGRATION_ALLOW_PRODUCTION_TARGET=false MIGRATION_CUSTOMER_EXECUTE_ENABLED=true
      MIGRATION_LEGACY_WRITABLE=false LEGACY_FORENSIC_URL=)
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
step() { echo; echo "=== $* ($(date +%H:%M:%S))"; }

step "1. synthetic legacy source"
node "$TOOLS/load-synthetic.mjs" $S/schema.sql $S/mssql-sa.pw 2>&1 | grep -v eprecation | grep -E '^\{|Error|^OPS' | cut -c1-300 || exit 1
node "$TOOLS/make-reader.mjs" $S/mssql-sa.pw $S/reader.pw 2>&1 | grep -v eprecation

step "2. disposable target"
OUT=$(bash "$TOOLS/reset-target.sh") || { echo "$OUT"; exit 1; }
echo "$OUT"
OWNER=$(echo "$OUT" | sed -n 's/^owner=//p')

step "3. backend"
( cd "$BE" && env "${ENVS[@]}" PORT=4055 npx tsx src/index.ts > $S/backend-e2e.log 2>&1 & echo $! > $S/backend.pid )
node -e 'const end=Date.now()+240000;(async()=>{for(;;){try{const r=await fetch("http://127.0.0.1:4055/health/live");if(r.ok){console.log("UP");return}}catch{} if(Date.now()>end){console.log("TIMEOUT");process.exit(1)} await new Promise(r=>setTimeout(r,2000))}})()' || exit 1

step "4. connect"
rm -f $S/e2e.token
node "$TOOLS/e2e.mjs" login && node "$TOOLS/e2e.mjs" source | cut -c1-160
node "$TOOLS/e2e.mjs" job | cut -c1-100
J=$(node -e 'const j=require(process.argv[1]);console.log(j.json?.data?.id??"")' $S/e2e-out/job-create.json); echo "$J" > $S/e2e.job
echo "JOB=$J baseline=$(node -e 'const j=require(process.argv[1]);console.log(JSON.stringify(j.json?.data?.reconciliationBaseline))' $S/e2e-out/job-create.json)"

step "5. analyze"
T=$(now); node "$TOOLS/e2e.mjs" run:analyze $J | cut -c1-100; node "$TOOLS/poll.mjs" $J $S/e2e.token $T

step "6. preview"
node "$TOOLS/e2e.mjs" issues $J | head -6
node "$TOOLS/e2e.mjs" mapping $J | cut -c1-220

step "7. dry-run"
T=$(now); node "$TOOLS/e2e.mjs" run:dry-run $J | cut -c1-100; node "$TOOLS/poll.mjs" $J $S/e2e.token $T
mysql -h 127.0.0.1 -P 3307 -uroot -plocal_dev_only_not_secret -N gates_mig_e2e -e "SELECT CONCAT('after dry-run: journals=',(SELECT COUNT(*) FROM journal_entries),' customers=',(SELECT COUNT(*) FROM customers),' suppliers=',(SELECT COUNT(*) FROM suppliers))" 2>&1 | grep -v "Using a password"

step "8. execute (wizard path: POST run {mode:'import'})"
T=$(now); node "$TOOLS/e2e.mjs" run:import $J | cut -c1-140; node "$TOOLS/poll.mjs" $J $S/e2e.token $T

step "9. reconcile"
T=$(now); node "$TOOLS/e2e.mjs" run:reconcile $J | cut -c1-100; node "$TOOLS/poll.mjs" $J $S/e2e.token $T
node "$TOOLS/e2e.mjs" recon $J > /dev/null
node -e '
const j=require(process.argv[1]).json; const d=j.data ?? j;
console.log("summary:", JSON.stringify(d.summary));
console.log("accounting:", JSON.stringify({sourceHeaders:d.accounting.sourceHeaders,importedHeaders:d.accounting.importedHeaders,difference:d.accounting.difference,targetLines:d.accounting.targetLines,quarantined:d.accounting.quarantined}));
console.log("parties:", d.parties.customerMatch, d.parties.supplierMatch);
console.log("inventory:", JSON.stringify({imported:d.inventory.importedMovements,planned:d.inventory.plannedImportable,qtyDiff:d.inventory.quantityDifferenceCount,quarantined:d.inventory.quarantined,missingItem:d.inventory.missingItem}));
console.log("settlement:", JSON.stringify(d.settlement)); console.log("cheques:", JSON.stringify(d.cheques)); console.log("commercial:", JSON.stringify(d.commercial));' $S/e2e-out/recon.json
node "$TOOLS/e2e.mjs" issues $J | head -30

step "10. independent source-vs-target check"
node "$TOOLS/verify.mjs" $S/mssql-sa.pw $CID

step "11. run the import again: nothing may be duplicated"
counts() { mysql -h 127.0.0.1 -P 3307 -uroot -plocal_dev_only_not_secret -N gates_mig_e2e -e "SELECT CONCAT_WS(' ', (SELECT COUNT(*) FROM journal_entries), (SELECT COUNT(*) FROM journal_entry_lines), (SELECT COUNT(*) FROM accounts), (SELECT COUNT(*) FROM customers), (SELECT COUNT(*) FROM suppliers), (SELECT COUNT(*) FROM items), (SELECT COUNT(*) FROM invoices), (SELECT COUNT(*) FROM invoice_lines), (SELECT COUNT(*) FROM cash_transactions), (SELECT COUNT(*) FROM cash_transaction_lines), (SELECT COUNT(*) FROM payment_allocations), (SELECT COUNT(*) FROM cheques), (SELECT COUNT(*) FROM inventory_movements))" 2>&1 | grep -v "Using a password"; }
BEFORE=$(counts); echo "before: $BEFORE"
T=$(now); node "$TOOLS/e2e.mjs" run:import $J | cut -c1-140; node "$TOOLS/poll.mjs" $J $S/e2e.token $T
AFTER=$(counts); echo "after:  $AFTER"
[ "$BEFORE" = "$AFTER" ] && echo "IDEMPOTENT: row counts unchanged" || echo "NOT IDEMPOTENT"
node "$TOOLS/verify.mjs" $S/mssql-sa.pw $CID | tail -1

step "done"
kill $(cat $S/backend.pid) 2>/dev/null; P=$(lsof -nP -iTCP:4055 -sTCP:LISTEN -t); [ -n "$P" ] && kill $P; echo "backend stopped"
