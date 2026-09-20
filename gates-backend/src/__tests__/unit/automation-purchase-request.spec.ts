import { createAutomationPurchaseRequestSchema } from '../../modules/automation/schemas/automation-purchase-request.schema';
import { AutomationPurchaseRequestService } from '../../modules/automation/services/automation-purchase-request.service';
import {
  AutomationPurchaseRequestError,
  type AutomationActionRunDb,
  type AutomationActionRunRecord,
  type PurchaseOrderDomain,
  type PurchaseOrderView,
} from '../../modules/automation/services/automation-action-run.types';
import { mapAutomationPayloadToPurchaseOrder } from '../../modules/automation/services/automation-purchase-request.mapper';
import { resolveInternalCompanyAccess } from '../../shared/middleware/internal-automation-auth.helpers';

const COMPANY_A = 'd5b92313-74fc-4359-875a-7b9ee5918ac3';
const COMPANY_B = '00000000-0000-0000-0000-000000000002';
const RULE_ID = '991ed11e-86d2-455f-8518-13d41fc2dbdc';
const SUPPLIER_A = '11111111-1111-4111-8111-111111111111';
const ITEM_A = '22222222-2222-4222-8222-222222222222';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    companyId: COMPANY_A,
    eventId: 'evt-001',
    correlationId: 'evt-001:rule-1:gates.createPurchaseRequest',
    ruleId: RULE_ID,
    supplierId: SUPPLIER_A,
    date: '2026-09-20T13:00:00.000Z',
    lines: [{ itemId: ITEM_A, quantity: 10 }],
    ...overrides,
  };
}

function draftPo(id = 'po-1'): PurchaseOrderView {
  return {
    id,
    orderNumber: 'PK-0001',
    companyId: COMPANY_A,
    isPosted: false,
    isApproved: false,
  };
}

function createMemory(opts?: {
  companies?: Array<{ id: string; isActive: boolean; deletedAt: Date | null }>;
  onCreatePo?: () => Promise<PurchaseOrderView> | PurchaseOrderView;
}) {
  const companies = opts?.companies ?? [
    { id: COMPANY_A, isActive: true, deletedAt: null },
    { id: COMPANY_B, isActive: true, deletedAt: null },
  ];
  const runs: AutomationActionRunRecord[] = [];
  const orders: PurchaseOrderView[] = [];
  let poCreates = 0;

  const db: AutomationActionRunDb = {
    company: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        companies.find((c) => c.id === where.id) ?? null,
    },
    purchaseOrder: {
      findFirst: async ({ where }: { where: { id?: string; companyId?: string; serial?: string } }) =>
        orders.find((o) => {
          if (where.id && o.id !== where.id) return false;
          if (where.companyId && o.companyId !== where.companyId) return false;
          return true;
        }) ?? null,
    },
    automationActionRun: {
      create: async ({ data }: { data: Omit<AutomationActionRunRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const dup = runs.find(
          (r) =>
            r.companyId === data.companyId &&
            r.eventId === data.eventId &&
            r.ruleId === data.ruleId &&
            r.actionType === data.actionType
        );
        if (dup) {
          const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          throw err;
        }
        const now = new Date();
        const row: AutomationActionRunRecord = {
          ...data,
          id: `run-${runs.length + 1}`,
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
        where: { companyId_eventId_ruleId_actionType: {
          companyId: string;
          eventId: string;
          ruleId: string;
          actionType: string;
        } };
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
      findFirst: async () => runs[0] ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<AutomationActionRunRecord>;
      }) => {
        const row = runs.find((r) => r.id === where.id);
        if (!row) throw new Error('run not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status?: string; resultEntityId?: null; updatedAt?: Date };
        data: Partial<AutomationActionRunRecord>;
      }) => {
        const row = runs.find((r) => {
          if (r.id !== where.id) return false;
          if (where.status && r.status !== where.status) return false;
          if (where.resultEntityId === null && r.resultEntityId) return false;
          if (where.updatedAt && r.updatedAt.getTime() !== where.updatedAt.getTime()) return false;
          return true;
        });
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      },
    },
  };

  const purchaseOrders: PurchaseOrderDomain = {
    createPurchaseOrder: async (companyId, data) => {
      const mapped = data as { supplierId: string; warehouseId?: string; lines: Array<{ itemId: string }> };
      if (mapped.supplierId === '33333333-3333-4333-8333-333333333333') {
        throw new Error('Supplier not found or does not belong to company');
      }
      if (mapped.warehouseId === '44444444-4444-4444-8444-444444444444') {
        throw new Error('Warehouse not found or does not belong to company');
      }
      if (mapped.lines.some((l) => l.itemId === '55555555-5555-4555-8555-555555555555')) {
        throw new Error('One or more items not found or do not belong to company');
      }
      poCreates += 1;
      const created = await (opts?.onCreatePo?.() ?? draftPo(`po-${poCreates}`));
      orders.push({ ...created, companyId });
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
    get poCreates() {
      return poCreates;
    },
    service: (now?: () => Date) =>
      new AutomationPurchaseRequestService(db, purchaseOrders, now),
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
  });
});

describe('automation purchase request adapter', () => {
  it('creates exactly one draft PurchaseOrder', async () => {
    const mem = createMemory();
    const result = await mem.service().createDraftPurchaseOrder(validBody() as never);
    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.purchaseOrder.isPosted).toBe(false);
    expect(result.purchaseOrder.isApproved).toBe(false);
    expect(mem.poCreates).toBe(1);
    expect(mem.runs[0].status).toBe('SUCCEEDED');
    expect(mem.runs[0].resultEntityType).toBe('PurchaseOrder');
  });

  it('does not create a second PurchaseOrder on replay', async () => {
    const mem = createMemory();
    const svc = mem.service();
    const first = await svc.createDraftPurchaseOrder(validBody() as never);
    const second = await svc.createDraftPurchaseOrder(validBody() as never);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.purchaseOrder.id).toBe(first.purchaseOrder.id);
    expect(mem.poCreates).toBe(1);
    expect(mem.runs).toHaveLength(1);
  });

  it('rejects concurrent duplicates before a second domain create', async () => {
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

  it('rejects supplier/item/warehouse that fail domain ownership checks', async () => {
    const mem = createMemory();
    const svc = mem.service();
    await expect(
      svc.createDraftPurchaseOrder(
        validBody({ supplierId: '33333333-3333-4333-8333-333333333333' }) as never
      )
    ).rejects.toBeInstanceOf(AutomationPurchaseRequestError);
    expect(mem.runs[0].status).toBe('FAILED');

    await expect(
      svc.createDraftPurchaseOrder(
        validBody({
          eventId: 'evt-item',
          correlationId: 'corr-item',
          lines: [{ itemId: '55555555-5555-4555-8555-555555555555', quantity: 1 }],
        }) as never
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      svc.createDraftPurchaseOrder(
        validBody({
          eventId: 'evt-wh',
          correlationId: 'corr-wh',
          warehouseId: '44444444-4444-4444-8444-444444444444',
        }) as never
      )
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('never approves or posts the created PurchaseOrder', async () => {
    const mem = createMemory();
    const result = await mem.service().createDraftPurchaseOrder(validBody() as never);
    expect(result.purchaseOrder.isPosted).toBe(false);
    expect(result.purchaseOrder.isApproved).toBe(false);
  });
});
