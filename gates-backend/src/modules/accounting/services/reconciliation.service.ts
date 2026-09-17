import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  createPaymentAllocationInTx,
  getCashTransactionUnappliedAmount,
  refreshInvoiceBalanceInTx,
} from '../../invoices/services/invoice-balance.service';
import type { ManualReconcileInput } from '../schemas/reconciliation.schema';

const RECEIVABLE_KINDS = ['SALE', 'PURCHASE_RETURN'] as const;
const PAYABLE_KINDS = ['PURCHASE', 'SALE_RETURN'] as const;

function sideKinds(side: 'receivable' | 'payable') {
  return side === 'receivable' ? [...RECEIVABLE_KINDS] : [...PAYABLE_KINDS];
}

export class ReconciliationService {
  async listOpenInvoices(
    companyId: string,
    params: {
      customerId?: string;
      supplierId?: string;
      accountId?: string;
      side?: 'receivable' | 'payable';
    }
  ) {
    const side = params.side ?? (params.supplierId ? 'payable' : 'receivable');
    const kinds = sideKinds(side);
    if (!params.customerId && !params.supplierId && !params.accountId) {
      return [];
    }

    const accountPartyFilter = params.accountId
      ? side === 'receivable'
        ? await prisma.customer.findMany({
            where: {
              companyId,
              OR: [{ mainAccountId: params.accountId }, { accountId: params.accountId }],
            },
            select: { id: true },
          })
        : await prisma.supplier.findMany({
            where: {
              companyId,
              OR: [{ mainAccountId: params.accountId }, { accountId: params.accountId }],
            },
            select: { id: true },
          })
      : [];

    if (params.accountId && !params.customerId && !params.supplierId && accountPartyFilter.length === 0) {
      return [];
    }

    const where = {
      companyId,
      isPosted: true,
      isCancelled: false,
      remainingAmount: { gt: 0 },
      invoiceKind: { in: kinds as string[] },
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      ...(!params.customerId && !params.supplierId && params.accountId
        ? side === 'receivable'
          ? { customerId: { in: accountPartyFilter.map((row) => row.id) } }
          : { supplierId: { in: accountPartyFilter.map((row) => row.id) } }
        : {}),
    };

    return prisma.invoice.findMany({
      where,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        invoiceNumber: true,
        date: true,
        netAmount: true,
        paidAmount: true,
        remainingAmount: true,
        paymentStatus: true,
        currencyCode: true,
        customerId: true,
        supplierId: true,
        invoiceKind: true,
      },
    });
  }

  async reconcileManual(companyId: string, input: ManualReconcileInput) {
    const cashTx = await prisma.cashTransaction.findFirst({
      where: { id: input.cashTransactionId, companyId },
      select: {
        id: true,
        transactionKind: true,
        customerId: true,
        supplierId: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (!cashTx) throw new AppError(404, 'Cash transaction not found');
    if (!cashTx.isPosted || cashTx.isCancelled) {
      throw new AppError(422, 'Post the cash transaction before allocating to invoices');
    }

    const { unapplied } = await getCashTransactionUnappliedAmount(companyId, cashTx.id);
    const newTotal = roundTo4(
      input.allocations.reduce((s, l) => s + l.allocatedAmount, 0)
    );
    if (newTotal > unapplied + 0.0001) {
      throw new AppError(
        422,
        `Allocation total (${newTotal}) exceeds unapplied receipt amount (${unapplied})`
      );
    }

    const invoiceIds = [...new Set(input.allocations.map((a) => a.invoiceId))];
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds }, companyId },
      select: {
        id: true,
        customerId: true,
        supplierId: true,
        remainingAmount: true,
        invoiceKind: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (invoices.length !== invoiceIds.length) {
      throw new AppError(422, 'One or more invoices were not found');
    }

    for (const inv of invoices) {
      if (!inv.isPosted || inv.isCancelled) {
        throw new AppError(422, 'All invoices must be posted and active');
      }
      if (cashTx.customerId && inv.customerId !== cashTx.customerId) {
        throw new AppError(422, 'Invoice customer does not match the receipt');
      }
      if (cashTx.supplierId && inv.supplierId !== cashTx.supplierId) {
        throw new AppError(422, 'Invoice supplier does not match the payment');
      }
    }

    const outstandingById = new Map(
      invoices.map((i) => [i.id, Number(i.remainingAmount)])
    );
    for (const line of input.allocations) {
      const outstanding = outstandingById.get(line.invoiceId) ?? 0;
      if (line.allocatedAmount > outstanding + 0.0001) {
        throw new AppError(
          422,
          `Allocation exceeds outstanding balance on invoice ${line.invoiceId}`
        );
      }
    }

    const refreshed = await prisma.$transaction(async (tx) => {
      for (const line of input.allocations) {
        await createPaymentAllocationInTx(tx, {
          companyId,
          cashTransactionId: cashTx.id,
          invoiceId: line.invoiceId,
          allocatedAmount: line.allocatedAmount,
        });
      }
      const results = [];
      for (const invoiceId of invoiceIds) {
        results.push(await refreshInvoiceBalanceInTx(tx, companyId, invoiceId));
      }
      return results;
    });

    const after = await getCashTransactionUnappliedAmount(companyId, cashTx.id);
    return { invoices: refreshed, unappliedRemaining: after.unapplied };
  }

  async reconcileAutoFifo(companyId: string, cashTransactionId: string) {
    const cashTx = await prisma.cashTransaction.findFirst({
      where: { id: cashTransactionId, companyId },
      select: {
        id: true,
        transactionKind: true,
        customerId: true,
        supplierId: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (!cashTx) throw new AppError(404, 'Cash transaction not found');
    if (!cashTx.isPosted || cashTx.isCancelled) {
      throw new AppError(422, 'Post the cash transaction before auto-allocation');
    }

    const { unapplied } = await getCashTransactionUnappliedAmount(companyId, cashTx.id);
    if (unapplied <= 0.0001) {
      return { allocations: [], unappliedRemaining: 0 };
    }

    const isReceipt = cashTx.transactionKind === 'RECEIPT';
    const side: 'receivable' | 'payable' = isReceipt ? 'receivable' : 'payable';
    const open = await this.listOpenInvoices(companyId, {
      customerId: cashTx.customerId ?? undefined,
      supplierId: cashTx.supplierId ?? undefined,
      side,
    });

    let remaining = unapplied;
    const lines: { invoiceId: string; allocatedAmount: number }[] = [];
    for (const inv of open) {
      if (remaining <= 0.0001) break;
      const outstanding = Number(inv.remainingAmount);
      if (outstanding <= 0) continue;
      const slice = roundTo4(Math.min(remaining, outstanding));
      lines.push({ invoiceId: inv.id, allocatedAmount: slice });
      remaining = roundTo4(remaining - slice);
    }

    if (lines.length === 0) {
      throw new AppError(422, 'No open invoices found for this party');
    }

    return this.reconcileManual(companyId, {
      cashTransactionId,
      allocations: lines,
    });
  }
}

export const reconciliationService = new ReconciliationService();
