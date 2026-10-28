#!/usr/bin/env bash
# Dirty-data check: load broken synthetic data, create a job, Analyze, print the pre-import checklist.
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
DIRTY=1 node "$TOOLS/load-synthetic.mjs" $S/schema.sql $S/mssql-sa.pw 2>&1 | grep -E '^\{' | cut -c1-200
node "$TOOLS/make-reader.mjs" $S/mssql-sa.pw $S/reader.pw > /dev/null 2>&1
bash "$TOOLS/reset-target.sh" | tail -1
( cd "$BE" && env "${ENVS[@]}" PORT=4055 npx tsx src/index.ts > $S/backend-dirty.log 2>&1 & echo $! > $S/backend.pid )
node -e 'const end=Date.now()+240000;(async()=>{for(;;){try{const r=await fetch("http://127.0.0.1:4055/health/live");if(r.ok){console.log("UP");return}}catch{} if(Date.now()>end){process.exit(1)} await new Promise(r=>setTimeout(r,2000))}})()' || exit 1
rm -f $S/e2e.token; node "$TOOLS/e2e.mjs" login > /dev/null && node "$TOOLS/e2e.mjs" source > /dev/null && node "$TOOLS/e2e.mjs" job > /dev/null
J=$(node -e 'console.log(require(process.argv[1]).json.data.id)' $S/e2e-out/job-create.json)
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
T=$(now); node "$TOOLS/e2e.mjs" run:analyze $J > /dev/null; node "$TOOLS/poll.mjs" $J $S/e2e.token $T
TOKEN=$(cat $S/e2e.token)
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:4055/api/v1/migration-engine/jobs/$J > $S/e2e-out/dirty-job.json
node -e '
const d=require(process.argv[1]).data; console.log("status:", d.job.status, "openBlockers:", d.progress?.openBlockers);
for (const f of d.preflight?.findings ?? []) if (f.count) console.log(`[${f.action}/${f.severity}] ${f.code} x${f.count}: ${f.samples.slice(0,4).join(" ; ")}`);' $S/e2e-out/dirty-job.json
kill $(cat $S/backend.pid) 2>/dev/null; P=$(lsof -nP -iTCP:4055 -sTCP:LISTEN -t); [ -n "$P" ] && kill $P; echo stopped
