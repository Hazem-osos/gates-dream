# Windows migration agent verification

Date: 2026-10-25. Agent version **0.2.0**. Not production-ready. Not published to customers.

## Why `node-v20.20.2-win-x64` 404ed

`npx --yes @yao-pkg/pkg --targets node20-win-x64` pulled `@yao-pkg/pkg` 6.24.0 → `@yao-pkg/pkg-fetch` **3.6.7**. Fetch 3.6.x publishes Node **22 / 24 / 26** only. Node 20 prebuilts live on the frozen **v3.5** cache. The packager then tried to compile Node 20 from source for Windows and cannot do that on macOS.

Fix: pin `@yao-pkg/pkg` **6.24.0**, target **`node22-win-x64`**, and pack with `--no-bytecode --public --public-packages "*"`. Bytecode fabrication spawns the Windows Node binary; on macOS that is `spawn Unknown system error -86`.

## Build (this Mac)

| Check | Result |
|-------|--------|
| `npm ci` / `npm install` in `gates-migration-connector` | Succeeded |
| `npm run build` (`tsc`) | Succeeded |
| `node dist/agent.js --version` | `GatesMigrationAgent 0.2.0` |
| `node dist/agent.js --self-test` | `GatesMigrationAgent 0.2.0 self-test ok` |
| `mssql` native addon | `mssql` 11 uses JavaScript `tedious`. No native SQL client |
| `npm run pack:win:exe` | Produced a PE file on this Mac |

Local pack output (macOS, **not** executed on Windows):

- Path: `gates-migration-connector/dist-exe/GatesMigrationAgent.exe` (gitignored)
- `file`: `PE32+ executable (console) x86-64, for MS Windows`
- Size: 101 MB
- SHA-256: `1743aa1b0470d94ea16de9e13cbfdb0955fac05ccfc62cd0213b85b5aa504c16`

Harmless pack warnings: `node_modules/open/xdg-open` cannot be embedded (Unix helper; unused on Windows).

## Windows execution

**Not verified.** This machine is macOS. GitHub CLI is not logged in (`gh auth status` → not logged into any GitHub hosts). GitHub MCP is unavailable. The Windows workflow was **not** started. The PE file was **not** launched on `windows-latest`.

## GitHub Actions artifact

**None.** There is no Actions run, no artifact URL, and no CI SHA-256.

Workflow ready at `.github/workflows/migration-agent-windows.yml`: `windows-latest`, Node 22, `npm ci`, `tsc`, pack, `GatesMigrationAgent.exe --self-test`, SHA-256, private artifact `GatesMigrationAgent-0.2.0`, fail if the exe is missing or `--self-test` does not print `self-test ok`.

### Run it (non-production branch)

```bash
gh auth login

git checkout -b packaging/windows-agent-0.2.0
git add \
  gates-migration-connector/package.json \
  gates-migration-connector/package-lock.json \
  gates-migration-connector/src/agent.ts \
  gates-migration-connector/README.md \
  gates-migration-connector/CUSTOMER.md \
  gates-migration-connector/AGENT_VERIFICATION.md \
  .github/workflows/migration-agent-windows.yml \
  .gitignore \
  .cursor/skills/gates-migration-engine/SKILL.md \
  .cursor/skills/gates-migration-engine/reference.md \
  .cursor/skills/skills-registry.yaml
git commit -m "$(cat <<'EOF'
Fix Windows Migration Agent packaging for pkg-fetch 3.6.

Target node22-win-x64 with a pinned pkg 6.24.0 and a noninteractive --self-test so CI can prove the exe starts.
EOF
)"
git push -u origin HEAD

gh workflow run migration-agent-windows.yml --ref packaging/windows-agent-0.2.0
gh run list --workflow=migration-agent-windows.yml --branch packaging/windows-agent-0.2.0
gh run watch
gh run download --name GatesMigrationAgent-0.2.0 --dir ./agent-artifact
```

After a green run: Actions → workflow run → Artifacts → `GatesMigrationAgent-0.2.0` (repo-private). SHA-256 is in the job log (`SHA256=…`) and in `GatesMigrationAgent.exe.sha256`.

## Windows / restore runbooks (not executed)

Instructions only — see `WINDOWS_TEST_GUIDE.md`, `SYNTHETIC_SQL_TEST.sql`, `LOCAL_RESTORE_TEST.md`.

## SQL Server restore

**Not verified.** No `sqlcmd`, no Docker, no synthetic `.bak`, no `RESTORE`. The workspace copy of `dist-exe/GatesMigrationAgent.exe` is gone (gitignored). Use the Mac-packed file whose SHA-256 is in the table above, or a later CI artifact.

## Pairing and security

Unchanged from the previous agent work. Pairing, token TTL, `sa` rejection, and `SQLCMDPASSWORD` were not re-exercised against a live API in this packaging pass.

## Distribution

Do not give customers this unsigned exe. Do not tell them to click through SmartScreen. Production needs Authenticode signing and a published checksum.

## Blockers before a real SQL Server restore test

1. Run the Windows workflow and confirm `--self-test` on `windows-latest`.
2. Authenticode is not required for an internal smoke, but SmartScreen will warn on unsigned bits.
3. A Windows PC with SQL Server (Developer is fine for synthetic data) and `sqlcmd`.
4. Pair the agent to a **non-production** Gates API (`MIGRATION_ENGINE_ENABLED`).
5. Isolated staging MySQL — not the production Railway database. Staging spend was estimated and **not approved**.
6. A synthetic `.bak` or an existing test database. Never customer production data.
7. Then: wizard **الترحيل من جهازي** → ten-stage engine through `ON_PREMISE_CONNECTOR`. The engine itself was not modified.

## Commands (local)

```
cd gates-migration-connector
npm ci
npm run build
node dist/agent.js --self-test
npm run pack:win
```
