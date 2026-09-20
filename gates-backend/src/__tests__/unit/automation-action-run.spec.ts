import {
  internalAutomationActionRunGetQuerySchema,
  internalAutomationActionRunListQuerySchema,
} from '../../modules/automation/schemas/automation-action-run.schema';
import {
  ACTION_RUN_LIST_MAX,
  AutomationActionRunService,
} from '../../modules/automation/services/automation-action-run.service';
import { toAutomationActionRunView } from '../../modules/automation/services/automation-action-run.mapper';
import {
  sanitizeResultMetadata,
  type AutomationActionRunRecord,
  type AutomationActionRunStore,
} from '../../modules/automation/services/automation-action-run.types';

const COMPANY_A = 'd5b92313-74fc-4359-875a-7b9ee5918ac3';
const COMPANY_B = '00000000-0000-0000-0000-000000000002';

function applyUpdate<T extends object>(row: T, data: Record<string, unknown>) {
  const next = { ...data };
  const increment = next.attemptCount as { increment?: number } | number | undefined;
  if (increment && typeof increment === 'object' && typeof increment.increment === 'number') {
    (row as { attemptCount: number }).attemptCount += increment.increment;
    delete next.attemptCount;
  }
  Object.assign(row, next, { updatedAt: new Date() });
}

function createStore(seed: AutomationActionRunRecord[] = []) {
  const runs = [...seed];
  const db: AutomationActionRunStore = {
    automationActionRun: {
      create: async ({ data }: { data: Partial<AutomationActionRunRecord> }) => {
        const dup = runs.find(
          (r) =>
            r.companyId === data.companyId &&
            r.eventId === data.eventId &&
            r.ruleId === data.ruleId &&
            r.actionType === data.actionType
        );
        if (dup) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        const now = new Date();
        const row: AutomationActionRunRecord = {
          id: `run-${runs.length + 1}`,
          companyId: data.companyId!,
          eventId: data.eventId!,
          ruleId: data.ruleId!,
          actionType: data.actionType!,
          correlationId: data.correlationId!,
          eventType: data.eventType ?? null,
          attemptCount: data.attemptCount ?? 1,
          startedAt: data.startedAt ?? now,
          completedAt: data.completedAt ?? null,
          resultMetadata: data.resultMetadata ?? null,
          lastErrorCode: data.lastErrorCode ?? null,
          status: data.status ?? 'PENDING',
          resultEntityType: data.resultEntityType ?? null,
          resultEntityId: data.resultEntityId ?? null,
          errorMessage: data.errorMessage ?? null,
          createdAt: now,
          updatedAt: now,
        };
        runs.push(row);
        return row;
      },
      findUnique: async ({
        where,
      }: {
        where: {
          companyId_eventId_ruleId_actionType: {
            companyId: string;
            eventId: string;
            ruleId: string;
            actionType: string;
          };
        };
      }) => {
        const k = where.companyId_eventId_ruleId_actionType;
        return (
          runs.find(
            (r) =>
              r.companyId === k.companyId &&
              r.eventId === k.eventId &&
              r.ruleId === k.ruleId &&
              r.actionType === k.actionType
          ) ?? null
        );
      },
      findFirst: async ({
        where,
      }: {
        where: { id?: string; companyId?: string };
      }) =>
        runs.find((r) => {
          if (where.id && r.id !== where.id) return false;
          if (where.companyId && r.companyId !== where.companyId) return false;
          return true;
        }) ?? null,
      findMany: async ({
        where,
        skip = 0,
        take = 20,
      }: {
        where?: Partial<Pick<AutomationActionRunRecord, 'companyId' | 'eventId' | 'eventType' | 'ruleId' | 'status'>>;
        skip?: number;
        take?: number;
      }) => {
        const filtered = runs
          .filter((r) => {
            if (where?.companyId && r.companyId !== where.companyId) return false;
            if (where?.eventId && r.eventId !== where.eventId) return false;
            if (where?.eventType && r.eventType !== where.eventType) return false;
            if (where?.ruleId && r.ruleId !== where.ruleId) return false;
            if (where?.status && r.status !== where.status) return false;
            return true;
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return filtered.slice(skip, skip + take);
      },
      count: async ({
        where,
      }: {
        where?: Partial<Pick<AutomationActionRunRecord, 'companyId' | 'eventId' | 'eventType' | 'ruleId' | 'status'>>;
      }) =>
        runs.filter((r) => {
          if (where?.companyId && r.companyId !== where.companyId) return false;
          if (where?.eventId && r.eventId !== where.eventId) return false;
          if (where?.eventType && r.eventType !== where.eventType) return false;
          if (where?.ruleId && r.ruleId !== where.ruleId) return false;
          if (where?.status && r.status !== where.status) return false;
          return true;
        }).length,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = runs.find((r) => r.id === where.id);
        if (!row) throw new Error('run not found');
        applyUpdate(row, data);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; companyId?: string; status?: string; updatedAt?: Date };
        data: Record<string, unknown>;
      }) => {
        const row = runs.find((r) => {
          if (r.id !== where.id) return false;
          if (where.companyId && r.companyId !== where.companyId) return false;
          if (where.status && r.status !== where.status) return false;
          if (where.updatedAt && r.updatedAt.getTime() !== where.updatedAt.getTime()) return false;
          return true;
        });
        if (!row) return { count: 0 };
        applyUpdate(row, data);
        return { count: 1 };
      },
    },
  };
  return { db, runs, service: (now?: () => Date) => new AutomationActionRunService(db, now) };
}

describe('sanitizeResultMetadata', () => {
  it('keeps safe primitives and drops secrets and nested objects', () => {
    expect(
      sanitizeResultMetadata({
        orderNumber: '00000001',
        token: 'should-not-persist',
        apiKey: 'x',
        supplierId: { nested: true },
        ok: true,
      })
    ).toEqual({ orderNumber: '00000001', ok: true });
  });
});

describe('AutomationActionRunService', () => {
  it('claims a fresh run then marks SUCCEEDED', async () => {
    const mem = createStore();
    const svc = mem.service();
    const claimed = await svc.claim({
      companyId: COMPANY_A,
      eventId: 'evt-1',
      ruleId: '991ed11e-86d2-455f-8518-13d41fc2dbdc',
      actionType: 'webhook.call',
      correlationId: 'corr-1',
      eventType: 'webhook.call',
    });
    expect(claimed.kind).toBe('claimed');
    expect(claimed.run.attemptCount).toBe(1);
    const succeeded = await svc.markSucceeded(claimed.run.companyId, claimed.run.id, {
      resultEntityType: 'WebhookDelivery',
      resultEntityId: 'none',
      resultMetadata: { orderNumber: 'n/a', token: 'secret' },
    });
    expect(succeeded.status).toBe('SUCCEEDED');
    expect(succeeded.resultMetadata).toEqual({ orderNumber: 'n/a' });
    expect(succeeded.completedAt).toBeTruthy();
  });

  it('FAILED reclaim increments attemptCount and keeps last error', async () => {
    const mem = createStore();
    const svc = mem.service();
    const claimed = await svc.claim({
      companyId: COMPANY_A,
      eventId: 'evt-fail',
      ruleId: '991ed11e-86d2-455f-8518-13d41fc2dbdc',
      actionType: 'notification.email',
      correlationId: 'corr-fail',
    });
    await svc.markFailed(claimed.run.companyId, claimed.run.id, {
      errorMessage: 'SMTP down',
      lastErrorCode: 'DOMAIN_ERROR',
    });
    expect(mem.runs[0].status).toBe('FAILED');
    expect(mem.runs[0].errorMessage).toBe('SMTP down');

    const retry = await svc.claim({
      companyId: COMPANY_A,
      eventId: 'evt-fail',
      ruleId: '991ed11e-86d2-455f-8518-13d41fc2dbdc',
      actionType: 'notification.email',
      correlationId: 'corr-fail-2',
    });
    expect(retry.kind).toBe('claimed');
    expect(retry.run.attemptCount).toBe(2);
    expect(retry.run.correlationId).toBe('corr-fail');
    expect(retry.run.errorMessage).toBe('SMTP down');
    expect(retry.run.lastErrorCode).toBe('DOMAIN_ERROR');
  });

  it('lists only the requested tenant and applies filters + pagination cap', async () => {
    const mem = createStore();
    const svc = mem.service();
    await svc.claim({
      companyId: COMPANY_A,
      eventId: 'evt-a',
      ruleId: '991ed11e-86d2-455f-8518-13d41fc2dbdc',
      actionType: 'webhook.call',
      correlationId: 'a',
      eventType: 'sales.invoice.posted',
    });
    await svc.claim({
      companyId: COMPANY_B,
      eventId: 'evt-b',
      ruleId: '991ed11e-86d2-455f-8518-13d41fc2dbdc',
      actionType: 'webhook.call',
      correlationId: 'b',
      eventType: 'sales.invoice.posted',
    });

    const listed = await svc.list({
      companyId: COMPANY_A,
      eventType: 'sales.invoice.posted',
      page: 1,
      limit: 500,
    });
    expect(listed.limit).toBe(ACTION_RUN_LIST_MAX);
    expect(listed.total).toBe(1);
    expect(listed.runs[0].companyId).toBe(COMPANY_A);

    const view = toAutomationActionRunView(listed.runs[0], 'Large invoice alert');
    expect(view.ruleName).toBe('Large invoice alert');
    expect(view.resultMetadata).toBeNull();
  });

  it('markSucceeded/markFailed never mutate a run belonging to another company', async () => {
    const mem = createStore();
    const svc = mem.service();
    const claimed = await svc.claim({
      companyId: COMPANY_A,
      eventId: 'evt-tenant',
      ruleId: '991ed11e-86d2-455f-8518-13d41fc2dbdc',
      actionType: 'webhook.call',
      correlationId: 'corr-tenant',
    });

    await expect(
      svc.markSucceeded(COMPANY_B, claimed.run.id, {
        resultEntityType: 'WebhookDelivery',
        resultEntityId: 'wrong-tenant',
      })
    ).rejects.toThrow(/not found for company/i);
    expect(mem.runs[0].status).toBe('PENDING');
    expect(mem.runs[0].resultEntityId).toBeNull();

    await svc.markFailed(COMPANY_B, claimed.run.id, { errorMessage: 'should not apply' });
    expect(mem.runs[0].status).toBe('PENDING');
    expect(mem.runs[0].errorMessage).toBeNull();

    const succeeded = await svc.markSucceeded(COMPANY_A, claimed.run.id, {
      resultEntityType: 'WebhookDelivery',
      resultEntityId: 'right-tenant',
    });
    expect(succeeded.status).toBe('SUCCEEDED');
    expect(succeeded.resultEntityId).toBe('right-tenant');
  });
});

describe('internal action-run query validation', () => {
  it('requires companyId on list and get', () => {
    expect(internalAutomationActionRunListQuerySchema.safeParse({}).success).toBe(false);
    expect(
      internalAutomationActionRunListQuerySchema.safeParse({
        companyId: COMPANY_A,
        status: 'SUCCEEDED',
      }).success
    ).toBe(true);
    expect(internalAutomationActionRunGetQuerySchema.safeParse({}).success).toBe(false);
    expect(
      internalAutomationActionRunGetQuerySchema.safeParse({ companyId: COMPANY_A }).success
    ).toBe(true);
  });
});
