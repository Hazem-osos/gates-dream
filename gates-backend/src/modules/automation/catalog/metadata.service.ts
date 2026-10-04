/**
 * Assembles the safe, user-facing Automation Capability Catalog response.
 * Contains zero secrets, credentials, internal URLs, or server internals —
 * only labelKeys/descriptionKeys (frontend localizes), field/operator/action
 * shape, and entity-selector kinds.
 */
import { CONDITION_OPERATORS, ENTITY_KINDS, type EntityKind } from './field-types';
import { EVENT_CATALOG, listCreatableEvents, listPlannedEvents } from './event-catalog';
import { ACTION_CATALOG } from './action-catalog';
import { env } from '../../../shared/config/env';
import { isCompanyEmailConfigured } from '../../company/services/company-email.service';
import { isCompanyWhatsappReady } from '../../whatsapp/whatsapp-connection.service';

export const AUTOMATION_ENTITY_LOOKUPS: Record<
  EntityKind,
  { type: EntityKind; listPath: string; query?: Record<string, string> }
> = {
  supplier: { type: 'supplier', listPath: '/accounting/suppliers' },
  warehouse: { type: 'warehouse', listPath: '/inventory/warehouses' },
  item: { type: 'item', listPath: '/inventory/items' },
  customer: { type: 'customer', listPath: '/accounting/customers' },
  customerCategory: { type: 'customerCategory', listPath: '/accounting/customer-categories' },
  user: { type: 'user', listPath: '/users' },
  salesInvoice: { type: 'salesInvoice', listPath: '/invoices', query: { invoiceKind: 'SALE' } },
  purchaseInvoice: { type: 'purchaseInvoice', listPath: '/invoices', query: { invoiceKind: 'PURCHASE' } },
  purchaseOrder: { type: 'purchaseOrder', listPath: '/inventory/purchase-orders' },
};

function serializeEvent(event: ReturnType<typeof listCreatableEvents>[number]) {
  return {
    eventType: event.eventType,
    category: event.category,
    labelKey: event.labelKey,
    descriptionKey: event.descriptionKey,
    emission: event.emission,
    emissionNote: event.emissionNote,
    selectable: event.selectable,
    creatable: event.selectable && event.emission !== 'plannedNotEmitting',
    fields: event.fields.map((field) => ({
      key: field.key,
      type: field.type,
      labelKey: field.labelKey,
      descriptionKey: field.descriptionKey,
      operators: field.operators,
      entityType: field.entityType ?? field.entityKind,
      enumValues: field.enumValues,
      currencyField: field.currencyField,
      bindable: field.bindable,
    })),
  };
}

function serializeAction(action: (typeof ACTION_CATALOG)[number]) {
  return {
    type: action.type,
    category: action.category,
    labelKey: action.labelKey,
    descriptionKey: action.descriptionKey,
    executedBy: action.executedBy,
    execution: action.execution,
    suggestedEventBindings: action.suggestedEventBindings ?? [],
    config: action.config.map((field) => ({
      key: field.key,
      type: field.type,
      labelKey: field.labelKey,
      descriptionKey: field.descriptionKey,
      required: field.required,
      bindable: field.bindable,
      entityType: field.entityType ?? field.entityKind,
      enumValues: field.enumValues,
      maxLength: field.maxLength,
      min: field.min,
      format: field.format,
      default: field.default,
    })),
  };
}

export function buildAutomationCapabilities(emailAvailable = false, whatsappAvailable = false) {
  return {
    email: {
      available: emailAvailable,
      unavailableReasonKey: emailAvailable ? null : 'automation.capabilities.email.smtpUnset',
    },
    whatsapp: {
      available: whatsappAvailable,
      unavailableReasonKey: whatsappAvailable ? null : 'automation.capabilities.whatsapp.notConfigured',
    },
    webhook: {
      executedBy: 'n8n' as const,
      recordsActionRun: false,
    },
    delivery: {
      redisEnabled: Boolean(env.REDIS_ENABLED),
      eventIntakeConfigured: Boolean(env.N8N_EVENT_INTAKE_URL),
    },
  };
}

export interface AutomationMetadataResponse {
  operators: readonly string[];
  events: ReturnType<typeof serializeEvent>[];
  plannedEvents: ReturnType<typeof serializeEvent>[];
  actions: ReturnType<typeof serializeAction>[];
  categories: { events: string[]; actions: string[] };
  entityTypes: Array<{ type: EntityKind; listPath: string; query?: Record<string, string> }>;
  capabilities: ReturnType<typeof buildAutomationCapabilities>;
}

export async function buildAutomationMetadataForCompany(companyId: string): Promise<AutomationMetadataResponse> {
  const emailAvailable = companyId ? await isCompanyEmailConfigured(companyId) : false;
  const whatsappAvailable = companyId ? await isCompanyWhatsappReady(companyId) : false;
  return { ...buildAutomationMetadata(), capabilities: buildAutomationCapabilities(emailAvailable, whatsappAvailable) };
}

export function buildAutomationMetadata(): AutomationMetadataResponse {
  const creatable = listCreatableEvents();
  const planned = listPlannedEvents();
  return {
    operators: CONDITION_OPERATORS,
    events: creatable.map(serializeEvent),
    plannedEvents: planned.map(serializeEvent),
    actions: ACTION_CATALOG.map(serializeAction),
    categories: {
      events: [...new Set(creatable.map((event) => event.category))],
      actions: [...new Set(ACTION_CATALOG.map((action) => action.category))],
    },
    entityTypes: ENTITY_KINDS.map((kind) => AUTOMATION_ENTITY_LOOKUPS[kind]),
    capabilities: buildAutomationCapabilities(),
  };
}

export { EVENT_CATALOG };
