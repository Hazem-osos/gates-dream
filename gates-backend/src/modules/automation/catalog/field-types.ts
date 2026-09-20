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

/** Primitive shapes a condition/action-config field can take. */
export type EventFieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'entity';

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
  /** Required when type === 'enum'. */
  enumValues?: string[];
}

/** Default legal operators per field type — used when a field doesn't override them. */
export const OPERATORS_BY_FIELD_TYPE: Record<EventFieldType, ConditionOperator[]> = {
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  string: ['eq', 'neq', 'contains'],
  boolean: ['eq', 'neq'],
  date: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  enum: ['eq', 'neq', 'in'],
  entity: ['eq', 'neq', 'in'],
};

export function defineField(def: {
  key: string;
  type: EventFieldType;
  labelKey: string;
  descriptionKey?: string;
  entityKind?: EntityKind;
  enumValues?: string[];
  operators?: ConditionOperator[];
}): EventFieldDefinition {
  return {
    key: def.key,
    type: def.type,
    labelKey: def.labelKey,
    descriptionKey: def.descriptionKey,
    entityKind: def.entityKind,
    enumValues: def.enumValues,
    operators: def.operators ?? OPERATORS_BY_FIELD_TYPE[def.type],
  };
}
