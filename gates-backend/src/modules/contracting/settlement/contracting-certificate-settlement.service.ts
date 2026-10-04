import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { cashTransactionService } from '../../treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import { contractingAccountResolverService } from '../services/contracting-account-resolver.service';
import { subcontractAccountResolverService } from '../../subcontracts/services/subcontract-account-resolver.service';
import type { TreasuryPostingContext } from '../../treasury/types/treasury.types';
import type {
  AllocateExistingCashToCertificateInput,
  ContractingCertificateCollectionInput,
} from './contracting-certificate-settlement.schema';
import {
  contractingCertificateBalanceService,
  lockClientInvoiceForSettlementInTx,
  lockSubcontractInvoiceForSettlementInTx,
  refreshClientInvoiceSettlementInTx,
  refreshSubcontractInvoiceSettlementInTx,
  readClientInvoiceRemainingSettlementInTx,
  readSubcontractInvoiceRemainingSettlementInTx,
  getCashTransactionUnappliedForContractingInTx,
} from './contracting-certificate-balance.service';
import {
  buildContractingSettlementFingerprint,
  claimContractingSettlementIdempotencyInTx,
  completeContractingSettlementIdempotencyInTx,
  type SettlementIdempotencyResult,
} from './contracting-settlement-idempotency.service';
import { ACTIVE_SETTLEMENT_BLOCKS_REVERSAL } from './contracting-settlement-status';
import {
  assertCashTransactionPartyMatchesClientInvoiceInTx,
  assertCashTransactionPartyMatchesSubcontractInvoiceInTx,
} from '../reconciliation/contracting-party-statement.service';

const CONTRACTING_CURRENCY = 'EGP';
const CLIENT_ELIGIBLE_STATUSES = new Set(['FINANCE_POSTED', 'PAID']);
const SUB_ELIGIBLE_STATUSES = new Set(['FINANCE_POSTED', 'PAID']);
const BLOCKED_CERTIFICATE_STATUSES = new Set(['REVERSED', 'REJECTED', 'DRAFT']);

async function loadEligibleClientInvoice(companyId: string, clientInvoiceId: string) {
  const invoice = await prisma.clientInvoice.findFirst({
    where: { id: clientInvoiceId, companyId },
    include: {
      clientContract: {
        select: {
          clientCustomerId: true,
          companyId: true,
        },
      },
    },
  });
  if (!invoice) throw new AppError(404, 'مستخلص المالك غير موجود');
  if (invoice.clientContract.companyId !== companyId) {
    throw new AppError(403, 'مستخلص المالك لا ينتمي لهذه الشركة');
  }
  if (BLOCKED_CERTIFICATE_STATUSES.has(invoice.status)) {
    throw new AppError(422, 'لا يمكن تحصيل مستخلص غير معتمد أو ملغى');
  }
  if (!invoice.journalEntryId || !CLIENT_ELIGIBLE_STATUSES.has(invoice.status)) {
    throw new AppError(422, 'يجب ترحيل المستخلص مالياً قبل التحصيل');
  }
  return invoice;
}

async function loadEligibleSubcontractInvoice(companyId: string, subcontractInvoiceId: string) {
  const invoice = await prisma.subcontractInvoice.findFirst({
    where: { id: subcontractInvoiceId, companyId },
    include: {
      subcontract: {
        select: { companyId: true, subcontractorId: true },
      },
    },
  });
  if (!invoice) throw new AppError(404, 'مستخلص المقاول غير موجود');
  if (invoice.subcontract.companyId !== companyId) {
    throw new AppError(403, 'مستخلص المقاول لا ينتمي لهذه الشركة');
  }
  if (BLOCKED_CERTIFICATE_STATUSES.has(invoice.status)) {
    throw new AppError(422, 'لا يمكن سداد مستخلص غير معتمد أو ملغى');
  }
  if (!invoice.journalEntryId || !SUB_ELIGIBLE_STATUSES.has(invoice.status)) {
    throw new AppError(422, 'يجب ترحيل المستخلص مالياً قبل السداد');
  }
  return invoice;
}

async function createClientAllocationInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    cashTransactionId: string;
    clientInvoiceId: string;
    allocatedAmount: number;
    createdBy?: string;
    allocatedAt?: Date;
  }
) {
  return tx.contractingCertificateAllocation.create({
    data: {
      companyId: params.companyId,
      cashTransactionId: params.cashTransactionId,
      clientInvoiceId: params.clientInvoiceId,
      allocatedAmount: new Decimal(roundTo4(params.allocatedAmount)),
      currencyCode: CONTRACTING_CURRENCY,
      createdBy: params.createdBy,
      allocatedAt: params.allocatedAt ?? new Date(),
    },
  });
}

async function createSubcontractAllocationInTx(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    cashTransactionId: string;
    subcontractInvoiceId: string;
    allocatedAmount: number;
    createdBy?: string;
    allocatedAt?: Date;
  }
) {
  return tx.contractingCertificateAllocation.create({
    data: {
      companyId: params.companyId,
      cashTransactionId: params.cashTransactionId,
      subcontractInvoiceId: params.subcontractInvoiceId,
      allocatedAmount: new Decimal(roundTo4(params.allocatedAmount)),
      currencyCode: CONTRACTING_CURRENCY,
      createdBy: params.createdBy,
      allocatedAt: params.allocatedAt ?? new Date(),
    },
  });
}

function assertAmountPositive(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0.0001) {
    throw new AppError(422, 'مبلغ التخصيص يجب أن يكون أكبر من صفر');
  }
}

function clientCollectFingerprint(
  clientInvoiceId: string,
  input: ContractingCertificateCollectionInput
) {
  return buildContractingSettlementFingerprint({
    target: 'CLIENT_INVOICE',
    clientInvoiceId,
    amount: roundTo4(input.amount),
    safeId: input.safeId ?? null,
    bankAccountId: input.bankAccountId ?? null,
    currencyCode: CONTRACTING_CURRENCY,
  });
}

function subPayFingerprint(
  subcontractInvoiceId: string,
  input: ContractingCertificateCollectionInput
) {
  return buildContractingSettlementFingerprint({
    target: 'SUBCONTRACT_INVOICE',
    subcontractInvoiceId,
    amount: roundTo4(input.amount),
    safeId: input.safeId ?? null,
    bankAccountId: input.bankAccountId ?? null,
    currencyCode: CONTRACTING_CURRENCY,
  });
}

function clientAllocateFingerprint(
  clientInvoiceId: string,
  input: AllocateExistingCashToCertificateInput
) {
  return buildContractingSettlementFingerprint({
    target: 'CLIENT_INVOICE_ALLOCATE',
    clientInvoiceId,
    cashTransactionId: input.cashTransactionId,
    amount: roundTo4(input.amount),
  });
}

function subAllocateFingerprint(
  subcontractInvoiceId: string,
  input: AllocateExistingCashToCertificateInput
) {
  return buildContractingSettlementFingerprint({
    target: 'SUBCONTRACT_INVOICE_ALLOCATE',
    subcontractInvoiceId,
    cashTransactionId: input.cashTransactionId,
    amount: roundTo4(input.amount),
  });
}

function toClientCollectResponse(result: SettlementIdempotencyResult) {
  return {
    cashTransactionId: result.cashTransactionId,
    eligibleAmount: result.eligibleAmount,
    collectedAmount: result.collectedAmount,
    remainingSettlementAmount: result.remainingSettlementAmount,
    remainingAmount: result.remainingAmount ?? result.remainingSettlementAmount,
    settlementStatus: result.settlementStatus,
  };
}

function toSubPayResponse(result: SettlementIdempotencyResult) {
  return {
    cashTransactionId: result.cashTransactionId,
    eligibleAmount: result.eligibleAmount,
    paidAmount: result.paidAmount,
    remainingSettlementAmount: result.remainingSettlementAmount,
    remainingAmount: result.remainingAmount ?? result.remainingSettlementAmount,
    settlementStatus: result.settlementStatus,
  };
}

export class ContractingCertificateSettlementService {
  async getClientInvoiceSettlement(companyId: string, clientInvoiceId: string) {
    const invoice = await prisma.clientInvoice.findFirst({
      where: { id: clientInvoiceId, companyId },
    });
    if (!invoice) throw new AppError(404, 'مستخلص المالك غير موجود');

    const allocations = await prisma.contractingCertificateAllocation.findMany({
      where: { companyId, clientInvoiceId },
      orderBy: { allocatedAt: 'desc' },
      include: {
        cashTransaction: {
          select: {
            id: true,
            voucherNumber: true,
            date: true,
            amount: true,
            isPosted: true,
            isCancelled: true,
            transactionKind: true,
          },
        },
      },
    });

    return {
      certificateAmount: Number(invoice.netPayableByClient),
      collectedAmount: Number(invoice.collectedAmount ?? 0),
      remainingAmount: Number(invoice.remainingSettlementAmount ?? invoice.netPayableByClient),
      settlementStatus: invoice.settlementStatus ?? 'UNPAID',
      currencyCode: CONTRACTING_CURRENCY,
      allocations: allocations.map((row) => ({
        id: row.id,
        treasuryDocumentId: row.cashTransactionId,
        allocatedAmount: Number(row.allocatedAmount),
        allocatedAt: row.allocatedAt,
        createdBy: row.createdBy,
        active: row.cashTransaction.isPosted && !row.cashTransaction.isCancelled,
        cashTransaction: row.cashTransaction,
      })),
    };
  }

  async getSubcontractInvoiceSettlement(companyId: string, subcontractInvoiceId: string) {
    const invoice = await prisma.subcontractInvoice.findFirst({
      where: { id: subcontractInvoiceId, companyId },
    });
    if (!invoice) throw new AppError(404, 'مستخلص المقاول غير موجود');

    const allocations = await prisma.contractingCertificateAllocation.findMany({
      where: { companyId, subcontractInvoiceId },
      orderBy: { allocatedAt: 'desc' },
      include: {
        cashTransaction: {
          select: {
            id: true,
            voucherNumber: true,
            date: true,
            amount: true,
            isPosted: true,
            isCancelled: true,
            transactionKind: true,
          },
        },
      },
    });

    return {
      payableAmount: Number(invoice.netPayableAmount),
      paidAmount: Number(invoice.paidSettlementAmount ?? 0),
      remainingAmount: Number(invoice.remainingSettlementAmount ?? invoice.netPayableAmount),
      settlementStatus: invoice.settlementStatus ?? 'UNPAID',
      currencyCode: CONTRACTING_CURRENCY,
      allocations: allocations.map((row) => ({
        id: row.id,
        treasuryDocumentId: row.cashTransactionId,
        allocatedAmount: Number(row.allocatedAmount),
        allocatedAt: row.allocatedAt,
        createdBy: row.createdBy,
        active: row.cashTransaction.isPosted && !row.cashTransaction.isCancelled,
        cashTransaction: row.cashTransaction,
      })),
    };
  }

  async collectClientInvoice(
    ctx: TreasuryPostingContext,
    clientInvoiceId: string,
    input: ContractingCertificateCollectionInput
  ) {
    assertAmountPositive(input.amount);
    const invoice = await loadEligibleClientInvoice(ctx.companyId, clientInvoiceId);
    const accounts = await contractingAccountResolverService.resolveAccounts(ctx.companyId);
    const customerId = invoice.clientContract.clientCustomerId;
    const fingerprint = clientCollectFingerprint(clientInvoiceId, input);

    return prisma.$transaction(async (tx) => {
      await lockClientInvoiceForSettlementInTx(tx, ctx.companyId, clientInvoiceId);

      const claim = await claimContractingSettlementIdempotencyInTx(tx, {
        companyId: ctx.companyId,
        operation: 'CLIENT_INVOICE_COLLECT',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
      });
      if (claim.mode === 'REPLAY') {
        return toClientCollectResponse(claim.result);
      }

      const remainingSettlementAmount = await readClientInvoiceRemainingSettlementInTx(
        tx,
        ctx.companyId,
        clientInvoiceId
      );
      if (input.amount > remainingSettlementAmount + 0.0001) {
        throw new AppError(
          422,
          `مبلغ التحصيل يتجاوز المتبقي (${remainingSettlementAmount.toFixed(2)})`
        );
      }

      const cashTx = await cashTransactionService.createInTx(
        tx,
        ctx.companyId,
        ctx.branchId ?? undefined,
        ctx.fiscalYearId,
        {
          transactionKind: 'RECEIPT',
          voucherNumber: input.voucherNumber,
          date: input.date ?? new Date(),
          description:
            input.description ??
            `تحصيل مستخلص مالك ${invoice.invoiceNumber ?? clientInvoiceId.slice(0, 8)}`,
          amount: input.amount,
          currencyCode: CONTRACTING_CURRENCY,
          customerId,
          offsetAccountId: accounts.clientReceivableAccountId,
          safeId: input.safeId,
          bankAccountId: input.bankAccountId,
          exchangeRate: input.exchangeRate ?? 1,
        },
        undefined,
        ctx.userId
      );

      await treasuryPostingService.postCashTransactionInTx(tx, ctx, cashTx.id);

      const allocation = await createClientAllocationInTx(tx, {
        companyId: ctx.companyId,
        cashTransactionId: cashTx.id,
        clientInvoiceId,
        allocatedAmount: input.amount,
        createdBy: ctx.userId,
        allocatedAt: input.date,
      });

      const totals = await refreshClientInvoiceSettlementInTx(tx, ctx.companyId, clientInvoiceId);
      const idemPayload: SettlementIdempotencyResult = {
        cashTransactionId: cashTx.id,
        allocationId: allocation.id,
        eligibleAmount: totals.eligibleAmount,
        collectedAmount: totals.collectedAmount,
        remainingSettlementAmount: totals.remainingSettlementAmount,
        remainingAmount: totals.remainingSettlementAmount,
        settlementStatus: totals.settlementStatus,
      };
      await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, idemPayload);
      return toClientCollectResponse(idemPayload);
    });
  }

  async allocateExistingReceiptToClientInvoice(
    ctx: TreasuryPostingContext,
    clientInvoiceId: string,
    input: AllocateExistingCashToCertificateInput
  ) {
    assertAmountPositive(input.amount);
    const invoice = await loadEligibleClientInvoice(ctx.companyId, clientInvoiceId);
    const customerId = invoice.clientContract.clientCustomerId;

    const cash = await prisma.cashTransaction.findFirst({
      where: { id: input.cashTransactionId, companyId: ctx.companyId },
      select: {
        id: true,
        transactionKind: true,
        customerId: true,
        currencyCode: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (!cash) throw new AppError(404, 'سند القبض غير موجود');
    if (cash.transactionKind !== 'RECEIPT') {
      throw new AppError(422, 'يجب اختيار سند قبض');
    }
    if (cash.customerId && cash.customerId !== customerId) {
      throw new AppError(422, 'سند القبض لا يخص نفس العميل');
    }
    if (cash.currencyCode !== CONTRACTING_CURRENCY) {
      throw new AppError(422, 'عملة سند القبض لا تطابق مستخلص المالك (EGP)');
    }

    const fingerprint = clientAllocateFingerprint(clientInvoiceId, input);

    return prisma.$transaction(async (tx) => {
      await lockClientInvoiceForSettlementInTx(tx, ctx.companyId, clientInvoiceId);

      const claim = await claimContractingSettlementIdempotencyInTx(tx, {
        companyId: ctx.companyId,
        operation: 'CLIENT_INVOICE_ALLOCATE',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
      });
      if (claim.mode === 'REPLAY') {
        return toClientCollectResponse(claim.result);
      }

      const remainingSettlementAmount = await readClientInvoiceRemainingSettlementInTx(
        tx,
        ctx.companyId,
        clientInvoiceId
      );
      if (input.amount > remainingSettlementAmount + 0.0001) {
        throw new AppError(422, 'مبلغ التخصيص يتجاوز المتبقي على المستخلص');
      }
      const unapplied = await getCashTransactionUnappliedForContractingInTx(
        tx,
        ctx.companyId,
        input.cashTransactionId
      );
      if (input.amount > unapplied + 0.0001) {
        throw new AppError(422, 'مبلغ التخصيص يتجاوز الرصيد غير المطبّق على السند');
      }

      await assertCashTransactionPartyMatchesClientInvoiceInTx(
        tx,
        ctx.companyId,
        clientInvoiceId,
        input.cashTransactionId
      );

      const allocation = await createClientAllocationInTx(tx, {
        companyId: ctx.companyId,
        cashTransactionId: input.cashTransactionId,
        clientInvoiceId,
        allocatedAmount: input.amount,
        createdBy: ctx.userId,
        allocatedAt: input.allocatedAt,
      });

      const totals = await refreshClientInvoiceSettlementInTx(tx, ctx.companyId, clientInvoiceId);
      const idemPayload: SettlementIdempotencyResult = {
        cashTransactionId: input.cashTransactionId,
        allocationId: allocation.id,
        eligibleAmount: totals.eligibleAmount,
        collectedAmount: totals.collectedAmount,
        remainingSettlementAmount: totals.remainingSettlementAmount,
        remainingAmount: totals.remainingSettlementAmount,
        settlementStatus: totals.settlementStatus,
      };
      await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, idemPayload);
      return toClientCollectResponse(idemPayload);
    });
  }

  async paySubcontractInvoice(
    ctx: TreasuryPostingContext,
    subcontractInvoiceId: string,
    input: ContractingCertificateCollectionInput
  ) {
    assertAmountPositive(input.amount);
    const invoice = await loadEligibleSubcontractInvoice(ctx.companyId, subcontractInvoiceId);
    const accounts = await subcontractAccountResolverService.resolveAccounts(ctx.companyId);
    const subcontractorId = invoice.subcontract.subcontractorId;
    const fingerprint = subPayFingerprint(subcontractInvoiceId, input);

    return prisma.$transaction(async (tx) => {
      await lockSubcontractInvoiceForSettlementInTx(tx, ctx.companyId, subcontractInvoiceId);

      const claim = await claimContractingSettlementIdempotencyInTx(tx, {
        companyId: ctx.companyId,
        operation: 'SUBCONTRACT_INVOICE_PAY',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
      });
      if (claim.mode === 'REPLAY') {
        return toSubPayResponse(claim.result);
      }

      const remainingSettlementAmount = await readSubcontractInvoiceRemainingSettlementInTx(
        tx,
        ctx.companyId,
        subcontractInvoiceId
      );
      if (input.amount > remainingSettlementAmount + 0.0001) {
        throw new AppError(
          422,
          `مبلغ السداد يتجاوز المتبقي (${remainingSettlementAmount.toFixed(2)})`
        );
      }

      const cashTx = await cashTransactionService.createInTx(
        tx,
        ctx.companyId,
        ctx.branchId ?? undefined,
        ctx.fiscalYearId,
        {
          transactionKind: 'PAYMENT',
          voucherNumber: input.voucherNumber,
          date: input.date ?? new Date(),
          description:
            input.description ??
            `سداد مستخلص مقاول ${invoice.invoiceNumber ?? subcontractInvoiceId.slice(0, 8)}`,
          amount: input.amount,
          currencyCode: CONTRACTING_CURRENCY,
          subcontractorId,
          offsetAccountId: accounts.apAccountId,
          safeId: input.safeId,
          bankAccountId: input.bankAccountId,
          exchangeRate: input.exchangeRate ?? 1,
        },
        undefined,
        ctx.userId
      );

      await treasuryPostingService.postCashTransactionInTx(tx, ctx, cashTx.id);

      const allocation = await createSubcontractAllocationInTx(tx, {
        companyId: ctx.companyId,
        cashTransactionId: cashTx.id,
        subcontractInvoiceId,
        allocatedAmount: input.amount,
        createdBy: ctx.userId,
        allocatedAt: input.date,
      });

      const totals = await refreshSubcontractInvoiceSettlementInTx(
        tx,
        ctx.companyId,
        subcontractInvoiceId
      );
      const idemPayload: SettlementIdempotencyResult = {
        cashTransactionId: cashTx.id,
        allocationId: allocation.id,
        eligibleAmount: totals.eligibleAmount,
        paidAmount: totals.paidAmount,
        remainingSettlementAmount: totals.remainingSettlementAmount,
        remainingAmount: totals.remainingSettlementAmount,
        settlementStatus: totals.settlementStatus,
      };
      await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, idemPayload);
      return toSubPayResponse(idemPayload);
    });
  }

  async allocateExistingPaymentToSubcontractInvoice(
    ctx: TreasuryPostingContext,
    subcontractInvoiceId: string,
    input: AllocateExistingCashToCertificateInput
  ) {
    assertAmountPositive(input.amount);
    await loadEligibleSubcontractInvoice(ctx.companyId, subcontractInvoiceId);

    const cash = await prisma.cashTransaction.findFirst({
      where: { id: input.cashTransactionId, companyId: ctx.companyId },
      select: {
        id: true,
        transactionKind: true,
        currencyCode: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (!cash) throw new AppError(404, 'سند الصرف غير موجود');
    if (cash.transactionKind !== 'PAYMENT') {
      throw new AppError(422, 'يجب اختيار سند صرف');
    }
    if (cash.currencyCode !== CONTRACTING_CURRENCY) {
      throw new AppError(422, 'عملة سند الصرف لا تطابق مستخلص المقاولات (EGP)');
    }

    const fingerprint = subAllocateFingerprint(subcontractInvoiceId, input);

    return prisma.$transaction(async (tx) => {
      await lockSubcontractInvoiceForSettlementInTx(tx, ctx.companyId, subcontractInvoiceId);

      const claim = await claimContractingSettlementIdempotencyInTx(tx, {
        companyId: ctx.companyId,
        operation: 'SUBCONTRACT_INVOICE_ALLOCATE',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: fingerprint,
      });
      if (claim.mode === 'REPLAY') {
        return toSubPayResponse(claim.result);
      }

      const remainingSettlementAmount = await readSubcontractInvoiceRemainingSettlementInTx(
        tx,
        ctx.companyId,
        subcontractInvoiceId
      );
      if (input.amount > remainingSettlementAmount + 0.0001) {
        throw new AppError(422, 'مبلغ التخصيص يتجاوز المتبقي على المستخلص');
      }
      const unapplied = await getCashTransactionUnappliedForContractingInTx(
        tx,
        ctx.companyId,
        input.cashTransactionId
      );
      if (input.amount > unapplied + 0.0001) {
        throw new AppError(422, 'مبلغ التخصيص يتجاوز الرصيد غير المطبّق على السند');
      }

      await assertCashTransactionPartyMatchesSubcontractInvoiceInTx(
        tx,
        ctx.companyId,
        subcontractInvoiceId,
        input.cashTransactionId
      );

      const allocation = await createSubcontractAllocationInTx(tx, {
        companyId: ctx.companyId,
        cashTransactionId: input.cashTransactionId,
        subcontractInvoiceId,
        allocatedAmount: input.amount,
        createdBy: ctx.userId,
        allocatedAt: input.allocatedAt,
      });

      const totals = await refreshSubcontractInvoiceSettlementInTx(
        tx,
        ctx.companyId,
        subcontractInvoiceId
      );
      const idemPayload: SettlementIdempotencyResult = {
        cashTransactionId: input.cashTransactionId,
        allocationId: allocation.id,
        eligibleAmount: totals.eligibleAmount,
        paidAmount: totals.paidAmount,
        remainingSettlementAmount: totals.remainingSettlementAmount,
        remainingAmount: totals.remainingSettlementAmount,
        settlementStatus: totals.settlementStatus,
      };
      await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, idemPayload);
      return toSubPayResponse(idemPayload);
    });
  }
}

export const contractingCertificateSettlementService = new ContractingCertificateSettlementService();

export async function assertClientInvoiceHasNoActiveSettlements(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientInvoiceId: string
) {
  const count = await contractingCertificateBalanceService.countActiveClientInvoiceSettlementsInTx(
    tx,
    companyId,
    clientInvoiceId
  );
  if (count > 0) {
    throw new AppError(
      422,
      `${ACTIVE_SETTLEMENT_BLOCKS_REVERSAL}: لا يمكن عكس مستخلص له تحصيلات خزينة نشطة`
    );
  }
}

export async function assertSubcontractInvoiceHasNoActiveSettlements(
  tx: Prisma.TransactionClient,
  companyId: string,
  subcontractInvoiceId: string
) {
  const count =
    await contractingCertificateBalanceService.countActiveSubcontractInvoiceSettlementsInTx(
      tx,
      companyId,
      subcontractInvoiceId
    );
  if (count > 0) {
    throw new AppError(
      422,
      `${ACTIVE_SETTLEMENT_BLOCKS_REVERSAL}: لا يمكن عكس مستخلص له سدادات خزينة نشطة`
    );
  }
}
