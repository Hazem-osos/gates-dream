import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { roundTo4 } from '../../../shared/utils/decimal-round';

export type SourceKind = 'PURCHASE_ORDER' | 'SALES_ORDER' | 'PRICE_QUOTE';

type Tx = Prisma.TransactionClient | typeof import('../../../shared/database/prisma').default;

/** Quantity of a source line already copied onto invoices. */
export async function usedSourceBaseQty(
  db: Tx,
  companyId: string,
  sourceKind: SourceKind,
  sourceLineId: string
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ qty: unknown }>>`
    SELECT COALESCE(SUM(baseQuantity), 0) AS qty
    FROM invoice_line_sources
    WHERE companyId = ${companyId}
      AND sourceKind = ${sourceKind}
      AND sourceLineId = ${sourceLineId}
  `;
  return Number(rows[0]?.qty ?? 0);
}

export async function remainingSourceBaseQty(
  db: Tx,
  companyId: string,
  sourceKind: SourceKind,
  sourceLineId: string,
  orderedBaseQty: number
): Promise<number> {
  const used = await usedSourceBaseQty(db, companyId, sourceKind, sourceLineId);
  return roundTo4(Math.max(orderedBaseQty - used, 0));
}

export async function recordInvoiceLineSource(
  db: Tx,
  input: {
    companyId: string;
    invoiceLineId: string;
    sourceKind: SourceKind;
    sourceLineId: string;
    baseQuantity: number;
  }
): Promise<void> {
  const qty = roundTo4(input.baseQuantity);
  if (qty <= 0) return;
  await db.$executeRaw`
    INSERT INTO invoice_line_sources
      (id, companyId, invoiceLineId, sourceKind, sourceLineId, baseQuantity, createdAt)
    VALUES
      (${randomUUID()}, ${input.companyId}, ${input.invoiceLineId}, ${input.sourceKind}, ${input.sourceLineId}, ${qty}, NOW(3))
  `;
}

/** مفتوح / جزئي / مكتمل from ordered vs already converted base quantity. */
export function conversionStatus(ordered: number, used: number): 'مفتوح' | 'جزئي' | 'مكتمل' {
  if (used <= 0) return 'مفتوح';
  if (used + 0.0001 < ordered) return 'جزئي';
  return 'مكتمل';
}
