#!/usr/bin/env bash
set -euo pipefail
COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$COMPOSE_DIR/audit-out"
SA_PASSWORD="${MSSQL_SA_PASSWORD:-GatesForensic_LocalOnly_ChangeMe!}"
COMPOSE=(docker compose -f "$COMPOSE_DIR/docker-compose.yml")
BASE=(exec -T legacy-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -d LegacyForensic -h -1 -W)

mkdir -p "$OUT"

run_q() {
  local name="$1"
  local sql="$2"
  echo ">> $name"
  "${COMPOSE[@]}" "${BASE[@]}" -Q "$sql" > "$OUT/${name}.txt" 2>"$OUT/${name}.err" || true
}

run_q "metadata_tables" "SELECT COUNT(*) AS user_tables FROM sys.tables WHERE is_ms_shipped=0"
run_q "metadata_fk" "SELECT COUNT(*) AS fk_count FROM sys.foreign_keys"
run_q "metadata_pk" "SELECT COUNT(*) AS pk_count FROM sys.indexes i JOIN sys.tables t ON t.object_id=i.object_id WHERE i.is_primary_key=1 AND t.is_ms_shipped=0"
run_q "metadata_views" "SELECT COUNT(*) FROM sys.views WHERE is_ms_shipped=0"
run_q "metadata_procedures" "SELECT COUNT(*) FROM sys.procedures WHERE is_ms_shipped=0"
run_q "metadata_functions" "SELECT COUNT(*) FROM sys.objects WHERE type IN ('FN','IF','TF') AND is_ms_shipped=0"
run_q "metadata_triggers" "SELECT COUNT(*) FROM sys.triggers WHERE parent_class=1"

run_q "top50_tables" "
SELECT TOP 50 s.name+'.'+o.name AS tbl, SUM(p.rows) AS row_count
FROM sys.tables o
JOIN sys.schemas s ON s.schema_id=o.schema_id
JOIN sys.partitions p ON p.object_id=o.object_id AND p.index_id IN (0,1)
WHERE o.is_ms_shipped=0
GROUP BY s.name, o.name ORDER BY row_count DESC"

run_q "companies" "SELECT CompanyCode, RTRIM(CompanyNameA) AS name FROM dbo.Company"
run_q "accounting_summary" "
SELECT
  SUM(CASE WHEN UPPER(RTRIM(Status))='POST' AND ISNULL(RTRIM(Deleted),'F')<>'T' THEN 1 ELSE 0 END) AS posted,
  SUM(CASE WHEN UPPER(RTRIM(Status))<>'POST' AND ISNULL(RTRIM(Deleted),'F')<>'T' THEN 1 ELSE 0 END) AS draft,
  SUM(CASE WHEN ISNULL(RTRIM(Deleted),'F')='T' THEN 1 ELSE 0 END) AS deleted
FROM dbo.GLTrxHeader"

run_q "accounting_totals" "
SELECT
  SUM(CASE WHEN UPPER(RTRIM(h.Status))='POST' AND ISNULL(RTRIM(h.Deleted),'F')<>'T' THEN d.DebitValue*ISNULL(d.Change,1) ELSE 0 END) AS debit_base,
  SUM(CASE WHEN UPPER(RTRIM(h.Status))='POST' AND ISNULL(RTRIM(h.Deleted),'F')<>'T' THEN d.CreditValue*ISNULL(d.Change,1) ELSE 0 END) AS credit_base
FROM dbo.GLTrxHeader h
JOIN dbo.GLTrxDetail d ON d.CompanyCode=h.CompanyCode AND d.BranchCode=h.BranchCode AND d.YearID=h.YearID AND d.GLNum=h.GlNum"

run_q "accounting_unbalanced" "SELECT COUNT(*) AS unbalanced FROM (
  SELECT h.GlNum FROM dbo.GLTrxHeader h
  JOIN dbo.GLTrxDetail d ON d.CompanyCode=h.CompanyCode AND d.BranchCode=h.BranchCode AND d.YearID=h.YearID AND d.GLNum=h.GlNum
  WHERE UPPER(RTRIM(h.Status))='POST' AND ISNULL(RTRIM(h.Deleted),'F')<>'T'
  GROUP BY h.CompanyCode,h.BranchCode,h.YearID,h.GlNum
  HAVING ABS(SUM((d.DebitValue-d.CreditValue)*ISNULL(d.Change,1)))>0.01) x"

run_q "opening_counts" "
SELECT 'BalanceAccountsH' src, COUNT(*) cnt FROM dbo.BalanceAccountsH UNION ALL
SELECT 'BalanceAccountsD', COUNT(*) FROM dbo.BalanceAccountsD UNION ALL
SELECT 'ItemsFirstTimeH', COUNT(*) FROM dbo.ItemsFirstTimeH UNION ALL
SELECT 'ItemsFirstTimeD', COUNT(*) FROM dbo.ItemsFirstTimeD"

run_q "critical_counts" "
SELECT 'GLTrxHeader' t, COUNT(*) c FROM dbo.GLTrxHeader UNION ALL
SELECT 'GLTrxDetail', COUNT(*) FROM dbo.GLTrxDetail UNION ALL
SELECT 'InvoiceTrxHeader', COUNT(*) FROM dbo.InvoiceTrxHeader UNION ALL
SELECT 'InvoiceTrxDetail', COUNT(*) FROM dbo.InvoiceTrxDetail UNION ALL
SELECT 'Item', COUNT(*) FROM dbo.Item UNION ALL
SELECT 'ItemStore', COUNT(*) FROM dbo.ItemStore UNION ALL
SELECT 'Store', COUNT(*) FROM dbo.Store UNION ALL
SELECT 'Customer', COUNT(*) FROM dbo.Customer UNION ALL
SELECT 'Supplier', COUNT(*) FROM dbo.Supplier UNION ALL
SELECT 'Account', COUNT(*) FROM dbo.Account UNION ALL
SELECT 'CashTrxHeader', COUNT(*) FROM dbo.CashTrxHeader UNION ALL
SELECT 'StoreTransHeader', COUNT(*) FROM dbo.StoreTransHeader UNION ALL
SELECT 'StoreTransDetail', COUNT(*) FROM dbo.StoreTransDetail"

run_q "inventory_itemstore" "SELECT COUNT(*) rows, SUM(CASE WHEN Qty<0 THEN 1 ELSE 0 END) neg, SUM(CASE WHEN Qty=0 THEN 1 ELSE 0 END) zero FROM dbo.ItemStore"

run_q "inventory_match" "
;WITH mov AS (
  SELECT CompanyCode,ItemCode,StoreCode,SUM(ISNULL(TransMainQty,Qty)) mov_qty FROM dbo.StoreTransDetail GROUP BY CompanyCode,ItemCode,StoreCode)
SELECT COUNT(*) pairs,
  SUM(CASE WHEN ABS(ISNULL(s.Qty,0)-ISNULL(m.mov_qty,0))<0.0001 THEN 1 ELSE 0 END) match_ok,
  SUM(CASE WHEN ABS(ISNULL(s.Qty,0)-ISNULL(m.mov_qty,0))>=0.0001 THEN 1 ELSE 0 END) mismatch
FROM dbo.ItemStore s FULL OUTER JOIN mov m ON m.CompanyCode=s.CompanyCode AND m.ItemCode=s.ItemCode AND m.StoreCode=s.StoreCode"

run_q "quality_orphan_gl" "
SELECT COUNT(*) FROM dbo.GLTrxDetail d
LEFT JOIN dbo.Account a ON a.CompanyCode=d.CompanyCode AND RTRIM(a.AccountCode)=RTRIM(d.AccountNo)
WHERE a.AccountCode IS NULL"

run_q "quality_dup_accounts" "SELECT COUNT(*) FROM (SELECT CompanyCode,AccountCode FROM dbo.Account GROUP BY CompanyCode,AccountCode HAVING COUNT(*)>1) x"

run_q "invoice_gl_link" "
SELECT COUNT(*) total,
  SUM(CASE WHEN RTRIM(ISNULL(GLNum,''))<>'' THEN 1 ELSE 0 END) with_gl,
  SUM(CASE WHEN UPPER(RTRIM(Status))='POST' AND RTRIM(ISNULL(GLNum,''))<>'' THEN 1 ELSE 0 END) posted_with_gl
FROM dbo.InvoiceTrxHeader"

run_q "total_rows" "
SELECT SUM(p.rows) FROM sys.partitions p JOIN sys.tables t ON t.object_id=p.object_id AND t.is_ms_shipped=0 WHERE p.index_id IN (0,1)"

run_q "procedure_names" "SELECT name FROM sys.procedures WHERE is_ms_shipped=0 ORDER BY name"

run_q "procedure_sizes" "
SELECT o.name, LEN(m.definition) def_len
FROM sys.procedures o JOIN sys.sql_modules m ON m.object_id=o.object_id
WHERE o.is_ms_shipped=0 ORDER BY o.name"

run_q "gl_types" "
SELECT RTRIM(Type) gl_type, COUNT(*) cnt FROM dbo.GLTrxHeader
WHERE UPPER(RTRIM(Status))='POST' AND ISNULL(RTRIM(Deleted),'F')<>'T'
GROUP BY RTRIM(Type) ORDER BY cnt DESC"

run_q "invoice_by_status" "
SELECT UPPER(RTRIM(Status)) st, COUNT(*) FROM dbo.InvoiceTrxHeader GROUP BY UPPER(RTRIM(Status))"

run_q "per_company_gl" "
SELECT h.CompanyCode, COUNT(DISTINCT h.GlNum) posted_je
FROM dbo.GLTrxHeader h
WHERE UPPER(RTRIM(h.Status))='POST' AND ISNULL(RTRIM(h.Deleted),'F')<>'T'
GROUP BY h.CompanyCode"

# Procedure bodies to host file (stdout)
"${COMPOSE[@]}" "${BASE[@]}" -y 0 -Q "
SELECT '-- '+o.name+CHAR(10)+m.definition+CHAR(10)+'GO'+CHAR(10)
FROM sys.procedures o JOIN sys.sql_modules m ON m.object_id=o.object_id
WHERE o.is_ms_shipped=0 ORDER BY o.name" > "$OUT/procedure_bodies.sql" 2>"$OUT/procedure_bodies.err" || true

echo "Forensic sqlcmd complete: $OUT"
