/**
 * Shapes returned by GET /api/v1/automation/metadata and /templates.
 * The backend catalog is the only source of events, fields, operators, and actions.
 */

export type AutomationFieldType = 'string' | 'number' | 'money' | 'boolean' | 'date' | 'enum' | 'entity';

export type AutomationEntityKind =
  | 'customer'
  | 'supplier'
  | 'item'
  | 'warehouse'
  | 'customerCategory'
  | 'user'
  | 'salesInvoice'
  | 'purchaseInvoice'
  | 'purchaseOrder';

export type AutomationEmission = 'realtime' | 'scheduled' | 'plannedNotEmitting';

export type AutomationEventField = {
  key: string;
  type: AutomationFieldType;
  labelKey: string;
  descriptionKey?: string;
  operators: string[];
  entityKind?: AutomationEntityKind;
  entityType?: AutomationEntityKind;
  enumValues?: string[];
  currencyField?: string;
  bindable?: boolean;
};

export type AutomationEventDef = {
  eventType: string;
  category: string;
  labelKey: string;
  descriptionKey: string;
  emission: AutomationEmission;
  emissionNote?: string;
  selectable?: boolean;
  creatable?: boolean;
  fields: AutomationEventField[];
};

export type AutomationActionConfigField = {
  key: string;
  type: AutomationFieldType;
  labelKey: string;
  descriptionKey?: string;
  required: boolean;
  entityKind?: AutomationEntityKind;
  entityType?: AutomationEntityKind;
  enumValues?: string[];
  bindable: boolean;
  maxLength?: number;
  min?: number;
  format?: 'url' | 'email';
  default?: string | number | boolean;
};

export type AutomationActionDef = {
  type: string;
  category: string;
  labelKey: string;
  descriptionKey: string;
  executedBy: 'gates' | 'n8n';
  execution?: {
    executedBy: 'gates' | 'n8n';
    recordsActionRun: boolean;
  };
  suggestedEventBindings?: Array<{ eventType: string; configKey: string; eventField: string }>;
  config: AutomationActionConfigField[];
};

export type AutomationMetadata = {
  operators: string[];
  events: AutomationEventDef[];
  plannedEvents?: AutomationEventDef[];
  actions: AutomationActionDef[];
  categories: { events: string[]; actions: string[] };
  entityTypes?: Array<{ type: AutomationEntityKind; listPath: string; query?: Record<string, string> }>;
  capabilities?: {
    email?: { available: boolean; unavailableReasonKey: string | null };
    whatsapp?: { available: boolean; unavailableReasonKey: string | null };
    webhook?: { executedBy: 'n8n'; recordsActionRun: boolean };
  };
};

export type TemplateRequiredUserField = {
  actionIndex: number;
  actionType: string;
  key: string;
  labelKey: string;
  type?: string;
  entityType?: AutomationEntityKind;
  required?: boolean;
};

export type AutomationTemplateDef = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  category: string;
  eventType: string;
  conditions: Array<{ field: string; operator: string; value: unknown }>;
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
  complete?: boolean;
  requiredUserFields?: TemplateRequiredUserField[];
};

export type EventFieldBinding = { source: 'event'; field: string };

export function isEventFieldBinding(value: unknown): value is EventFieldBinding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.source === 'event' && typeof row.field === 'string' && row.field.trim().length > 0;
}

export function fieldEntityKind(field: {
  entityType?: AutomationEntityKind;
  entityKind?: AutomationEntityKind;
}): AutomationEntityKind | undefined {
  return field.entityType ?? field.entityKind;
}

/** Events a user may create a rule for today. plannedNotEmitting stays off the picker. */
export function creatableEvents(metadata: AutomationMetadata | undefined): AutomationEventDef[] {
  return (metadata?.events ?? []).filter(
    (event) => event.emission !== 'plannedNotEmitting' && event.creatable !== false && event.selectable !== false
  );
}

export function findEvent(
  metadata: AutomationMetadata | undefined,
  eventType: string | null | undefined
): AutomationEventDef | undefined {
  if (!eventType || !metadata) return undefined;
  return metadata.events.find((event) => event.eventType === eventType)
    ?? metadata.plannedEvents?.find((event) => event.eventType === eventType);
}

export function findActionDef(
  metadata: AutomationMetadata | undefined,
  actionType: string | null | undefined
): AutomationActionDef | undefined {
  if (!actionType || !metadata) return undefined;
  return metadata.actions.find((action) => action.type === actionType);
}

function numericType(type: string): boolean {
  return type === 'number' || type === 'money';
}

export function compatibleBindFields(
  event: AutomationEventDef | undefined,
  field: AutomationActionConfigField
): AutomationEventField[] {
  if (!field.bindable || !event) return [];
  return event.fields.filter((candidate) => {
    const sameType =
      candidate.type === field.type || (numericType(candidate.type) && numericType(field.type));
    if (!sameType) return false;
    if (candidate.type === 'entity' || field.type === 'entity') {
      return fieldEntityKind(candidate) === fieldEntityKind(field);
    }
    return true;
  });
}

/** Backend exposes SMTP availability on capabilities.email. Absent means do not guess. */
export function actionUnavailableReasonKey(
  metadata: AutomationMetadata | undefined,
  actionType: string
): string | null {
  const email = metadata?.capabilities?.email;
  if (actionType === 'email.send' || actionType.startsWith('email.')) {
    if (!email || email.available !== false) return null;
    return email.unavailableReasonKey || 'automation.capabilities.email.smtpUnset';
  }
  const whatsapp = metadata?.capabilities?.whatsapp;
  if (actionType === 'whatsapp.send') {
    if (!whatsapp || whatsapp.available !== false) return null;
    return whatsapp.unavailableReasonKey || 'automation.capabilities.whatsapp.notConfigured';
  }
  return null;
}

export function recordsActionResult(action: AutomationActionDef | undefined): boolean {
  if (!action) return true;
  if (action.execution && action.execution.recordsActionRun === false) return false;
  if (action.type === 'webhook' && action.executedBy === 'n8n' && !action.execution) return false;
  return true;
}
