import {
  EVENT_CATALOG,
  getEventDefinition,
  getEventField,
  isEventTypeCreatable,
} from '../../modules/automation/catalog/event-catalog';
import { ACTION_CATALOG, getActionDefinition } from '../../modules/automation/catalog/action-catalog';
import { isEventFieldBinding, resolveConfigValue, validateBindingAgainstEvent } from '../../modules/automation/catalog/binding';
import { AUTOMATION_TEMPLATES } from '../../modules/automation/catalog/templates';
import { buildAutomationMetadata } from '../../modules/automation/catalog/metadata.service';
import { CONDITION_OPERATORS } from '../../modules/automation/catalog/field-types';

describe('Event Catalog', () => {
  it('exposes at least one real, wired event per priority module', () => {
    const categories = new Set(EVENT_CATALOG.map((event) => event.category));
    expect(categories.has('sales')).toBe(true);
    expect(categories.has('customers')).toBe(true);
    expect(categories.has('inventory')).toBe(true);
    expect(categories.has('purchasing')).toBe(true);
  });

  it('every field only uses operators legal for its type', () => {
    for (const event of EVENT_CATALOG) {
      for (const field of event.fields) {
        for (const operator of field.operators) {
          expect(CONDITION_OPERATORS).toContain(operator);
        }
      }
    }
  });

  it('getEventDefinition / getEventField resolve real entries', () => {
    expect(getEventDefinition('sales.invoice.created')?.category).toBe('sales');
    expect(getEventField('sales.invoice.created', 'totalAmount')?.type).toBe('number');
    expect(getEventField('sales.invoice.created', 'nonexistentField')).toBeUndefined();
    expect(getEventDefinition('does.not.exist')).toBeUndefined();
  });

  it('isEventTypeCreatable rejects plannedNotEmitting events and unknown events', () => {
    expect(isEventTypeCreatable('sales.invoice.created')).toBe(true);
    expect(isEventTypeCreatable('inventory.stock.belowMinimum')).toBe(true);
    expect(isEventTypeCreatable('sales.invoice.overdue')).toBe(true); // scheduled is still creatable
    expect(isEventTypeCreatable('sales.invoice.posted')).toBe(false); // plannedNotEmitting
    expect(isEventTypeCreatable('totally.made.up')).toBe(false);
  });

  it('does not define CRM/Lead/Task/Approval events that have no real domain model', () => {
    const types = EVENT_CATALOG.map((event) => event.eventType);
    expect(types.some((type) => /lead|opportunity|approval|task\./i.test(type))).toBe(false);
  });
});

describe('Action Catalog', () => {
  it('getActionDefinition resolves gates.createPurchaseRequest and preserves its existing config shape', () => {
    const def = getActionDefinition('gates.createPurchaseRequest');
    expect(def?.executedBy).toBe('gates');
    expect(def?.config.map((f) => f.key)).toEqual(
      expect.arrayContaining(['supplierId', 'warehouseId', 'quantity', 'description'])
    );
  });

  it('marks webhook as n8n-executed and email/notification as gates-executed', () => {
    expect(getActionDefinition('webhook')?.executedBy).toBe('n8n');
    expect(getActionDefinition('email.send')?.executedBy).toBe('gates');
    expect(getActionDefinition('gates.createNotification')?.executedBy).toBe('gates');
  });

  it('does not define gates.createTask/createApprovalRequest/assignUser (no real domain model)', () => {
    const types = ACTION_CATALOG.map((action) => action.type);
    expect(types).not.toContain('gates.createTask');
    expect(types).not.toContain('gates.createApprovalRequest');
    expect(types).not.toContain('gates.assignUser');
  });
});

describe('Event-field binding', () => {
  it('recognizes a valid binding shape and rejects everything else', () => {
    expect(isEventFieldBinding({ source: 'event', field: 'shortageQuantity' })).toBe(true);
    expect(isEventFieldBinding('constant')).toBe(false);
    expect(isEventFieldBinding(42)).toBe(false);
    expect(isEventFieldBinding({ source: 'event' })).toBe(false);
    expect(isEventFieldBinding(null)).toBe(false);
  });

  it('validates the referenced field exists on the target event', () => {
    expect(
      validateBindingAgainstEvent({ source: 'event', field: 'shortageQuantity' }, 'inventory.stock.belowMinimum')
    ).toEqual({ ok: true });
    const invalid = validateBindingAgainstEvent(
      { source: 'event', field: 'doesNotExist' },
      'inventory.stock.belowMinimum'
    );
    expect(invalid.ok).toBe(false);
  });

  it('resolveConfigValue resolves bindings against event data and passes constants through', () => {
    expect(
      resolveConfigValue({ source: 'event', field: 'shortageQuantity' }, { shortageQuantity: 12 })
    ).toBe(12);
    expect(resolveConfigValue({ source: 'event', field: 'missing' }, { other: 1 })).toBeUndefined();
    expect(resolveConfigValue('a constant string', undefined)).toBe('a constant string');
    expect(resolveConfigValue(42, undefined)).toBe(42);
  });
});

describe('Template Catalog', () => {
  it('every template only references real, creatable events and real actions', () => {
    for (const template of AUTOMATION_TEMPLATES) {
      expect(isEventTypeCreatable(template.eventType)).toBe(true);
      const event = getEventDefinition(template.eventType)!;
      for (const condition of template.conditions) {
        expect(event.fields.some((field) => field.key === condition.field)).toBe(true);
      }
      for (const action of template.actions) {
        expect(getActionDefinition(action.type)).toBeDefined();
      }
    }
  });

  it('does not include a Lead/CRM template (no Lead domain model exists)', () => {
    expect(AUTOMATION_TEMPLATES.some((t) => /lead/i.test(t.id))).toBe(false);
  });
});

describe('Metadata API shape', () => {
  it('contains no secrets/credentials/internal URLs', () => {
    const metadata = buildAutomationMetadata();
    const serialized = JSON.stringify(metadata).toLowerCase();
    expect(serialized).not.toContain('apikey');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('n8n_event_intake_url');
    expect(serialized).not.toMatch(/https?:\/\//); // no baked-in URLs
  });

  it('exposes operators, events, actions and categories', () => {
    const metadata = buildAutomationMetadata();
    expect(metadata.operators).toEqual(CONDITION_OPERATORS);
    expect(metadata.events.length).toBeGreaterThan(0);
    expect(metadata.actions.length).toBeGreaterThan(0);
    expect(metadata.categories.events.length).toBeGreaterThan(0);
    expect(metadata.categories.actions.length).toBeGreaterThan(0);
  });
});
