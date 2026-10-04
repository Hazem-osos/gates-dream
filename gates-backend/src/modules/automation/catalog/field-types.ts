/**
 * Shared primitives for the Automation Capability Catalog.
 *
 * These types describe WHAT a frontend builder can render (field types,
 * allowed operators, entity pickers) and WHAT the backend can validate
 * against (does field X exist for event Y, is operator Z legal for X,
 * does entity value belong to this tenant). Condition/action *evaluation*
 * still lives in n8n — this module only describes and validates shape.
 */

/** Matches the existing `AUTOMATION_CONDITION_OPERATORS` in automation-rule.schema.ts. */
export const CONDITION_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'in',
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/**
 * Primitive shapes a condition/action-config field can take.
 * `money` uses the same comparisons as `number` and may name a sibling
 * currency field that the event actually emits (never a guessed currency).
 */
export type EventFieldType = 'string' | 'number' | 'money' | 'boolean' | 'date' | 'enum' | 'entity';

/**
 * Tenant-owned entity kinds the catalog can reference. Each maps to a real
 * Prisma model with a `companyId` column so ownership can be verified.
 */
export const ENTITY_KINDS = [
  'customer',
  'supplier',
  'item',
  'warehouse',
  'customerCategory',
  'user',
  'salesInvoice',
  'purchaseInvoice',
  'purchaseOrder',
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface EventFieldDefinition {
  key: string;
  type: EventFieldType;
  labelKey: string;
  descriptionKey?: string;
  operators: ConditionOperator[];
  /** Required when type === 'entity'. Identifies which tenant table to check ownership against. */
  entityKind?: EntityKind;
  /**
   * Public alias of `entityKind` for metadata consumers (frontend selectors).
   */
  entityType?: EntityKind;
  /**
   * For `money` fields: a sibling payload key that carries the currency code,
   * only when that key is actually emitted with the event.
   */
  currencyField?: string;
  /** Required when type === 'enum'. */
  enumValues?: string[];
  /** Event payload fields may be referenced from action config as `{source:'event', field}`. */
  bindable: boolean;
}

/** Default legal operators per field type — used when a field doesn't override them. */
export const OPERATORS_BY_FIELD_TYPE: Record<EventFieldType, ConditionOperator[]> = {
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  money: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  string: ['eq', 'neq', 'contains'],
  boolean: ['eq', 'neq'],
  date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  enum: ['eq', 'neq', 'in'],
  entity: ['eq', 'neq', 'in'],
};

const NUMERIC_FIELD_TYPES = new Set<EventFieldType>(['number', 'money']);

/** Bindings may cross money/number. Entity bindings must be the same kind. */
export function fieldTypesCompatible(
  source: { type: EventFieldType; entityKind?: EntityKind },
  target: { type: EventFieldType; entityKind?: EntityKind }
): boolean {
  if (NUMERIC_FIELD_TYPES.has(source.type) && NUMERIC_FIELD_TYPES.has(target.type)) return true;
  if (source.type !== target.type) return false;
  if (source.type === 'entity') {
    return Boolean(source.entityKind) && source.entityKind === target.entityKind;
  }
  return true;
}

export function defineField(def: {
  key: string;
  type: EventFieldType;
  labelKey: string;
  descriptionKey?: string;
  entityKind?: EntityKind;
  enumValues?: string[];
  operators?: ConditionOperator[];
  bindable?: boolean;
  currencyField?: string;
}): EventFieldDefinition {
  return {
    key: def.key,
    type: def.type,
    labelKey: def.labelKey,
    descriptionKey: def.descriptionKey,
    entityKind: def.entityKind,
    entityType: def.entityKind,
    enumValues: def.enumValues,
    currencyField: def.currencyField,
    operators: def.operators ?? OPERATORS_BY_FIELD_TYPE[def.type],
    bindable: def.bindable ?? true,
  };
}
