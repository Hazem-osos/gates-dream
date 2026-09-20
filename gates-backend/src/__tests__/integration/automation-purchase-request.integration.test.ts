/**
 * Real Prisma-backed integration test for the n8n purchase-request
 * automation adapter (`POST /internal/v1/automation/purchase-requests`).
 *
 * Unlike `automation-purchase-request.spec.ts` (in-memory fakes), this
 * exercises the actual production singleton — real `AutomationActionRunService`
 * + real `purchaseOrderService.createPurchaseOrder` — against a real MySQL
 * database, following the exact isolation convention already used by
 * `optimistic-locking.test.ts`: uniquely-named throwaway companies created
 * in `beforeAll`, hard-deleted in `afterAll`.
 *
 * SAFETY: this connects to whatever `DATABASE_URL` is loaded from the
 * local `.env` (the developer's local MySQL, e.g. `gates_db` on
 * localhost:3306) — the same target every other integration test in this
 * folder already uses. It NEVER touches Railway/production. Do not point
 * `DATABASE_URL` at production when running this suite.
 */
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ override: true });

import { automationPurchaseRequestService } from '../../modules/automation/services/automation-purchase-request.instance';
import { automationIdempotencyKey } from '../../modules/automation/services/automation-purchase-request.mapper';
import type { CreateAutomationPurchaseRequestInput } from '../../modules/automation/schemas/automation-purchase-request.schema';

const prisma = new PrismaClient();

describe('Automation purchase-request — real Prisma-backed integration', () => {
  jest.setTimeout(60_000);

  const RULE_ID = '11111111-1111-4111-8111-111111111111';
  const ACTION_TYPE = 'gates.createPurchaseRequest';

  let companyId: string;
  let otherCompanyId: string;
  let supplierId: string;
  let warehouseId: string;
  let itemId: string;
  let otherSupplierId: string;
  let otherItemId: string;

  beforeAll(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const [company, otherCompany] = await Promise.all([
      prisma.company.create({
        data: {
          arabicName: `Automation IT ${suffix}`,
          englishName: `Automation IT ${suffix}`,
          isActive: true,
        },
      }),
      prisma.company.create({
        data: {
          arabicName: `Automation IT Other ${suffix}`,
          englishName: `Automation IT Other ${suffix}`,
          isActive: true,
        },
      }),
    ]);
    companyId = company.id;
    otherCompanyId = otherCompany.id;

    const [supplier, warehouse, item, otherSupplier, otherItem] = await Promise.all([
      prisma.supplier.create({ data: { companyId, arabicName: `Supplier ${suffix}` } }),
      prisma.warehouse.create({ data: { companyId, arabicName: `Warehouse ${suffix}` } }),
      prisma.item.create({ data: { companyId, arabicName: `Item ${suffix}` } }),
      prisma.supplier.create({
        data: { companyId: otherCompanyId, arabicName: `Other Supplier ${suffix}` },
      }),
      prisma.item.create({ data: { companyId: otherCompanyId, arabicName: `Other Item ${suffix}` } }),
    ]);
    supplierId = supplier.id;
    warehouseId = warehouse.id;
    itemId = item.id;
    otherSupplierId = otherSupplier.id;
    otherItemId = otherItem.id;
  });

  afterAll(async () => {
    const companyIds = [companyId, otherCompanyId];
    await prisma.automationActionRun.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.purchaseOrderLine.deleteMany({
      where: { purchaseOrder: { companyId: { in: companyIds } } },
    });
    await prisma.purchaseOrderCondition.deleteMany({
      where: { purchaseOrder: { companyId: { in: companyIds } } },
    });
    await prisma.purchaseOrder.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.inventoryMovement.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.item.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.warehouse.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.supplier.deleteMany({ where: { companyId: { in: companyIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    await prisma.$disconnect();
  });

  function baseInput(
    overrides: Partial<CreateAutomationPurchaseRequestInput> = {}
  ): CreateAutomationPurchaseRequestInput {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      companyId,
      eventId: `evt-${unique}`,
      correlationId: `corr-${unique}`,
      eventType: 'inventory.stock.low',
      ruleId: RULE_ID,
      supplierId,
      date: new Date().toISOString(),
      warehouseId,
      lines: [{ itemId, quantity: 5 }],
      ...overrides,
    };
  }

  async function poCountForKey(scopeCompanyId: string, eventId: string) {
    return prisma.purchaseOrder.count({
      where: {
        companyId: scopeCompanyId,
        automationIdempotencyKey: automationIdempotencyKey({ eventId, ruleId: RULE_ID }),
      },
    });
  }

  it('A: first valid request creates exactly one draft PurchaseOrder + one SUCCEEDED AutomationActionRun', async () => {
    const input = baseInput();
    const result = await automationPurchaseRequestService.createDraftPurchaseOrder(input);

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.purchaseOrder.isApproved).toBe(false);
    expect(result.purchaseOrder.isPosted).toBe(false);

    const po = await prisma.purchaseOrder.findUnique({ where: { id: result.purchaseOrder.id } });
    expect(po).not.toBeNull();
    expect(po?.isPosted).toBe(false);
    expect(po?.isApproved).toBe(false);
    expect(po?.isCancelled).toBe(false);
    expect(po?.automationIdempotencyKey).toBe(
      automationIdempotencyKey({ eventId: input.eventId, ruleId: RULE_ID })
    );

    const runs = await prisma.automationActionRun.findMany({
      where: { companyId, eventId: input.eventId, ruleId: RULE_ID, actionType: ACTION_TYPE },
    });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('SUCCEEDED');
    expect(runs[0].resultEntityId).toBe(result.purchaseOrder.id);
    expect(runs[0].attemptCount).toBe(1);

    expect(await poCountForKey(companyId, input.eventId)).toBe(1);
  });

  it('B: exact replay reuses the same result — no second PurchaseOrder', async () => {
    const input = baseInput();
    const first = await automationPurchaseRequestService.createDraftPurchaseOrder(input);
    const second = await automationPurchaseRequestService.createDraftPurchaseOrder(input);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.purchaseOrder.id).toBe(first.purchaseOrder.id);

    expect(await poCountForKey(companyId, input.eventId)).toBe(1);
    const runs = await prisma.automationActionRun.findMany({
      where: { companyId, eventId: input.eventId, ruleId: RULE_ID, actionType: ACTION_TYPE },
    });
    expect(runs).toHaveLength(1);
  });

  it('C: same event/rule/action with a changed correlationId still creates no second PurchaseOrder', async () => {
    const input = baseInput({ correlationId: 'corr-C-original' });
    const first = await automationPurchaseRequestService.createDraftPurchaseOrder(input);
    const second = await automationPurchaseRequestService.createDraftPurchaseOrder({
      ...input,
      correlationId: 'corr-C-changed',
    });

    expect(second.duplicate).toBe(true);
    expect(second.purchaseOrder.id).toBe(first.purchaseOrder.id);

    expect(await poCountForKey(companyId, input.eventId)).toBe(1);
    const runs = await prisma.automationActionRun.findMany({
      where: { companyId, eventId: input.eventId, ruleId: RULE_ID, actionType: ACTION_TYPE },
    });
    expect(runs).toHaveLength(1);
    // First-claim correlationId stays canonical — a retry's different
    // correlationId must never overwrite the recovery key.
    expect(runs[0].correlationId).toBe('corr-C-original');
  });

  it('D: concurrent duplicate requests converge on exactly one PurchaseOrder', async () => {
    const input = baseInput();

    const settled = await Promise.allSettled([
      automationPurchaseRequestService.createDraftPurchaseOrder(input),
      automationPurchaseRequestService.createDraftPurchaseOrder(input),
      automationPurchaseRequestService.createDraftPurchaseOrder(input),
    ]);

    const fulfilled = settled.filter(
      (s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof automationPurchaseRequestService.createDraftPurchaseOrder>>> =>
        s.status === 'fulfilled'
    );
    const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');

    // Every rejection must be the documented transient 409 (in-progress /
    // claim conflict) — never an unexpected error — and at least one
    // request must have actually resolved successfully.
    for (const r of rejected) {
      expect((r.reason as { statusCode?: number }).statusCode).toBe(409);
    }
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const resultIds = new Set(fulfilled.map((f) => f.value.purchaseOrder.id));
    expect(resultIds.size).toBe(1);

    // The database-unique invariant is the real guarantee, independent of
    // which/how many calls happened to observe success vs 409.
    expect(await poCountForKey(companyId, input.eventId)).toBe(1);
    const runs = await prisma.automationActionRun.findMany({
      where: { companyId, eventId: input.eventId, ruleId: RULE_ID, actionType: ACTION_TYPE },
    });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('SUCCEEDED');
  });

  it('E: invalid/foreign supplier or item → no PurchaseOrder, permanent 400 semantics', async () => {
    const badSupplierInput = baseInput({ supplierId: otherSupplierId });
    await expect(
      automationPurchaseRequestService.createDraftPurchaseOrder(badSupplierInput)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await poCountForKey(companyId, badSupplierInput.eventId)).toBe(0);

    const badItemInput = baseInput({ lines: [{ itemId: otherItemId, quantity: 1 }] });
    await expect(
      automationPurchaseRequestService.createDraftPurchaseOrder(badItemInput)
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(await poCountForKey(companyId, badItemInput.eventId)).toBe(0);

    const failedRun = await prisma.automationActionRun.findFirst({
      where: { companyId, eventId: badSupplierInput.eventId, ruleId: RULE_ID, actionType: ACTION_TYPE },
    });
    expect(failedRun?.status).toBe('FAILED');
    expect(failedRun?.lastErrorCode).toBe('OWNERSHIP');
  });

  it('F: FAILED action followed by a corrected retry — one lifecycle row, attemptCount increments, exactly one final PurchaseOrder', async () => {
    const eventId = `evt-F-${Date.now()}`;
    const badInput = baseInput({ eventId, supplierId: otherSupplierId });
    await expect(
      automationPurchaseRequestService.createDraftPurchaseOrder(badInput)
    ).rejects.toMatchObject({ statusCode: 400 });

    const run = await prisma.automationActionRun.findFirst({
      where: { companyId, eventId, ruleId: RULE_ID, actionType: ACTION_TYPE },
    });
    expect(run?.status).toBe('FAILED');
    expect(run?.attemptCount).toBe(1);

    const correctedInput = baseInput({ eventId }); // same eventId/ruleId, valid supplierId this time
    const result = await automationPurchaseRequestService.createDraftPurchaseOrder(correctedInput);
    expect(result.duplicate).toBe(false);

    const allRuns = await prisma.automationActionRun.findMany({
      where: { companyId, eventId, ruleId: RULE_ID, actionType: ACTION_TYPE },
    });
    expect(allRuns).toHaveLength(1); // reclaimed the same row, not a new one
    expect(allRuns[0].status).toBe('SUCCEEDED');
    expect(allRuns[0].attemptCount).toBe(2);

    expect(await poCountForKey(companyId, eventId)).toBe(1);
  });

  it('G: automation-created draft PurchaseOrder produces no inventory movement', async () => {
    const input = baseInput();
    const result = await automationPurchaseRequestService.createDraftPurchaseOrder(input);

    const movementsForItem = await prisma.inventoryMovement.findMany({
      where: { companyId, itemId },
    });
    expect(movementsForItem).toHaveLength(0);

    const movementsBySourceDoc = await prisma.inventoryMovement.findMany({
      where: { companyId, sourceDocumentId: result.purchaseOrder.id },
    });
    expect(movementsBySourceDoc).toHaveLength(0);
  });

  it('H: a different tenant cannot reuse supplier/item references belonging to another company', async () => {
    const crossTenantInput: CreateAutomationPurchaseRequestInput = {
      companyId: otherCompanyId,
      eventId: `evt-H-${Date.now()}`,
      correlationId: `corr-H-${Date.now()}`,
      eventType: 'inventory.stock.low',
      ruleId: RULE_ID,
      supplierId, // belongs to `companyId`, not `otherCompanyId`
      date: new Date().toISOString(),
      warehouseId, // also belongs to `companyId`
      lines: [{ itemId, quantity: 1 }], // also belongs to `companyId`
    };

    await expect(
      automationPurchaseRequestService.createDraftPurchaseOrder(crossTenantInput)
    ).rejects.toMatchObject({ statusCode: 400 });

    const poCount = await prisma.purchaseOrder.count({ where: { companyId: otherCompanyId } });
    expect(poCount).toBe(0);
  });
});
