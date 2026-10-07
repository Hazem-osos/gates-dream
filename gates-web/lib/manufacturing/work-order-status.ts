/** Work orders that can still receive new production orders (backend assertWorkOrderLink). */
export function isWorkOrderSelectableForProductionOrder(status: string): boolean {
  return status !== 'CANCELLED' && status !== 'CLOSED' && status !== 'COMPLETED';
}

export function manufacturingWorkOrderStatusLabel(status: string): string {
  switch (status) {
    case 'CONFIRMED':
    case 'OPEN':
      return 'تم التأكيد';
    case 'IN_PROGRESS':
      return 'قيد التنفيذ';
    case 'COMPLETED':
      return 'منتهي';
    case 'CLOSED':
      return 'مغلق';
    case 'CANCELLED':
      return 'ملغي';
    default:
      return status;
  }
}

import type { StatusTone } from '@/components/ui/StatusBadge';

export function workOrderStatusTone(status: string): StatusTone {
  if (status === 'COMPLETED' || status === 'CLOSED') return 'success';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'CANCELLED') return 'danger';
  return 'warning';
}
