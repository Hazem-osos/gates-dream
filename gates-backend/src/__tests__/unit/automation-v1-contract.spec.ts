import prisma from '../../shared/database/prisma';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    customer: { findMany: jest.fn() },
    supplier: { findMany: jest.fn() },
    item: { findMany: jest.fn() },
    warehouse: { findMany: jest.fn() },
    customerCategory: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

import { buildAutomationMetadata } from '../../modules/automation/catalog/metadata.service';
import {
  AUTOMATION_TEMPLATES,
  listAutomationTemplateViews,
  listTemplateRequiredUserFields,
} from '../../modules/automation/catalog/templates';
import { isEventTypeCreatable, listCreatableEvents } from '../../modules/automation/catalog/event-catalog';
import { ACTION_CATALOG, getActionDefinition } from '../../modules/automation/catalog/action-catalog';
import { validateAutomationConditions } from '../../modules/automation/catalog/condition-validator';
import { validateAutomationActions } from '../../modules/automation/catalog/action-validator';
import { validateBindingAgainstEvent } from '../../modules/automation/catalog/binding';
import { AutomationRuleService } from '../../modules/automation/services/automation-rule.service';
import type { AutomationRuleDb, AutomationRuleRecord } from '../../modules/automation/services/automation-rule.types';
import {
  sanitizeErrorMessage,
  sanitizeResultMetadata,
} from '../../modules/automation/services/automation-action-run.types';
import { toAutomationActionRunView } from '../../modules/automation/services/automation-action-run.mapper';
import { getAutomationDeliveryDiagnostic } from '../../modules/automation/services/automation-delivery-diagnostics';
import { AUTOMATION_ENTITY_LOOKUPS } from '../../modules/automation/catalog/metadata.service';

const COMPANY_A = '00000000-0000-0000-0000-000000000001';
const COMPANY_B = '00000000-0000-0000-0000-000000000002';
const SUPPLIER_ID = '22222222-2222-2222-2222-222222222222';
const FOREIGN_SUPPLIER = '33333333-3333-3333-3333-333333333333';

const supplierFindMany = prisma.supplier.findMany as jest.Mock;

const EMITTED_PAYLOADS: Record<string, string[]> = {
  'sales.invoice.created': [
    'invoiceId',
    'invoiceNumber',
    'totalAmount',
    'netAmount',
    'customerId',
    'customerCategoryId',
    'warehouseId',
    'currencyCode',
  ],
  'sales.invoice.overdue': [
    'invoiceId',
    'invoiceNumber',
    'customerId',
    'daysOverdue',
    'remainingAmount',
  ],
  'customer.created': [
    'customerId',
    'arabicName',
    'customerType',
    'priceTier',
    'customerCategoryId',
    'city',
  ],
  'inventory.stock.belowMinimum': [
    'itemId',
    'warehouseId',
    'quantityOnHand',
    'minimumQuantity',
    'shortageQuantity',
  ],
  'purchase.order.created': [
    'purchaseOrderId',
    'orderNumber',
    'supplierId',
    'warehouseId',
    'totalAmount',
    'netAmount',
    'createdByAutomation',
  ],
  'purchase.order.approved': ['purchaseOrderId', 'orderNumber', 'supplierId', 'netAmount'],
  'sales.invoice.posted': [
    'invoiceId',
    'invoiceNumber',
    'totalAmount',
    'netAmount',
    'customerId',
    'customerCategoryId',
    'warehouseId',
    'currencyCode',
  ],
  'purchase.invoice.posted': [
    'invoiceId',
    'invoiceNumber',
    'supplierId',
    'warehouseId',
    'totalAmount',
    'netAmount',
    'currencyCode',
  ],
  'supplier.created': ['supplierId', 'arabicName', 'supplierType'],
  'hr.employee.created': ['arabicName', 'city', 'basicSalary'],
  'project.created': ['arabicName', 'englishName', 'totalValue'],
};

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Automation V1 contract — events', () => {
  it('exposes every emitted event as selectable/creatable', () => {
    const metadata = buildAutomationMetadata();
    expect(metadata.events.map((event) => event.eventType).sort()).toEqual(Object.keys(EMITTED_PAYLOADS).sort());
    expect(listCreatableEvents().map((event) => event.eventType).sort()).toEqual(
      Object.keys(EMITTED_PAYLOADS).sort()
    );
    for (const event of metadata.events) {
      expect(event.selectable).toBe(true);
      expect(event.creatable).toBe(true);
      expect(isEventTypeCreatable(event.eventType)).toBe(true);
    }
  });

  it('matches metadata fields to the actually emitted payloads', () => {
    const metadata = buildAutomationMetadata();
    for (const event of metadata.events) {
      expect(event.fields.map((field) => field.key)).toEqual(EMITTED_PAYLOADS[event.eventType]);
      for (const field of event.fields) {
        expect(field.operators.length).toBeGreaterThan(0);
        expect(field.bindable).toBe(true);
        if (field.type === 'entity') {
          expect(field.entityType).toBeDefined();
        }
      }
    }
  });

  it('treats sales.invoice.posted as a working trigger after post commits', async () => {
    expect(isEventTypeCreatable('sales.invoice.posted')).toBe(true);
    const metadata = buildAutomationMetadata();
    expect(metadata.events.some((event) => event.eventType === 'sales.invoice.posted')).toBe(true);
    expect(metadata.plannedEvents.some((event) => event.eventType === 'sales.invoice.posted')).toBe(false);
    await expect(validateAutomationConditions(COMPANY_A, 'sales.invoice.posted', [])).resolves.toBeUndefined();
  });
});

describe('Automation V1 contract — actions', () => {
  it('exposes executable actions with complete config metadata', () => {
    const metadata = buildAutomationMetadata();
    expect(metadata.actions.map((action) => action.type)).toEqual([
      'gates.createPurchaseRequest',
      'gates.createNotification',
      'email.send',
      'whatsapp.send',
      'webhook',
    ]);
    expect(ACTION_CATALOG).toHaveLength(5);
    expect(metadata.capabilities.whatsapp.available).toBe(false);

    const pr = metadata.actions.find((action) => action.type === 'gates.createPurchaseRequest')!;
    expect(pr.execution).toEqual(
      expect.objectContaining({
        executedBy: 'gates',
        recordsActionRun: true,
        endpoint: '/internal/v1/automation/purchase-requests',
        method: 'POST',
      })
    );
    expect(pr.config.find((field) => field.key === 'supplierId')).toEqual(
      expect.objectContaining({ required: true, entityType: 'supplier', bindable: false })
    );
    expect(pr.config.find((field) => field.key === 'itemId')).toEqual(
      expect.objectContaining({ required: false, entityType: 'item', bindable: true })
    );
    expect(pr.config.find((field) => field.key === 'warehouseId')).toEqual(
      expect.objectContaining({ required: false, entityType: 'warehouse', bindable: true })
    );
    expect(pr.config.find((field) => field.key === 'quantity')).toEqual(
      expect.objectContaining({ bindable: true, type: 'number' })
    );
    expect(pr.suggestedEventBindings).toEqual(
      expect.arrayContaining([
        { eventType: 'inventory.stock.belowMinimum', configKey: 'itemId', eventField: 'itemId' },
        { eventType: 'inventory.stock.belowMinimum', configKey: 'warehouseId', eventField: 'warehouseId' },
        {
          eventType: 'inventory.stock.belowMinimum',
          configKey: 'quantity',
          eventField: 'shortageQuantity',
        },
      ])
    );

    const webhook = metadata.actions.find((action) => action.type === 'webhook')!;
    expect(webhook.execution.recordsActionRun).toBe(false);
    expect(webhook.execution.executedBy).toBe('n8n');
    expect(webhook.execution.endpoint).toBeNull();
    expect(webhook.config.find((field) => field.key === 'url')?.format).toBe('url');

    const email = metadata.actions.find((action) => action.type === 'email.send')!;
    expect(email.execution.endpoint).toBe('/internal/v1/automation/actions/execute');
  });

  it('allows stock event bindings for purchase-request item/warehouse/quantity', () => {
    expect(
      validateBindingAgainstEvent({ source: 'event', field: 'itemId' }, 'inventory.stock.belowMinimum')
    ).toEqual({ ok: true });
    expect(
      validateBindingAgainstEvent({ source: 'event', field: 'warehouseId' }, 'inventory.stock.belowMinimum')
    ).toEqual({ ok: true });
    expect(
      validateBindingAgainstEvent({ source: 'event', field: 'shortageQuantity' }, 'inventory.stock.belowMinimum')
    ).toEqual({ ok: true });
  });
});

describe('Automation V1 contract — templates', () => {
  it('lists four real templates and requires supplier selection for stock replenishment', () => {
    const views = listAutomationTemplateViews();
    expect(views.map((template) => template.id)).toEqual([
      'large-invoice-alert',
      'keep-stock-replenished',
      'overdue-customer-follow-up',
      'new-customer-welcome',
    ]);
    const stock = views.find((template) => template.id === 'keep-stock-replenished')!;
    expect(stock.complete).toBe(false);
    expect(listTemplateRequiredUserFields(stock).map((field) => field.key)).toEqual(['supplierId']);
    expect(stock.actions[0].config?.quantity).toEqual({ source: 'event', field: 'shortageQuantity' });
  });

  it('validates every template after required user fields are supplied', async () => {
    supplierFindMany.mockResolvedValue([{ id: SUPPLIER_ID }]);
    for (const template of AUTOMATION_TEMPLATES) {
      const required = listTemplateRequiredUserFields(template);
      const actions = template.actions.map((action, index) => {
        const extra: Record<string, unknown> = {};
        for (const field of required.filter((item) => item.actionIndex === index)) {
          extra[field.key] = SUPPLIER_ID;
        }
        return { ...action, config: { ...action.config, ...extra } };
      });
      await expect(validateAutomationConditions(COMPANY_A, template.eventType, template.conditions)).resolves.toBeUndefined();
      await expect(validateAutomationActions(COMPANY_A, template.eventType, actions)).resolves.toBeUndefined();
    }
  });
});

describe('Automation V1 contract — CRUD + isolation', () => {
  const createInput = {
    name: 'Large invoice alert',
    eventType: 'sales.invoice.created',
    enabled: true,
    conditions: [{ field: 'totalAmount' as const, operator: 'gt' as const, value: 250000 }],
    actions: [{ type: 'gates.createNotification', config: { title: 'Big', message: 'Check' } }],
  };

  it('creates, updates, duplicates, toggles, deletes — and isolates tenants', async () => {
    const db = createMemoryDb();
    const service = new AutomationRuleService(db);

    const created = await service.createRule(COMPANY_A, createInput);
    expect(created.companyId).toBe(COMPANY_A);

    const updated = await service.updateRule(COMPANY_A, created.id, { name: 'Renamed' });
    expect(updated.name).toBe('Renamed');

    const disabled = await service.setEnabled(COMPANY_A, created.id, false);
    expect(disabled.enabled).toBe(false);

    const copy = await service.duplicateRule(COMPANY_A, created.id);
    expect(copy.enabled).toBe(false);
    expect(copy.id).not.toBe(created.id);

    await expect(service.getRuleById(COMPANY_B, created.id)).rejects.toMatchObject({ statusCode: 404 });

    await service.deleteRule(COMPANY_A, created.id);
    await expect(service.getRuleById(COMPANY_A, created.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('accepts a posted-invoice rule and rejects a foreign supplier', async () => {
    const service = new AutomationRuleService(createMemoryDb());
    await expect(
      service.createRule(COMPANY_A, { ...createInput, eventType: 'sales.invoice.posted' })
    ).resolves.toMatchObject({ eventType: 'sales.invoice.posted' });

    supplierFindMany.mockResolvedValueOnce([]);
    await expect(
      validateAutomationActions(COMPANY_A, 'inventory.stock.belowMinimum', [
        {
          type: 'gates.createPurchaseRequest',
          config: { supplierId: FOREIGN_SUPPLIER },
        },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('Automation V1 contract — run history + capabilities', () => {
  it('sanitizes run metadata and error messages', () => {
    expect(sanitizeResultMetadata({ orderNumber: '1', apiKey: 'x', nested: { a: 1 } })).toEqual({
      orderNumber: '1',
    });
    expect(sanitizeErrorMessage('SMTP down\n    at email.handler.ts:12')).toBe('SMTP down');

    const view = toAutomationActionRunView(
      {
        id: 'run-1',
        companyId: COMPANY_A,
        eventId: 'evt-1',
        eventType: 'sales.invoice.created',
        ruleId: 'rule-1',
        actionType: 'gates.createNotification',
        correlationId: 'corr-1',
        status: 'FAILED',
        attemptCount: 2,
        startedAt: new Date(),
        completedAt: new Date(),
        resultEntityType: null,
        resultEntityId: null,
        resultMetadata: { token: 'nope', title: 'ok' },
        lastErrorCode: 'DOMAIN_ERROR',
        errorMessage: 'Config field "to" resolved to an empty value\nstack',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      'Rule'
    );
    expect(view.ruleName).toBe('Rule');
    expect(view.eventId).toBe('evt-1');
    expect(view.correlationId).toBe('corr-1');
    expect(view.resultMetadata).toEqual({ title: 'ok' });
    expect(view.errorMessage).toBe('Config field "to" resolved to an empty value');
  });

  it('exposes email/delivery capabilities without secrets and existing entity lookups', () => {
    const metadata = buildAutomationMetadata();
    expect(typeof metadata.capabilities.email.available).toBe('boolean');
    expect(metadata.capabilities.webhook.recordsActionRun).toBe(false);
    expect(typeof metadata.capabilities.delivery.redisEnabled).toBe('boolean');
    expect(typeof metadata.capabilities.delivery.eventIntakeConfigured).toBe('boolean');
    expect(JSON.stringify(metadata).toLowerCase()).not.toContain('smtp_host');
    expect(JSON.stringify(metadata).toLowerCase()).not.toContain('n8n_event_intake_url');

    expect(metadata.entityTypes.map((entity) => entity.type)).toEqual([
      'customer',
      'supplier',
      'item',
      'warehouse',
      'customerCategory',
      'user',
      'salesInvoice',
      'purchaseInvoice',
      'purchaseOrder',
    ]);
    expect(metadata.entityTypes.find((entity) => entity.type === 'salesInvoice')?.query).toEqual({
      invoiceKind: 'SALE',
    });
    expect(AUTOMATION_ENTITY_LOOKUPS.supplier.listPath).toBe('/accounting/suppliers');
    expect(getActionDefinition('gates.createPurchaseRequest')?.execution.endpoint).toBe(
      '/internal/v1/automation/purchase-requests'
    );

    const diagnostic = getAutomationDeliveryDiagnostic();
    expect(['ready', 'disabled', 'no_intake']).toContain(diagnostic.status);
    expect(diagnostic.message.length).toBeGreaterThan(0);
  });
});
