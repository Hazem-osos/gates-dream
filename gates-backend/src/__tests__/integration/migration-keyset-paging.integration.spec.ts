/**
 * Regression: legacy voucher paging must return every posted journal exactly once.
 *
 * Bug (fixed 2026-10-27): loadPostedJournalBatch filtered the next page on the
 * zero-padded key Year|Branch|00000009 but sorted by the raw GlNum ('10' < '9').
 * With unpadded voucher numbers and more than one page, vouchers were skipped or
 * read twice. Same family: invoice / cash / cheque / settlement / setting readers.
 *
 * Runs against a REAL SQL Server only when MIGRATION_TEST_MSSQL_URL is set
 * (a disposable test instance — e.g. a local Developer container). It creates and
 * drops its own uniquely named database; it never touches an existing one.
 */
import { randomBytes } from 'node:crypto';
import type { ConnectionPool } from 'mssql';
import { LegacyGatesSqlServerAdapter } from '../../modules/migration-engine/adapters/legacy-gates-sqlserver.adapter';
import { loadPostedJournalBatch } from '../../modules/migration-engine/services/legacy-journal-data.service';
import { loadPostedInvoiceHeaderBatch } from '../../modules/migration-engine/services/legacy-commercial-data.service';
import { padGlNum } from '../../modules/migration-engine/transforms/legacy-values';

const baseUrl = process.env.MIGRATION_TEST_MSSQL_URL;
const describeMssql = baseUrl ? describe : describe.skip;

const VOUCHERS_PER_BRANCH = 225; // 450 total: 3 pages of 200, numbers 1..225 unpadded
const BRANCHES = ['01', '02'];
const INVOICE_TYPES = ['S', 'SR']; // 'S|…' sorts after 'SR|…' as a key, before it as a column

function withDatabase(url: string, db: string): string {
  // Accepts the mssql connection-string form: Server=…;Database=…;User Id=…;Password=…
  return /Database=[^;]*/i.test(url) ? url.replace(/Database=[^;]*/i, `Database=${db}`) : `${url};Database=${db}`;
}

describeMssql('legacy keyset paging (real SQL Server)', () => {
  const dbName = `GatesKeysetTest_${randomBytes(4).toString('hex')}`;
  let admin: ConnectionPool;
  let adapter: LegacyGatesSqlServerAdapter;

  beforeAll(async () => {
    const mssql = (await import('mssql')).default;
    admin = await mssql.connect(withDatabase(baseUrl!, 'master'));
    await admin.request().query(`CREATE DATABASE [${dbName}]`);
    const pool = await new mssql.ConnectionPool(withDatabase(baseUrl!, dbName)).connect();
    await pool.request().query(`
      CREATE TABLE dbo.GLTrxHeader (
        CompanyCode VARCHAR(10) NOT NULL, BranchCode VARCHAR(10), YearID VARCHAR(10), GlNum VARCHAR(20),
        Date DATETIME, DateH VARCHAR(20), DescA NVARCHAR(100), DescE NVARCHAR(100), CurrencyCode VARCHAR(10),
        Status VARCHAR(10), Deleted VARCHAR(5), Type VARCHAR(10), SourceNum VARCHAR(20), GLInvoiceType VARCHAR(10),
        UserCode VARCHAR(10), Balanced VARCHAR(5), IdNum INT IDENTITY(1,1));
      CREATE TABLE dbo.GLTrxDetail (
        CompanyCode VARCHAR(10) NOT NULL, BranchCode VARCHAR(10), YearID VARCHAR(10), GLNum VARCHAR(20),
        DetailNum DECIMAL(9,0), AccountNo NVARCHAR(30), DebitValue DECIMAL(19,4), CreditValue DECIMAL(19,4),
        Change DECIMAL(19,6), IdNum INT IDENTITY(1,1));
      CREATE TABLE dbo.InvoiceTrxHeader (
        CompanyCode VARCHAR(10) NOT NULL, BranchCode VARCHAR(10), YearID VARCHAR(10), Type VARCHAR(10),
        InvoiceNum VARCHAR(20), Status VARCHAR(10), Deleted VARCHAR(5), Date DATETIME, DateH VARCHAR(20),
        GLNum VARCHAR(20), SupplierAccountCode NVARCHAR(30), StoreCode VARCHAR(20), CurrencyCode VARCHAR(10),
        Change DECIMAL(19,6), TotalAmount DECIMAL(19,4), OfferAmount DECIMAL(19,4), SalesDaribaAmount DECIMAL(19,4),
        NetAmount DECIMAL(19,4), PaidAmount DECIMAL(19,4), CashType VARCHAR(10), ReturnInvoiceType VARCHAR(10),
        ReturnInvoiceNum VARCHAR(20), ReturnInvoiceYearID VARCHAR(10), SourceType VARCHAR(10), SourceNum VARCHAR(20),
        DescA NVARCHAR(100), DescE NVARCHAR(100), AllowReturn VARCHAR(5), Days DECIMAL(9,0), AffectStore VARCHAR(5),
        CCenter NVARCHAR(30), OrderNum VARCHAR(20), OrderType VARCHAR(10), OrderYearID VARCHAR(10),
        IsPeriodic VARCHAR(5), PayAccount NVARCHAR(30), EtmadCode VARCHAR(20), IANum VARCHAR(20),
        IAYearId VARCHAR(10), IAType VARCHAR(10), UserCode VARCHAR(10));`);
    for (const branch of BRANCHES) {
      for (let n = 1; n <= VOUCHERS_PER_BRANCH; n += 1) {
        await pool.request().query(`
          INSERT dbo.GLTrxHeader (CompanyCode, BranchCode, YearID, GlNum, Date, Status, Deleted, Type, Balanced)
          VALUES ('0001', '${branch}', '2026', '${n}', '2026-01-01', 'Post', 'F', 'GL01', 'T');
          INSERT dbo.GLTrxDetail (CompanyCode, BranchCode, YearID, GLNum, DetailNum, AccountNo, DebitValue, CreditValue, Change)
          VALUES ('0001', '${branch}', '2026', '${n}', 1, '1010101', ${n}, 0, 1),
                 ('0001', '${branch}', '2026', '${n}', 2, '4010101', 0, ${n}, 1);`);
      }
      for (const type of INVOICE_TYPES) {
        for (let n = 1; n <= 120; n += 1) {
          await pool.request().query(`
            INSERT dbo.InvoiceTrxHeader (CompanyCode, BranchCode, YearID, Type, InvoiceNum, Status, Deleted)
            VALUES ('0001', '${branch}', '2026', '${type}', '${n}', 'Post', 'F');`);
        }
      }
    }
    await pool.close();
    adapter = new LegacyGatesSqlServerAdapter(withDatabase(baseUrl!, dbName));
  }, 300_000);

  afterAll(async () => {
    await adapter?.close();
    if (admin) {
      await admin.request().query(
        `IF DB_ID('${dbName}') IS NOT NULL BEGIN ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${dbName}]; END`
      );
      await admin.close();
    }
  }, 120_000);

  it('adapter reads its own database even when a global mssql pool already exists', async () => {
    // beforeAll opened the global pool on master via mssql.connect(); the adapter must
    // not silently reuse it.
    expect(await adapter.getDatabaseName()).toBe(dbName);
  });

  it('the pre-fix query pattern really loses or repeats vouchers on this data', async () => {
    // Old SQL: padded-key filter, raw-column sort, cursor from the last row's padded key.
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 20; guard += 1) {
      const rows: Array<{ YearID: string; BranchCode: string; GlNum: string }> = await adapter.querySql(
        `SELECT TOP (200) YearID, BranchCode, GlNum FROM dbo.GLTrxHeader h
         WHERE RTRIM(h.CompanyCode)=@cc
           ${cursor ? `AND (RTRIM(h.YearID)+'|'+RTRIM(h.BranchCode)+'|'+RIGHT('00000000'+RTRIM(h.GlNum),8)) > @cursor` : ''}
         ORDER BY YearID, BranchCode, GlNum`,
        { cc: '0001', ...(cursor ? { cursor } : {}) }
      );
      for (const r of rows) seen.push(`${r.BranchCode.trim()}|${padGlNum(r.GlNum)}`);
      if (rows.length < 200) break;
      const last = rows[rows.length - 1];
      cursor = `${last.YearID.trim()}|${last.BranchCode.trim()}|${padGlNum(last.GlNum)}`;
    }
    const unique = new Set(seen);
    const broken = unique.size !== BRANCHES.length * VOUCHERS_PER_BRANCH || seen.length !== unique.size;
    expect(broken).toBe(true);
  });

  it('loadPostedJournalBatch returns every posted voucher exactly once, with its lines', async () => {
    const seen: string[] = [];
    let lineCount = 0;
    let cursor: string | null = null;
    for (let guard = 0; guard < 20; guard += 1) {
      const batch = await loadPostedJournalBatch(adapter, '0001', cursor, 200);
      for (const h of batch.headers) seen.push(`${String(h.BranchCode).trim()}|${padGlNum(h.GlNum)}`);
      lineCount += batch.lines.length;
      expect(batch.headers.every((h) => !('__cursorKey' in (h as object)))).toBe(true);
      if (!batch.nextCursor) break;
      cursor = batch.nextCursor;
    }
    expect(seen.length).toBe(BRANCHES.length * VOUCHERS_PER_BRANCH);
    expect(new Set(seen).size).toBe(seen.length);
    expect(lineCount).toBe(seen.length * 2);
  });

  it('loadPostedInvoiceHeaderBatch returns every invoice exactly once across S / SR types', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 20; guard += 1) {
      const page = await loadPostedInvoiceHeaderBatch(adapter, '0001', cursor, 200);
      for (const r of page.rows) {
        seen.push(`${String(r.BranchCode).trim()}|${String(r.Type).trim()}|${String(r.InvoiceNum).trim()}`);
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen.length).toBe(BRANCHES.length * INVOICE_TYPES.length * 120);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
