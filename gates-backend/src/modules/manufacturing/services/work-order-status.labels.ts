export function manufacturingWorkOrderStatusLabelAr(status: string): string {
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
