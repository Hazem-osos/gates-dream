/**
 * Regression: the owner-approved override catalog holds decisions made for ONE legacy
 * database (the pilot). It used to be written into every target company and enforced
 * on every execute, so execute failed for any other customer with legacy company code
 * 0001 ("Cannot resolve owner override 102060101003 … not mapped to a POSTING account").
 * A seed now applies only when the source's posted GL actually uses its account.
 */
import { randomUUID } from 'node:crypto';
import { MigrationContext } from '../../modules/migration-engine/migration-context';
import {
  postedGlUsesLegacyAccount,
  syncOwnerApprovedPostedGlMappings,
} from '../../modules/migration-engine/services/legacy-account-override.service';
import { MigrationIdMapService } from '../../modules/migration-engine/services/migration-id-map.service';

function makeCtx(prisma: any, querySql: (sql: string, params?: any) => Promise<unknown[]>) {
  return new MigrationContext(
    {
      migrationJobId: randomUUID(),
      targetCompanyId: randomUUID(),
      legacyCompanyCode: '0001',
      sourceFingerprint: 'test',
      dryRun: false,
      options: { legacyCompanyCode: '0001' },
    },
    {
      prisma,
      jobService: {} as any,
      idMapService: new MigrationIdMapService(prisma),
      checkpointService: {} as any,
      issueService: { record: async () => undefined } as any,
      sourceAdapter: { querySql, close: async () => undefined } as any,
    }
  );
}

function prismaSpy() {
  const created: unknown[] = [];
  return {
    created,
    legacyAccountOverride: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        created.push(data);
        return data;
      },
      update: async () => undefined,
    },
    account: { findFirst: async () => null },
    migrationIdMap: { findUnique: async () => null, create: async ({ data }: any) => data },
  };
}

describe('owner-approved override relevance', () => {
  it('skips a pilot override the source never posts to: no row written, no error', async () => {
    const prisma = prismaSpy();
    const ctx = makeCtx(prisma, async () => [{ cnt: 0 }]);
    const result = await syncOwnerApprovedPostedGlMappings(ctx);
    expect(result).toEqual({ overridesEnsured: 0, mappingsRecorded: 0, skippedDryRun: false });
    expect(prisma.created).toHaveLength(0);
  });

  it('still enforces the override when the source does post to that account', async () => {
    const prisma = prismaSpy();
    const ctx = makeCtx(prisma, async () => [{ cnt: 2 }]);
    await expect(syncOwnerApprovedPostedGlMappings(ctx)).rejects.toThrow(/not mapped to a POSTING account/);
    expect(prisma.created).toHaveLength(1);
  });

  it('asks the source about the posted GL account, scoped to the legacy company', async () => {
    const calls: Array<{ sql: string; params: any }> = [];
    const ctx = makeCtx(prismaSpy(), async (sql, params) => {
      calls.push({ sql, params });
      return [{ cnt: 1 }];
    });
    await expect(postedGlUsesLegacyAccount(ctx, '102060101003')).resolves.toBe(true);
    expect(calls[0].params).toEqual({ cc: '0001', code: '102060101003' });
    expect(calls[0].sql).toMatch(/FROM dbo\.GLTrxDetail d/);
    expect(calls[0].sql).toMatch(/Status\) = 'Post'/);
  });

  it('treats an unanswerable source (no row) as relevant, keeping the strict check', async () => {
    const ctx = makeCtx(prismaSpy(), async () => []);
    await expect(postedGlUsesLegacyAccount(ctx, '102060101003')).resolves.toBe(true);
  });
});
