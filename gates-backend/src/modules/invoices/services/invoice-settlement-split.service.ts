import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { cashTransactionService } from '../../treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import { chequeLifecycleService } from '../../treasury/services/cheque-lifecycle.service';
import type { TreasuryPostingContext } from '../../treasury/types/treasury.types';
import type { InvoicePostingContext } from '../types/invoice-posting.types';
import {
  invoicePaymentSplitsSchema,
  validatePaymentSplitsTotal,
  type InvoicePaymentSplitLine,
} from '../types/invoice-payment-split.types';
import {
  createPaymentAllocationInTx,
  refreshInvoiceBalanceInTx,
} from './invoice-balance.service';
import { countActiveInvoiceSettlementsInTx, settlementKind } from './invoice-settlement.service';
import { shouldSkipInvoiceAutoSettle } from './invoice-settlement-policy';

function parseSplits(raw: unknown): InvoicePaymentSplitLine[] {
  const parsed = invoicePaymentSplitsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(422, 'Invalid payment split configuration on invoice');
  }
  return parsed.data;
}

export function isSplitPaymentInvoice(invoice: {
  paymentMethod?: string | null;
  paymentSplits?: unknown;
}): boolean {
  const method = (invoice.paymentMethod ?? '').trim().toUpperCase();
  if (method === 'SPLIT') return true;
  if (method !== 'CREDIT' && method !== 'آجل') return false;
  const parsed = invoicePaymentSplitsSchema.safeParse(invoice.paymentSplits);
  return parsed.success && parsed.data.some((line) => line.type !== 'ON_ACCOUNT');
}

export class InvoiceSettlementSplitService {
  async autoSettleSplitInTx(
    tx: Prisma.TransactionClient,
    ctx: InvoicePostingContext,
    invoice: {
      id: string;
      invoiceKind: string | null;
      invoiceNumber: string | null;
      date: Date;
      currencyCode: string;
      customerId: string | null;
      supplierId: string | null;
      netAmount: Decimal | number;
      paymentSplits: unknown;
    }
  ) {
    const splits = parseSplits(invoice.paymentSplits);
    const grandTotal = roundTo4(Number(invoice.netAmount));
    if (!validatePaymentSplitsTotal(splits, grandTotal)) {
      throw new AppError(
        422,
        `Payment splits must sum to invoice total (${grandTotal.toFixed(2)})`
      );
    }

    const existing = await countActiveInvoiceSettlementsInTx(tx, ctx.companyId, invoice.id);
    if (shouldSkipInvoiceAutoSettle(existing.allocationCount, existing.chequeCount)) {
      return;
    }

    const treasuryCtx: TreasuryPostingContext = {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      fiscalYearId: ctx.fiscalYearId,
      userId: ctx.userId,
    };

    const kind = settlementKind(invoice.invoiceKind);
    const label = invoice.invoiceNumber ?? invoice.id.slice(0, 8);

    for (const line of splits) {
      if (line.type === 'ON_ACCOUNT') continue;

      const amount = roundTo4(line.amount);
      if (amount <= 0) continue;

      if (line.type === 'CASH' || line.type === 'BANK') {
        const cashTx = await cashTransactionService.createInTx(
          tx,
          ctx.companyId,
          ctx.branchId,
          ctx.fiscalYearId,
          {
            transactionKind: kind,
            date: invoice.date,
            description:
              line.type === 'BANK'
                ? `تحويل بنكي — فاتورة ${label}${line.referenceNumber ? ` (${line.referenceNumber})` : ''}`
                : `نقدية — فاتورة ${label}`,
            amount,
            currencyCode: invoice.currencyCode,
            customerId: invoice.customerId ?? undefined,
            supplierId: invoice.supplierId ?? undefined,
            safeId: line.type === 'CASH' ? line.safeId : undefined,
            bankAccountId: line.type === 'BANK' ? line.bankAccountId : undefined,
            voucherNumber: line.type === 'BANK' ? line.referenceNumber : undefined,
          },
          { invoiceId: invoice.id }
        );

        await treasuryPostingService.postCashTransactionInTx(tx, ctx, cashTx.id);

        await createPaymentAllocationInTx(tx, {
          companyId: ctx.companyId,
          cashTransactionId: cashTx.id,
          invoiceId: invoice.id,
          allocatedAmount: amount,
          allocatedAt: invoice.date,
        });
      }

      if (line.type === 'CHEQUE') {
        if (kind === 'RECEIPT') {
          if (!invoice.customerId) {
            throw new AppError(422, 'Cheque receipt requires a customer on the invoice');
          }
          await chequeLifecycleService.createInwardChequeInTx(
            tx,
            treasuryCtx,
            {
              chequeNumber: line.chequeNumber,
              bankName: line.bankName,
              dueDate: line.dueDate,
              amount,
              currencyCode: invoice.currencyCode,
              customerId: invoice.customerId,
              description: `شيك فاتورة ${label}`,
            },
            { invoiceId: invoice.id }
          );
        } else {
          if (!invoice.supplierId) {
            throw new AppError(422, 'Cheque payment requires a supplier on the invoice');
          }
          const bankAccountId =
            line.bankAccountId ??
            (splits.find((s) => s.type === 'BANK')?.type === 'BANK'
              ? (splits.find((s) => s.type === 'BANK') as { bankAccountId: string }).bankAccountId
              : undefined);
          if (!bankAccountId) {
            throw new AppError(
              422,
              'Cheque payment requires bankAccountId on the cheque line or a bank split line'
            );
          }
          await chequeLifecycleService.issueOutwardChequeInTx(
            tx,
            treasuryCtx,
            {
              chequeNumber: line.chequeNumber,
              bankName: line.bankName,
              dueDate: line.dueDate,
              amount,
              currencyCode: invoice.currencyCode,
              supplierId: invoice.supplierId,
              bankAccountId,
              description: `شيك دفع فاتورة ${label}`,
            },
            { invoiceId: invoice.id }
          );
        }
      }
    }

    await refreshInvoiceBalanceInTx(tx, ctx.companyId, invoice.id);
  }
}

export const invoiceSettlementSplitService = new InvoiceSettlementSplitService();
