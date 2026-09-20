/**
 * Automation templates — pre-filled starting points for the builder.
 * Every template here must map to a genuinely supported trigger/action
 * combination in `catalog.ts`. Do not add a template for something that
 * cannot actually run end-to-end yet.
 */
import type { AutomationCondition } from './types';

export type AutomationTemplate = {
  id: string;
  label: string;
  description: string;
  name: string;
  eventType: string;
  conditions: AutomationCondition[];
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
};

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'keep-stock-replenished',
    label: 'تعويض المخزون المنخفض',
    description: 'أنشئ طلب شراء تلقائيًا عند انخفاض كمية أحد الأصناف عن الحد الذي تحدده.',
    name: 'تعويض المخزون المنخفض',
    eventType: 'inventory.stock.low',
    conditions: [{ field: 'data.quantity', operator: 'lt', value: 10 }],
    actions: [{ type: 'gates.createPurchaseRequest', config: { description: 'تعويض مخزون منخفض' } }],
  },
];

export function findTemplate(id: string | null | undefined): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((t) => t.id === id);
}
