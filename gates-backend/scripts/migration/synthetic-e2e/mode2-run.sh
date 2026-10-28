#!/usr/bin/env bash
# Step 3b: agent mode 2 (local .bak restore) driven interactively through `expect`, using the
# real Microsoft sqlcmd inside the disposable SQL Server container. Local synthetic data only.
set -uo pipefail
TOOLS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$TOOLS/../../../.." && pwd)"
S="${GATES_E2E_WORK:-$HOME/.gates-migration-e2e}"
N="$S"
mkdir -p "$S/e2e-out"
BE="$REPO/gates-backend"
CONN="$REPO/gates-migration-connector"
API=http://127.0.0.1:4055/api/v1/migration-engine
ENVS=(DATABASE_URL="mysql://root:local_dev_only_not_secret@127.0.0.1:3307/gates_mig_e2e?connection_limit=10"
      NODE_ENV=development REDIS_ENABLED=false MIGRATION_ENGINE_ENABLED=true MIGRATION_RUN_INLINE=true
      MIGRATION_ALLOW_PRODUCTION_TARGET=false MIGRATION_CUSTOMER_EXECUTE_ENABLED=true MIGRATION_LEGACY_WRITABLE=false LEGACY_FORENSIC_URL=)
SA="$(cat $S/mssql-sa.pw)"
sq() { docker exec -e SQLCMDPASSWORD="$SA" gates_mig_synthetic_mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -s '|' -W -Q "$1"; }
step() { echo; echo "=== $* ($(date +%H:%M:%S))"; }
cleanup() { pkill -f "src/agent.ts" 2>/dev/null; kill $(cat $S/backend.pid) 2>/dev/null; P=$(lsof -nP -iTCP:4055 -sTCP:LISTEN -t); [ -n "$P" ] && kill $P; }
trap cleanup EXIT

step "1. .bak with 3 appended sets: full (marker FIRST), full (SECOND), differential (THIRD)"
docker exec -u root gates_mig_synthetic_mssql bash -c 'mkdir -p /var/opt/mssql/backup && chown mssql /var/opt/mssql/backup && rm -f /var/opt/mssql/backup/gsyn.bak'
sq "SET NOCOUNT ON; USE GatesSyntheticLegacy; UPDATE dbo.CompanySetting SET Value=N'FIRST' WHERE Name=N'SyntheticMarker'; BACKUP DATABASE GatesSyntheticLegacy TO DISK=N'/var/opt/mssql/backup/gsyn.bak' WITH INIT, FORMAT, NAME=N'first';" > /dev/null
sq "SET NOCOUNT ON; USE GatesSyntheticLegacy; UPDATE dbo.CompanySetting SET Value=N'SECOND' WHERE Name=N'SyntheticMarker'; BACKUP DATABASE GatesSyntheticLegacy TO DISK=N'/var/opt/mssql/backup/gsyn.bak' WITH NOINIT, NAME=N'second';" > /dev/null
sq "SET NOCOUNT ON; USE GatesSyntheticLegacy; UPDATE dbo.CompanySetting SET Value=N'THIRD' WHERE Name=N'SyntheticMarker'; BACKUP DATABASE GatesSyntheticLegacy TO DISK=N'/var/opt/mssql/backup/gsyn.bak' WITH DIFFERENTIAL, NOINIT, NAME=N'third';" > /dev/null
sq "SET NOCOUNT ON; RESTORE HEADERONLY FROM DISK=N'/var/opt/mssql/backup/gsyn.bak';" | cut -d'|' -f1-6,25-26 | head -6
sq "SET NOCOUNT ON; SELECT name FROM sys.databases WHERE name LIKE 'Gates%';"

step "2. restore login: dbcreator only (not sysadmin)"
RPW="R$(openssl rand -hex 12)!"
sq "SET NOCOUNT ON; IF SUSER_ID('gates_restore') IS NULL CREATE LOGIN gates_restore WITH PASSWORD=N'$RPW', CHECK_POLICY=OFF; ELSE ALTER LOGIN gates_restore WITH PASSWORD=N'$RPW'; ALTER SERVER ROLE dbcreator ADD MEMBER gates_restore;" > /dev/null && echo "gates_restore ready"

step "3. sqlcmd on PATH = the container's real sqlcmd"
mkdir -p $N/bin
cat > $N/bin/sqlcmd <<'SH'
#!/bin/bash
args=(); while [ $# -gt 0 ]; do if [ "$1" = "-S" ]; then args+=("-S" "localhost"); shift 2; else args+=("$1"); shift; fi; done
exec docker exec -i -e SQLCMDPASSWORD="$SQLCMDPASSWORD" gates_mig_synthetic_mssql /opt/mssql-tools18/bin/sqlcmd "${args[@]}"
SH
chmod +x $N/bin/sqlcmd

step "4. backend + pairing code"
bash "$TOOLS/reset-target.sh" | tail -1
( cd "$BE" && env "${ENVS[@]}" PORT=4055 npx tsx src/index.ts > $N/backend-mode2.log 2>&1 & echo $! > $S/backend.pid )
node -e 'const end=Date.now()+240000;(async()=>{for(;;){try{const r=await fetch("http://127.0.0.1:4055/health/live");if(r.ok){console.log("UP");return}}catch{} if(Date.now()>end){process.exit(1)} await new Promise(r=>setTimeout(r,2000))}})()' || exit 1
rm -f $S/e2e.token; node "$TOOLS/e2e.mjs" login
TOKEN=$(cat $S/e2e.token)
CODE=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" $API/source/connector/pairing-code | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.code))')

step "5. agent mode 2, answered like a person at the keyboard (expect)"
rm -rf $N/agent-home2; mkdir -p $N/agent-home2
cat > $N/mode2.exp <<EXP
set timeout 300
spawn env PATH=$N/bin:\$env(PATH) HOME=$N/agent-home2 USERPROFILE=$N/agent-home2 CONNECTOR_POLL_MS=200 {$REPO/gates-backend/node_modules/.bin/tsx} src/agent.ts
expect "Gates API base"            { send "$API\r" }
expect "Pairing code"              { send "$CODE\r" }
expect "Mode:"                     { send "2\r" }
expect "SQL Server"                { send "127.0.0.1,14333\r" }
expect "SQL login"                 { send "gates_mig_reader\r" }
expect "SQL password"              { send "$(cat $S/reader.pw)\r" }
expect "Database name"             { send "\r" }
expect "Full path to the .bak"     { send "/var/opt/mssql/backup/gsyn.bak\r" }
expect "Administrator SQL login"   { send "sa\r" }
expect "Administrator password"    { send "$SA\r" }
expect "Type YES"                  { send "YES\r" }
expect {
  "Connected to legacy SQL Server" { puts "\nAGENT CONNECTED" }
  "Press Enter to close"           { puts "\nAGENT FAILED"; exit 1 }
  timeout                          { puts "\nAGENT TIMEOUT"; exit 1 }
}
expect timeout { }
EXP
( cd "$CONN" && expect $N/mode2.exp > $N/agent-mode2.log 2>&1 & echo $! > $N/expect.pid )
for i in $(seq 1 120); do grep -qE "AGENT (CONNECTED|FAILED|TIMEOUT)" $N/agent-mode2.log && break; sleep 2; done
# password must not be echoed
for PW in "$SA" "$(cat $S/reader.pw)"; do grep -c -- "$PW" $N/agent-mode2.log; done | paste -sd" " - | sed 's/^/password occurrences in agent output (admin reader): /'
grep -vE "^\s*$" $N/agent-mode2.log | grep -v -- "$SA" | grep -E "Backup to restore|Restoring|can read|Connected|AGENT|Error|error|on file|RESTORE DATABASE|cancel" | head -15

step "6. restored database: newest FULL backup (marker SECOND), original untouched"
sq "SET NOCOUNT ON; SELECT name, state_desc, SUSER_SNAME(owner_sid) AS owner FROM sys.databases WHERE name LIKE 'Gates%';"
RDB=$(sq "SET NOCOUNT ON; SELECT TOP 1 name FROM sys.databases WHERE name LIKE 'GatesAgentRestore_%' ORDER BY create_date DESC;" | sed -n 3p)
echo "restored: $RDB"
sq "SET NOCOUNT ON; SELECT Value AS restored_marker FROM [$RDB].dbo.CompanySetting WHERE Name=N'SyntheticMarker'; SELECT Value AS original_marker FROM GatesSyntheticLegacy.dbo.CompanySetting WHERE Name=N'SyntheticMarker';"
sq "SET NOCOUNT ON; SELECT physical_name FROM sys.master_files WHERE database_id = DB_ID(N'$RDB');"

step "7. Analyze through the agent reading the restored copy"
J=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"legacyCompanyCode":"0001","sourceMode":"ON_PREMISE_CONNECTOR"}' $API/jobs | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.data?.id ?? ("ERR "+s.slice(0,300)))})')
T=$(date -u +%Y-%m-%dT%H:%M:%SZ); node "$TOOLS/e2e.mjs" run:analyze $J | cut -c1-100; node "$TOOLS/poll.mjs" $J $S/e2e.token $T
curl -s -H "Authorization: Bearer $TOKEN" $API/jobs/$J | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s).data;console.log("status:",d.job.status,"db:",d.job.sourceDatabaseName,"preflight firing:",(d.preflight?.findings??[]).filter(f=>f.count).map(f=>f.code).join(",")||"none")})'

step "8. refusals: sa login and a second restore of the same file"
sq "SET NOCOUNT ON; SELECT COUNT(*) AS restores FROM sys.databases WHERE name LIKE 'GatesAgentRestore_%';"
