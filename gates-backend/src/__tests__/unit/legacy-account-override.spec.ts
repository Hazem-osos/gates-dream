import { randomUUID } from 'node:crypto';
import { reconcileCoa } from '../../modules/migration-engine/stages/coa.stage';
import { MigrationContext } from '../../modules/migration-engine/migration-context';
import {
  assertOverrideTargetPostingAccount,
  ensureOwnerApprovedOverrideCatalog,
  LegacyAccountOverrideError,
  syncOwnerApprovedPostedGlMappings,
} from '../../modules/migration-engine/services/legacy-account-override.service';
import { MigrationIdMapService } from '../../modules/migration-engine/services/migration-id-map.service';
import { OWNER_APPROVED_LEGACY_ACCOUNT_OVERRIDES } from '../../modules/migration-engine/policies/approved-legacy-account-overrides';
const LEGACY_AMBIGUOUS = '102060101003';
const TARGET_CASH = '1020101001';

function makeCtx(
  prisma: any,
  jobId: string,
  companyId: string,
  idMap: MigrationIdMapService,
  dryRun = false
): MigrationContext {
  return new MigrationContext(
    {
      migrationJobId: jobId,
      targetCompanyId: companyId,
      legacyCompanyCode: '0001',
      sourceFingerprint: 'test',
      dryRun,
      options: { legacyCompanyCode: '0001' },
    },
    {
      prisma,
      jobService: {} as any,
      idMapService: idMap,
      checkpointService: {} as any,
      issueService: { record: async () => undefined } as any,
      sourceAdapter: {
        querySql: async () => [],
        close: async () => undefined,
      } as any,
    }
  );
}

function createPrismaMock(companyId: string, cashAccountId: string) {
  const overrides: any[] = [];
  const idMaps: any[] = [];
  const accounts = [
    {
      id: cashAccountId,
      companyId,
      code: TARGET_CASH,
      accountKind: 'POSTING',
      deletedAt: null,
    },
  ];

  const prisma = {
    legacyAccountOverride: {
      findUnique: async ({ where }: any) => {
        const w = where.targetCompanyId_sourceCompanyCode_legacyAccountCode;
        return (
          overrides.find(
            (o) =>
              o.targetCompanyId === w.targetCompanyId &&
              o.sourceCompanyCode === w.sourceCompanyCode &&
              o.legacyAccountCode === w.legacyAccountCode
          ) ?? null
        );
      },
      findMany: async ({ where }: any) =>
        overrides.filter(
          (o) =>
            o.targetCompanyId === where.targetCompanyId &&
            (!where.sourceCompanyCode || o.sourceCompanyCode === where.sourceCompanyCode)
        ),
      create: async ({ data }: any) => {
        const row = { ...data, updatedAt: new Date() };
        overrides.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const idx = overrides.findIndex((o) => o.id === where.id);
        overrides[idx] = { ...overrides[idx], ...data };
        return overrides[idx];
      },
    },
    account: {
      findFirst: async ({ where }: any) =>
        accounts.find(
          (a) =>
            a.companyId === where.companyId &&
            (!where.id || a.id === where.id) &&
            (!where.code || a.code === where.code) &&
            (where.deletedAt === null ? a.deletedAt === null : true)
        ) ?? null,
    },
    migrationIdMap: {
      findUnique: async ({ where }: any) => {
        const w = where.migrationJobId_sourceEntity_sourceKeyHash;
        return (
          idMaps.find(
            (m) =>
              m.migrationJobId === w.migrationJobId &&
              m.sourceEntity === w.sourceEntity &&
              m.sourceKeyHash === w.sourceKeyHash
          ) ?? null
        );
      },
      create: async ({ data }: any) => {
        idMaps.push(data);
        return data;
      },
    },
    _idMaps: idMaps,
    _accounts: accounts,
    _overrides: overrides,
  };
  return prisma;
}

describe('legacy-account-override', () => {
  const companyA = randomUUID();
  const companyB = randomUUID();
  const jobId = randomUUID();
  const cashAccountId = randomUUID();

  it('registers approved override catalog for company', async () => {
    const prisma = createPrismaMock(companyA, cashAccountId);
    const rows = await ensureOwnerApprovedOverrideCatalog(prisma as any, companyA);
    expect(rows).toHaveLength(OWNER_APPROVED_LEGACY_ACCOUNT_OVERRIDES.length);
    expect(rows[0].legacyAccountCode).toBe(LEGACY_AMBIGUOUS);
    expect(rows[0].mappingClassification).toBe('OWNER_APPROVED_MAPPING');
    const again = await ensureOwnerApprovedOverrideCatalog(prisma as any, companyA);
    expect(again).toHaveLength(1);
  });

  it('override is company-scoped', async () => {
    const prisma = createPrismaMock(companyA, cashAccountId);
    await ensureOwnerApprovedOverrideCatalog(prisma as any, companyA);
    const forB = await prisma.legacyAccountOverride.findMany({
      where: { targetCompanyId: companyB, sourceCompanyCode: '0001' },
    });
    expect(forB).toHaveLength(0);
  });

  it('rejects HEADER target account', () => {
    expect(() =>
      assertOverrideTargetPostingAccount(
        { id: 'x', code: TARGET_CASH, accountKind: 'HEADER' },
        { legacyAccountCode: LEGACY_AMBIGUOUS, targetLegacyAccountCode: TARGET_CASH }
      )
    ).toThrow(LegacyAccountOverrideError);
  });

  it('sync records OWNER_APPROVED_MAPPING id map via COA target resolution', async () => {
    const prisma = createPrismaMock(companyA, cashAccountId);
    const idMap = new MigrationIdMapService(prisma as any);
    await idMap.recordMapping({
      jobId,
      sourceEntity: 'Account',
      sourceKeyParts: { companyCode: '0001', accountCode: TARGET_CASH },
      targetModel: 'Account',
      targetId: cashAccountId,
      outcome: 'CREATED_BY_MIGRATION',
    });
    await ensureOwnerApprovedOverrideCatalog(prisma as any, companyA);
    const ctx = makeCtx(prisma, jobId, companyA, idMap);
    const result = await syncOwnerApprovedPostedGlMappings(ctx);
    expect(result.mappingsRecorded).toBe(1);
    const ambiguousMap = await idMap.findMapping(jobId, 'Account', {
      companyCode: '0001',
      accountCode: LEGACY_AMBIGUOUS,
    });
    expect(ambiguousMap?.outcome).toBe('OWNER_APPROVED_MAPPING');
    expect(ambiguousMap?.targetId).toBe(cashAccountId);
  });

  it('rejects invalid target when COA mapping missing', async () => {
    const prisma = createPrismaMock(companyA, cashAccountId);
    const idMap = new MigrationIdMapService(prisma as any);
    await ensureOwnerApprovedOverrideCatalog(prisma as any, companyA);
    const ctx = makeCtx(prisma, jobId, companyA, idMap);
    await expect(syncOwnerApprovedPostedGlMappings(ctx)).rejects.toThrow(/not mapped/);
  });

  it('does not create COA account for legacy ambiguous code', async () => {
    const prisma = createPrismaMock(companyA, cashAccountId);
    prisma._accounts.push({
      id: randomUUID(),
      companyId: companyA,
      code: LEGACY_AMBIGUOUS,
      accountKind: 'POSTING',
      deletedAt: null,
    });
    const idMap = new MigrationIdMapService(prisma as any);
    await idMap.recordMapping({
      jobId,
      sourceEntity: 'Account',
      sourceKeyParts: { companyCode: '0001', accountCode: TARGET_CASH },
      targetModel: 'Account',
      targetId: cashAccountId,
      outcome: 'CREATED_BY_MIGRATION',
    });
    await ensureOwnerApprovedOverrideCatalog(prisma as any, companyA);
    const ctx = makeCtx(prisma, jobId, companyA, idMap);
    await expect(syncOwnerApprovedPostedGlMappings(ctx)).rejects.toThrow(/must not exist as a migrated COA/);
  });

  it('replay/idempotency does not duplicate id maps', async () => {
    const prisma = createPrismaMock(companyA, cashAccountId);
    const idMap = new MigrationIdMapService(prisma as any);
    await idMap.recordMapping({
      jobId,
      sourceEntity: 'Account',
      sourceKeyParts: { companyCode: '0001', accountCode: TARGET_CASH },
      targetModel: 'Account',
      targetId: cashAccountId,
      outcome: 'CREATED_BY_MIGRATION',
    });
    await ensureOwnerApprovedOverrideCatalog(prisma as any, companyA);
    const ctx = makeCtx(prisma, jobId, companyA, idMap);
    const first = await syncOwnerApprovedPostedGlMappings(ctx);
    const second = await syncOwnerApprovedPostedGlMappings(ctx);
    expect(first.mappingsRecorded).toBe(1);
    expect(second.mappingsRecorded).toBe(0);
    expect(prisma._idMaps.filter((m: any) => m.sourceEntity === 'Account')).toHaveLength(2);
  });

  it('TB readiness reaches full mapped amount with owner override', async () => {
    const prisma = createPrismaMock(companyA, cashAccountId);
    const idMap = new MigrationIdMapService(prisma as any);
    await idMap.recordMapping({
      jobId,
      sourceEntity: 'Account',
      sourceKeyParts: { companyCode: '0001', accountCode: TARGET_CASH },
      targetModel: 'Account',
      targetId: cashAccountId,
      outcome: 'CREATED_BY_MIGRATION',
    });
    await idMap.recordMapping({
      jobId,
      sourceEntity: 'Account',
      sourceKeyParts: { companyCode: '0001', accountCode: LEGACY_AMBIGUOUS },
      targetModel: 'Account',
      targetId: cashAccountId,
      outcome: 'OWNER_APPROVED_MAPPING',
    });
    await ensureOwnerApprovedOverrideCatalog(prisma as any, companyA);

    const snapshotModule = await import('../../modules/migration-engine/services/legacy-coa-data.service');
    const loadSpy = jest.spyOn(snapshotModule, 'loadLegacyCoaSnapshot').mockResolvedValue({
      masters: [],
      masterCodes: new Set(),
      postedGlCodes: new Set([LEGACY_AMBIGUOUS, TARGET_CASH]),
      allGlCodes: new Set(),
      balanceAccountCodes: new Set(),
      partyAccountCodes: new Set(),
      glLineHintByCode: new Map(),
      postedGlBalances: new Map([
        [LEGACY_AMBIGUOUS, { debit: '60', credit: '24' }],
        [TARGET_CASH, { debit: '100', credit: '100' }],
      ]),
      postedGlTotals: { debit: '62869333.38', credit: '62869333.38' },
    } as any);

    const ctx = makeCtx(prisma, jobId, companyA, idMap);
    const rec = await reconcileCoa(ctx);
    expect(rec.distinctPostedGlAccountCodes).toBe(2);
    expect(rec.resolved).toBe(2);
    expect(rec.ambiguous).toBe(0);
    expect(rec.ownerApproved).toBe(1);
    expect(Number(rec.balanceMappingPreview.amountsLost)).toBe(0);
    expect(rec.balanceMappingPreview.mappedDebit).toBe('160.00');
    loadSpy.mockRestore();
  });
});
