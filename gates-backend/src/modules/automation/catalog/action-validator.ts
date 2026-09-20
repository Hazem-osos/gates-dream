/**
 * Backend validation of AutomationRule.actions against the Action Catalog.
 */
import { AppError } from '../../../shared/middleware/error-handler';
import { getActionDefinition, type ActionConfigFieldDefinition } from './action-catalog';
import { isEventFieldBinding, validateBindingAgainstEvent } from './binding';
import { assertEntitiesBelongToCompany } from './entity-ownership';

export interface AutomationActionLike {
  type: string;
  config?: Record<string, unknown>;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function assertConstantType(field: ActionConfigFieldDefinition, value: unknown): void {
  switch (field.type) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new AppError(400, `Config field "${field.key}" requires a numeric value`);
      }
      return;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new AppError(400, `Config field "${field.key}" requires a boolean value`);
      }
      return;
    case 'string':
      if (typeof value !== 'string') {
        throw new AppError(400, `Config field "${field.key}" requires a string value`);
      }
      if (field.maxLength && value.length > field.maxLength) {
        throw new AppError(400, `Config field "${field.key}" exceeds max length ${field.maxLength}`);
      }
      return;
    case 'date':
      if (
        !(typeof value === 'string' && !Number.isNaN(new Date(value).getTime())) &&
        typeof value !== 'number'
      ) {
        throw new AppError(400, `Config field "${field.key}" requires a valid date value`);
      }
      return;
    case 'enum':
      if (typeof value !== 'string' || !field.enumValues?.includes(value)) {
        throw new AppError(
          400,
          `Config field "${field.key}" must be one of: ${field.enumValues?.join(', ')}`
        );
      }
      return;
    case 'entity':
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new AppError(400, `Config field "${field.key}" requires an entity id (string)`);
      }
      return;
    default: {
      const exhaustive: never = field.type;
      throw new Error(`Unknown field type: ${exhaustive as string}`);
    }
  }
}

/**
 * Validates one rule's `actions` array against its `eventType` (needed so
 * event-field bindings can be checked). Throws AppError(400, ...) on the
 * first violation.
 */
export async function validateAutomationActions(
  companyId: string,
  eventType: string,
  actions: AutomationActionLike[]
): Promise<void> {
  for (const action of actions) {
    const definition = getActionDefinition(action.type);
    if (!definition) {
      throw new AppError(400, `Action type "${action.type}" is not supported`);
    }

    const config = action.config ?? {};
    const allowedKeys = new Set(definition.config.map((field) => field.key));
    for (const key of Object.keys(config)) {
      if (!allowedKeys.has(key)) {
        throw new AppError(400, `Unknown config field "${key}" for action "${action.type}"`);
      }
    }

    for (const field of definition.config) {
      const raw = config[field.key];
      if (field.required && isEmpty(raw)) {
        throw new AppError(
          400,
          `Action "${action.type}" requires config field "${field.key}"`
        );
      }
      if (isEmpty(raw)) continue;

      if (isEventFieldBinding(raw)) {
        if (!field.bindable) {
          throw new AppError(
            400,
            `Config field "${field.key}" on action "${action.type}" cannot be bound to an event field`
          );
        }
        const check = validateBindingAgainstEvent(raw, eventType);
        if (!check.ok) {
          throw new AppError(400, check.message);
        }
        continue;
      }

      assertConstantType(field, raw);
      if (field.type === 'entity' && field.entityKind) {
        await assertEntitiesBelongToCompany(companyId, field.entityKind, [String(raw)], field.key);
      }
    }
  }
}
