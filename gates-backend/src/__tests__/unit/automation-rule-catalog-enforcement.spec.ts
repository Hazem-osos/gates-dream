import { AutomationRuleService } from '../../modules/automation/services/automation-rule.service';
import type { AutomationRuleDb, AutomationRuleRecord } from '../../modules/automation/services/automation-rule.types';

const COMPANY_A = '00000000-0000-0000-0000-000000000001';

function createMemoryDb(seed: AutomationRuleRecord[] = []): AutomationRuleDb {
  const rows = [...seed];
  return {
    automationRule: {
      findMany: async () => rows,
      findFirst: async (args: unknown) => {
        const { where } = (args ?? {}) as { where?: { id?: string; companyId?: string } };
        return (
          rows.find(
            (row) =>
              (!where?.id || row.id === where.id) && (!where?.companyId || row.companyId === where.companyId)
          ) ?? null
        );
      },
      create: async (args: unknown) => {
        const { data } = args as { data: Partial<AutomationRuleRecord> };
        const created: AutomationRuleRecord = {
          id: `rule-${rows.length + 1}`,
          companyId: data.companyId!,
          name: data.name!,
          description: data.description ?? null,
          eventType: data.eventType!,
          enabled: data.enabled ?? true,
          conditions: data.conditions ?? [],
          actions: data.actions ?? [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(created);
        return created;
      },
      update: async (args: unknown) => {
        const { where, data } = args as { where: { id: string }; data: Partial<AutomationRuleRecord> };
        const index = rows.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error('not found');
        rows[index] = { ...rows[index], ...data, updatedAt: new Date() };
        return rows[index];
      },
      delete: async (args: unknown) => {
        const { where } = args as { where: { id: string } };
        const index = rows.findIndex((row) => row.id === where.id);
        const [removed] = rows.splice(index, 1);
        return removed;
      },
      count: async () => rows.length,
    },
  };
}

// Entity-free events/actions so these tests never need a real Prisma entity lookup.
const validCreateInput = {
  name: 'Large invoice alert',
  eventType: 'sales.invoice.created',
  enabled: true,
  conditions: [{ field: 'totalAmount' as const, operator: 'gt' as const, value: 250000 }],
  actions: [
    { type: 'gates.createNotification', config: { title: 'Big invoice', message: 'Check it out' } },
  ],
};

describe('AutomationRuleService — catalog enforcement', () => {
  it('creates a rule whose fields/operators/actions exist in the catalog', async () => {
    const service = new AutomationRuleService(createMemoryDb());
    const rule = await service.createRule(COMPANY_A, validCreateInput);
    expect(rule.eventType).toBe('sales.invoice.created');
  });

  it('rejects creating a rule for a plannedNotEmitting event', async () => {
    const service = new AutomationRuleService(createMemoryDb());
    await expect(
      service.createRule(COMPANY_A, { ...validCreateInput, eventType: 'sales.invoice.posted' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects creating a rule with a condition field that does not exist for the event', async () => {
    const service = new AutomationRuleService(createMemoryDb());
    await expect(
      service.createRule(COMPANY_A, {
        ...validCreateInput,
        conditions: [{ field: 'notReal' as never, operator: 'eq', value: 1 }],
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects creating a rule whose action config is missing a required field', async () => {
    const service = new AutomationRuleService(createMemoryDb());
    await expect(
      service.createRule(COMPANY_A, {
        ...validCreateInput,
        actions: [{ type: 'gates.createNotification', config: { title: 'Only a title' } }],
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('re-validates the merged state on update, catching a stale conditions/eventType mismatch', async () => {
    const seed = [
      {
        id: 'rule-1',
        companyId: COMPANY_A,
        name: 'Rule',
        description: null,
        eventType: 'sales.invoice.created',
        enabled: true,
        conditions: [{ field: 'totalAmount', operator: 'gt', value: 1 }],
        actions: validCreateInput.actions,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const service = new AutomationRuleService(createMemoryDb(seed));

    // Changing eventType alone, while old conditions reference a field that
    // doesn't exist on the new event, must be rejected.
    await expect(
      service.updateRule(COMPANY_A, 'rule-1', { eventType: 'customer.created' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('allows a partial update (e.g. only enabled) that keeps the existing valid state', async () => {
    const seed = [
      {
        id: 'rule-1',
        companyId: COMPANY_A,
        name: 'Rule',
        description: null,
        eventType: 'sales.invoice.created',
        enabled: true,
        conditions: validCreateInput.conditions,
        actions: validCreateInput.actions,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const service = new AutomationRuleService(createMemoryDb(seed));
    const updated = await service.updateRule(COMPANY_A, 'rule-1', { enabled: false });
    expect(updated.enabled).toBe(false);
  });

  it('duplicateRule copies conditions/actions but always starts disabled', async () => {
    const seed = [
      {
        id: 'rule-1',
        companyId: COMPANY_A,
        name: 'Rule',
        description: null,
        eventType: 'sales.invoice.created',
        enabled: true,
        conditions: validCreateInput.conditions,
        actions: validCreateInput.actions,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const service = new AutomationRuleService(createMemoryDb(seed));
    const copy = await service.duplicateRule(COMPANY_A, 'rule-1');
    expect(copy.enabled).toBe(false);
    expect(copy.eventType).toBe('sales.invoice.created');
    expect(copy.id).not.toBe('rule-1');
  });
});
