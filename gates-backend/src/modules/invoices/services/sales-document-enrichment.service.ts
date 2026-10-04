import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { itemOfferService } from '../../inventory/services/item-offer.service';
import type { CreateM5InvoiceInput } from '../schemas/invoice-m5.schema';
import type { InvoicePaymentSplitLine } from '../types/invoice-payment-split.types';

type Line = CreateM5InvoiceInput['lines'][number];

const SALES_KINDS = new Set(['SALE', 'SALES_ORDER']);

export async function applyItemOffersToSalesLines(
  companyId: string,
  invoiceKind: string,
  lines: Line[],
  partyId?: string | null,
  invoiceDate?: Date
): Promise<Line[]> {
  if (!SALES_KINDS.has(invoiceKind)) return lines;
  if (lines.some((line) => line.sourceLineId)) return lines;

  const next = lines.map((line) => ({ ...line }));
  const gifts: Line[] = [];
  let order = next.reduce((max, line) => Math.max(max, line.lineOrder || 0), 0);

  for (const line of next) {
    const offers = await itemOfferService.getApplicableOffers(
      companyId,
      line.itemId,
      Number(line.quantity),
      'sales',
      undefined,
      line.unitId,
      undefined,
      invoiceDate,
      partyId ?? undefined
    );
    for (const offer of offers) {
      if (offer.how === 'discount-percentage' && offer.percentage != null) {
        const current = Number(line.discountPercent ?? 0);
        if (current <= 0 && Number(line.discountAmount ?? 0) <= 0) {
          line.discountPercent = Number(offer.percentage);
        }
      }
      if (offer.how === 'additional-quantity' && offer.toItemId && offer.offerQuantity != null) {
        const qty = Number(offer.offerQuantity);
        if (qty <= 0) continue;
        const already = next.some((row) => row.itemId === offer.toItemId && Number(row.price) === 0 && row.lineNotes === 'عرض');
        if (already || gifts.some((row) => row.itemId === offer.toItemId)) continue;
        order += 1;
        gifts.push({
          itemId: offer.toItemId,
          unitId: offer.unitId ?? line.unitId,
          quantity: qty,
          baseQuantity: qty,
          price: 0,
          lineOrder: order,
          lineNotes: 'عرض',
          warehouseId: line.warehouseId,
        });
      }
    }
  }

  return gifts.length ? [...next, ...gifts] : next;
}

export async function contractDueDays(
  customerId: string,
  categoryIds: string[] = []
): Promise<number | null> {
  const contract = await prisma.customerContract.findFirst({
    where: { customerId, isActive: true },
    orderBy: { updatedAt: 'desc' },
    include: { groups: true },
  });
  if (!contract) return null;
  const group = contract.groups.find((row) => row.categoryId && categoryIds.includes(row.categoryId) && row.days != null);
  if (group?.days != null) return group.days;
  return contract.daysCount ?? null;
}

export async function contractPaymentSplits(
  companyId: string,
  branchId: string | null | undefined,
  customerId: string,
  netAmount: number
): Promise<{ paymentMethod?: string; paymentSplits?: InvoicePaymentSplitLine[] } | null> {
  const contract = await prisma.customerContract.findFirst({
    where: { customerId, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!contract) return null;
  const cashPct = Number(contract.cashPercentage ?? 0);
  const creditPct = Number(contract.creditPercentage ?? 0);
  if (cashPct + creditPct <= 0 || netAmount <= 0) return null;
  const cashAmt = roundTo4((netAmount * cashPct) / (cashPct + creditPct));
  const creditAmt = roundTo4(netAmount - cashAmt);
  const safeId = cashAmt > 0 ? await defaultSafeId(companyId, branchId) : null;
  if (cashAmt > 0 && creditAmt > 0 && safeId) {
    return {
      paymentMethod: 'split',
      paymentSplits: [
        { type: 'CASH', safeId, amount: cashAmt },
        { type: 'ON_ACCOUNT', amount: creditAmt },
      ],
    };
  }
  if (creditAmt > 0 && cashAmt <= 0) return { paymentMethod: 'credit' };
  if (cashAmt > 0 && safeId) {
    return { paymentMethod: 'cash', paymentSplits: [{ type: 'CASH', safeId, amount: cashAmt }] };
  }
  return null;
}

async function defaultSafeId(companyId: string, branchId?: string | null): Promise<string | null> {
  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId },
      select: { defaultSafeId: true },
    });
    if (branch?.defaultSafeId) return branch.defaultSafeId;
  }
  const safe = await prisma.safe.findFirst({
    where: { companyId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return safe?.id ?? null;
}
