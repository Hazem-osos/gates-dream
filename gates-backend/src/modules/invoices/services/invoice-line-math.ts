import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';

/** Tolerance for comparing a client-supplied amount against the server-derived value. */
const AMOUNT_TOLERANCE = 0.02;
const HEADER_DISCOUNT_TOLERANCE = 0.02;

export interface LineMathInput {
  quantity: number;
  price: number;
  discountPercent?: number | null;
  discountAmount?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
}

export interface LineMathResult {
  lineTotal: number;
  lineDiscount: number;
  lineTax: number;
}

export interface LineMathOptions {
  /**
   * Legacy `CascadingDiscounts{Module}`: stacked trade (line) then cash
   * (header) discounts both reduce the VAT base. Off — the default, and
   * standard Egyptian VAT practice — taxes only the line net; the header
   * settlement discount does not change tax.
   */
  cascadingDiscounts?: boolean;
  /** This line's share of the header/cash discount. Used only when cascading. */
  headerDiscountShare?: number;
}

export interface InvoiceHeaderDiscountInput {
  headerDiscountPercent?: number | null;
  headerDiscountAmount?: number | null;
}

export interface DevelopmentFeeInput {
  developmentFeeRate?: number | null;
  developmentFeeAmount?: number | null;
}

export interface InvoiceMathResult {
  totalAmount: number;
  lineDiscountAmount: number;
  headerDiscountAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  allocations: number[];
}

function lineDiscountOf(line: LineMathInput, lineTotal: number): number {
  const computedDiscount = line.discountPercent
    ? roundTo4((lineTotal * line.discountPercent) / 100)
    : null;
  if (
    computedDiscount !== null &&
    line.discountAmount != null &&
    Math.abs(line.discountAmount - computedDiscount) > AMOUNT_TOLERANCE
  ) {
    throw new AppError(
      422,
      `Line discountAmount (${line.discountAmount}) does not match discountPercent-derived amount (${computedDiscount}) for discountPercent ${line.discountPercent}%`
    );
  }
  return computedDiscount ?? roundTo4(line.discountAmount ?? 0);
}

/**
 * H3 fix: the server is the single source of truth for tax and discount math —
 * it never blindly trusts a client-supplied `taxAmount`/`discountAmount`.
 *
 * - Tax is always percent-derived. A VAT/WHT figure must be traceable to a rate;
 *   an arbitrary flat `taxAmount` with no `taxPercent` behind it is rejected outright
 *   (this is exactly the exploit described in H3 — "an API caller can send any
 *   taxAmount"). If both `taxPercent` and `taxAmount` are supplied, the amount must
 *   match what the percent produces, or the request is rejected as poisoned input.
 * - Discount MAY legitimately be a flat amount (sales discretion, no percent basis),
 *   so a bare `discountAmount` is accepted. But once `discountPercent` is present,
 *   the amount is recomputed from it and a mismatching client-supplied amount is
 *   rejected rather than silently overridden.
 *
 * Cascading discounts: when `cascadingDiscounts` is on, the VAT base is
 * `(qty×price − trade discount − this line's header/cash share)`. When off,
 * the header share is ignored and tax stays on the line net. Client
 * `taxAmount` is not cross-checked in the cascading case because the caller
 * cannot know the per-line header allocation until the server computes it.
 *
 * H15 fix: every computed figure is rounded to 4dp (`roundTo4`) at the point of
 * calculation — the same precision the GL uses at post time — instead of
 * accumulating raw, unrounded JS floats that then drift from the ledger.
 */
export function computeLineAmounts(
  line: LineMathInput,
  options?: LineMathOptions
): LineMathResult {
  const lineTotal = roundTo4(line.quantity * line.price);
  const lineDiscount = lineDiscountOf(line, lineTotal);
  const lineAfterDiscount = roundTo4(lineTotal - lineDiscount);
  const headerShare =
    options?.cascadingDiscounts === true
      ? roundTo4(Math.max(options.headerDiscountShare ?? 0, 0))
      : 0;
  const taxBase = roundTo4(Math.max(lineAfterDiscount - headerShare, 0));

  const computedTax = line.taxPercent
    ? roundTo4((taxBase * line.taxPercent) / 100)
    : 0;
  if (
    options?.cascadingDiscounts !== true &&
    line.taxAmount != null &&
    Math.abs(line.taxAmount - computedTax) > AMOUNT_TOLERANCE
  ) {
    throw new AppError(
      422,
      line.taxPercent
        ? `Line taxAmount (${line.taxAmount}) does not match taxPercent-derived amount (${computedTax}) for taxPercent ${line.taxPercent}%`
        : `Line taxAmount (${line.taxAmount}) was supplied without a taxPercent — tax must always be percent-derived`
    );
  }

  return { lineTotal, lineDiscount, lineTax: computedTax };
}

function headerDiscountAmount(
  base: number,
  header: InvoiceHeaderDiscountInput
): number {
  const computed = header.headerDiscountPercent
    ? roundTo4((base * header.headerDiscountPercent) / 100)
    : null;
  if (
    computed !== null &&
    header.headerDiscountAmount != null &&
    Math.abs(header.headerDiscountAmount - computed) > HEADER_DISCOUNT_TOLERANCE
  ) {
    throw new AppError(
      422,
      `headerDiscountAmount (${header.headerDiscountAmount}) does not match headerDiscountPercent-derived amount (${computed}) for headerDiscountPercent ${header.headerDiscountPercent}%`
    );
  }
  return computed ?? roundTo4(header.headerDiscountAmount ?? 0);
}

/**
 * رسم التنمية — السيرفر مصدر الحقيقة.
 * إذا وُجدت نسبة (> 0) تُحسب على الصافي قبل الضريبة ويُرفض مبلغ العميل إن خالف الناتج.
 * إذا لم توجد نسبة يُقبل مبلغ ثابت غير سالب (وضع القيمة الثابتة).
 */
export function resolveDevelopmentFee(
  netSubtotal: number,
  input: DevelopmentFeeInput = {}
): { rate: number | null; amount: number } {
  const rawRate = input.developmentFeeRate != null ? Number(input.developmentFeeRate) : null;
  const rate = rawRate != null && Number.isFinite(rawRate) ? rawRate : null;
  if (rate != null && rate < 0) {
    throw new AppError(422, 'developmentFeeRate cannot be negative');
  }
  if (rate != null && rate > 0) {
    const computed = roundTo4((Math.max(netSubtotal, 0) * rate) / 100);
    if (
      input.developmentFeeAmount != null &&
      Math.abs(input.developmentFeeAmount - computed) > AMOUNT_TOLERANCE
    ) {
      throw new AppError(
        422,
        `developmentFeeAmount (${input.developmentFeeAmount}) does not match developmentFeeRate-derived amount (${computed}) for developmentFeeRate ${rate}%`
      );
    }
    return { rate, amount: computed };
  }
  const fixed = roundTo4(Math.max(input.developmentFeeAmount ?? 0, 0));
  return { rate: rate === 0 ? 0 : null, amount: fixed };
}

function allocateHeaderDiscount(shares: number[], amount: number, base: number): number[] {
  if (amount <= 0 || base <= 0) return shares.map(() => 0);
  const allocations = shares.map((share) => roundTo4((amount * share) / base));
  const allocatedSum = roundTo4(allocations.reduce((a, b) => a + b, 0));
  const remainder = roundTo4(amount - allocatedSum);
  if (remainder !== 0 && allocations.length > 0) {
    allocations[allocations.length - 1] = roundTo4(
      allocations[allocations.length - 1] + remainder
    );
  }
  return allocations;
}

/**
 * Whole-invoice math: line totals, header/cash discount, then tax.
 *
 * When `cascadingDiscounts` is off (default), tax is the sum of each
 * line's `(lineTotal − lineDiscount) × taxPercent` and the header
 * discount never reduces the VAT base — standard Egyptian VAT on the
 * invoiced price net of trade discounts only.
 *
 * When on, the header discount is applied after the line (trade)
 * discount and each line's VAT is recomputed on the cascaded remainder.
 */
export function computeInvoiceAmounts(
  lines: LineMathInput[],
  header: InvoiceHeaderDiscountInput = {},
  options?: { cascadingDiscounts?: boolean }
): InvoiceMathResult {
  let totalAmount = 0;
  let lineDiscountAmount = 0;
  const lineNets: number[] = [];

  for (const line of lines) {
    const lineTotal = roundTo4(line.quantity * line.price);
    const lineDiscount = lineDiscountOf(line, lineTotal);
    totalAmount = roundTo4(totalAmount + lineTotal);
    lineDiscountAmount = roundTo4(lineDiscountAmount + lineDiscount);
    lineNets.push(roundTo4(lineTotal - lineDiscount));
  }

  const headerBase = roundTo4(totalAmount - lineDiscountAmount);
  const headerAmount = headerDiscountAmount(headerBase, header);
  const allocations = allocateHeaderDiscount(lineNets, headerAmount, headerBase);

  let taxAmount = 0;
  if (options?.cascadingDiscounts) {
    for (let i = 0; i < lines.length; i++) {
      const { lineTax } = computeLineAmounts(lines[i], {
        cascadingDiscounts: true,
        headerDiscountShare: allocations[i],
      });
      taxAmount = roundTo4(taxAmount + lineTax);
    }
  } else {
    for (const line of lines) {
      const { lineTax } = computeLineAmounts(line);
      taxAmount = roundTo4(taxAmount + lineTax);
    }
  }

  const discountAmount = roundTo4(lineDiscountAmount + headerAmount);
  const netAmount = roundTo4(totalAmount - discountAmount + taxAmount);
  return {
    totalAmount,
    lineDiscountAmount,
    headerDiscountAmount: headerAmount,
    discountAmount,
    taxAmount,
    netAmount,
    allocations,
  };
}
