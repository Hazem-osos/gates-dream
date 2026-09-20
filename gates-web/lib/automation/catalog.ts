/**
 * Gates Automation — trigger/action metadata catalog.
 *
 * IMPORTANT: only list a trigger or action here once its backend event
 * source and execution path are genuinely wired end-to-end. This file is
 * the single place the builder reads from, so adding a new automation is
 * one array entry — but never add a placeholder for something that does
 * not actually run yet (see project rule: do not fake capabilities).
 *
 * Today, exactly one trigger and one action are production-ready:
 *   inventory.stock.low  →  gates.createPurchaseRequest
 * Both were verified end-to-end (rule lookup + idempotent draft PO creation)
 * before this catalog entry was written.
 */
import type { LucideIcon } from 'lucide-react';
import { Boxes, ShoppingCart } from 'lucide-react';
import type { AutomationConditionOperator } from './types';

export type AutomationFieldType = 'number' | 'text';

export type AutomationTriggerField = {
  /** Dot-path stored in AutomationCondition.field, e.g. "data.quantity". */
  field: string;
  label: string;
  type: AutomationFieldType;
};

export type AutomationTriggerDef = {
  eventType: string;
  moduleId: string;
  moduleLabel: string;
  label: string;
  description: string;
  icon: LucideIcon;
  fields: AutomationTriggerField[];
};

export type AutomationActionConfigFieldType = 'supplier' | 'warehouse' | 'text';

export type AutomationActionConfigField = {
  key: string;
  label: string;
  type: AutomationActionConfigFieldType;
  required?: boolean;
  placeholder?: string;
};

export type AutomationActionDef = {
  actionType: string;
  moduleId: string;
  moduleLabel: string;
  label: string;
  description: string;
  icon: LucideIcon;
  configFields: AutomationActionConfigField[];
};

export const AUTOMATION_TRIGGERS: AutomationTriggerDef[] = [
  {
    eventType: 'inventory.stock.low',
    moduleId: 'inventory',
    moduleLabel: 'المخازن',
    label: 'تغيّر المخزون',
    description: 'يبدأ العملية عند تغيّر كمية أي صنف في المخزن.',
    icon: Boxes,
    fields: [{ field: 'data.quantity', label: 'الكمية المتاحة', type: 'number' }],
  },
];

export const AUTOMATION_ACTIONS: AutomationActionDef[] = [
  {
    actionType: 'gates.createPurchaseRequest',
    moduleId: 'gates',
    moduleLabel: 'GATES',
    label: 'إنشاء طلب شراء',
    description: 'ينشئ أمر شراء (مسودة) تلقائيًا لمورد ومخزن محددين.',
    icon: ShoppingCart,
    configFields: [
      { key: 'supplierId', label: 'المورد', type: 'supplier', required: true },
      { key: 'warehouseId', label: 'المخزن', type: 'warehouse', required: true },
      { key: 'description', label: 'وصف (اختياري)', type: 'text', placeholder: 'مثال: تعويض مخزون منخفض' },
    ],
  },
];

/** Operators offered per field type — never show an operator the value type can't support. */
export const OPERATORS_BY_FIELD_TYPE: Record<AutomationFieldType, AutomationConditionOperator[]> = {
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  text: ['eq', 'neq', 'contains', 'in'],
};

export const OPERATOR_LABELS: Record<AutomationConditionOperator, string> = {
  eq: 'يساوي',
  neq: 'لا يساوي',
  gt: 'أكبر من',
  gte: 'أكبر من أو يساوي',
  lt: 'أقل من',
  lte: 'أقل من أو يساوي',
  contains: 'يحتوي على',
  in: 'من ضمن',
};

export function findTrigger(eventType: string | undefined): AutomationTriggerDef | undefined {
  return AUTOMATION_TRIGGERS.find((t) => t.eventType === eventType);
}

export function findAction(actionType: string | undefined): AutomationActionDef | undefined {
  return AUTOMATION_ACTIONS.find((a) => a.actionType === actionType);
}

export function findTriggerField(
  trigger: AutomationTriggerDef | undefined,
  field: string | undefined
): AutomationTriggerField | undefined {
  return trigger?.fields.find((f) => f.field === field);
}
