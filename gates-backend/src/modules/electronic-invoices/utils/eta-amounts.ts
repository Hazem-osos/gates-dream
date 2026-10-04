import { roundTo4 } from '../../../shared/utils/decimal-round';

/** قيمة المبيعات قبل ضريبة القيمة المضافة: إجمالي البيع بعد الخصم وقبل الضريبة. */
export function salesBeforeVat(input: {
  totalAmount?: unknown;
  discountAmount?: unknown;
}): number {
  return roundTo4(Number(input.totalAmount ?? 0) - Number(input.discountAmount ?? 0));
}
