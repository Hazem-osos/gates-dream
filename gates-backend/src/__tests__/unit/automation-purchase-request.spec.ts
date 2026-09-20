import { createAutomationPurchaseRequestSchema } from '../../modules/automation/schemas/automation-purchase-request.schema';
import { AutomationActionRunService } from '../../modules/automation/services/automation-action-run.service';
import { AutomationPurchaseRequestService } from '../../modules/automation/services/automation-purchase-request.service';
import {
  AUTOMATION_ERROR_CODES,
  AutomationPurchaseRequestError,
  type AutomationActionRunDb,
  type AutomationActionRunRecord,
  type PurchaseOrderDomain,
  type PurchaseOrderView,
} from '../../modules/automation/services/automation-action-run.types';
import {
  automationIdempotencyKey,
  automationPurchaseOrderSerial,
  mapAutomationPayloadToPurchaseOrder,
} from '../../modules/automation/services/automation-purchase-request.mapper';
import { resolveInternalCompanyAccess } from '../../shared/middleware/internal-automation-auth.helpers';

const COMPANY_A = 'd5b92313-74fc-4359-875a-7b9ee5918ac3';
const COMPANY_B = '00000000-0000-0000-0000-000000000002';
const RULE_ID = '991ed11e-86d2-4559-8518-13d41fc2dbdc';
const SUPPLIER_A = '11111111-1111-4111-8111-111111111111';
const ITEM_A = '22222222-2222-4222-8222-222222222222';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    companyId: COMPANY_A,
    eventId: 'evt-001',
    correlationId: 'evt-001:rule-1:gates.createPurchaseRequest',
    eventType: 'inventory.stock.low',
    ruleId: RULE_ID,
    supplierId: SUPPLIER_A,
    date: '2026-09-20T13:00:00.000Z',
    lines: [{ itemId: ITEM_A, quantity: 10 }],
    ...overrides,
  };
}

function draftPo(id = 'po-1', extras: Partial<PurchaseOrderView> = {}): PurchaseOrderView {
  return {
    id,
    orderNumber: extras.orderNumber ?? '00000001',
    companyId: extras.companyId ?? COMPANY_A,
    isPosted: extras.isPosted ?? false,
    isApproved: extras.isApproved ?? false,
    serial: extras.serial ?? null,
    automationIdempotencyKey: extras.automationIdempotencyKey ?? null,
  };
}

function applyUpdate<T extends object>(row: T, data: Record<string, unknown>) {
  const next = { ...data };
  const increment = next.attemptCount as { increment?: number } | number | undefined;
  if (increment && typeof increment === 'object' && typeof increment.increment === 'number') {
    (row as { attemptCount: number }).attemptCount += increment.increment;
    delete next.attemptCount;
  }
  Object.assign(row, next, { updatedAt: new Date() });
}

function createMemory(opts?: {
  companies?: Array<{ id: string; isActive: boolean; deletedAt: Date | null }>;
  onCreatePo?: () => Promise<PurchaseOrderView> | PurchaseOrderView;
  beforeInsert?: () => Promise<void> | void;
}) {
  const companies = opts?.companies ?? [
    { id: COMPANY_A, isActive: true, deletedAt: null },
    { id: COMPANY_B, isActive: true, deletedAt: null },
  ];
  const runs: AutomationActionRunRecord[] = [];
  const orders: PurchaseOrderView[] = [];
  let poCreates = 0;
  let errorAtCreate: string | null | undefined;

  const db: AutomationActionRunDb = {
    company: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        companies.find((c) => c.id === where.id) ?? null,
    },
    purchaseOrder: {
      findFirst: async ({
        where,
      }: {
        where: {
          id?: string;
          companyId?: string;
          serial?: string;
          automationIdempotencyKey?: string;
        };
      }) =>
        orders.find((o) => {
          if (where.id && o.id !== where.id) return false;
          if (where.companyId && o.companyId !== where.companyId) return false;
          if (where.serial && o.serial !== where.serial) return false;
          if (
            where.automationIdempotencyKey &&
            o.automationIdempotencyKey !== where.automationIdempotencyKey
          ) {
            return false;
          }
          return true;
        }) ?? null,
    },
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
        where: { id: string; status?: string; resultEntityId?: null; updatedAt?: Date };
        data: Record<string, unknown>;
      }) => {
        const row = runs.find((r) => {
          if (r.id !== where.id) return false;
          if (where.status && r.status !== where.status) return false;
          if (where.resultEntityId === null && r.resultEntityId) return false;
          if (where.updatedAt && r.updatedAt.getTime() !== where.updatedAt.getTime()) return false;
          return true;
        });
        if (!row) return { count: 0 };
        applyUpdate(row, data);
        return { count: 1 };
      },
    },
  };

  const purchaseOrders: PurchaseOrderDomain = {
    createPurchaseOrder: async (companyId, data) => {
      const mapped = data as {
        supplierId: string;
        warehouseId?: string;
        serial?: string;
        automationIdempotencyKey?: string;
        lines: Array<{ itemId: string }>;
      };
      if (mapped.supplierId === '33333333-3333-4333-8333-333333333333') {
        throw new Error('Supplier not found or does not belong to company');
      }
      if (mapped.warehouseId === '44444444-4444-4444-8444-444444444444') {
        throw new Error('Warehouse not found or does not belong to company');
      }
      if (mapped.lines.some((l) => l.itemId === '55555555-5555-4555-8555-555555555555')) {
        throw new Error('One or more items not found or do not belong to company');
      }
      errorAtCreate = runs[0]?.errorMessage ?? null;
      poCreates += 1;
      if (opts?.beforeInsert) await opts.beforeInsert();
      const created = opts?.onCreatePo
        ? await opts.onCreatePo()
        : draftPo(`po-${orders.length + 1}`);
      if (
        mapped.automationIdempotencyKey &&
        orders.some(
          (o) =>
            o.companyId === companyId &&
            o.automationIdempotencyKey === mapped.automationIdempotencyKey
        )
      ) {
        throw Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          meta: { target: ['companyId', 'automationIdempotencyKey'] },
        });
      }
      const stored = {
        ...created,
        companyId,
        serial: created.serial ?? mapped.serial ?? null,
        automationIdempotencyKey:
          created.automationIdempotencyKey ?? mapped.automationIdempotencyKey ?? null,
      };
      orders.push(stored);
      return created;
    },
    getPurchaseOrderById: async (companyId, id) => {
      const found = orders.find((o) => o.id === id && o.companyId === companyId);
      if (!found) throw new Error('Purchase order not found');
      return found;
    },
  };

  return {
    db,
    purchaseOrders,
    runs,
    orders,
    get poCreates() {
      return poCreates;
    },
    get errorAtCreate() {
      return errorAtCreate;
    },
    seedRun(partial: Partial<AutomationActionRunRecord> & Pick<AutomationActionRunRecord, 'status'>) {
      const now = new Date();
      const row: AutomationActionRunRecord = {
        id: partial.id ?? `run-${runs.length + 1}`,
        companyId: partial.companyId ?? COMPANY_A,
        eventId: partial.eventId ?? 'evt-001',
        ruleId: partial.ruleId ?? RULE_ID,
        actionType: partial.actionType ?? 'gates.createPurchaseRequest',
        correlationId: partial.correlationId ?? 'evt-001:rule-1:gates.createPurchaseRequest',
        eventType: partial.eventType ?? 'inventory.stock.low',
        attemptCount: partial.attemptCount ?? 1,
        startedAt: partial.startedAt ?? now,
        completedAt: partial.completedAt ?? null,
        resultMetadata: partial.resultMetadata ?? null,
        lastErrorCode: partial.lastErrorCode ?? null,
        status: partial.status,
        resultEntityType: partial.resultEntityType ?? null,
        resultEntityId: partial.resultEntityId ?? null,
        errorMessage: partial.errorMessage ?? null,
        createdAt: partial.createdAt ?? now,
        updatedAt: partial.updatedAt ?? now,
      };
      runs.push(row);
      return row;
    },
    seedOrder(order: PurchaseOrderView) {
      orders.push(order);
      return order;
    },
    service: (now?: () => Date) =>
      new AutomationPurchaseRequestService(
        db,
        purchaseOrders,
        new AutomationActionRunService(db, now)
      ),
    runService: (now?: () => Date) => new AutomationActionRunService(db, now),
  };
}

describe('automation purchase request validation', () => {
  it('rejects a missing supplierId', () => {
    const { supplierId: _omit, ...body } = validBody();
    void _omit;
    expect(createAutomationPurchaseRequestSchema.safeParse(body).success).toBe(false);
  });

  it('rejects empty lines', () => {
    expect(createAutomationPurchaseRequestSchema.safeParse(validBody({ lines: [] })).success).toBe(
      false
    );
  });

  it('maps companyId from the payload and does not invent ownership', () => {
    const mapped = mapAutomationPayloadToPurchaseOrder(validBody() as never);
    expect(mapped.companyId).toBe(COMPANY_A);
    expect(mapped.supplierId).toBe(SUPPLIER_A);
    expect(mapped.lines).toHaveLength(1);
    expect(mapped.automationIdempotencyKey).toBe(
      automationIdempotencyKey({ eventId: 'evt-001', ruleId: RULE_ID })
    );
    expect(
      automationIdempotencyKey({ eventId: 'evt-001', ruleId: RULE_ID })
    ).toBe(
      automationIdempotencyKey({
        eventId: 'evt-001',
        ruleId: RULE_ID,
        actionType: 'gates.createPurchaseRequest',
      })
    );
  });
});

describe('automation purchase request adapter', () => {
  it('creates exactly one draft PurchaseOrder on first success', async () => {
    const mem = createMemory();
    const result = await mem.service().createDraftPurchaseOrder(validBody() as never);
    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.purchaseOrder.isPosted).toBe(false);
    expect(result.purchaseOrder.isApproved).toBe(false);
    expect(mem.poCreates).toBe(1);
    expect(mem.runs[0].status).toBe('SUCCEEDED');
    expect(mem.runs[0].resultEntityType).toBe('PurchaseOrder');
    expect(mem.runs[0].attemptCount).toBe(1);
    expect(mem.runs[0].eventType).toBe('inventory.stock.low');
    expect(mem.runs[0].completedAt).toBeTruthy();
    expect(mem.runs[0].resultMetadata).toEqual({ orderNumber: '00000001' });
  });

  it('does not create a second PurchaseOrder on SUCCEEDED replay', async () => {
    const mem = createMemory();
    const svc = mem.service();
    const first = await svc.createDraftPurchaseOrder(validBody() as never);
    const second = await svc.createDraftPurchaseOrder(validBody() as never);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.purchaseOrder.id).toBe(first.purchaseOrder.id);
    expect(mem.poCreates).toBe(1);
    expect(mem.runs).toHaveLength(1);
    expect(mem.runs[0].attemptCount).toBe(1);
  });

  it('rejects fresh PENDING conflict before a second domain create', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const mem = createMemory({
      onCreatePo: async () => {
        await gate;
        return draftPo('po-concurrent');
      },
    });
    const svc = mem.service();
    const first = svc.createDraftPurchaseOrder(validBody() as never);
    await new Promise((r) => setTimeout(r, 10));
    await expect(svc.createDraftPurchaseOrder(validBody() as never)).rejects.toMatchObject({
      statusCode: 409,
    });
    release();
    const created = await first;
    expect(created.duplicate).toBe(false);
    expect(mem.poCreates).toBe(1);

    const replay = await svc.createDraftPurchaseOrder(validBody() as never);
    expect(replay.duplicate).toBe(true);
    expect(mem.poCreates).toBe(1);
  });

  it('FAILED retry increments attemptCount and preserves last error until success', async () => {
    const mem = createMemory();
    const svc = mem.service();
    await expect(
      svc.createDraftPurchaseOrder(
        validBody({ supplierId: '33333333-3333-4333-8333-333333333333' }) as never
      )
    ).rejects.toBeInstanceOf(AutomationPurchaseRequestError);
    expect(mem.runs[0].status).toBe('FAILED');
    expect(mem.runs[0].attemptCount).toBe(1);
    expect(mem.runs[0].lastErrorCode).toBe(AUTOMATION_ERROR_CODES.OWNERSHIP);
    expect(mem.runs[0].errorMessage).toMatch(/Supplier not found/);
    expect(mem.runs[0].completedAt).toBeTruthy();

    const retry = await svc.createDraftPurchaseOrder(validBody() as never);
    expect(retry.duplicate).toBe(false);
    expect(mem.poCreates).toBe(1);
    expect(mem.runs[0].attemptCount).toBe(2);
    expect(mem.runs[0].status).toBe('SUCCEEDED');
    expect(mem.errorAtCreate).toMatch(/Supplier not found/);
    expect(mem.runs[0].errorMessage).toBeNull();
    expect(mem.runs[0].lastErrorCode).toBeNull();
  });

  it('stale PENDING retry increments attemptCount', async () => {
    const mem = createMemory();
    const past = new Date(Date.now() - 60_000);
    mem.seedRun({
      status: 'PENDING',
      updatedAt: past,
      createdAt: past,
      startedAt: past,
      attemptCount: 1,
    });
    const result = await mem.service().createDraftPurchaseOrder(validBody() as never);
    expect(result.duplicate).toBe(false);
    expect(mem.poCreates).toBe(1);
    expect(mem.runs[0].attemptCount).toBe(2);
    expect(mem.runs[0].status).toBe('SUCCEEDED');
  });

  it('domain failure persists FAILED', async () => {
    const mem = createMemory();
    const svc = mem.service();
    await expect(
      svc.createDraftPurchaseOrder(
        validBody({
          eventId: 'evt-item',
          correlationId: 'corr-item',
          lines: [{ itemId: '55555555-5555-4555-8555-555555555555', quantity: 1 }],
        }) as never
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mem.runs[0].status).toBe('FAILED');
    expect(mem.runs[0].lastErrorCode).toBe(AUTOMATION_ERROR_CODES.OWNERSHIP);

    await expect(
      svc.createDraftPurchaseOrder(
        validBody({
          eventId: 'evt-wh',
          correlationId: 'corr-wh',
          warehouseId: '44444444-4444-4444-8444-444444444444',
        }) as never
      )
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mem.runs[1].status).toBe('FAILED');
  });

  it('recovers after PurchaseOrder create when the run is still PENDING', async () => {
    const mem = createMemory();
    const correlationId = String(validBody().correlationId);
    mem.seedRun({ status: 'PENDING', correlationId, attemptCount: 1 });
    mem.seedOrder(
      draftPo('po-crash', {
        serial: automationPurchaseOrderSerial(correlationId),
        automationIdempotencyKey: automationIdempotencyKey({
          eventId: 'evt-001',
          ruleId: RULE_ID,
        }),
        orderNumber: '00000009',
      })
    );
    const result = await mem.service().createDraftPurchaseOrder(validBody() as never);
    expect(result.duplicate).toBe(true);
    expect(result.purchaseOrder.id).toBe('po-crash');
    expect(mem.poCreates).toBe(0);
    expect(mem.runs[0].status).toBe('SUCCEEDED');
    expect(mem.runs[0].resultEntityId).toBe('po-crash');
  });

  it('changed correlationId recovery does not create a second PurchaseOrder', async () => {
    const mem = createMemory();
    const firstCorr = 'corr-original';
    const past = new Date(Date.now() - 60_000);
    mem.seedRun({
      status: 'PENDING',
      correlationId: firstCorr,
      updatedAt: past,
      createdAt: past,
      startedAt: past,
      attemptCount: 1,
    });
    mem.seedOrder(
      draftPo('po-original', {
        serial: automationPurchaseOrderSerial(firstCorr),
        automationIdempotencyKey: automationIdempotencyKey({
          eventId: 'evt-001',
          ruleId: RULE_ID,
        }),
        orderNumber: '00000002',
      })
    );
    const result = await mem.service().createDraftPurchaseOrder(
      validBody({ correlationId: 'corr-changed' }) as never
    );
    expect(result.duplicate).toBe(true);
    expect(result.purchaseOrder.id).toBe('po-original');
    expect(mem.poCreates).toBe(0);
    expect(mem.runs).toHaveLength(1);
    expect(mem.runs[0].correlationId).toBe(firstCorr);
    expect(mem.runs[0].status).toBe('SUCCEEDED');
  });

  it('stores only safe result metadata with no secrets', async () => {
    const mem = createMemory();
    await mem.service().createDraftPurchaseOrder(validBody() as never);
    expect(mem.runs[0].resultMetadata).toEqual({ orderNumber: '00000001' });
    const serialized = JSON.stringify(mem.runs[0].resultMetadata);
    expect(serialized).not.toMatch(/secret|token|password|apiKey|supplierId|authorization/i);
  });

  it('never approves or posts the created PurchaseOrder', async () => {
    const mem = createMemory();
    const result = await mem.service().createDraftPurchaseOrder(validBody() as never);
    expect(result.purchaseOrder.isPosted).toBe(false);
    expect(result.purchaseOrder.isApproved).toBe(false);
  });

  it('blocks a tenant-scoped API key from another company', () => {
    expect(
      resolveInternalCompanyAccess(COMPANY_A, {
        source: 'api-key',
        apiKey: { tenantId: COMPANY_B, permissions: ['*'] },
      })
    ).toBe('forbidden');
    expect(
      resolveInternalCompanyAccess(COMPANY_A, {
        source: 'api-key',
        apiKey: { tenantId: COMPANY_A, permissions: [] },
      })
    ).toBe('allow');
  });

  it('does not create a run when company validation fails before claim', async () => {
    const mem = createMemory();
    await expect(
      mem.service().createDraftPurchaseOrder(
        validBody({ companyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) as never
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mem.runs).toHaveLength(0);
  });

  it('persists FAILED when the domain returns a posted document', async () => {
    const mem = createMemory({
      onCreatePo: () => draftPo('po-posted', { isPosted: true }),
    });
    await expect(mem.service().createDraftPurchaseOrder(validBody() as never)).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(mem.runs[0].status).toBe('FAILED');
    expect(mem.runs[0].lastErrorCode).toBe(AUTOMATION_ERROR_CODES.DRAFT_POLICY);
    expect(mem.runs[0].resultEntityId).toBe('po-posted');
  });

  it('lists action runs only for the requested company', async () => {
    const mem = createMemory();
    await mem.service().createDraftPurchaseOrder(validBody() as never);
    mem.seedRun({
      id: 'run-other',
      companyId: COMPANY_B,
      eventId: 'evt-b',
      status: 'SUCCEEDED',
    });
    const listed = await mem.runService().list({
      companyId: COMPANY_A,
      page: 1,
      limit: 20,
    });
    expect(listed.total).toBe(1);
    expect(listed.runs.every((run) => run.companyId === COMPANY_A)).toBe(true);
    expect(await mem.runService().getById(COMPANY_A, 'run-other')).toBeNull();
  });

  it('overlapping stale reclaim converges on exactly one PurchaseOrder', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = 0;
    const mem = createMemory({
      beforeInsert: async () => {
        entered += 1;
        await gate;
      },
    });
    const svc = mem.service();
    const first = svc.createDraftPurchaseOrder(validBody() as never);
    await waitUntil(() => entered === 1);
    mem.runs[0].updatedAt = new Date(Date.now() - 60_000);

    const second = svc.createDraftPurchaseOrder(
      validBody({ correlationId: 'corr-stale-overlap' }) as never
    );
    await waitUntil(() => entered === 2);
    release();

    const results = await Promise.all([first, second]);
    expect(mem.orders).toHaveLength(1);
    expect(results[0].purchaseOrder.id).toBe(results[1].purchaseOrder.id);
    expect(results.filter((r) => r.duplicate).length).toBe(1);
    expect(results.filter((r) => !r.duplicate).length).toBe(1);
    expect(mem.orders[0].isPosted).toBe(false);
    expect(mem.orders[0].isApproved).toBe(false);
    expect(mem.runs).toHaveLength(1);
    expect(mem.runs[0].status).toBe('SUCCEEDED');
    expect(mem.runs[0].resultEntityId).toBe(mem.orders[0].id);
  });

  it('two different automation actions can still create separate PurchaseOrders', async () => {
    const mem = createMemory();
    const svc = mem.service();
    const first = await svc.createDraftPurchaseOrder(validBody() as never);
    const second = await svc.createDraftPurchaseOrder(
      validBody({
        eventId: 'evt-002',
        correlationId: 'evt-002:other',
      }) as never
    );
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(false);
    expect(first.purchaseOrder.id).not.toBe(second.purchaseOrder.id);
    expect(mem.orders).toHaveLength(2);
    expect(mem.orders[0].automationIdempotencyKey).not.toBe(
      mem.orders[1].automationIdempotencyKey
    );
  });
});

async function waitUntil(predicate: () => boolean, timeoutMs = 1000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for overlapping create');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
