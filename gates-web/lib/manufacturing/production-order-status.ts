export type ProductionOrderStatus =
  | 'DRAFT'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export function productionOrderStatusLabel(status: ProductionOrderStatus | undefined): string {
  switch (status) {
    case 'DRAFT':
    case 'RELEASED':
      return 'تم التأكيد';
    case 'IN_PROGRESS':
      return 'قيد التنفيذ';
    case 'COMPLETED':
      return 'منتهي';
    case 'CANCELLED':
      return 'ملغي';
    default:
      return 'جديد';
  }
}

export const PRODUCTION_ORDER_WORKFLOW_STEPS = [
  { id: 'confirmed', label: 'تم التأكيد' },
  { id: 'in_progress', label: 'قيد التنفيذ' },
  { id: 'finished', label: 'منتهي' },
] as const;

export function productionOrderWorkflowStepIndex(
  status: ProductionOrderStatus | undefined
): number {
  if (!status || status === 'CANCELLED') return 0;
  if (status === 'DRAFT' || status === 'RELEASED') return 0;
  if (status === 'IN_PROGRESS') return 1;
  if (status === 'COMPLETED') return PRODUCTION_ORDER_WORKFLOW_STEPS.length;
  return 0;
}
