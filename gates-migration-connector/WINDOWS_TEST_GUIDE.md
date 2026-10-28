# Windows smoke test — GatesMigrationAgent.exe

Internal testers only. Do **not** send this unsigned EXE to customers. Do **not** pair it to production Gates. Do **not** deploy Railway. Do **not** point `sqlcmd` at a customer or production database.

Windows execution has **not** been run yet. Treat every box below as unchecked until a Windows machine produces the captured output.

## 1. Artifact identity (macOS pack, 2026-10-25)

The packer wrote a PE file, then `dist-exe/` was gitignored. This repo does **not** currently contain `GatesMigrationAgent.exe`. Copy the file that was packed on the Mac (or a later GitHub Actions artifact with a **new** hash) onto the Windows PC.

| Field | Expected for the 2026-10-25 Mac pack |
|-------|--------------------------------------|
| File name | `GatesMigrationAgent.exe` |
| Kind | PE32+ console x86-64 for MS Windows (`MZ` header) |
| Size | about 101 MB |
| SHA-256 | `1743aa1b0470d94ea16de9e13cbfdb0955fac05ccfc62cd0213b85b5aa504c16` |
| `--version` | `GatesMigrationAgent 0.2.0` |
| `--self-test` | `GatesMigrationAgent 0.2.0 self-test ok` and exit `0` |

If the hash does not match, **stop**. You are not testing the recorded binary. Record the new hash; do not reuse this table.

## 2. Copy onto Windows

On the Windows PC (PowerShell, not as Administrator):

```powershell
New-Item -ItemType Directory -Force -Path C:\GatesMigrationTest | Out-Null
# Copy GatesMigrationAgent.exe into C:\GatesMigrationTest\
Set-Location C:\GatesMigrationTest
$exe = Join-Path (Get-Location) "GatesMigrationAgent.exe"
```

Unsigned binaries may show SmartScreen. For this **internal** smoke only, keep the file local. Do not tell customers to click through SmartScreen. Do not right-click → Run as administrator — the agent does not need a Windows admin token.

## 3. Completeness check

```powershell
$exe = "C:\GatesMigrationTest\GatesMigrationAgent.exe"
if (-not (Test-Path -LiteralPath $exe)) { throw "EXE missing at $exe" }

$item = Get-Item -LiteralPath $exe
"length_bytes=$($item.Length)"
if ($item.Length -lt 10MB) { throw "EXE is too small to be the packed agent" }

$fs = [System.IO.File]::OpenRead($exe)
try {
  $mz = New-Object byte[] 2
  [void]$fs.Read($mz, 0, 2)
} finally { $fs.Close() }
$header = [System.Text.Encoding]::ASCII.GetString($mz)
"header=$header"
if ($header -ne "MZ") { throw "Not a Windows PE file" }

$expected = "1743aa1b0470d94ea16de9e13cbfdb0955fac05ccfc62cd0213b85b5aa504c16"
$hash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLower()
"sha256=$hash"
if ($hash -ne $expected) {
  throw "SHA-256 mismatch. expected=$expected actual=$hash"
}
"completeness_ok"
```

Pass only if you see `completeness_ok`. Capture the full console text.

## 4. `--version` (stdout, stderr, exit code)

```powershell
$exe = "C:\GatesMigrationTest\GatesMigrationAgent.exe"
$out = "C:\GatesMigrationTest\agent-version.out.txt"
$err = "C:\GatesMigrationTest\agent-version.err.txt"
Remove-Item $out, $err -ErrorAction SilentlyContinue
$p = Start-Process -FilePath $exe -ArgumentList "--version" -Wait -PassThru -NoNewWindow `
  -RedirectStandardOutput $out -RedirectStandardError $err
"exit=$($p.ExitCode)"
"--- stdout ---"
Get-Content -LiteralPath $out -Raw
"--- stderr ---"
Get-Content -LiteralPath $err -Raw
```

Expected: exit `0`, stdout exactly `GatesMigrationAgent 0.2.0` (optional trailing newline), stderr empty. If the process hangs, it is not `--version` — stop and capture Task Manager command line.

## 5. `--self-test`

```powershell
$exe = "C:\GatesMigrationTest\GatesMigrationAgent.exe"
$out = "C:\GatesMigrationTest\agent-self-test.out.txt"
$err = "C:\GatesMigrationTest\agent-self-test.err.txt"
Remove-Item $out, $err -ErrorAction SilentlyContinue
$p = Start-Process -FilePath $exe -ArgumentList "--self-test" -Wait -PassThru -NoNewWindow `
  -RedirectStandardOutput $out -RedirectStandardError $err
"exit=$($p.ExitCode)"
"--- stdout ---"
Get-Content -LiteralPath $out -Raw
"--- stderr ---"
Get-Content -LiteralPath $err -Raw
$stdout = Get-Content -LiteralPath $out -Raw
if ($p.ExitCode -ne 0) { throw "self-test exit $($p.ExitCode)" }
if ($stdout -notmatch "self-test ok") { throw "self-test output missing" }
"self_test_ok"
```

Expected: exit `0`, stdout contains `GatesMigrationAgent 0.2.0 self-test ok`. This loads bundled JS (`connector-ops`, restore-plan helpers). It does **not** open SQL Server and does **not** call Gates.

## 6. SQL Server + sqlcmd (connectivity only)

Install [sqlcmd](https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-utility) if `Get-Command sqlcmd` fails. Use a **local** instance (Developer / Express). Never production.

Do **not** pass the password on the command line (`-P`). Match the agent: `SQLCMDPASSWORD`.

```powershell
Get-Command sqlcmd | Format-List Source
sqlcmd -? | Select-Object -First 1

$server = "localhost"   # or localhost\SQLEXPRESS
$login  = "gates_mig_test"  # created by SYNTHETIC_SQL_TEST.sql — never sa
$env:SQLCMDPASSWORD = "LOCAL_ONLY_PASSWORD"  # not production; not committed

sqlcmd -S $server -U $login -C -Q "SELECT @@SERVERNAME AS server_name, SUSER_SNAME() AS login_name, IS_SRVROLEMEMBER('sysadmin') AS is_sysadmin;"
"sqlcmd_exit=$LASTEXITCODE"
Remove-Item Env:SQLCMDPASSWORD
```

Pass when: exit `0`, `login_name` is `gates_mig_test`, `is_sysadmin` is `0`. If `Login failed` or sqlcmd is missing, stop — restore testing is not ready.

Refuse these hosts / databases:

- Any Railway MySQL (`rlwy.net`) or production Gates `DATABASE_URL`
- Customer live SQL Server
- Login `sa`

## 7. What this guide does not prove

| Check | Status until Windows output exists |
|-------|-------------------------------------|
| EXE starts on Windows | Not run |
| `--version` / `--self-test` on Windows | Not run |
| SQL restore through the agent | Not run — see `LOCAL_RESTORE_TEST.md` |
| Pairing / ten-stage engine | Not run |

Next file: `SYNTHETIC_SQL_TEST.sql`, then `LOCAL_RESTORE_TEST.md`.
