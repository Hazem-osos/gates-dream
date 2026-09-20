/**
 * Automation Action Catalog (V1).
 *
 * `executedBy` states who actually performs the action:
 *  - 'gates' — n8n calls a GATES internal endpoint, which reuses an
 *              existing GATES domain service. GATES owns validation,
 *              idempotency (AutomationActionRun) and the resulting data.
 *  - 'n8n'   — n8n performs the action itself (its own HTTP/email nodes).
 *              GATES only catalogs + validates the *shape* of the config
 *              at rule-save time so the frontend can render safe controls
 *              and obviously-broken rules are rejected before saving.
 *
 * Do NOT implement fake actions — every entry here maps to a real,
 * already-existing GATES service, or to a config shape n8n itself executes.
 */
import { type EntityKind, type EventFieldType } from './field-types';

export interface ActionConfigFieldDefinition {
  key: string;
  type: EventFieldType;
  labelKey: string;
  descriptionKey?: string;
  required: boolean;
  entityKind?: EntityKind;
  enumValues?: string[];
  /** May this field's value be a `{source:'event', field}` binding instead of a constant? */
  bindable: boolean;
  maxLength?: number;
}

export type ActionExecutor = 'gates' | 'n8n';

export interface AutomationActionDefinition {
  type: string;
  category: string;
  labelKey: string;
  descriptionKey: string;
  executedBy: ActionExecutor;
  config: ActionConfigFieldDefinition[];
}

function field(def: {
  key: string;
  type: EventFieldType;
  labelKey: string;
  descriptionKey?: string;
  required?: boolean;
  entityKind?: EntityKind;
  enumValues?: string[];
  bindable?: boolean;
  maxLength?: number;
}): ActionConfigFieldDefinition {
  return {
    key: def.key,
    type: def.type,
    labelKey: def.labelKey,
    descriptionKey: def.descriptionKey,
    required: def.required ?? false,
    entityKind: def.entityKind,
    enumValues: def.enumValues,
    bindable: def.bindable ?? false,
    maxLength: def.maxLength,
  };
}

export const CREATE_PURCHASE_REQUEST_ACTION = 'gates.createPurchaseRequest';
export const CREATE_NOTIFICATION_ACTION = 'gates.createNotification';
export const SEND_EMAIL_ACTION = 'email.send';
export const WEBHOOK_ACTION = 'webhook';

export const ACTION_CATALOG: AutomationActionDefinition[] = [
  {
    type: CREATE_PURCHASE_REQUEST_ACTION,
    category: 'gates',
    labelKey: 'automation.actions.createPurchaseRequest',
    descriptionKey: 'automation.actions.createPurchaseRequest.description',
    executedBy: 'gates',
    config: [
      field({
        key: 'supplierId',
        type: 'entity',
        entityKind: 'supplier',
        labelKey: 'automation.fields.supplier',
        required: true,
      }),
      field({
        key: 'warehouseId',
        type: 'entity',
        entityKind: 'warehouse',
        labelKey: 'automation.fields.warehouse',
        required: false,
      }),
      field({
        key: 'quantity',
        type: 'number',
        labelKey: 'automation.fields.quantity',
        required: false,
        bindable: true,
      }),
      field({
        key: 'description',
        type: 'string',
        labelKey: 'automation.fields.description',
        required: false,
        maxLength: 2000,
        bindable: true,
      }),
    ],
  },
  {
    type: CREATE_NOTIFICATION_ACTION,
    category: 'gates',
    labelKey: 'automation.actions.createNotification',
    descriptionKey: 'automation.actions.createNotification.description',
    executedBy: 'gates',
    config: [
      field({
        key: 'title',
        type: 'string',
        labelKey: 'automation.fields.notificationTitle',
        required: true,
        maxLength: 200,
        bindable: true,
      }),
      field({
        key: 'message',
        type: 'string',
        labelKey: 'automation.fields.notificationMessage',
        required: true,
        maxLength: 2000,
        bindable: true,
      }),
      field({
        key: 'userId',
        type: 'entity',
        entityKind: 'user',
        labelKey: 'automation.fields.notificationUser',
        descriptionKey: 'automation.fields.notificationUser.description',
        required: false,
      }),
      field({
        key: 'linkUrl',
        type: 'string',
        labelKey: 'automation.fields.notificationLink',
        required: false,
        maxLength: 500,
        bindable: true,
      }),
      field({
        key: 'severity',
        type: 'enum',
        labelKey: 'automation.fields.notificationSeverity',
        required: false,
        enumValues: ['info', 'warn', 'error'],
      }),
    ],
  },
  {
    type: SEND_EMAIL_ACTION,
    category: 'communication',
    labelKey: 'automation.actions.sendEmail',
    descriptionKey: 'automation.actions.sendEmail.description',
    executedBy: 'gates',
    config: [
      field({
        key: 'to',
        type: 'string',
        labelKey: 'automation.fields.emailTo',
        descriptionKey: 'automation.fields.emailTo.description',
        required: true,
        maxLength: 500,
        bindable: true,
      }),
      field({
        key: 'subject',
        type: 'string',
        labelKey: 'automation.fields.emailSubject',
        required: true,
        maxLength: 300,
        bindable: true,
      }),
      field({
        key: 'body',
        type: 'string',
        labelKey: 'automation.fields.emailBody',
        required: true,
        maxLength: 10_000,
        bindable: true,
      }),
    ],
  },
  {
    type: WEBHOOK_ACTION,
    category: 'integrations',
    labelKey: 'automation.actions.webhook',
    descriptionKey: 'automation.actions.webhook.description',
    executedBy: 'n8n',
    config: [
      field({
        key: 'url',
        type: 'string',
        labelKey: 'automation.fields.webhookUrl',
        descriptionKey: 'automation.fields.webhookUrl.description',
        required: true,
        maxLength: 2000,
      }),
      field({
        key: 'method',
        type: 'enum',
        labelKey: 'automation.fields.webhookMethod',
        required: false,
        enumValues: ['GET', 'POST', 'PUT', 'PATCH'],
      }),
      field({
        key: 'body',
        type: 'string',
        labelKey: 'automation.fields.webhookBody',
        required: false,
        maxLength: 10_000,
        bindable: true,
      }),
    ],
  },
];

const ACTION_BY_TYPE = new Map(ACTION_CATALOG.map((action) => [action.type, action]));

export function getActionDefinition(type: string): AutomationActionDefinition | undefined {
  return ACTION_BY_TYPE.get(type);
}
