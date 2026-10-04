/* Extended read-only forensic queries — Phase 0.5 */

-- @@SECTION identity
SELECT DB_NAME() AS database_name, COUNT(*) AS user_table_count
FROM sys.tables WHERE is_ms_shipped = 0;

-- @@SECTION programmability_counts
SELECT o.type_desc, COUNT(*) AS cnt
FROM sys.objects o
WHERE o.type IN ('P','V','FN','IF','TF','TR')
GROUP BY o.type_desc ORDER BY cnt DESC;

-- @@SECTION companies
SELECT CompanyCode, RTRIM(CompanyNameA) AS name_a FROM dbo.Company ORDER BY CompanyCode;

-- @@SECTION branches
SELECT CompanyCode, BranchCode, COUNT(*) AS cnt FROM dbo.Branch GROUP BY CompanyCode, BranchCode;

-- @@SECTION accounting_summary
SELECT
  SUM(CASE WHEN UPPER(RTRIM(Status)) = 'POST' AND ISNULL(RTRIM(Deleted),'F') <> 'T' THEN 1 ELSE 0 END) AS posted_headers,
  SUM(CASE WHEN UPPER(RTRIM(Status)) <> 'POST' AND ISNULL(RTRIM(Deleted),'F') <> 'T' THEN 1 ELSE 0 END) AS draft_headers,
  SUM(CASE WHEN ISNULL(RTRIM(Deleted),'F') = 'T' THEN 1 ELSE 0 END) AS deleted_headers
FROM dbo.GLTrxHeader;

-- @@SECTION accounting_totals
SELECT
  SUM(CASE WHEN UPPER(RTRIM(h.Status)) = 'POST' AND ISNULL(RTRIM(h.Deleted),'F') <> 'T' THEN d.DebitValue * ISNULL(d.Change,1) ELSE 0 END) AS total_debit_base,
  SUM(CASE WHEN UPPER(RTRIM(h.Status)) = 'POST' AND ISNULL(RTRIM(h.Deleted),'F') <> 'T' THEN d.CreditValue * ISNULL(d.Change,1) ELSE 0 END) AS total_credit_base
FROM dbo.GLTrxHeader h
JOIN dbo.GLTrxDetail d ON d.CompanyCode = h.CompanyCode AND d.BranchCode = h.BranchCode
  AND d.YearID = h.YearID AND d.GLNum = h.GlNum;

-- @@SECTION accounting_unbalanced_count
SELECT COUNT(*) AS unbalanced_posted_count FROM (
  SELECT h.CompanyCode, h.BranchCode, h.YearID, h.GlNum
  FROM dbo.GLTrxHeader h
  JOIN dbo.GLTrxDetail d ON d.CompanyCode = h.CompanyCode AND d.BranchCode = h.BranchCode
    AND d.YearID = h.YearID AND d.GLNum = h.GlNum
  WHERE UPPER(RTRIM(h.Status)) = 'POST' AND ISNULL(RTRIM(h.Deleted),'F') <> 'T'
  GROUP BY h.CompanyCode, h.BranchCode, h.YearID, h.GlNum
  HAVING ABS(SUM((d.DebitValue - d.CreditValue) * ISNULL(d.Change,1))) > 0.01
) x;

-- @@SECTION opening_counts
SELECT 'BalanceAccountsH' AS src, COUNT(*) AS cnt FROM dbo.BalanceAccountsH
UNION ALL SELECT 'BalanceAccountsD', COUNT(*) FROM dbo.BalanceAccountsD
UNION ALL SELECT 'ItemsFirstTimeH', COUNT(*) FROM dbo.ItemsFirstTimeH
UNION ALL SELECT 'ItemsFirstTimeD', COUNT(*) FROM dbo.ItemsFirstTimeD
UNION ALL SELECT 'GL_Type_sample', COUNT(*) FROM dbo.GLTrxHeader WHERE RTRIM(Type) IN ('1','2','3','4','5','6','7','8','9','0');

-- @@SECTION gl_types
SELECT RTRIM(Type) AS gl_type, COUNT(*) AS cnt
FROM dbo.GLTrxHeader
WHERE UPPER(RTRIM(Status))='POST' AND ISNULL(RTRIM(Deleted),'F')<>'T'
GROUP BY RTRIM(Type) ORDER BY cnt DESC;

-- @@SECTION inventory_itemstore
SELECT COUNT(*) AS itemstore_rows, SUM(CASE WHEN Qty < 0 THEN 1 ELSE 0 END) AS negative_qty_rows,
  SUM(CASE WHEN Qty = 0 THEN 1 ELSE 0 END) AS zero_qty_rows
FROM dbo.ItemStore;

-- @@SECTION inventory_match
;WITH mov AS (
  SELECT CompanyCode, ItemCode, StoreCode, SUM(ISNULL(TransMainQty, Qty)) AS mov_qty
  FROM dbo.StoreTransDetail
  GROUP BY CompanyCode, ItemCode, StoreCode
)
SELECT
  COUNT(*) AS pairs_compared,
  SUM(CASE WHEN ABS(ISNULL(s.Qty,0) - ISNULL(m.mov_qty,0)) < 0.0001 THEN 1 ELSE 0 END) AS exact_match,
  SUM(CASE WHEN ABS(ISNULL(s.Qty,0) - ISNULL(m.mov_qty,0)) >= 0.0001 THEN 1 ELSE 0 END) AS mismatch
FROM dbo.ItemStore s
FULL OUTER JOIN mov m ON m.CompanyCode = s.CompanyCode AND m.ItemCode = s.ItemCode AND m.StoreCode = s.StoreCode;

-- @@SECTION commercial_invoices
SELECT
  SUM(CASE WHEN UPPER(RTRIM(Status))='POST' THEN 1 ELSE 0 END) AS posted_inv,
  SUM(CASE WHEN UPPER(RTRIM(Status))<>'POST' THEN 1 ELSE 0 END) AS unposted_inv,
  COUNT(*) AS total_inv
FROM dbo.InvoiceTrxHeader;

-- @@SECTION quality_orphan_gl
SELECT COUNT(*) AS orphan_gl_lines
FROM dbo.GLTrxDetail d
LEFT JOIN dbo.Account a ON a.CompanyCode = d.CompanyCode AND RTRIM(a.AccountCode) = RTRIM(d.AccountNo)
WHERE a.AccountCode IS NULL;

-- @@SECTION quality_dup_accounts
SELECT COUNT(*) AS duplicate_account_groups FROM (
  SELECT CompanyCode, AccountCode FROM dbo.Account GROUP BY CompanyCode, AccountCode HAVING COUNT(*) > 1
) d;

-- @@SECTION fk_count
SELECT COUNT(*) AS fk_count FROM sys.foreign_keys;

-- @@SECTION pk_count
SELECT COUNT(*) AS pk_count FROM sys.indexes WHERE is_primary_key = 1 AND object_id IN (SELECT object_id FROM sys.tables WHERE is_ms_shipped=0);

-- @@SECTION invoice_gl_link
SELECT
  SUM(CASE WHEN RTRIM(ISNULL(GLNum,'')) <> '' THEN 1 ELSE 0 END) AS with_glnum,
  SUM(CASE WHEN UPPER(RTRIM(Status))='POST' AND RTRIM(ISNULL(GLNum,'')) <> '' THEN 1 ELSE 0 END) AS posted_with_gl
FROM dbo.InvoiceTrxHeader;

-- @@SECTION total_rows
SELECT SUM(p.rows) AS total_rows
FROM sys.partitions p
JOIN sys.tables t ON t.object_id = p.object_id AND t.is_ms_shipped = 0
WHERE p.index_id IN (0,1);
