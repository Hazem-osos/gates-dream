# Migrate from your computer

Gates stays on Railway. SQL Server stays on the Windows machine. The agent only makes outbound HTTPS calls. It does not open port 1433 and it does not send the SQL password to the browser or to Railway.

## Customer steps

1. In Gates, open ترحيل قواعد البيانات and choose **الترحيل من جهازي**.
2. Create a pairing code. It works once and expires in 15 minutes.
3. On the Windows PC that can see SQL Server, run `GatesMigrationAgent.exe`.
4. Enter the API address (`https://<backend>/api/v1/migration-engine`) and the code.
5. Choose an existing database, or a local `.bak`. For a `.bak` the agent shows the newest full backup in the file (database name and date) and restores it only after you type `YES`, into a new database named `GatesAgentRestore_…_<date>` using `WITH MOVE`. The original database is not dropped or overwritten. Do not use `sa` or any administrator login — see `SETUP_AND_TROUBLESHOOTING.md` for the read-only login script.
6. Return to Gates and press **ترحيل الآن**. The existing ten-stage engine reads through the agent.

The connector token is stored only on that PC (`%USERPROFILE%\.gates-migration-agent\session.json`) so a restart can reuse the pairing; it expires after 7 days (`MIGRATION_CONNECTOR_TOKEN_TTL_MS`). Revoke it from the wizard if the PC is lost — the agent then deletes it.

## Build the exe (on a developer machine, not the customer)

Packaging uses pinned `@yao-pkg/pkg` 6.24.0 and `node22-win-x64`. Node 20 Windows runtimes are not published in pkg-fetch 3.6.

```bash
cd gates-migration-connector
npm ci
npm run pack:win
```

On Windows, verify the exe starts:

```powershell
.\dist-exe\GatesMigrationAgent.exe --self-test
```

The output is `dist-exe/GatesMigrationAgent.exe`. The customer does not install Node. Unsigned GitHub Actions artifacts are for internal testing only.

## What was not executed

No Windows exe was built in this session, and no real `.bak` was restored. Unit tests cover the restore name, the refusal to overwrite, and the refusal of `sa`.
