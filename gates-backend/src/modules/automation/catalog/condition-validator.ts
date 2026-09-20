/**
 * Backend validation of AutomationRule.conditions against the Event Catalog.
 * Never trust the frontend to enforce this — rules containing unsupported
 * fields/operators/types must be rejected here.
 */
import { AppError } from '../../../shared/middleware/error-handler';
import { getEventDefinition, isEventTypeCreatable } from './event-catalog';
import type { EventFieldDefinition } from './field-types';
import { assertEntitiesBelongToCompany } from './entity-ownership';

export interface AutomationConditionLike {
  field: string;
  operator: string;
  // Optional in the TS structural type only because Zod's inferred type for
  // `z.unknown()` object properties is always optional — the Zod schema's
  // own superRefine already guarantees `value` is present at runtime.
  value?: unknown;
}

function assertScalarType(field: EventFieldDefinition, value: unknown): void {
  switch (field.type) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new AppError(400, `Condition field "${field.key}" requires a numeric value`);
      }
      return;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new AppError(400, `Condition field "${field.key}" requires a boolean value`);
      }
      return;
    case 'string':
      if (typeof value !== 'string') {
        throw new AppError(400, `Condition field "${field.key}" requires a string value`);
      }
      return;
    case 'date':
      if (
        !(typeof value === 'string' && !Number.isNaN(new Date(value).getTime())) &&
        typeof value !== 'number'
      ) {
        throw new AppError(400, `Condition field "${field.key}" requires a valid date value`);
      }
      return;
    case 'enum':
      if (typeof value !== 'string' || !field.enumValues?.includes(value)) {
        throw new AppError(
          400,
          `Condition field "${field.key}" must be one of: ${field.enumValues?.join(', ')}`
        );
      }
      return;
    case 'entity':
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new AppError(400, `Condition field "${field.key}" requires an entity id (string)`);
      }
      return;
    default: {
      const exhaustive: never = field.type;
      throw new Error(`Unknown field type: ${exhaustive as string}`);
    }
  }
}

async function assertEntityOwnership(
  companyId: string,
  field: EventFieldDefinition,
  values: string[]
): Promise<void> {
  if (field.type !== 'entity' || !field.entityKind) return;
  await assertEntitiesBelongToCompany(companyId, field.entityKind, values, field.key);
}

/**
 * Validates one rule's `conditions` array against its `eventType`.
 * Throws AppError(400, ...) on the first violation found.
 */
export async function validateAutomationConditions(
  companyId: string,
  eventType: string,
  conditions: AutomationConditionLike[]
): Promise<void> {
  if (!isEventTypeCreatable(eventType)) {
    throw new AppError(
      400,
      `Event "${eventType}" is not a supported automation trigger yet`
    );
  }
  const event = getEventDefinition(eventType);
  if (!event) {
    throw new AppError(400, `Unknown event type "${eventType}"`);
  }

  for (const condition of conditions) {
    const field = event.fields.find((candidate) => candidate.key === condition.field);
    if (!field) {
      throw new AppError(
        400,
        `Condition field "${condition.field}" is not available for event "${eventType}"`
      );
    }
    if (!field.operators.includes(condition.operator as EventFieldDefinition['operators'][number])) {
      throw new AppError(
        400,
        `Operator "${condition.operator}" is not supported for field "${condition.field}"`
      );
    }

    if (condition.operator === 'in') {
      if (!Array.isArray(condition.value) || condition.value.length === 0) {
        throw new AppError(400, `Condition field "${condition.field}" with "in" requires a non-empty array`);
      }
      for (const item of condition.value) assertScalarType(field, item);
      if (field.type === 'entity') {
        await assertEntityOwnership(companyId, field, condition.value as string[]);
      }
      continue;
    }

    assertScalarType(field, condition.value);
    if (field.type === 'entity') {
      await assertEntityOwnership(companyId, field, [condition.value as string]);
    }
  }
}
