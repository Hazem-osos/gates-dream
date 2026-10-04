import { catalogText } from './labels';
import { suggestAutomation } from './suggest-rule';
import { groupAutomationRuns } from './group-runs';
import {
  actionUnavailableReasonKey,
  compatibleBindFields,
  creatableEvents,
  isEventFieldBinding,
  type AutomationMetadata,
} from './metadata';
import { validateAutomationDraft } from './validate-rule';
import type { AutomationRun } from './types';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const t = (key: string, vars?: Record<string, string | number>) => {
  const table: Record<string, string> = {
    'automation.eventDescriptions.stockBelowMinimum': 'Stock fell below minimum',
    'automation.events.stockBelowMinimum': 'Stock Below Minimum',
    'automation.metadataRequired': 'metadata',
    'automation.nameRequired': 'name',
    'automation.whenRequired': 'when',
    'automation.thenRequired': 'then',
    'automation.eventUnsupported': 'event',
    'automation.actionConfigRequired': 'config',
    'automation.bindingIncompatible': 'binding',
    'automation.chooseSupplier': 'supplier',
    'automation.capabilities.email.smtpUnset': 'smtp',
    'automation.unknownConfig': 'unknown',
  };
  const raw = table[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
};

const metadata: AutomationMetadata = {
  operators: ['eq', 'gt'],
  events: [
    {
      eventType: 'inventory.stock.belowMinimum',
      category: 'inventory',
      labelKey: 'automation.events.stockBelowMinimum',
      descriptionKey: 'automation.events.stockBelowMinimum.description',
      emission: 'realtime',
      creatable: true,
      selectable: true,
      fields: [
        { key: 'itemId', type: 'entity', labelKey: 'automation.fields.item', operators: ['eq'], entityType: 'item' },
        { key: 'shortageQuantity', type: 'number', labelKey: 'automation.fields.shortageQuantity', operators: ['gt', 'eq'] },
        { key: 'warehouseId', type: 'entity', labelKey: 'automation.fields.warehouse', operators: ['eq'], entityType: 'warehouse' },
      ],
    },
  ],
  plannedEvents: [
    {
      eventType: 'sales.invoice.posted',
      category: 'sales',
      labelKey: 'automation.events.salesInvoicePosted',
      descriptionKey: 'automation.events.salesInvoicePosted.description',
      emission: 'plannedNotEmitting',
      creatable: false,
      selectable: false,
      fields: [],
    },
  ],
  actions: [
    {
      type: 'gates.createPurchaseRequest',
      category: 'gates',
      labelKey: 'automation.actions.createPurchaseRequest',
      descriptionKey: 'automation.actions.createPurchaseRequest.description',
      executedBy: 'gates',
      config: [
        { key: 'supplierId', type: 'entity', labelKey: 'automation.fields.supplier', required: true, entityType: 'supplier', bindable: false },
        { key: 'quantity', type: 'number', labelKey: 'automation.fields.quantity', required: false, bindable: true },
        { key: 'itemId', type: 'entity', labelKey: 'automation.fields.item', required: false, entityType: 'item', bindable: true },
      ],
    },
    {
      type: 'email.send',
      category: 'communication',
      labelKey: 'automation.actions.sendEmail',
      descriptionKey: 'automation.actions.sendEmail.description',
      executedBy: 'gates',
      config: [{ key: 'to', type: 'string', labelKey: 'automation.fields.emailTo', required: true, bindable: true }],
    },
  ],
  categories: { events: ['inventory'], actions: ['gates', 'communication'] },
  capabilities: { email: { available: false, unavailableReasonKey: 'automation.capabilities.email.smtpUnset' } },
};

assert(!creatableEvents(metadata).some((event) => event.eventType === 'sales.invoice.posted'), 'hide planned events');
assert(creatableEvents(metadata).some((event) => event.eventType === 'inventory.stock.belowMinimum'), 'show creatable event');

const purchase = metadata.actions[0]!;
const quantity = purchase.config.find((field) => field.key === 'quantity')!;
const bindable = compatibleBindFields(metadata.events[0], quantity).map((field) => field.key);
assert(bindable.includes('shortageQuantity') && !bindable.includes('itemId'), 'number binds only to numbers');
const itemField = purchase.config.find((field) => field.key === 'itemId')!;
const itemBinds = compatibleBindFields(metadata.events[0], itemField).map((field) => field.key);
assert(itemBinds.includes('itemId') && !itemBinds.includes('warehouseId'), 'entity binds only to the same kind');
assert(isEventFieldBinding({ source: 'event', field: 'shortageQuantity' }), 'binding shape');

assert(
  catalogText(t, 'automation.events.stockBelowMinimum.description') === 'Stock fell below minimum',
  'description key maps to eventDescriptions'
);

const base = {
  name: 'Keep stock',
  eventType: 'inventory.stock.belowMinimum',
  conditions: [],
  actions: [
    {
      type: 'gates.createPurchaseRequest',
      config: {
        itemId: { source: 'event', field: 'itemId' },
        quantity: { source: 'event', field: 'shortageQuantity' },
      },
    },
  ],
};
assert(validateAutomationDraft(t, metadata, base) === 'config', 'supplier required');
assert(
  validateAutomationDraft(t, metadata, {
    ...base,
    actions: [{ type: 'gates.createPurchaseRequest', config: { supplierId: 'sup-1', quantity: { source: 'event', field: 'itemId' } } }],
  }) === 'binding',
  'reject incompatible binding'
);
assert(
  validateAutomationDraft(t, metadata, {
    ...base,
    actions: [{ type: 'gates.createPurchaseRequest', config: { supplierId: 'sup-1', quantity: { source: 'event', field: 'shortageQuantity' } } }],
  }) === null,
  'valid replenishment draft'
);
assert(
  validateAutomationDraft(t, metadata, {
    name: 'Mail',
    eventType: 'inventory.stock.belowMinimum',
    conditions: [],
    actions: [{ type: 'email.send', config: { to: 'a@b.co' } }],
  }) === 'smtp',
  'disable email when metadata says unavailable'
);
assert(actionUnavailableReasonKey({ ...metadata, capabilities: undefined }, 'email.send') === null, 'do not guess email');
assert(
  actionUnavailableReasonKey(
    {
      ...metadata,
      capabilities: {
        whatsapp: { available: false, unavailableReasonKey: 'automation.capabilities.whatsapp.notConfigured' },
      },
    },
    'whatsapp.send'
  ) === 'automation.capabilities.whatsapp.notConfigured',
  'disable whatsapp when the provider is missing'
);
assert(
  validateAutomationDraft(t, metadata, {
    ...base,
    actions: [{ type: 'gates.createPurchaseRequest', config: { supplierId: 'sup-1', extra: true } }],
  }) === 'unknown',
  'keep unknown keys visible as an error instead of dropping them'
);

const runs: AutomationRun[] = [
  {
    id: 'a2',
    companyId: 'c',
    eventId: 'e1',
    eventType: 'sales.invoice.created',
    ruleId: 'r1',
    ruleName: 'Large',
    actionType: 'email.send',
    correlationId: 'corr',
    status: 'FAILED',
    attemptCount: 1,
    startedAt: '2026-09-23T10:00:02.000Z',
    completedAt: '2026-09-23T10:00:03.000Z',
    resultEntityType: null,
    resultEntityId: null,
    resultMetadata: null,
    lastErrorCode: null,
    errorMessage: 'no',
    createdAt: '2026-09-23T10:00:02.000Z',
    updatedAt: '2026-09-23T10:00:03.000Z',
  },
  {
    id: 'a1',
    companyId: 'c',
    eventId: 'e1',
    eventType: 'sales.invoice.created',
    ruleId: 'r1',
    ruleName: 'Large',
    actionType: 'gates.createNotification',
    correlationId: 'corr',
    status: 'SUCCEEDED',
    attemptCount: 1,
    startedAt: '2026-09-23T10:00:01.000Z',
    completedAt: '2026-09-23T10:00:02.000Z',
    resultEntityType: null,
    resultEntityId: null,
    resultMetadata: null,
    lastErrorCode: null,
    errorMessage: null,
    createdAt: '2026-09-23T10:00:01.000Z',
    updatedAt: '2026-09-23T10:00:02.000Z',
  },
  {
    id: 'b1',
    companyId: 'c',
    eventId: 'e2',
    eventType: 'customer.created',
    ruleId: 'r1',
    ruleName: 'Large',
    actionType: 'gates.createNotification',
    correlationId: 'corr2',
    status: 'SUCCEEDED',
    attemptCount: 1,
    startedAt: '2026-09-23T11:00:00.000Z',
    completedAt: null,
    resultEntityType: null,
    resultEntityId: null,
    resultMetadata: null,
    lastErrorCode: null,
    errorMessage: null,
    createdAt: '2026-09-23T11:00:00.000Z',
    updatedAt: '2026-09-23T11:00:00.000Z',
  },
];

const groups = groupAutomationRuns(runs);
assert(groups.length === 2, 'group by event and rule');
assert(groups[0]?.eventId === 'e2', 'newest execution first');
assert(groups[1]?.runs.map((run) => run.actionType).join(',') === 'gates.createNotification,email.send', 'actions stay in execution order');

const suggested = suggestAutomation('لما فاتورة مبيعات أكبر من 10000');
assert(suggested?.eventType === 'sales.invoice.created', 'agent matches a sales invoice');
assert(suggested?.conditions[0]?.field === 'totalAmount', 'agent uses the amount field');
assert(suggested?.conditions[0]?.operator === 'gt', 'agent uses greater than');
assert(suggestAutomation('hello') == null, 'agent ignores unknown text');

console.log('automation metadata tests ok');
test('automation metadata assertions', () => {});
