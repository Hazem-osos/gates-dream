import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
} from '../../modules/automation/schemas/automation-rule.schema';
import {
  buildEnabledLookupWhere,
  listEnabledRulesForEvent,
  toN8nAutomationRule,
} from '../../modules/automation/services/automation-rule.mapper';
import type {
  AutomationRuleDb,
  AutomationRuleRecord,
} from '../../modules/automation/services/automation-rule.types';
import {
  apiKeyMayLookupCompany,
  matchesPlatformAutomationSecret,
  resolveInternalCompanyAccess,
} from '../../shared/middleware/internal-automation-auth.helpers';

const COMPANY_A = '00000000-0000-0000-0000-000000000001';
const COMPANY_B = '00000000-0000-0000-0000-000000000002';

function rule(partial: Partial<AutomationRuleRecord> & Pick<AutomationRuleRecord, 'id' | 'companyId' | 'eventType' | 'enabled'>): AutomationRuleRecord {
  return {
    name: partial.name ?? 'Rule',
    description: partial.description ?? null,
    conditions: partial.conditions ?? [{ field: 'data.total', operator: 'gt', value: 100000 }],
    actions: partial.actions ?? [{ type: 'notification.email', config: { recipient: 'manager' } }],
    createdAt: partial.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: partial.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  };
}

function createMemoryDb(seed: AutomationRuleRecord[]): AutomationRuleDb {
  const rows = [...seed];
  return {
    automationRule: {
      findMany: async (args: unknown) => {
        const { where, skip, take } = (args ?? {}) as {
          where?: { companyId?: string; eventType?: string; enabled?: boolean };
          skip?: number;
          take?: number;
        };
        let result = rows.filter((row) => {
          if (where?.companyId && row.companyId !== where.companyId) return false;
          if (where?.eventType && row.eventType !== where.eventType) return false;
          if (where?.enabled !== undefined && row.enabled !== where.enabled) return false;
          return true;
        });
        if (typeof skip === 'number') result = result.slice(skip);
        if (typeof take === 'number') result = result.slice(0, take);
        return result;
      },
      findFirst: async (args: unknown) => {
        const { where } = (args ?? {}) as { where?: { id?: string; companyId?: string } };
        return (
          rows.find(
            (row) =>
              (!where?.id || row.id === where.id) &&
              (!where?.companyId || row.companyId === where.companyId)
          ) ?? null
        );
      },
      create: async (args: unknown) => {
        const { data } = args as { data: AutomationRuleRecord };
        const created: AutomationRuleRecord = {
          ...data,
          id: data.id ?? `rule-${rows.length + 1}`,
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
        if (index < 0) throw new Error('not found');
        const [removed] = rows.splice(index, 1);
        return removed;
      },
      count: async (args: unknown) => {
        const found = await createMemoryDb(rows).automationRule.findMany(args);
        return found.length;
      },
    },
  };
}

const matchingInvoice = rule({
  id: 'rule-001',
  companyId: COMPANY_A,
  name: 'Large invoice alert',
  eventType: 'sales.invoice.posted',
  enabled: true,
  conditions: [{ field: 'data.total', operator: 'gt', value: 100000 }],
  actions: [{ type: 'notification.email', config: { recipient: 'manager', template: 'large_invoice' } }],
});

const disabledInvoice = rule({
  id: 'rule-002',
  companyId: COMPANY_A,
  name: 'Disabled invoice alert',
  eventType: 'sales.invoice.posted',
  enabled: false,
});

const otherEvent = rule({
  id: 'rule-003',
  companyId: COMPANY_A,
  name: 'Low stock automation',
  eventType: 'inventory.stock.low',
  enabled: true,
  conditions: [{ field: 'data.quantity', operator: 'lt', value: 10 }],
  actions: [{ type: 'gates.createPurchaseRequest', config: {} }],
});

const otherTenant = rule({
  id: 'rule-004',
  companyId: COMPANY_B,
  name: 'Other tenant invoice alert',
  eventType: 'sales.invoice.posted',
  enabled: true,
});

describe('automation rule lookup', () => {
  const db = createMemoryDb([matchingInvoice, disabledInvoice, otherEvent, otherTenant]);

  it('returns enabled rules for matching tenant + eventType', async () => {
    const rules = await listEnabledRulesForEvent(COMPANY_A, 'sales.invoice.posted', db);
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({
      id: 'rule-001',
      companyId: COMPANY_A,
      name: 'Large invoice alert',
      enabled: true,
      eventType: 'sales.invoice.posted',
    });
  });

  it('does not return another tenant\'s rules', async () => {
    const rules = await listEnabledRulesForEvent(COMPANY_B, 'sales.invoice.posted', db);
    expect(rules.map((row) => row.id)).toEqual(['rule-004']);
    expect(rules.every((row) => row.companyId === COMPANY_B)).toBe(true);

    const companyA = await listEnabledRulesForEvent(COMPANY_A, 'sales.invoice.posted', db);
    expect(companyA.every((row) => row.companyId === COMPANY_A)).toBe(true);
    expect(companyA.some((row) => row.id === 'rule-004')).toBe(false);
  });

  it('excludes disabled rules from the n8n lookup', async () => {
    const rules = await listEnabledRulesForEvent(COMPANY_A, 'sales.invoice.posted', db);
    expect(rules.some((row) => row.id === 'rule-002')).toBe(false);
    expect(buildEnabledLookupWhere(COMPANY_A, 'sales.invoice.posted')).toEqual({
      companyId: COMPANY_A,
      eventType: 'sales.invoice.posted',
      enabled: true,
    });
  });

  it('excludes a different eventType', async () => {
    const rules = await listEnabledRulesForEvent(COMPANY_A, 'sales.invoice.posted', db);
    expect(rules.some((row) => row.eventType === 'inventory.stock.low')).toBe(false);

    const stock = await listEnabledRulesForEvent(COMPANY_A, 'inventory.stock.low', db);
    expect(stock.map((row) => row.id)).toEqual(['rule-003']);
  });
});

describe('automation rule validation', () => {
  const valid = {
    name: 'Large invoice alert',
    eventType: 'sales.invoice.posted',
    enabled: true,
    conditions: [{ field: 'data.total', operator: 'gt' as const, value: 100000 }],
    actions: [{ type: 'notification.email', config: { recipient: 'manager', template: 'large_invoice' } }],
  };

  it('rejects an invalid condition operator', () => {
    const parsed = createAutomationRuleSchema.safeParse({
      ...valid,
      conditions: [{ field: 'data.total', operator: 'startsWith', value: 1 }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.includes('operator'))).toBe(true);
    }
  });

  it('rejects a rule with no actions', () => {
    const parsed = createAutomationRuleSchema.safeParse({
      ...valid,
      actions: [],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.includes('actions'))).toBe(true);
    }
  });

  it('stores a generic/custom eventType without code changes', () => {
    const parsed = createAutomationRuleSchema.parse({
      ...valid,
      eventType: 'custom.tenant.event.v1',
    });
    expect(parsed.eventType).toBe('custom.tenant.event.v1');
  });

  it('stores a generic/custom action type without code changes', () => {
    const parsed = createAutomationRuleSchema.parse({
      ...valid,
      actions: [{ type: 'custom.webhook.dispatch', config: { endpointAlias: 'ops' } }],
    });
    expect(parsed.actions[0].type).toBe('custom.webhook.dispatch');
  });

  it('rejects empty name or eventType and non-array conditions', () => {
    expect(createAutomationRuleSchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
    expect(createAutomationRuleSchema.safeParse({ ...valid, eventType: '' }).success).toBe(false);
    expect(createAutomationRuleSchema.safeParse({ ...valid, conditions: {} }).success).toBe(false);
  });

  it('rejects action config secrets and requires action type', () => {
    expect(
      createAutomationRuleSchema.safeParse({
        ...valid,
        actions: [{ type: 'notification.email', config: { apiKey: 'sk-live' } }],
      }).success
    ).toBe(false);
    expect(
      createAutomationRuleSchema.safeParse({
        ...valid,
        actions: [{ type: '', config: { recipient: 'manager' } }],
      }).success
    ).toBe(false);
    expect(
      createAutomationRuleSchema.safeParse({
        ...valid,
        actions: [{ type: 'notification.email', config: 'manager' }],
      }).success
    ).toBe(false);
  });

  it('allows a partial update that only toggles enabled', () => {
    expect(updateAutomationRuleSchema.parse({ enabled: false })).toEqual({ enabled: false });
  });
});

describe('automation rule persistence helpers', () => {
  it('maps a stored rule to the n8n payload shape', () => {
    expect(toN8nAutomationRule(matchingInvoice)).toEqual({
      id: 'rule-001',
      companyId: COMPANY_A,
      name: 'Large invoice alert',
      description: null,
      enabled: true,
      eventType: 'sales.invoice.posted',
      conditions: matchingInvoice.conditions,
      actions: matchingInvoice.actions,
    });
  });

  it('persists generic eventType and action type on the tenant that created them', async () => {
    const db = createMemoryDb([]);
    const created = await db.automationRule.create({
      data: {
        companyId: COMPANY_A,
        name: 'Custom hook',
        description: null,
        eventType: 'ops.nightly.reconcile',
        enabled: true,
        conditions: [{ field: 'data.status', operator: 'eq', value: 'ready' }],
        actions: [{ type: 'gates.runReconcile', config: { dryRun: false } }],
      },
    });
    expect(created.eventType).toBe('ops.nightly.reconcile');
    expect((created.actions as { type: string }[])[0].type).toBe('gates.runReconcile');

    const own = await db.automationRule.findFirst({
      where: { id: created.id, companyId: COMPANY_A },
    });
    const foreign = await db.automationRule.findFirst({
      where: { id: created.id, companyId: COMPANY_B },
    });
    expect(own?.name).toBe('Custom hook');
    expect(foreign).toBeNull();
  });
});

describe('internal automation auth isolation', () => {
  it('lets a platform env secret match without leaking length via raw compare', () => {
    expect(matchesPlatformAutomationSecret('n8n-secret', 'n8n-secret')).toBe(true);
    expect(matchesPlatformAutomationSecret('n8n-secret', 'other')).toBe(false);
    expect(matchesPlatformAutomationSecret('n8n-secret', undefined)).toBe(false);
  });

  it('blocks a tenant-scoped API key from another company', () => {
    expect(
      apiKeyMayLookupCompany(COMPANY_A, { tenantId: COMPANY_B, permissions: ['*'] })
    ).toBe(false);
    expect(
      apiKeyMayLookupCompany(COMPANY_A, { tenantId: COMPANY_A, permissions: [] })
    ).toBe(true);
    expect(
      resolveInternalCompanyAccess(COMPANY_A, {
        source: 'api-key',
        apiKey: { tenantId: COMPANY_B, permissions: ['*'] },
        scopedCompanyId: COMPANY_B,
      })
    ).toBe('forbidden');
  });

  it('allows the platform secret to look up any company', () => {
    expect(resolveInternalCompanyAccess(COMPANY_B, { source: 'platform-secret' })).toBe('allow');
  });
});
