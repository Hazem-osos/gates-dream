jest.mock('../../modules/migration-engine/services/migration-legacy-snapshot-preserve.service', () => ({
  preserveLegacySnapshot: jest.fn(async () => 0),
}));

import { Decimal } from '@prisma/client/runtime/library';
import { decidePostedJournalImport } from '../../modules/migration-engine/accounting/journal-decision';
import { isBalanced, money, scaleToBase } from '../../modules/migration-engine/accounting/journal-money';
import {
  resolveOpeningImportPolicy,
  shouldImportBalanceAccounts,
} from '../../modules/migration-engine/accounting/opening-import-policy';
import { overallImplementationPercent } from '../../modules/migration-engine/services/migration-progress.service';
import { MigrationContext } from '../../modules/migration-engine/migration-context';
import { runAccountingStage } from '../../modules/migration-engine/stages/accounting.stage';
import {
  assignUniqueLineNumbers,
  journalSourceKey,
  transformHistoricalJournalHeader,
  transformHistoricalJournalLine,
} from '../../modules/migration-engine/transforms/journal-transform';
import {
  dedupeLegacyJournalLines,
  dedupePostedJournalHeaders,
} from '../../modules/migration-engine/accounting/journal-dedupe';
import { padGlNum } from '../../modules/migration-engine/transforms/legacy-values';
import { LEGACY_POSTED_DETAIL_EXISTS } from '../../modules/migration-engine/coa/legacy-posted-gl';

describe('accounting-migration', () => {
  it('uses Decimal scaling for multi-currency lines', () => {
    const debit = money('100.10');
    const rate = money('30.5');
    expect(scaleToBase(debit, rate).toFixed(4)).toBe('3053.0500');
    expect(isBalanced(money('10.00'), money('10.00'))).toBe(true);
    expect(isBalanced(money('10.00'), money('10.02'))).toBe(false);
  });

  it('quarantines unbalanced posted journals without fabricating a suspense line', () => {
    const result = decidePostedJournalImport({
      isPosted: true,
      isDeleted: false,
      alreadyMapped: false,
      lineCount: 2,
      debitBase: money('100.00'),
      creditBase: money('90.00'),
      unresolvedAccountCodes: [],
    });
    expect(result.decision).toBe('QUARANTINE_UNBALANCED');
    expect(result.difference).toBe('10.00');
  });

  it('quarantines unresolved account codes', () => {
    const result = decidePostedJournalImport({
      isPosted: true,
      isDeleted: false,
      alreadyMapped: false,
      lineCount: 2,
      debitBase: money('50'),
      creditBase: money('50'),
      unresolvedAccountCodes: ['999'],
    });
    expect(result.decision).toBe('QUARANTINE_UNRESOLVED_ACCOUNT');
  });

  it('skips already mapped journals on rerun', () => {
    const result = decidePostedJournalImport({
      isPosted: true,
      isDeleted: false,
      alreadyMapped: true,
      lineCount: 2,
      debitBase: money('50'),
      creditBase: money('50'),
      unresolvedAccountCodes: [],
    });
    expect(result.decision).toBe('SKIP_ALREADY_MAPPED');
  });

  it('skips unposted and deleted headers', () => {
    expect(
      decidePostedJournalImport({
        isPosted: false,
        isDeleted: false,
        alreadyMapped: false,
        lineCount: 2,
        debitBase: money('1'),
        creditBase: money('1'),
        unresolvedAccountCodes: [],
      }).decision
    ).toBe('SKIP_UNPOSTED');
    expect(
      decidePostedJournalImport({
        isPosted: true,
        isDeleted: true,
        alreadyMapped: false,
        lineCount: 2,
        debitBase: money('1'),
        creditBase: money('1'),
        unresolvedAccountCodes: [],
      }).decision
    ).toBe('SKIP_DELETED');
  });

  it('prevents opening-balance double count when BG01 GL exists', () => {
    const policy = resolveOpeningImportPolicy({
      balanceAccountHeaderCount: 1,
      openingGlHeaderCount: 1,
    });
    expect(policy).toBe('GL_ONLY');
    expect(shouldImportBalanceAccounts(policy)).toBe(false);
  });

  it('renumbers lines when legacy DetailNum repeats inside one journal', () => {
    const lines = assignUniqueLineNumbers([
      transformHistoricalJournalLine({ DetailNum: 1, AccountNo: '101', DebitValue: '10', CreditValue: '0', Change: '1' }),
      transformHistoricalJournalLine({ DetailNum: 1, AccountNo: '201', DebitValue: '0', CreditValue: '10', Change: '1' }),
    ]);
    expect(lines.map((l) => l.lineNumber)).toEqual([1, 2]);
    expect(lines[0].debit.toFixed(2)).toBe('10.00');
    expect(lines[1].credit.toFixed(2)).toBe('10.00');
  });

  it('pads GL numbers and keeps company-scoped source keys distinct', () => {
    expect(padGlNum('84')).toBe('00000084');
    const a = journalSourceKey({ companyCode: '0001', branchCode: '0001', yearId: '1', glNum: '00000084' });
    const b = journalSourceKey({ companyCode: '0002', branchCode: '0001', yearId: '1', glNum: '00000084' });
    expect(a.companyCode).not.toBe(b.companyCode);
  });

  it('transforms FX lines into base amounts without Number()', () => {
    const line = transformHistoricalJournalLine({
      DetailNum: 1,
      AccountNo: '101',
      DebitValue: '12.5',
      CreditValue: '0',
      Change: '2',
      DetailDescA: 'قيد',
    });
    expect(line.description).toBe('قيد');
    expect(line.debitBase).toBeInstanceOf(Decimal);
    expect(line.debitBase.toFixed(4)).toBe('25.0000');
    const header = transformHistoricalJournalHeader(
      {
        GlNum: '12',
        Status: 'Post',
        Date: '2025-01-01',
        CurrencyCode: 'USD',
        Change: '30.123456',
        Type: 'GL01',
      },
      { companyId: 'co-1', branchId: 'br-1', fiscalYearId: 'fy-1' }
    );
    expect(header.legacyGlNum).toBe('00000012');
    expect(header.sourceKind).toBe('MANUAL');
    expect(header.isPosted).toBe(true);
    expect(header.createdBy).toBe('legacy-historical-import');
  });

  function cleanJournalScenario(opts: { mapBranch?: boolean; mapYear?: boolean } = {}) {
    const created: unknown[] = [];
    const maps = new Map<string, { targetId: string }>();
    const issues: unknown[] = [];
    const prisma = {
      legacyAccountOverride: {
        findMany: async () => [],
      },
      account: {
        findFirst: async () => ({ id: 'acc-1' }),
      },
      journalEntry: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: 'je-1', ...data };
        },
      },
      journalEntryLine: {
        create: async ({ data }: { data: Record<string, unknown> }) => data,
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          journalEntry: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
              created.push(data);
              return { id: 'je-1', ...data };
            },
          },
          journalEntryLine: {
            create: async ({ data }: { data: Record<string, unknown> }) => data,
          },
        }),
    };

    const headers = [
      {
        CompanyCode: '0001',
        BranchCode: '0001',
        YearID: '00000001',
        GlNum: '00000001',
        Status: 'Post',
        Deleted: 'F',
        Date: '2025-01-01',
        Type: 'GL01',
        Change: '1',
        CurrencyCode: 'EGP',
      },
    ];
    const lines = [
      {
        CompanyCode: '0001',
        BranchCode: '0001',
        YearID: '00000001',
        GLNum: '00000001',
        LineNum: 1,
        AccountNo: '101',
        DebitValue: '40',
        CreditValue: '0',
        Change: '1',
      },
      {
        CompanyCode: '0001',
        BranchCode: '0001',
        YearID: '00000001',
        GLNum: '00000001',
        LineNum: 2,
        AccountNo: '401',
        DebitValue: '0',
        CreditValue: '40',
        Change: '1',
      },
    ];
    const source = {
      querySql: async (sql: string) => {
        if (sql.includes('sys.columns')) return [];
        if (sql.includes('COUNT(*)') && sql.includes('BG01')) return [{ cnt: 1 }];
        if (sql.includes('BalanceAccountsH')) return [{ cnt: 1 }];
        if (sql.includes('HAVING COUNT(*)')) return [{ cnt: 0 }];
        if (sql.includes('COUNT(*)')) return [{ cnt: 1 }];
        if (sql.includes('SUM(')) return [{ debit: 40, credit: 40, lines: 2 }];
        if (sql.includes('GLTrxDetail')) return lines;
        if (sql.includes('GLTrxHeader')) return headers;
        return [];
      },
      close: async () => undefined,
    };

    const ctx = new MigrationContext(
      {
        migrationJobId: 'job-1',
        targetCompanyId: 'co-1',
        legacyCompanyCode: '0001',
        sourceFingerprint: 'fp',
        dryRun: false,
        options: { legacyCompanyCode: '0001', batchSize: 20 },
      },
      {
        prisma: prisma as never,
        jobService: {
          countOpenBlockers: async () =>
            issues.filter((row) => (row as { severity?: string }).severity === 'BLOCKER').length,
          getJob: async () => ({ status: 'RUNNING' }),
          isCancelRequested: async () => false,
        } as never,
        idMapService: {
          findMapping: async (_job: string, entity: string, key: Record<string, string>) => {
            if (entity === 'Account') return { targetId: `acc-${key.accountCode}` };
            // The foundation stage maps branches and years before journals run.
            if (entity === 'Branch') return opts.mapBranch === false ? null : { targetId: `br-${key.branchCode}` };
            if (entity === 'Year') return opts.mapYear === false ? null : { targetId: `fy-${key.yearCode}` };
            return maps.get(`${entity}|${JSON.stringify(key)}`) ?? null;
          },
          recordMapping: async (params: { sourceEntity: string; sourceKeyParts: Record<string, string>; targetId: string }) => {
            maps.set(`${params.sourceEntity}|${JSON.stringify(params.sourceKeyParts)}`, {
              targetId: params.targetId,
            });
          },
        } as never,
        checkpointService: {
          load: async () => null,
          save: async () => undefined,
        } as never,
        issueService: {
          record: async (row: unknown) => {
            issues.push(row);
          },
          recordOnce: async (row: unknown) => {
            issues.push(row);
          },
        } as never,
        sourceAdapter: source as never,
      }
    );

    return { ctx, created, issues };
  }

  it('imports a clean posted journal once and skips the rerun', async () => {
    const { ctx, created, issues } = cleanJournalScenario();
    const first = await runAccountingStage(ctx);
    expect(first.written).toBe(1);
    expect(created).toHaveLength(1);
    expect(issues.some((row) => (row as { category?: string }).category === 'REVERSAL_LINKS_UNAVAILABLE')).toBe(true);
    const second = await runAccountingStage(ctx);
    expect(second.written).toBe(0);
  });

  it.each([
    ['branch', { mapBranch: false }, 'JOURNAL_BRANCH_UNMAPPED'],
    ['fiscal year', { mapYear: false }, 'JOURNAL_YEAR_UNMAPPED'],
  ])('blocks a posted journal whose %s was not migrated instead of importing it without one', async (_label, opts, category) => {
    const { ctx, created, issues } = cleanJournalScenario(opts);
    const report = await runAccountingStage(ctx);
    expect(report.written).toBe(0);
    expect(created).toHaveLength(0);
    // The orchestrator moves the job to BLOCKED, not COMPLETED, when this is > 0.
    expect(report.blockers).toBe(1);
    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ severity: 'BLOCKER', category, sourceEntity: 'GLTrxHeader' })])
    );
  });

  it('loads posted details with EXISTS so shared GlNum headers do not multiply rows', () => {
    expect(LEGACY_POSTED_DETAIL_EXISTS).toMatch(/EXISTS\s*\(/);
    expect(LEGACY_POSTED_DETAIL_EXISTS).not.toMatch(/INNER JOIN dbo\.GLTrxHeader/);
  });

  it('collapses invoice+receipt headers that share GlNum and does not double lines', () => {
    const { headers, collapsed } = dedupePostedJournalHeaders([
      {
        YearID: '00000002',
        BranchCode: '0001',
        GlNum: '00000206',
        Type: 'SV01',
        Status: 'Post',
      },
      {
        YearID: '00000002',
        BranchCode: '0001',
        GlNum: '00000206',
        Type: 'BR02',
        Status: 'Post',
      },
    ]);
    expect(headers).toHaveLength(1);
    expect(headers[0].Type).toBe('SV01');
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].droppedTypes).toEqual(['BR02']);

    const zeroDuplicates = [
      { YearID: '00000002', BranchCode: '0001', GLNum: '00000139', DetailNum: 1, AccountNo: '101004', DebitValue: '0', CreditValue: '0' },
      { YearID: '00000002', BranchCode: '0001', GLNum: '00000139', DetailNum: 1, AccountNo: '101004', DebitValue: '0', CreditValue: '0' },
    ];
    expect(dedupeLegacyJournalLines(zeroDuplicates)).toHaveLength(1);
    const keptPhysical = assignUniqueLineNumbers(zeroDuplicates.map(transformHistoricalJournalLine));
    expect(keptPhysical).toHaveLength(2);
    expect(keptPhysical.map((l) => l.lineNumber)).toEqual([1, 2]);
    expect(keptPhysical.every((l) => l.debitBase.toFixed(2) === '0.00')).toBe(true);
  });

  it('does not claim production-ready completion from scripts executing', () => {
    const percent = overallImplementationPercent();
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(100);
  });
});
