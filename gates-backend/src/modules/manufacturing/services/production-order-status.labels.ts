/** Arabic labels for the 3-step manufacturing order workflow (+ cancelled). */
export function productionOrderStatusLabelAr(status: string): string {
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
      return status;
  }
}
