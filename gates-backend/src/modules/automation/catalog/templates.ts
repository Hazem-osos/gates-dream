/**
 * Automation Template Catalog (V1).
 *
 * Templates are ONLY pre-filled automation rule definitions — creating a
 * rule from a template is exactly `POST /api/v1/automation/rules` with this
 * body pre-filled by the frontend. There is no separate runtime behind a
 * template; every one of them is built exclusively from events/actions that
 * genuinely exist in EVENT_CATALOG / ACTION_CATALOG (enforced by a unit test).
 *
 * "New Lead Assignment" and other CRM examples from the product brief are
 * intentionally NOT included — GATES has no Lead/Opportunity domain model.
 */
import { CREATE_NOTIFICATION_ACTION, CREATE_PURCHASE_REQUEST_ACTION } from './action-catalog';

export interface AutomationTemplateDefinition {
  id: string;
  labelKey: string;
  descriptionKey: string;
  category: string;
  eventType: string;
  conditions: Array<{ field: string; operator: string; value: unknown }>;
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
}

export const AUTOMATION_TEMPLATES: AutomationTemplateDefinition[] = [
  {
    id: 'large-invoice-alert',
    labelKey: 'automation.templates.largeInvoiceAlert',
    descriptionKey: 'automation.templates.largeInvoiceAlert.description',
    category: 'sales',
    eventType: 'sales.invoice.created',
    conditions: [{ field: 'totalAmount', operator: 'gt', value: 250000 }],
    actions: [
      {
        type: CREATE_NOTIFICATION_ACTION,
        config: {
          title: 'Large sales invoice created',
          message: { source: 'event', field: 'invoiceNumber' },
          severity: 'warn',
        },
      },
    ],
  },
  {
    id: 'keep-stock-replenished',
    labelKey: 'automation.templates.keepStockReplenished',
    descriptionKey: 'automation.templates.keepStockReplenished.description',
    category: 'inventory',
    eventType: 'inventory.stock.belowMinimum',
    conditions: [],
    actions: [
      {
        type: CREATE_PURCHASE_REQUEST_ACTION,
        config: {
          quantity: { source: 'event', field: 'shortageQuantity' },
          description: 'Auto-replenishment: stock fell below minimum',
        },
      },
    ],
  },
  {
    id: 'overdue-customer-follow-up',
    labelKey: 'automation.templates.overdueCustomerFollowUp',
    descriptionKey: 'automation.templates.overdueCustomerFollowUp.description',
    category: 'sales',
    eventType: 'sales.invoice.overdue',
    conditions: [{ field: 'daysOverdue', operator: 'gte', value: 7 }],
    actions: [
      {
        type: CREATE_NOTIFICATION_ACTION,
        config: {
          title: 'Customer invoice overdue',
          message: { source: 'event', field: 'invoiceNumber' },
          severity: 'error',
        },
      },
    ],
  },
  {
    id: 'new-customer-welcome',
    labelKey: 'automation.templates.newCustomerWelcome',
    descriptionKey: 'automation.templates.newCustomerWelcome.description',
    category: 'customers',
    eventType: 'customer.created',
    conditions: [],
    actions: [
      {
        type: CREATE_NOTIFICATION_ACTION,
        config: {
          title: 'New customer created',
          message: { source: 'event', field: 'arabicName' },
          severity: 'info',
        },
      },
    ],
  },
];
