# Gates Migration Connector (on-premise)

Outbound-only agent: polls Gates API, executes **read-only** legacy SQL Server operations locally, returns results.

## Pairing

1. Owner opens migration wizard → **SQL Server داخل الشركة** → generates pairing code.
2. On a Windows/Linux machine with SQL Server access:

```bash
export GATES_API_BASE=https://your-gates-backend/api/v1/migration-engine
export GATES_COMPANY_ID=<tenant-company-uuid>
export LEGACY_MSSQL_URL="Server=localhost;Database=LegacyForensic;User Id=...;Password=...;Encrypt=true;TrustServerCertificate=true"
npm install && npm run build && npm start
```

3. Pair once (connector calls `POST /connector/v1/pair` with pairing code).

## Runtime

Set `CONNECTOR_TOKEN` from pair response. Connector polls `POST /connector/v1/poll` every 2s.

## Windows packaging

Pinned `@yao-pkg/pkg` 6.24.0, target `node22-win-x64` (pkg-fetch 3.6 no longer publishes Node 20 Windows binaries).

```bash
npm ci
npm run pack:win
```

CI: `.github/workflows/migration-agent-windows.yml` packs the exe, runs `--self-test`, records SHA-256, and uploads a private artifact. Do not ship that artifact to customers until it is Authenticode-signed.

## Security

- Token is revocable from Gates admin.
- Only SELECT operations; table allowlist enforced on server and connector.
