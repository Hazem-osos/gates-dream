/**
 * Automation Event Catalog (V1).
 *
 * Every entry describes a real GATES domain boundary. `emission` states
 * exactly how (and whether) GATES currently produces this event:
 *
 *  - 'realtime'   — emitted synchronously-triggered-but-asynchronously-
 *                    delivered from a real domain/service success path
 *                    (see automation-event-bus.service.ts callers).
 *  - 'scheduled'   — emitted by a daily background job (BullMQ repeatable
 *                    job), not a live transaction event.
 *  - 'plannedNotEmitting' — metadata exists for forward compatibility /
 *                    frontend preview, but GATES does not emit it yet.
 *                    Creating a rule for these is rejected (see
 *                    condition-validator.ts) until they are wired.
 *
 * DO NOT add events for modules/lifecycle states that don't genuinely
 * exist — see the final report for what was deliberately left out and why.
 */
import { defineField, type EventFieldDefinition } from './field-types';

export type EventEmissionStatus = 'realtime' | 'scheduled' | 'plannedNotEmitting';

export interface AutomationEventDefinition {
  eventType: string;
  category: string;
  labelKey: string;
  descriptionKey: string;
  emission: EventEmissionStatus;
  /** Human-readable explanation shown in the metadata API for non-realtime events. */
  emissionNote?: string;
  /**
   * Whether the frontend may offer this event as a new-rule trigger.
   * False for plannedNotEmitting events — they stay in the internal catalog
   * so existing rules (if any) still validate, but they are not selectable.
   */
  selectable: boolean;
  fields: EventFieldDefinition[];
}

const salesInvoiceFields: EventFieldDefinition[] = [
  defineField({
    key: 'invoiceId',
    type: 'entity',
    entityKind: 'salesInvoice',
    labelKey: 'automation.fields.invoiceId',
    operators: ['eq', 'neq'],
  }),
  defineField({
    key: 'invoiceNumber',
    type: 'string',
    labelKey: 'automation.fields.invoiceNumber',
  }),
  defineField({
    key: 'totalAmount',
    type: 'money',
    labelKey: 'automation.fields.totalAmount',
    currencyField: 'currencyCode',
  }),
  defineField({
    key: 'netAmount',
    type: 'money',
    labelKey: 'automation.fields.netAmount',
    currencyField: 'currencyCode',
  }),
  defineField({
    key: 'customerId',
    type: 'entity',
    entityKind: 'customer',
    labelKey: 'automation.fields.customer',
  }),
  defineField({
    key: 'customerCategoryId',
    type: 'entity',
    entityKind: 'customerCategory',
    labelKey: 'automation.fields.customerCategory',
  }),
  defineField({
    key: 'warehouseId',
    type: 'entity',
    entityKind: 'warehouse',
    labelKey: 'automation.fields.warehouse',
  }),
  defineField({
    key: 'currencyCode',
    type: 'string',
    labelKey: 'automation.fields.currencyCode',
    operators: ['eq', 'neq'],
  }),
];

export const EVENT_CATALOG: AutomationEventDefinition[] = [
  // ───────────────────────── SALES ─────────────────────────
  {
    eventType: 'sales.invoice.created',
    category: 'sales',
    labelKey: 'automation.events.salesInvoiceCreated',
    descriptionKey: 'automation.events.salesInvoiceCreated.description',
    emission: 'realtime',
    selectable: true,
    fields: salesInvoiceFields,
  },
  {
    eventType: 'sales.invoice.posted',
    category: 'sales',
    labelKey: 'automation.events.salesInvoicePosted',
    descriptionKey: 'automation.events.salesInvoicePosted.description',
    emission: 'realtime',
    selectable: true,
    emissionNote:
      'Emitted after a sales invoice post commits. The posting transaction itself is unchanged.',
    fields: salesInvoiceFields,
  },
  {
    eventType: 'sales.invoice.overdue',
    category: 'sales',
    labelKey: 'automation.events.salesInvoiceOverdue',
    descriptionKey: 'automation.events.salesInvoiceOverdue.description',
    emission: 'scheduled',
    selectable: true,
    emissionNote:
      'Emitted once per calendar day (UTC) by a scheduled job that scans POSTED, ' +
      'not-fully-paid sale invoices past their dueDate. Not a live transaction event — ' +
      'there can be up to ~24h delay between an invoice becoming overdue and the event firing.',
    fields: [
      defineField({
        key: 'invoiceId',
        type: 'entity',
        entityKind: 'salesInvoice',
        labelKey: 'automation.fields.invoiceId',
        operators: ['eq', 'neq'],
      }),
      defineField({ key: 'invoiceNumber', type: 'string', labelKey: 'automation.fields.invoiceNumber' }),
      defineField({
        key: 'customerId',
        type: 'entity',
        entityKind: 'customer',
        labelKey: 'automation.fields.customer',
      }),
      defineField({ key: 'daysOverdue', type: 'number', labelKey: 'automation.fields.daysOverdue' }),
      defineField({ key: 'remainingAmount', type: 'money', labelKey: 'automation.fields.remainingAmount' }),
    ],
  },

  // ───────────────────────── CUSTOMERS ─────────────────────────
  {
    eventType: 'customer.created',
    category: 'customers',
    labelKey: 'automation.events.customerCreated',
    descriptionKey: 'automation.events.customerCreated.description',
    emission: 'realtime',
    selectable: true,
    fields: [
      defineField({
        key: 'customerId',
        type: 'entity',
        entityKind: 'customer',
        labelKey: 'automation.fields.customer',
        operators: ['eq', 'neq'],
      }),
      defineField({ key: 'arabicName', type: 'string', labelKey: 'automation.fields.customerName' }),
      defineField({
        key: 'customerType',
        type: 'enum',
        labelKey: 'automation.fields.customerType',
        enumValues: ['company', 'individual'],
      }),
      defineField({
        key: 'priceTier',
        type: 'enum',
        labelKey: 'automation.fields.priceTier',
        enumValues: ['RETAIL', 'SEMI_WHOLESALE', 'WHOLESALE', 'PROJECTS'],
      }),
      defineField({
        key: 'customerCategoryId',
        type: 'entity',
        entityKind: 'customerCategory',
        labelKey: 'automation.fields.customerCategory',
      }),
      defineField({ key: 'city', type: 'string', labelKey: 'automation.fields.city' }),
    ],
  },

  // ───────────────────────── INVENTORY ─────────────────────────
  {
    eventType: 'inventory.stock.belowMinimum',
    category: 'inventory',
    labelKey: 'automation.events.stockBelowMinimum',
    descriptionKey: 'automation.events.stockBelowMinimum.description',
    emission: 'realtime',
    selectable: true,
    fields: [
      defineField({
        key: 'itemId',
        type: 'entity',
        entityKind: 'item',
        labelKey: 'automation.fields.item',
      }),
      defineField({
        key: 'warehouseId',
        type: 'entity',
        entityKind: 'warehouse',
        labelKey: 'automation.fields.warehouse',
      }),
      defineField({ key: 'quantityOnHand', type: 'number', labelKey: 'automation.fields.quantityOnHand' }),
      defineField({ key: 'minimumQuantity', type: 'number', labelKey: 'automation.fields.minimumQuantity' }),
      defineField({ key: 'shortageQuantity', type: 'number', labelKey: 'automation.fields.shortageQuantity' }),
    ],
  },

  // ───────────────────────── PURCHASING ─────────────────────────
  {
    eventType: 'purchase.order.created',
    category: 'purchasing',
    labelKey: 'automation.events.purchaseOrderCreated',
    descriptionKey: 'automation.events.purchaseOrderCreated.description',
    emission: 'realtime',
    selectable: true,
    emissionNote:
      'GATES models "purchase request" and "purchase order" as the same PurchaseOrder ' +
      'entity (a draft, unapproved, unposted PurchaseOrder created by automation IS a ' +
      'purchase request). There is no separate PurchaseRequest table, so this single ' +
      'event covers both concepts. Fired for orders created by a user AND by automation itself.',
    fields: [
      defineField({
        key: 'purchaseOrderId',
        type: 'entity',
        entityKind: 'purchaseOrder',
        labelKey: 'automation.fields.purchaseOrderId',
        operators: ['eq', 'neq'],
      }),
      defineField({ key: 'orderNumber', type: 'string', labelKey: 'automation.fields.orderNumber' }),
      defineField({
        key: 'supplierId',
        type: 'entity',
        entityKind: 'supplier',
        labelKey: 'automation.fields.supplier',
      }),
      defineField({
        key: 'warehouseId',
        type: 'entity',
        entityKind: 'warehouse',
        labelKey: 'automation.fields.warehouse',
      }),
      defineField({ key: 'totalAmount', type: 'money', labelKey: 'automation.fields.totalAmount' }),
      defineField({ key: 'netAmount', type: 'money', labelKey: 'automation.fields.netAmount' }),
      defineField({
        key: 'createdByAutomation',
        type: 'boolean',
        labelKey: 'automation.fields.createdByAutomation',
      }),
    ],
  },
  {
    eventType: 'purchase.order.approved',
    category: 'purchasing',
    labelKey: 'automation.events.purchaseOrderApproved',
    descriptionKey: 'automation.events.purchaseOrderApproved.description',
    emission: 'realtime',
    selectable: true,
    fields: [
      defineField({
        key: 'purchaseOrderId',
        type: 'entity',
        entityKind: 'purchaseOrder',
        labelKey: 'automation.fields.purchaseOrderId',
        operators: ['eq', 'neq'],
      }),
      defineField({ key: 'orderNumber', type: 'string', labelKey: 'automation.fields.orderNumber' }),
      defineField({
        key: 'supplierId',
        type: 'entity',
        entityKind: 'supplier',
        labelKey: 'automation.fields.supplier',
      }),
      defineField({ key: 'netAmount', type: 'money', labelKey: 'automation.fields.netAmount' }),
    ],
  },

  {
    eventType: 'purchase.invoice.posted',
    category: 'purchasing',
    labelKey: 'automation.events.purchaseInvoicePosted',
    descriptionKey: 'automation.events.purchaseInvoicePosted.description',
    emission: 'realtime',
    selectable: true,
    emissionNote: 'Emitted after a purchase invoice post commits. Posting itself is unchanged.',
    fields: [
      defineField({
        key: 'invoiceId',
        type: 'entity',
        entityKind: 'purchaseInvoice',
        labelKey: 'automation.fields.invoiceId',
        operators: ['eq', 'neq'],
      }),
      defineField({ key: 'invoiceNumber', type: 'string', labelKey: 'automation.fields.invoiceNumber' }),
      defineField({
        key: 'supplierId',
        type: 'entity',
        entityKind: 'supplier',
        labelKey: 'automation.fields.supplier',
      }),
      defineField({
        key: 'warehouseId',
        type: 'entity',
        entityKind: 'warehouse',
        labelKey: 'automation.fields.warehouse',
      }),
      defineField({
        key: 'totalAmount',
        type: 'money',
        labelKey: 'automation.fields.totalAmount',
        currencyField: 'currencyCode',
      }),
      defineField({
        key: 'netAmount',
        type: 'money',
        labelKey: 'automation.fields.netAmount',
        currencyField: 'currencyCode',
      }),
      defineField({
        key: 'currencyCode',
        type: 'string',
        labelKey: 'automation.fields.currencyCode',
        operators: ['eq', 'neq'],
      }),
    ],
  },

  {
    eventType: 'supplier.created',
    category: 'purchasing',
    labelKey: 'automation.events.supplierCreated',
    descriptionKey: 'automation.events.supplierCreated.description',
    emission: 'realtime',
    selectable: true,
    fields: [
      defineField({
        key: 'supplierId',
        type: 'entity',
        entityKind: 'supplier',
        labelKey: 'automation.fields.supplier',
        operators: ['eq', 'neq'],
      }),
      defineField({ key: 'arabicName', type: 'string', labelKey: 'automation.fields.supplierName' }),
      defineField({
        key: 'supplierType',
        type: 'enum',
        labelKey: 'automation.fields.supplierType',
        enumValues: ['company', 'individual'],
      }),
    ],
  },

  {
    eventType: 'hr.employee.created',
    category: 'hr',
    labelKey: 'automation.events.employeeCreated',
    descriptionKey: 'automation.events.employeeCreated.description',
    emission: 'realtime',
    selectable: true,
    fields: [
      defineField({ key: 'arabicName', type: 'string', labelKey: 'automation.fields.employeeName' }),
      defineField({ key: 'city', type: 'string', labelKey: 'automation.fields.city' }),
      defineField({ key: 'basicSalary', type: 'money', labelKey: 'automation.fields.basicSalary' }),
    ],
  },

  {
    eventType: 'project.created',
    category: 'projects',
    labelKey: 'automation.events.projectCreated',
    descriptionKey: 'automation.events.projectCreated.description',
    emission: 'realtime',
    selectable: true,
    fields: [
      defineField({ key: 'arabicName', type: 'string', labelKey: 'automation.fields.projectName' }),
      defineField({ key: 'englishName', type: 'string', labelKey: 'automation.fields.englishName' }),
      defineField({ key: 'totalValue', type: 'money', labelKey: 'automation.fields.totalValue' }),
    ],
  },
];

const EVENT_BY_TYPE = new Map(EVENT_CATALOG.map((event) => [event.eventType, event]));

export function getEventDefinition(eventType: string): AutomationEventDefinition | undefined {
  return EVENT_BY_TYPE.get(eventType);
}

export function getEventField(
  eventType: string,
  fieldKey: string
): EventFieldDefinition | undefined {
  return getEventDefinition(eventType)?.fields.find((field) => field.key === fieldKey);
}

/** Events a rule may legally target today (excludes plannedNotEmitting / non-selectable). */
export function isEventTypeCreatable(eventType: string): boolean {
  const event = getEventDefinition(eventType);
  return Boolean(event) && event!.selectable && event!.emission !== 'plannedNotEmitting';
}

/** Selectable/creatable events for new automations — the 6 currently emitted types. */
export function listCreatableEvents(): AutomationEventDefinition[] {
  return EVENT_CATALOG.filter((event) => event.selectable && event.emission !== 'plannedNotEmitting');
}

/** Catalog entries that exist internally but must not be offered as working triggers. */
export function listPlannedEvents(): AutomationEventDefinition[] {
  return EVENT_CATALOG.filter((event) => !event.selectable || event.emission === 'plannedNotEmitting');
}
