# Synthetic migration E2E harness

Proves the legacy migration engine end to end on **synthetic data and disposable local
databases only**: a synthetic legacy Gates SQL Server → the real backend API (the wizard's calls)
→ a fresh local MySQL, then an **independent** source-vs-target check that does not use the engine.

Results and what each fix covers: `docs/migration/LOCAL_E2E_RESULTS_2026-10-27.md`.
Windows agent / `.bak`: `gates-migration-connector/SETUP_AND_TROUBLESHOOTING.md`.

## Prerequisites (local only)

| Container | Address | Role |
|---|---|---|
| `gates_mig_synthetic_mssql` (SQL Server 2022, `MSSQL_MEMORY_LIMIT_MB=2048`) | `127.0.0.1:14333` | legacy source |
| `gates_local_dev_mysql` | `127.0.0.1:3307` | target (`gates_mig_e2e`, recreated each run) |

Every script refuses other hosts/ports. Nothing here may point at Railway, staging or a customer.
Working files go to `$GATES_E2E_WORK` (default `~/.gates-migration-e2e`), never into the repo.

```bash
bash prepare.sh            # after a reboot or schema change
bash full-run.sh           # load → analyze → preview → dry-run → import → reconcile → verify → re-import
PARTY_LEAF_IN_MASTER=0 bash full-run.sh   # party accounts missing from the legacy chart
bash dirty-run.sh          # broken legacy data: Analyze must list every problem and stop
bash rollback-test.sh      # after full-run: rollback must remove exactly what the job created
bash conn-run.sh           # the same flow through the Windows agent code (Node, macOS)
bash mode2-run.sh          # agent .bak restore with the container's real sqlcmd (needs `expect`)
```

Expected: `16/16 checks match`, `IDEMPOTENT: row counts unchanged`, reconcile `COMPLETED`.

| File | Purpose |
|---|---|
| `gen-schema.mjs` | legacy table DDL from `erp/erp_schema.txt` |
| `load-synthetic.mjs` + `ops-data.mjs` | synthetic legacy data (2 branches, 2 years, EGP+USD, invoices/returns/drafts, cash, cheques, stock; `DIRTY=1` adds broken rows) |
| `make-reader.mjs` | `db_datareader` login for the engine |
| `reset-target.sh` | fresh `gates_mig_e2e` from the current schema + demo seed |
| `e2e.mjs` / `poll.mjs` | API driver (login, source, job, run, issues, recon) and job poller |
| `verify.mjs` | independent 16-check comparison of source and target |
| `cloud-sqlcmd-shim.sh` | test-only `sqlcmd` wrapper into the container (cloud restore functions) |
