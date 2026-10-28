#!/usr/bin/env bash
# Step 3: real agent (src/agent.ts via tsx, macOS) -> local backend -> disposable MySQL,
# reading the synthetic legacy SQL Server through the connector path. Local data only.
set -uo pipefail
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$TOOLS/../../../.." && pwd)"
S="${GATES_E2E_WORK:-$HOME/.gates-migration-e2e}"
N="$S"
mkdir -p "$S/e2e-out"
BE="$REPO/gates-backend"
CONN="$REPO/gates-migration-connector"
CID=00000000-0000-0000-0000-000000000001
API=http://127.0.0.1:4055/api/v1/migration-engine
ENVS=(DATABASE_URL="mysql://root:local_dev_only_not_secret@127.0.0.1:3307/gates_mig_e2e?connection_limit=10"
      NODE_ENV=development REDIS_ENABLED=false MIGRATION_ENGINE_ENABLED=true MIGRATION_RUN_INLINE=true
      MIGRATION_ALLOW_PRODUCTION_TARGET=false MIGRATION_CUSTOMER_EXECUTE_ENABLED=true MIGRATION_LEGACY_WRITABLE=false LEGACY_FORENSIC_URL=)
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
step() { echo; echo "=== $* ($(date +%H:%M:%S))"; }
cleanup() { [ -f $N/agent.pid ] && kill $(cat $N/agent.pid) 2>/dev/null; kill $(cat $S/backend.pid) 2>/dev/null; P=$(lsof -nP -iTCP:4055 -sTCP:LISTEN -t); [ -n "$P" ] && kill $P; }
trap cleanup EXIT

step "1. synthetic legacy source + text that the API input filter used to reject"
node "$TOOLS/load-synthetic.mjs" $S/schema.sql $S/mssql-sa.pw 2>&1 | grep -E '^\{' | cut -c1-200
node "$TOOLS/make-reader.mjs" $S/mssql-sa.pw $S/reader.pw 2>&1 | grep -v eprecat
node --input-type=module -e "
import fs from 'node:fs'; import { createRequire } from 'node:module';
const mssql = createRequire('$BE/package.json')('mssql');
const p = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 14333, user: 'sa', password: fs.readFileSync('$S/mssql-sa.pw','utf8').trim(), database: 'GatesSyntheticLegacy', options: { encrypt: true, trustServerCertificate: true } }).connect();
await p.request().query(\"UPDATE dbo.Customer SET CustomerNameA = N'عميل اختبار 1; SELECT * FROM x -- <b>update</b> /* delete */' WHERE CustomerCode='1'\");
await p.request().query(\"UPDATE dbo.Supplier SET SupplierNameA = N'مورد اختبار 2 OR 1=1; DROP TABLE t' WHERE SupplierCode='2'\");
console.log('tricky text injected'); await p.close();" 2>&1 | grep -v eprecat

step "2. disposable target + backend"
bash "$TOOLS/reset-target.sh" | tail -1
( cd "$BE" && env "${ENVS[@]}" PORT=4055 npx tsx src/index.ts > $N/backend-conn.log 2>&1 & echo $! > $S/backend.pid )
node -e 'const end=Date.now()+240000;(async()=>{for(;;){try{const r=await fetch("http://127.0.0.1:4055/health/live");if(r.ok){console.log("UP");return}}catch{} if(Date.now()>end){process.exit(1)} await new Promise(r=>setTimeout(r,2000))}})()' || exit 1
rm -f $S/e2e.token; node "$TOOLS/e2e.mjs" login
TOKEN=$(cat $S/e2e.token)

step "3. pairing code (wizard) + agent 0.2.4 started with it"
CODE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" $API/source/connector/pairing-code | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.data?.pairingCode ?? j.data?.code ?? "")})')
echo "pairing code: ${CODE:0:2}…"
rm -rf $N/agent-home; mkdir -p $N/agent-home
( cd "$CONN" && env HOME=$N/agent-home USERPROFILE=$N/agent-home GATES_API_BASE=$API GATES_PAIRING_CODE=$CODE \
    LEGACY_MSSQL_SERVER=127.0.0.1,14333 LEGACY_MSSQL_USER=gates_mig_reader LEGACY_MSSQL_PASSWORD="$(cat $S/reader.pw)" \
    LEGACY_MSSQL_DATABASE=GatesSyntheticLegacy CONNECTOR_POLL_MS=200 npx tsx src/agent.ts > $N/agent.log 2>&1 & echo $! > $N/agent.pid )
for i in $(seq 1 60); do grep -q "Connected to legacy SQL Server" $N/agent.log && break; sleep 2; done
grep -v "^\s*$" $N/agent.log | head -8
ls -la $N/agent-home/.gates-migration-agent/ 2>&1 | tail -1

step "4. job on the connector"
J=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"legacyCompanyCode":"0001","sourceMode":"ON_PREMISE_CONNECTOR"}' $API/jobs | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.data?.id ?? ("ERR "+s.slice(0,300)))})')
echo "JOB=$J"; echo "$J" > $S/e2e.job

for MODE in analyze dry-run import reconcile; do
  step "5. $MODE through the agent"
  T=$(now); node "$TOOLS/e2e.mjs" run:$MODE $J | cut -c1-120; node "$TOOLS/poll.mjs" $J $S/e2e.token $T
done
node "$TOOLS/e2e.mjs" recon $J > /dev/null
node -e 'const j=require(process.argv[1]).json; const d=j.data ?? j; console.log("summary:", JSON.stringify(d.summary)); console.log("completeness:", JSON.stringify(d.completeness))' $S/e2e-out/recon.json
node "$TOOLS/e2e.mjs" issues $J | head -20

step "6. independent source-vs-target check"
node "$TOOLS/verify.mjs" $S/mssql-sa.pw $CID
mysql -h 127.0.0.1 -P 3307 -uroot -plocal_dev_only_not_secret -N gates_mig_e2e -e "SELECT CONCAT('customer 1: ', arabicName) FROM customers WHERE code='1'; SELECT CONCAT('supplier 2: ', arabicName) FROM suppliers WHERE code='2'; SELECT CONCAT('commands: ', status, ' ', COUNT(*)) FROM migration_connector_commands GROUP BY status;" 2>&1 | grep -v "Using a password"
grep -ciE "SQL_INJECTION|Potential SQL injection" $N/backend-conn.log | sed 's/^/sanitizer rejections in backend log: /'
grep -E "Connector loop error|Could not send" $N/agent.log | head -5
echo "agent log lines: $(wc -l < $N/agent.log)"
