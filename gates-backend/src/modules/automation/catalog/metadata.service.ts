/**
 * Assembles the safe, user-facing Automation Capability Catalog response.
 * Contains zero secrets, credentials, internal URLs, or server internals —
 * only labelKeys/descriptionKeys (frontend localizes), field/operator/action
 * shape, and entity-selector kinds.
 */
import { CONDITION_OPERATORS } from './field-types';
import { EVENT_CATALOG } from './event-catalog';
import { ACTION_CATALOG } from './action-catalog';

export interface AutomationMetadataResponse {
  operators: readonly string[];
  events: typeof EVENT_CATALOG;
  actions: typeof ACTION_CATALOG;
  categories: { events: string[]; actions: string[] };
}

export function buildAutomationMetadata(): AutomationMetadataResponse {
  return {
    operators: CONDITION_OPERATORS,
    events: EVENT_CATALOG,
    actions: ACTION_CATALOG,
    categories: {
      events: [...new Set(EVENT_CATALOG.map((event) => event.category))],
      actions: [...new Set(ACTION_CATALOG.map((action) => action.category))],
    },
  };
}
