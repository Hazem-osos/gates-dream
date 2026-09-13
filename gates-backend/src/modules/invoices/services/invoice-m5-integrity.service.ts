import prisma from '../../../shared/database/prisma';
import type { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { stockMovementService } from '../../inventory/services/stock-movement.service';
import { partyCreditService } from '../../accounting/services/party-credit.service';
import { companySettingService } from '../../platform/services/company-setting.service';
import type { InvoiceKind } from '../types/invoice-posting.types';
import type { CreateM5InvoiceInput } from '../schemas/invoice-m5.schema';
import { computeLineAmounts } from './invoice-line-math';

const OUTBOUND_KINDS = new Set<InvoiceKind>(['SALE', 'PURCHASE_RETURN']);
const RETURN_KINDS = new Set<InvoiceKind>(['SALE_RETURN', 'PURCHASE_RETURN']);
const OVER_RETURN_EPSILON = 1e-6;

export function resolveInvoiceLineWarehouseId(
  lineWarehouseId: string | null | undefined,
  headerWarehouseId: string | null | undefined
): string | undefined {
  const line = lineWarehouseId?.trim();
  if (line) return line;
  const header = headerWarehouseId?.trim();
  return header || undefined;
}

function lineAmounts(line: CreateM5InvoiceInput['lines'][number]) {
  const { lineTotal, lineDiscount, lineTax } = computeLineAmounts(line);
  return lineTotal - lineDiscount + lineTax;
}

/**
 * Pre-post integrity for draft edits: outbound stock feasibility and customer credit headroom.
 * Moving-average cost is applied at post time via `itemCostService.applyMovingAverageInTx`.
 */
export async function assertDraftInvoiceIntegrity(
  companyId: string,
  invoiceKind: InvoiceKind,
  header: {
    customerId?: string | null;
    warehouseId?: string | null;
    netAmount: number;
  },
  lines: CreateM5InvoiceInput['lines'],
  opts?: { checkMinusQty?: boolean; checkCredit?: boolean; forceMinusQty?: boolean }
) {
  if (lines.length === 0) {
    throw new AppError(422, 'Invoice must have at least one line');
  }

  for (const line of lines) {
    if (line.quantity <= 0 || line.baseQuantity <= 0) {
      throw new AppError(422, 'Line quantities must be positive');
    }
    if (line.price < 0) {
      throw new AppError(422, 'Line price cannot be negative');
    }
  }

  const checkMinusQty = opts?.checkMinusQty !== false;
  if (checkMinusQty && OUTBOUND_KINDS.has(invoiceKind)) {
    for (const line of lines) {
      const warehouseId = resolveInvoiceLineWarehouseId(line.warehouseId, header.warehouseId);
      if (!warehouseId) continue;
      await stockMovementService.assertNegativeStockAllowed(
        companyId,
        warehouseId,
        line.itemId,
        null,
        -line.baseQuantity,
        undefined,
        opts?.forceMinusQty === true
      );
    }
  }

  if (opts?.checkCredit !== false && invoiceKind === 'SALE' && header.customerId) {
    const net = roundTo4(header.netAmount);
    const creditCheck = await partyCreditService.checkCustomerCredit(
      companyId,
      header.customerId,
      net
    );
    const warnOnly = await companySettingService.getFlag(
      companyId,
      'CreditWarningOnly',
      false
    );
    if (!creditCheck.allowed && !warnOnly) {
      partyCreditService.assertCustomerCreditAllowed(creditCheck);
    }
  }
}

/**
 * H10 fix: block over-return. A SALE_RETURN/PURCHASE_RETURN line that carries
 * `originalInvoiceLineId` is checked against the original line's `baseQuantity`
 * minus whatever has already been returned against it by OTHER non-cancelled
 * return invoices. Lines without `originalInvoiceLineId` are not constrained —
 * this only tightens the case where the caller opts into traceable returns.
 */
export async function assertNoOverReturn(
  tx: Prisma.TransactionClient,
  companyId: string,
  invoiceKind: InvoiceKind,
  selfInvoiceId: string | null,
  lines: CreateM5InvoiceInput['lines']
): Promise<void> {
  if (!RETURN_KINDS.has(invoiceKind)) return;

  const requestedByOriginal = new Map<string, number>();
  for (const line of lines) {
    if (!line.originalInvoiceLineId) continue;
    requestedByOriginal.set(
      line.originalInvoiceLineId,
      (requestedByOriginal.get(line.originalInvoiceLineId) ?? 0) + line.baseQuantity
    );
  }
  if (requestedByOriginal.size === 0) return;

  const originalIds = [...requestedByOriginal.keys()];

  const originals = await tx.invoiceLine.findMany({
    where: { id: { in: originalIds }, invoice: { companyId } },
    select: { id: true, baseQuantity: true },
  });
  const originalById = new Map(originals.map((o) => [o.id, Number(o.baseQuantity)]));

  const alreadyReturned = await tx.invoiceLine.groupBy({
    by: ['originalInvoiceLineId'],
    where: {
      originalInvoiceLineId: { in: originalIds },
      ...(selfInvoiceId ? { invoiceId: { not: selfInvoiceId } } : {}),
      invoice: { isCancelled: false },
    },
    _sum: { baseQuantity: true },
  });
  const returnedById = new Map(
    alreadyReturned.map((r) => [
      r.originalInvoiceLineId as string,
      Number(r._sum.baseQuantity ?? 0),
    ])
  );

  for (const [originalLineId, requestedQty] of requestedByOriginal) {
    const originalQty = originalById.get(originalLineId);
    if (originalQty === undefined) {
      throw new AppError(
        422,
        `originalInvoiceLineId ${originalLineId} does not reference a valid line on this company's invoices`
      );
    }
    const already = returnedById.get(originalLineId) ?? 0;
    if (roundTo4(already + requestedQty) > roundTo4(originalQty) + OVER_RETURN_EPSILON) {
      throw new AppError(
        422,
        `Over-return blocked: original line sold/purchased ${originalQty}, already returned ${already}, this request adds ${requestedQty}`
      );
    }
  }
}

export function computeNetFromLines(
  lines: CreateM5InvoiceInput['lines'],
  withholdingTaxAmount = 0
): number {
  let net = 0;
  for (const line of lines) {
    net += lineAmounts(line);
  }
  return roundTo4(net - withholdingTaxAmount);
}

export async function loadInvoiceKind(
  companyId: string,
  invoiceId: string
): Promise<InvoiceKind> {
  const row = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { invoiceKind: true },
  });
  if (!row?.invoiceKind) throw new AppError(404, 'Invoice not found');
  return row.invoiceKind as InvoiceKind;
}
