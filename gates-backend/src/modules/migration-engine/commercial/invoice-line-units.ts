import { money } from '../accounting/journal-money';
import { legacyTrim } from '../transforms/legacy-values';

/**
 * The (unit, quantity) pair the line's Price is quoted in. Qty2/UnitCode2 is the base unit
 * (erp/SQL_SERVER_ERP_GUIDE.md); the entered unit is UnitCode1/Qty1 unless the price fits Qty2.
 */
export function pickPricedUnitPair(line: {
  UnitCode1?: unknown;
  UnitCode2?: unknown;
  Qty1?: unknown;
  Qty2?: unknown;
  Price?: unknown;
  TotalValue?: unknown;
}) {
  const u1 = legacyTrim(line.UnitCode1);
  const u2 = legacyTrim(line.UnitCode2);
  const q1 = money(line.Qty1 ?? 0);
  const q2 = money(line.Qty2 ?? 0);
  const price = money(line.Price ?? 0);
  const total = money(line.TotalValue ?? 0);
  const baseQuantity = q2.isZero() ? q1 : q2;
  const one = { unitCode: u1 || u2, quantity: q1.isZero() ? q2 : q1, baseQuantity };
  const two = { unitCode: u2 || u1, quantity: q2.isZero() ? q1 : q2, baseQuantity };
  if (!u1 || q1.isZero()) return two;
  if (!u2 || q2.isZero() || price.isZero() || total.isZero()) return one;
  const err1 = q1.mul(price).sub(total).abs();
  const err2 = q2.mul(price).sub(total).abs();
  return err2.lt(err1) ? two : one;
}
