/**
 * Pre-import data check (read-only, legacy source only).
 *
 * One pass over the legacy database that lists, before anything is written, every condition
 * that would stop a 100% migration — and what the owner should do about it:
 *   ADD    — a master row the documents need is missing (item, unit, store, party)
 *   FIX    — a document is inconsistent (unbalanced journal, posted invoice with no journal…)
 *   IGNORE — rows that carry no value and are skipped safely (orphans, zero cheques)
 * Each check records one issue (category PREFLIGHT_<CODE>) with an Arabic description and
 * samples. Re-running Analyze resolves checks that no longer fire.
 */
import type { MigrationContext } from '../migration-context';
import type { MigrationIssueSeverity } from '../types';
import { legacyTableExists } from '../accounting-source-profile';
import { legacyTrim } from '../transforms/legacy-values';
import { mapLegacyInvoiceKind } from '../transforms/commercial-document-transform';
import { invoiceStockSign } from '../inventory/inventory-decision';
import { loadLegacyPartySnapshot } from './legacy-party-data.service';

export type PreflightAction = 'ADD' | 'FIX' | 'IGNORE';

export interface PreflightFinding {
  code: string;
  action: PreflightAction;
  severity: MigrationIssueSeverity;
  count: number;
  messageAr: string;
  samples: string[];
}

const POSTED = `RTRIM(h.Status)='Post' AND RTRIM(ISNULL(h.Deleted,''))<>'T'`;
const PAD8 = (expr: string) => `RIGHT('00000000'+RTRIM(ISNULL(${expr},'')),8)`;
const SAMPLE_LIMIT = 15;

type Check = {
  code: string;
  action: PreflightAction;
  severity: MigrationIssueSeverity;
  tables: string[];
  messageAr: (n: number) => string;
  /** Returns one display key per offending row. */
  run: (ctx: MigrationContext) => Promise<string[]>;
};

async function keys(ctx: MigrationContext, sql: string): Promise<string[]> {
  const rows = await ctx.source.querySql<{ k?: unknown }>(sql, { cc: ctx.legacyCompanyCode });
  return rows.map((r) => legacyTrim(r.k));
}

/**
 * Posted-journal (year|branch) groups whose branch or year the foundation stage will not migrate.
 * Keys match foundation exactly (Branch.BranchCode, Year.YearCode ?? Year.YearID), so the
 * accounting stage would stop on these with JOURNAL_BRANCH_UNMAPPED / JOURNAL_YEAR_UNMAPPED.
 */
export function journalGroupsOutsideFoundation(
  groups: Array<{ y?: unknown; b?: unknown; n?: unknown }>,
  branchRows: Array<Record<string, unknown>>,
  yearRows: Array<Record<string, unknown>>
): string[] {
  const branches = new Set(branchRows.map((r) => legacyTrim(r.BranchCode)));
  const years = new Set(yearRows.map((r) => legacyTrim(r.YearCode ?? r.YearID)));
  return groups
    .filter((g) => !branches.has(legacyTrim(g.b)) || !years.has(legacyTrim(g.y)))
    .map((g) => {
      const missing = [!years.has(legacyTrim(g.y)) && 'سنة', !branches.has(legacyTrim(g.b)) && 'فرع']
        .filter(Boolean)
        .join('+');
      return `${legacyTrim(g.y)}|${legacyTrim(g.b)} (${Number(g.n ?? 0)} قيد، ناقص: ${missing})`;
    });
}

const CHECKS: Check[] = [
  {
    code: 'GL_UNBALANCED',
    action: 'FIX',
    severity: 'BLOCKER',
    tables: ['GLTrxHeader', 'GLTrxDetail'],
    messageAr: (n) => `${n} قيد مرحّل غير متوازن (المدين لا يساوي الدائن). يجب تصحيحه في النظام القديم قبل الترحيل.`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT RTRIM(h.YearID)+'|'+RTRIM(h.BranchCode)+'|'+RTRIM(h.GlNum) AS k
         FROM dbo.GLTrxHeader h
         JOIN dbo.GLTrxDetail d ON d.CompanyCode=h.CompanyCode AND d.BranchCode=h.BranchCode AND d.YearID=h.YearID
          AND d.GLNum=h.GlNum
         WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}
         GROUP BY h.YearID, h.BranchCode, h.GlNum
         HAVING ABS(SUM(CAST(ISNULL(d.DebitValue,0) AS DECIMAL(19,4))*ISNULL(d.Change,1))
                  - SUM(CAST(ISNULL(d.CreditValue,0) AS DECIMAL(19,4))*ISNULL(d.Change,1))) > 0.01`
      ),
  },
  {
    code: 'GL_POSTED_WITHOUT_LINES',
    action: 'FIX',
    severity: 'WARNING',
    tables: ['GLTrxHeader', 'GLTrxDetail'],
    messageAr: (n) => `${n} قيد مرحّل بدون أي سطور. لن يُنقل (لا أثر مالي له) — احذفه أو أكمله في النظام القديم.`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT RTRIM(h.YearID)+'|'+RTRIM(h.BranchCode)+'|'+RTRIM(h.GlNum) AS k
         FROM dbo.GLTrxHeader h
         WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}
           AND NOT EXISTS (SELECT 1 FROM dbo.GLTrxDetail d WHERE d.CompanyCode=h.CompanyCode AND d.BranchCode=h.BranchCode
             AND d.YearID=h.YearID AND d.GLNum=h.GlNum)`
      ),
  },
  {
    code: 'GL_ORPHAN_LINES',
    action: 'IGNORE',
    severity: 'INFO',
    tables: ['GLTrxHeader', 'GLTrxDetail'],
    messageAr: (n) => `${n} سطر قيد بدون رأس قيد. سيتم تجاهلها (يمكن حذفها من النظام القديم).`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT RTRIM(d.YearID)+'|'+RTRIM(d.BranchCode)+'|'+RTRIM(d.GLNum)+'|'+CONVERT(varchar(20), d.DetailNum) AS k
         FROM dbo.GLTrxDetail d
         WHERE RTRIM(d.CompanyCode)=@cc
           AND NOT EXISTS (SELECT 1 FROM dbo.GLTrxHeader h WHERE h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode
             AND h.YearID=d.YearID AND h.GlNum=d.GLNum)`
      ),
  },
  {
    code: 'GL_BRANCH_OR_YEAR_NOT_MIGRATED',
    action: 'ADD',
    severity: 'BLOCKER',
    tables: ['GLTrxHeader', 'Branch', 'Year'],
    messageAr: (n) =>
      `${n} (سنة|فرع) عليها قيود مرحّلة لكن الفرع أو السنة غير موجودين في دليل الفروع/السنوات، فلن تُنقل هذه القيود. أضِف الفرع أو السنة في النظام القديم أو صحّح القيود قبل الترحيل.`,
    run: async (ctx) => {
      const cc = { cc: ctx.legacyCompanyCode };
      const [groups, branches, years] = await Promise.all([
        ctx.source.querySql<{ y?: unknown; b?: unknown; n?: unknown }>(
          `SELECT RTRIM(h.YearID) AS y, RTRIM(h.BranchCode) AS b, COUNT(*) AS n
           FROM dbo.GLTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}
           GROUP BY RTRIM(h.YearID), RTRIM(h.BranchCode)`,
          cc
        ),
        ctx.source.querySql<Record<string, unknown>>(
          `SELECT b.BranchCode FROM dbo.[Branch] b WHERE RTRIM(b.CompanyCode)=@cc`,
          cc
        ),
        ctx.source.querySql<Record<string, unknown>>(`SELECT * FROM dbo.[Year] y WHERE RTRIM(y.CompanyCode)=@cc`, cc),
      ]);
      return journalGroupsOutsideFoundation(groups, branches, years);
    },
  },
  {
    code: 'INVOICE_UNKNOWN_TYPE',
    action: 'FIX',
    severity: 'BLOCKER',
    tables: ['InvoiceTrxHeader'],
    messageAr: (n) => `${n} نوع فاتورة غير معروف (ليس بيع/شراء/مرتجع). يجب تحديد نوعه قبل الترحيل.`,
    run: async (ctx) =>
      (
        await keys(
          ctx,
          `SELECT DISTINCT RTRIM(h.Type) AS k FROM dbo.InvoiceTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc`
        )
      ).filter((t) => !mapLegacyInvoiceKind(t)),
  },
  {
    code: 'INVOICE_STOCK_TYPE_WITHOUT_DIRECTION',
    action: 'FIX',
    severity: 'BLOCKER',
    tables: ['InvoiceTrxHeader'],
    messageAr: (n) =>
      `${n} نوع فاتورة يؤثر على المخزن ولا يُعرف هل يُدخل أم يُخرج بضاعة. يجب تحديد اتجاهه قبل الترحيل.`,
    run: async (ctx) =>
      (
        await keys(
          ctx,
          `SELECT DISTINCT RTRIM(h.Type) AS k FROM dbo.InvoiceTrxHeader h
           WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED} AND RTRIM(ISNULL(h.AffectStore,''))='T'`
        )
      ).filter((t) => invoiceStockSign(t) === null),
  },
  {
    code: 'INVOICE_LINE_ITEM_MISSING',
    action: 'ADD',
    severity: 'BLOCKER',
    tables: ['InvoiceTrxDetail', 'Item'],
    messageAr: (n) => `${n} صنف مستخدم في الفواتير وغير موجود في دليل الأصناف. أضِف هذه الأصناف قبل الترحيل.`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT DISTINCT RTRIM(d.ItemCode) AS k FROM dbo.InvoiceTrxDetail d
         WHERE RTRIM(d.CompanyCode)=@cc AND RTRIM(ISNULL(d.ItemCode,''))<>''
           AND NOT EXISTS (SELECT 1 FROM dbo.Item i WHERE i.CompanyCode=d.CompanyCode AND RTRIM(i.ItemCode)=RTRIM(d.ItemCode))`
      ),
  },
  {
    code: 'INVOICE_LINE_UNIT_MISSING',
    action: 'ADD',
    severity: 'BLOCKER',
    tables: ['InvoiceTrxDetail', 'ItemUnit'],
    messageAr: (n) => `${n} وحدة (صنف|وحدة) مستخدمة في الفواتير وغير معرّفة للصنف. أضِف الوحدة للصنف قبل الترحيل.`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT DISTINCT RTRIM(x.ItemCode)+'|'+RTRIM(x.UnitCode) AS k FROM (
           SELECT d.CompanyCode, d.ItemCode, d.UnitCode1 AS UnitCode FROM dbo.InvoiceTrxDetail d
           UNION ALL SELECT d.CompanyCode, d.ItemCode, d.UnitCode2 FROM dbo.InvoiceTrxDetail d) x
         WHERE RTRIM(x.CompanyCode)=@cc AND RTRIM(ISNULL(x.UnitCode,''))<>''
           AND EXISTS (SELECT 1 FROM dbo.Item i WHERE i.CompanyCode=x.CompanyCode AND RTRIM(i.ItemCode)=RTRIM(x.ItemCode))
           AND NOT EXISTS (SELECT 1 FROM dbo.ItemUnit u WHERE u.CompanyCode=x.CompanyCode
             AND RTRIM(u.ItemCode)=RTRIM(x.ItemCode) AND RTRIM(u.UnitCode)=RTRIM(x.UnitCode))`
      ),
  },
  {
    code: 'DOCUMENT_STORE_MISSING',
    action: 'ADD',
    severity: 'BLOCKER',
    tables: ['InvoiceTrxDetail', 'InvoiceTrxHeader', 'Store'],
    messageAr: (n) => `${n} مخزن مستخدم في الفواتير وغير موجود في دليل المخازن. أضِف هذه المخازن قبل الترحيل.`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT DISTINCT RTRIM(x.StoreCode) AS k FROM (
           SELECT d.CompanyCode, d.StoreCode FROM dbo.InvoiceTrxDetail d
           UNION ALL SELECT h.CompanyCode, h.StoreCode FROM dbo.InvoiceTrxHeader h) x
         WHERE RTRIM(x.CompanyCode)=@cc AND RTRIM(ISNULL(x.StoreCode,''))<>''
           AND NOT EXISTS (SELECT 1 FROM dbo.Store s WHERE s.CompanyCode=x.CompanyCode AND RTRIM(s.StoreCode)=RTRIM(x.StoreCode))`
      ),
  },
  {
    code: 'INVOICE_POSTED_WITHOUT_JOURNAL',
    action: 'FIX',
    severity: 'BLOCKER',
    tables: ['InvoiceTrxHeader', 'GLTrxHeader'],
    messageAr: (n) =>
      `${n} فاتورة مرحّلة بدون قيد محاسبي (GLNum فارغ أو القيد غير موجود/غير مرحّل). أعد ترحيل الفاتورة في النظام القديم أو صحّح رقم القيد.`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT RTRIM(h.YearID)+'|'+RTRIM(h.BranchCode)+'|'+RTRIM(h.Type)+'|'+RTRIM(h.InvoiceNum) AS k
         FROM dbo.InvoiceTrxHeader h
         WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}
           AND NOT EXISTS (SELECT 1 FROM dbo.GLTrxHeader g WHERE g.CompanyCode=h.CompanyCode AND g.BranchCode=h.BranchCode
             AND g.YearID=h.YearID AND ${PAD8('g.GlNum')}=${PAD8('h.GLNum')}
             AND RTRIM(g.Status)='Post' AND RTRIM(ISNULL(g.Deleted,''))<>'T')`
      ),
  },
  {
    code: 'CASH_POSTED_WITHOUT_JOURNAL',
    action: 'FIX',
    severity: 'BLOCKER',
    tables: ['CashTrxHeader', 'GLTrxHeader'],
    messageAr: (n) =>
      `${n} سند قبض/صرف مرحّل بدون قيد محاسبي مرحّل. أعد ترحيل السند في النظام القديم أو صحّح رقم القيد.`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT RTRIM(h.YearID)+'|'+RTRIM(h.BranchCode)+'|'+RTRIM(h.Type)+'|'+RTRIM(h.CashNum) AS k
         FROM dbo.CashTrxHeader h
         WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}
           AND NOT EXISTS (SELECT 1 FROM dbo.GLTrxHeader g WHERE g.CompanyCode=h.CompanyCode AND g.BranchCode=h.BranchCode
             AND g.YearID=h.YearID AND ${PAD8('g.GlNum')}=${PAD8('h.GLNum')}
             AND RTRIM(g.Status)='Post' AND RTRIM(ISNULL(g.Deleted,''))<>'T')`
      ),
  },
  {
    code: 'CASH_ALLOCATION_INVOICE_MISSING',
    action: 'FIX',
    severity: 'BLOCKER',
    tables: ['CashTrxDetail', 'CashTrxHeader', 'InvoiceTrxHeader'],
    messageAr: (n) =>
      `${n} سطر سند مربوط بفاتورة غير موجودة أو غير مرحّلة. صحّح رقم الفاتورة في السند أو احذف الربط.`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT RTRIM(d.YearID)+'|'+RTRIM(d.BranchCode)+'|'+RTRIM(d.Type)+'|'+RTRIM(d.CashNum)+'|'+CONVERT(varchar(20), d.DetailNum) AS k
         FROM dbo.CashTrxDetail d
         JOIN dbo.CashTrxHeader h ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode AND h.YearID=d.YearID
          AND RTRIM(ISNULL(h.Type,''))=RTRIM(ISNULL(d.Type,'')) AND h.CashNum=d.CashNum
         WHERE RTRIM(d.CompanyCode)=@cc AND ${POSTED} AND RTRIM(ISNULL(d.InvoiceNum,''))<>''
           AND RTRIM(ISNULL(d.Accepted,'T')) NOT IN ('F','0','N','False','No')
           AND NOT EXISTS (SELECT 1 FROM dbo.InvoiceTrxHeader i WHERE i.CompanyCode=d.CompanyCode AND i.BranchCode=d.BranchCode
             AND RTRIM(i.YearID)=RTRIM(ISNULL(NULLIF(RTRIM(d.InvoiceYearId),''), d.YearID))
             AND RTRIM(i.Type)=RTRIM(d.InvoiceType) AND RTRIM(i.InvoiceNum)=RTRIM(d.InvoiceNum)
             AND RTRIM(i.Status)='Post' AND RTRIM(ISNULL(i.Deleted,''))<>'T')`
      ),
  },
  {
    code: 'INVOICE_ORPHAN_LINES',
    action: 'IGNORE',
    severity: 'INFO',
    tables: ['InvoiceTrxDetail', 'InvoiceTrxHeader'],
    messageAr: (n) => `${n} سطر فاتورة بدون رأس فاتورة. سيتم تجاهلها (يمكن حذفها من النظام القديم).`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT RTRIM(d.YearID)+'|'+RTRIM(d.BranchCode)+'|'+RTRIM(d.Type)+'|'+RTRIM(d.InvoiceNum)+'|'+RTRIM(d.ItemCode) AS k
         FROM dbo.InvoiceTrxDetail d
         WHERE RTRIM(d.CompanyCode)=@cc
           AND NOT EXISTS (SELECT 1 FROM dbo.InvoiceTrxHeader h WHERE h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode
             AND h.YearID=d.YearID AND h.Type=d.Type AND h.InvoiceNum=d.InvoiceNum)`
      ),
  },
  {
    code: 'CHEQUE_ZERO_AMOUNT',
    action: 'IGNORE',
    severity: 'INFO',
    tables: ['CKTrxDetail'],
    messageAr: (n) => `${n} شيك وارد بقيمة صفر أو سالبة. لن يُنقل (يمكن حذفه من النظام القديم).`,
    run: (ctx) =>
      keys(
        ctx,
        `SELECT RTRIM(d.YearID)+'|'+RTRIM(d.BranchCode)+'|'+RTRIM(d.CKNum)+'|'+RTRIM(ISNULL(d.IdNum,'')) AS k
         FROM dbo.CKTrxDetail d WHERE RTRIM(d.CompanyCode)=@cc AND ISNULL(d.Amount,0)<=0`
      ),
  },
];

/** Party checks need the classifier-free snapshot, not SQL alone. */
async function partyChecks(ctx: MigrationContext): Promise<PreflightFinding[]> {
  if (!(await legacyTableExists(ctx.source, 'InvoiceTrxHeader'))) return [];
  const snapshot = await loadLegacyPartySnapshot(ctx.source, ctx.legacyCompanyCode);
  const out: PreflightFinding[] = [];

  const shared = new Map<string, string[]>();
  for (const c of snapshot.customers) {
    if (!c.accountCode) continue;
    shared.set(c.accountCode, [...(shared.get(c.accountCode) ?? []), `C:${c.customerCode}`]);
  }
  for (const s of snapshot.suppliers) {
    if (!s.accountCode) continue;
    shared.set(s.accountCode, [...(shared.get(s.accountCode) ?? []), `S:${s.supplierCode}`]);
  }
  const sharedRows = [...shared].filter(([, who]) => who.length > 1).map(([acc, who]) => `${acc}: ${who.join(',')}`);
  out.push({
    code: 'PARTY_SHARED_ACCOUNT',
    action: 'FIX',
    severity: 'WARNING',
    count: sharedRows.length,
    messageAr: `${sharedRows.length} حساب مشترك بين أكثر من عميل/مورد. المستندات المرتبطة بهذا الحساب لن تُربط بعميل/مورد محدد — اجعل لكل طرف حسابه.`,
    samples: sharedRows.slice(0, SAMPLE_LIMIT),
  });

  const known = new Set<string>([
    ...snapshot.customers.flatMap((c) => [c.customerCode, c.accountCode]),
    ...snapshot.suppliers.flatMap((s) => [s.supplierCode, s.accountCode]),
  ].filter(Boolean));
  const refs = await keys(
    ctx,
    `SELECT DISTINCT RTRIM(h.SupplierAccountCode) AS k FROM dbo.InvoiceTrxHeader h
     WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED} AND RTRIM(ISNULL(h.SupplierAccountCode,''))<>''`
  );
  const unknown = refs.filter((r) => !known.has(r));
  out.push({
    code: 'INVOICE_PARTY_UNKNOWN',
    action: 'ADD',
    severity: 'WARNING',
    count: unknown.length,
    messageAr: `${unknown.length} حساب عميل/مورد مستخدم في فواتير مرحّلة ولا يخص أي عميل أو مورد. ستُنقل الفاتورة بدون عميل/مورد — أضِف الطرف أو صحّح الحساب.`,
    samples: unknown.slice(0, SAMPLE_LIMIT),
  });
  return out;
}

export async function runMigrationPreflight(ctx: MigrationContext): Promise<PreflightFinding[]> {
  const findings: PreflightFinding[] = [];
  const tableCache = new Map<string, boolean>();
  const has = async (t: string) => {
    if (!tableCache.has(t)) tableCache.set(t, await legacyTableExists(ctx.source, t));
    return tableCache.get(t)!;
  };
  for (const check of CHECKS) {
    if (!(await Promise.all(check.tables.map(has))).every(Boolean)) continue;
    let rows: string[];
    try {
      rows = await check.run(ctx);
    } catch (err) {
      findings.push({
        code: check.code,
        action: 'FIX',
        severity: 'WARNING',
        count: -1,
        messageAr: `تعذّر تنفيذ الفحص ${check.code}: ${err instanceof Error ? err.message : String(err)}`,
        samples: [],
      });
      continue;
    }
    findings.push({
      code: check.code,
      action: check.action,
      severity: check.severity,
      count: rows.length,
      messageAr: check.messageAr(rows.length),
      samples: rows.slice(0, SAMPLE_LIMIT),
    });
  }
  try {
    findings.push(...(await partyChecks(ctx)));
  } catch {
    /* party snapshot unavailable: the PARTIES stage reports it */
  }

  await recordPreflightIssues(ctx, findings);
  return findings;
}

/** One issue per firing check; checks that no longer fire are resolved. */
async function recordPreflightIssues(ctx: MigrationContext, findings: PreflightFinding[]) {
  const firing = findings.filter((f) => f.count !== 0);
  const firingCategories = new Set(firing.map((f) => `PREFLIGHT_${f.code}`));
  const existing = await ctx.prisma.migrationIssue.findMany({
    where: { migrationJobId: ctx.migrationJobId, category: { startsWith: 'PREFLIGHT_' } },
    select: { id: true, category: true },
  });
  const resolveIds = existing.filter((e) => !firingCategories.has(e.category)).map((e) => e.id);
  if (resolveIds.length) {
    await ctx.prisma.migrationIssue.updateMany({
      where: { id: { in: resolveIds }, migrationJobId: ctx.migrationJobId },
      data: { resolutionState: 'RESOLVED' },
    });
  }
  for (const f of firing) {
    const category = `PREFLIGHT_${f.code}`;
    const description = f.samples.length
      ? `${f.messageAr} أمثلة: ${f.samples.join(' ؛ ')}`
      : f.messageAr;
    const prior = existing.find((e) => e.category === category);
    if (prior) {
      await ctx.prisma.migrationIssue.updateMany({
        where: { id: prior.id, migrationJobId: ctx.migrationJobId },
        data: { severity: f.severity, description, resolutionState: 'OPEN', sourceKey: f.action },
      });
    } else {
      await ctx.issues.record({
        jobId: ctx.migrationJobId,
        stage: 'PREFLIGHT',
        severity: f.severity,
        category,
        sourceEntity: 'LegacySource',
        sourceKey: f.action,
        description,
      });
    }
  }
}
