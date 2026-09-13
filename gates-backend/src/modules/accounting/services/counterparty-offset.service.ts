import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import {
  createPaymentAllocationInTx,
  refreshInvoiceBalanceInTx,
} from '../../invoices/services/invoice-balance.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';

async function sumOpenInvoices(
  companyId: string,
  kind: 'SALE' | 'PURCHASE',
  partyField: 'customerId' | 'supplierId',
  partyId: string
) {
  const agg = await prisma.invoice.aggregate({
    where: {
      companyId,
      invoiceKind: kind,
      isPosted: true,
      isCancelled: false,
      remainingAmount: { gt: 0 },
      [partyField]: partyId,
    },
    _sum: { remainingAmount: true },
  });
  return roundTo4(Number(agg._sum.remainingAmount ?? 0));
}

function resolvePartyAccountId(mainAccountId: string | null, accountId: string | null): string {
  const id = mainAccountId ?? accountId;
  if (!id) throw new AppError(422, 'Party GL account is not configured');
  return id;
}

/**
 * Allocates the offset amount across the party's open invoices (FIFO by
 * date) so each invoice's `remainingAmount` reflects the netting.
 *
 * Wave 2 fix: this used to route through `cashTransactionService.createInTx`,
 * which (a) requires a real `safeId`/`bankAccountId` and therefore posted
 * fake `TreasuryReceipt`/`TreasuryPayment` vouchers against a real operating
 * safe that no cash ever moved through, and (b) flipped the resulting
 * `CashTransaction.isPosted` to true with no `journalEntryId` at all — a
 * posted cash record with zero ledger backing. The actual double-entry
 * effect (Dr supplier AP / Cr customer AR) is already fully posted once via
 * the single netting journal entry created in `execute()`. So here we create
 * the `CashTransaction` rows directly with no safe/bank, linked to that same
 * `journalEntryId`, purely so `PaymentAllocation`/`refreshInvoiceBalanceInTx`
 * have a posted, ledger-backed record to key off per invoice slice.
 */
async function fifoAllocateInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    branchId?: string | null;
    fiscalYearId: string;
    offsetId: string;
    journalEntryId: string;
    amount: number;
    date: Date;
    currencyCode: string;
    invoiceKind: 'SALE' | 'PURCHASE';
    partyField: 'customerId' | 'supplierId';
    partyId: string;
    transactionKind: 'RECEIPT' | 'PAYMENT';
    description: string;
  }
) {
  let remaining = params.amount;
  const invoices = await tx.invoice.findMany({
    where: {
      companyId: params.companyId,
      invoiceKind: params.invoiceKind,
      isPosted: true,
      isCancelled: false,
      remainingAmount: { gt: 0 },
      [params.partyField]: params.partyId,
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, remainingAmount: true, currencyCode: true },
  });

  for (const inv of invoices) {
    if (remaining <= 0) break;
    const outstanding = Number(inv.remainingAmount);
    const slice = roundTo4(Math.min(remaining, outstanding));
    if (slice <= 0) continue;

    const cashTx = await tx.cashTransaction.create({
      data: {
        companyId: params.companyId,
        branchId: params.branchId ?? undefined,
        fiscalYearId: params.fiscalYearId,
        transactionKind: params.transactionKind,
        date: params.date,
        description: params.description,
        amount: new Decimal(slice),
        currencyCode: inv.currencyCode || params.currencyCode,
        customerId: params.partyField === 'customerId' ? params.partyId : undefined,
        supplierId: params.partyField === 'supplierId' ? params.partyId : undefined,
        journalEntryId: params.journalEntryId,
        isPosted: true,
        postedAt: new Date(),
      },
    });

    await createPaymentAllocationInTx(tx, {
      companyId: params.companyId,
      cashTransactionId: cashTx.id,
      invoiceId: inv.id,
      allocatedAmount: slice,
      allocatedAt: params.date,
      counterpartyOffsetId: params.offsetId,
    });

    await refreshInvoiceBalanceInTx(tx, params.companyId, inv.id);
    remaining = roundTo4(remaining - slice);
  }

  if (remaining > 0.0001) {
    throw new AppError(
      422,
      `Could not allocate full offset amount; ${remaining.toFixed(2)} unallocated`
    );
  }
}

/**
 * Wave 2 fix: reverses one FIFO-allocated leg — cancels the per-invoice
 * `CashTransaction`/`PaymentAllocation` created in `fifoAllocateInTx` (never
 * hard-deleted, per the H14 fix noted on `PaymentAllocation`) and re-derives
 * each touched invoice's balance.
 */
async function reverseFifoAllocationsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  offsetId: string
) {
  const allocations = await tx.paymentAllocation.findMany({
    where: { companyId, counterpartyOffsetId: offsetId },
    select: { id: true, invoiceId: true, cashTransactionId: true },
  });

  const cashTxIds = Array.from(new Set(allocations.map((a) => a.cashTransactionId)));
  for (const id of cashTxIds) {
    await tx.cashTransaction.update({ where: { id }, data: { isCancelled: true } });
  }

  const invoiceIds = Array.from(new Set(allocations.map((a) => a.invoiceId)));
  for (const invoiceId of invoiceIds) {
    await refreshInvoiceBalanceInTx(tx, companyId, invoiceId);
  }
}

export class CounterpartyOffsetService {
  async getSummary(companyId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
      select: {
        id: true,
        arabicName: true,
        balance: true,
        linkedSupplierId: true,
        linkedSupplier: { select: { id: true, arabicName: true, balance: true } },
      },
    });
    if (!customer) throw new AppError(404, 'Customer not found');
    if (!customer.linkedSupplierId || !customer.linkedSupplier) {
      throw new AppError(422, 'Customer is not linked to a supplier');
    }

    const arBalance = await sumOpenInvoices(companyId, 'SALE', 'customerId', customer.id);
    const apBalance = await sumOpenInvoices(
      companyId,
      'PURCHASE',
      'supplierId',
      customer.linkedSupplierId
    );
    const maxOffset = roundTo4(Math.min(arBalance, apBalance));

    return {
      customer: {
        id: customer.id,
        name: customer.arabicName,
        arBalance,
        ledgerBalance: roundTo4(Number(customer.balance)),
      },
      supplier: {
        id: customer.linkedSupplier.id,
        name: customer.linkedSupplier.arabicName,
        apBalance,
        ledgerBalance: roundTo4(Number(customer.linkedSupplier.balance)),
      },
      maxOffset,
    };
  }

  async execute(params: {
    companyId: string;
    customerId: string;
    amount: number;
    date: Date;
    userId: string;
    branchId?: string | null;
    fiscalYearId: string;
  }) {
    const summary = await this.getSummary(params.companyId, params.customerId);
    if (params.amount <= 0) throw new AppError(422, 'Offset amount must be positive');
    if (params.amount > summary.maxOffset + 0.0001) {
      throw new AppError(422, `Amount exceeds maximum offset (${summary.maxOffset})`);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: params.customerId, companyId: params.companyId },
      select: {
        id: true,
        arabicName: true,
        mainAccountId: true,
        accountId: true,
        linkedSupplierId: true,
        currencyCode: true,
      },
    });
    if (!customer?.linkedSupplierId) throw new AppError(422, 'Missing supplier link');

    const supplier = await prisma.supplier.findFirst({
      where: { id: customer.linkedSupplierId, companyId: params.companyId },
      select: {
        id: true,
        arabicName: true,
        mainAccountId: true,
        accountId: true,
      },
    });
    if (!supplier) throw new AppError(404, 'Supplier not found');

    const customerArId = resolvePartyAccountId(customer.mainAccountId, customer.accountId);
    const supplierApId = resolvePartyAccountId(supplier.mainAccountId, supplier.accountId);
    const currencyCode = customer.currencyCode ?? 'EGP';
    const amount = roundTo4(params.amount);

    const ctx: JournalPostingContext = {
      companyId: params.companyId,
      branchId: params.branchId ?? '',
      fiscalYearId: params.fiscalYearId,
      userId: params.userId,
    };

    return prisma.$transaction(async (tx) => {
      // Was `OFF-${Date.now()}`: a timestamp slice is neither gap-free nor
      // collision-proof (two offsets in the same millisecond, or any two whose
      // last 8 digits coincide, produce the same voucher number).
      const voucherNumber = await documentSequenceService.nextNumberInTx(tx, {
        companyId: params.companyId,
        branchId: params.branchId ?? null,
        fiscalYearId: params.fiscalYearId,
        docType: 'OFFSET',
        seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
          const rows = await tx.counterpartyOffset.findMany({
            where: { companyId: params.companyId },
            select: { voucherNumber: true },
          });
          return rows.map((r) => r.voucherNumber);
        }),
        isAvailable: async (candidate) => {
          const taken = await tx.counterpartyOffset.findFirst({
            where: { companyId: params.companyId, voucherNumber: candidate },
            select: { id: true },
          });
          return !taken;
        },
      });

      const offset = await tx.counterpartyOffset.create({
        data: {
          companyId: params.companyId,
          branchId: params.branchId,
          fiscalYearId: params.fiscalYearId,
          date: params.date,
          amount: new Decimal(amount),
          customerId: customer.id,
          supplierId: supplier.id,
          description: `مقاصة ${customer.arabicName} / ${supplier.arabicName}`,
          createdBy: params.userId,
          voucherNumber,
        },
      });

      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: params.fiscalYearId,
        date: params.date,
        description: `قيد مقاصة تسوية — ${customer.arabicName}`,
        currencyCode,
        entryType: 'Offset',
        sourceType: 'COUNTERPARTY_OFFSET',
        sourceNumber: offset.voucherNumber ?? offset.id.slice(0, 8),
        lines: [
          {
            accountId: supplierApId,
            debit: amount,
            credit: 0,
            lineOrder: 1,
            description: 'تخفيض حساب المورد',
          },
          {
            accountId: customerArId,
            debit: 0,
            credit: amount,
            lineOrder: 2,
            description: 'تخفيض حساب العميل',
          },
        ],
      });

      await tx.counterpartyOffset.update({
        where: { id: offset.id },
        data: { journalEntryId: je.id },
      });

      const desc = `تسوية مقاصة ${offset.voucherNumber ?? ''}`.trim();

      await fifoAllocateInTx(tx, {
        companyId: params.companyId,
        branchId: params.branchId,
        fiscalYearId: params.fiscalYearId,
        offsetId: offset.id,
        journalEntryId: je.id,
        amount,
        date: params.date,
        currencyCode,
        invoiceKind: 'SALE',
        partyField: 'customerId',
        partyId: customer.id,
        transactionKind: 'RECEIPT',
        description: desc,
      });

      await fifoAllocateInTx(tx, {
        companyId: params.companyId,
        branchId: params.branchId,
        fiscalYearId: params.fiscalYearId,
        offsetId: offset.id,
        journalEntryId: je.id,
        amount,
        date: params.date,
        currencyCode,
        invoiceKind: 'PURCHASE',
        partyField: 'supplierId',
        partyId: supplier.id,
        transactionKind: 'PAYMENT',
        description: desc,
      });

      await tx.customer.update({
        where: { id: customer.id },
        data: { balance: { decrement: amount } },
      });
      await tx.supplier.update({
        where: { id: supplier.id },
        data: { balance: { decrement: amount } },
      });

      return {
        offsetId: offset.id,
        voucherNumber: offset.voucherNumber,
        journalEntryId: je.id,
        amount,
        customerName: customer.arabicName,
        supplierName: supplier.arabicName,
        date: params.date,
      };
    });
  }

  /**
   * Wave 2 fix: reverses an offset — dated contra entry against the netting
   * JE, cancels the FIFO-allocated cash/allocation legs on both the customer
   * and supplier side (restoring each invoice's remainingAmount), and gives
   * the customer/supplier balances the amount back.
   */
  async reverse(params: {
    companyId: string;
    offsetId: string;
    userId: string;
    branchId?: string | null;
    fiscalYearId: string;
  }) {
    const offset = await prisma.counterpartyOffset.findFirst({
      where: { id: params.offsetId, companyId: params.companyId },
    });
    if (!offset) throw new AppError(404, 'Counterparty offset not found');
    if (!offset.journalEntryId) {
      throw new AppError(400, 'Offset has no journal entry to reverse');
    }

    const ctx: JournalPostingContext = {
      companyId: params.companyId,
      branchId: params.branchId ?? '',
      fiscalYearId: params.fiscalYearId,
      userId: params.userId,
    };
    const amount = Number(offset.amount);

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, offset.journalEntryId!, {
        reason: 'Counterparty offset unposted',
      });

      await reverseFifoAllocationsInTx(tx, params.companyId, offset.id);

      await tx.customer.update({
        where: { id: offset.customerId },
        data: { balance: { increment: amount } },
      });
      await tx.supplier.update({
        where: { id: offset.supplierId },
        data: { balance: { increment: amount } },
      });

      return tx.counterpartyOffset.update({
        where: { id: offset.id },
        data: { journalEntryId: null },
      });
    });
  }
}

export const counterpartyOffsetService = new CounterpartyOffsetService();
