import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { assertExpectedVersion, assertUpdateCount } from '../../../shared/concurrency/optimistic-lock';
import { resolveHijriDate } from '../../../shared/utils/hijri-date';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { assertCashOverdraftAllowed } from './treasury-overdraft';
import { splitVoucherLineTotals } from '../types/vouchers.dto';
import { journalPostingService } from '../../accounting/services/journal-posting.service';

export interface CreateCashTransactionLineInput {
  accountId: string;
  description?: string;
  amount: number;
  currencyCode?: string;
  exchangeRate?: number;
  costCenterId?: string | null;
  entrySide?: 'DEBIT' | 'CREDIT';
  isTiedToInvoice?: boolean;
  invoiceId?: string | null;
}

export interface CreateCashAllocationInput {
  invoiceId: string;
  allocatedAmount: number;
}

export interface CreateCashTransactionInput {
  transactionKind: 'RECEIPT' | 'PAYMENT';
  voucherNumber?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  amount: number;
  currencyCode: string;
  customerId?: string;
  supplierId?: string;
  offsetAccountId?: string;
  safeId?: string;
  bankAccountId?: string;
  /** Wave 2 fix: FX rate in effect for this movement (defaults to 1 if omitted). */
  exchangeRate?: number;
  isRecurring?: boolean;
  documentRole?: 'ORDER' | 'VOUCHER';
  departmentId?: string;
  sourceOrderId?: string;
  paymentOrderCode?: string;
  paymentOrderNumber?: string;
  receiptOrderCode?: string;
  receiptOrderNumber?: string;
  bankReference?: string;
  referenceNumber?: string;
  valueDate?: Date;
  lines?: CreateCashTransactionLineInput[];
  allocations?: CreateCashAllocationInput[];
}

export type UpdateCashTransactionInput = CreateCashTransactionInput & {
  expectedVersion: number;
};

/**
 * Legacy `CreateCashNum`'s `CashNumType`: `BR`/`BP` are the cash box's receipt
 * and payment vouchers, `KR`/`KP` the bank's. `*01` is the always-present base
 * instance of each type — a user-defined `NewModule` code (e.g. `BP02`) would
 * come from the registry once documents carry a module reference.
 */
export function cashVoucherFamily(input: {
  transactionKind: string;
  bankAccountId?: string | null;
}): 'BP01' | 'BR01' | 'KP01' | 'KR01' {
  const isBank = Boolean(input.bankAccountId);
  const isReceipt = input.transactionKind === 'RECEIPT';
  if (isBank) return isReceipt ? 'KR01' : 'KP01';
  return isReceipt ? 'BR01' : 'BP01';
}

function cashVoucherSuffix(input: { transactionKind: string; bankAccountId?: string | null }): string {
  return cashVoucherFamily(input);
}

export class CashTransactionService {
  async create(
    companyId: string,
    branchId: string | undefined,
    fiscalYearId: string | undefined,
    input: CreateCashTransactionInput,
    userId?: string
  ) {
    return prisma.$transaction(async (tx) =>
      this.createInTx(tx, companyId, branchId, fiscalYearId, input, undefined, userId)
    );
  }

  async createInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    branchId: string | undefined,
    fiscalYearId: string | undefined,
    input: CreateCashTransactionInput,
    extra?: { invoiceId?: string; invoiceInstallmentId?: string },
    userId?: string
  ) {
    const lines = input.lines ?? [];
    if (lines.length) {
      await this.assertVoucherLines(tx, companyId, lines);
      const { netCash } = splitVoucherLineTotals(lines, input.transactionKind);
      const isBankPayment = Boolean(input.bankAccountId) && input.transactionKind === 'PAYMENT';
      const isBankReceipt = Boolean(input.bankAccountId) && input.transactionKind === 'RECEIPT';
      if (netCash <= 0) {
        throw new AppError(
          422,
          isBankReceipt
            ? 'صافي المضاف للبنك يجب أن يكون أكبر من صفر'
            : input.transactionKind === 'RECEIPT'
              ? 'صافي المقبوض بالخزنة يجب أن يكون أكبر من صفر'
              : isBankPayment
                ? 'صافي المخصوم من البنك يجب أن يكون أكبر من صفر'
                : 'صافي المنصرف من الخزنة يجب أن يكون أكبر من صفر'
        );
      }
      if (Math.abs(netCash - Number(input.amount)) > 0.009) {
        throw new AppError(
          422,
          isBankReceipt
            ? 'صافي المضاف للبنك (الدائن − الأطراف المدينة) يجب أن يساوي مبلغ الإشعار'
            : input.transactionKind === 'RECEIPT'
              ? 'صافي المقبوض (الدائن − الأطراف المدينة) يجب أن يساوي مبلغ السند'
              : isBankPayment
                ? 'صافي المخصوم من البنك (المدين − الأطراف الدائنة) يجب أن يساوي مبلغ الإشعار'
                : 'صافي المنصرف (المدين − الأطراف الدائنة) يجب أن يساوي مبلغ السند'
        );
      }
    }

    if (input.referenceNumber && !input.bankReference) {
      input.bankReference = input.referenceNumber;
    }

    if (!input.sourceOrderId && (input.paymentOrderCode || input.paymentOrderNumber)) {
      const order = await this.findPaymentOrder(companyId, {
        code: input.paymentOrderCode,
        number: input.paymentOrderNumber,
      });
      input.sourceOrderId = order.id;
    }
    if (!input.sourceOrderId && (input.receiptOrderCode || input.receiptOrderNumber)) {
      const order = await this.findReceiptOrder(companyId, {
        code: input.receiptOrderCode,
        number: input.receiptOrderNumber,
      });
      input.sourceOrderId = order.id;
    }

    const isVoucherDoc = (input.documentRole ?? 'VOUCHER') !== 'ORDER';
    if (isVoucherDoc && input.sourceOrderId) {
      await this.assertSourceOrderAvailable(tx, companyId, input.sourceOrderId, {
        transactionKind: input.transactionKind,
      });
    }

    const allocations = input.allocations ?? [];
    if (allocations.length) {
      await this.assertAllocations(tx, companyId, input, allocations);
    }

    if (input.safeId && input.bankAccountId) {
      throw new AppError(422, 'السند يقبل خزينة أو حساباً بنكياً — وليس الاثنين معاً');
    }

    if (input.transactionKind === 'RECEIPT') {
      if (!input.customerId && !input.supplierId && !input.offsetAccountId && !lines.length) {
        throw new AppError(422, 'Receipt requires customer, supplier, or offset account');
      }
      if (!input.safeId && !input.bankAccountId) {
        throw new AppError(422, 'Receipt requires safe or bank account');
      }
    } else {
      if (!input.customerId && !input.supplierId && !input.offsetAccountId && !lines.length) {
        throw new AppError(422, 'Payment requires customer, supplier, offset account, or voucher lines');
      }
      if (!input.safeId && !input.bankAccountId) {
        throw new AppError(422, 'Payment requires safe or bank account');
      }
      await assertCashOverdraftAllowed({
        companyId,
        amount: Number(input.amount),
        safeId: input.safeId,
        bankAccountId: input.bankAccountId,
      });
    }

    let treasuryReceiptId: string | undefined;
    let treasuryPaymentId: string | undefined;

    // Legacy `CreateCashNum` numbers cash/bank vouchers per document type
    // (`BP`/`BR` for the box, `KP`/`KR` for the bank). The web app accepted a
    // free-text `voucherNumber` and left it null when the client omitted one,
    // so vouchers went to the ledger unnumbered.
    const voucherNumber =
      input.voucherNumber?.trim() ||
      (await documentSequenceService.nextNumberForFamilyInTx(tx, {
        companyId,
        branchId: branchId ?? null,
        fiscalYearId: fiscalYearId ?? null,
        docType: 'CASH',
        legacySuffix: cashVoucherSuffix(input),
        // Receipts and payments share the CASH series and each enforce a
        // per-company unique voucher number, so the sequence has to start above
        // whatever the pre-sequencing rows already used on both sides.
        seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
          const [receipts, payments] = await Promise.all([
            tx.treasuryReceipt.findMany({ where: { companyId }, select: { voucherNumber: true } }),
            tx.treasuryPayment.findMany({ where: { companyId }, select: { voucherNumber: true } }),
          ]);
          return [...receipts, ...payments].map((r) => r.voucherNumber);
        }),
        isAvailable: async (candidate) => {
          const [receipt, payment] = await Promise.all([
            tx.treasuryReceipt.findFirst({
              where: { companyId, voucherNumber: candidate },
              select: { id: true },
            }),
            tx.treasuryPayment.findFirst({
              where: { companyId, voucherNumber: candidate },
              select: { id: true },
            }),
          ]);
          return !receipt && !payment;
        },
      }));
    if (!voucherNumber) {
      // Legacy `if SerialAutomatic<>'A' then ... ShowLangMessage(81)`.
      throw new AppError(422, 'رقم السند مطلوب — الترقيم يدوي لهذا النوع من السندات');
    }

    if (input.transactionKind === 'RECEIPT') {
      const receipt = await tx.treasuryReceipt.create({
        data: {
          companyId,
          branchId,
          fiscalYearId,
          voucherNumber,
          date: input.date,
          description: input.description,
          receiptType: 'party',
          customerId: input.customerId,
          supplierId: input.supplierId,
          accountId: input.offsetAccountId,
          safeId: input.safeId,
          bankAccountId: input.bankAccountId,
          amount: new Decimal(input.amount),
          currencyCode: input.currencyCode,
        },
      });
      treasuryReceiptId = receipt.id;
    } else {
      const payment = await tx.treasuryPayment.create({
        data: {
          companyId,
          branchId,
          fiscalYearId,
          voucherNumber,
          date: input.date,
          description: input.description,
          paymentType: 'party',
          customerId: input.customerId,
          supplierId: input.supplierId,
          accountId: input.offsetAccountId,
          safeId: input.safeId,
          bankAccountId: input.bankAccountId,
          amount: new Decimal(input.amount),
          currencyCode: input.currencyCode,
        },
      });
      treasuryPaymentId = payment.id;
    }

    const created = await tx.cashTransaction.create({
      data: {
        companyId,
        branchId,
        fiscalYearId,
        transactionKind: input.transactionKind,
        voucherNumber,
        date: input.date,
        hijriDate: resolveHijriDate(input.date, input.hijriDate),
        description: input.description,
        amount: new Decimal(input.amount),
        currencyCode: input.currencyCode,
        customerId: input.customerId,
        supplierId: input.supplierId,
        offsetAccountId: input.offsetAccountId ?? lines[0]?.accountId,
        safeId: input.safeId,
        bankAccountId: input.bankAccountId,
        exchangeRate: input.exchangeRate != null ? new Decimal(input.exchangeRate) : null,
        isRecurring: input.isRecurring ?? false,
        documentRole: input.documentRole ?? 'VOUCHER',
        departmentId: input.departmentId,
        sourceOrderId: input.sourceOrderId,
        bankReference: input.bankReference,
        valueDate: input.valueDate,
        workflowStatus: 'DRAFT',
        treasuryReceiptId,
        treasuryPaymentId,
        invoiceId: extra?.invoiceId,
        invoiceInstallmentId: extra?.invoiceInstallmentId,
        createdBy: userId,
        executionStatus: 'PENDING',
      },
    });

    if (lines.length) {
      await tx.cashTransactionLine.createMany({
        data: lines.map((line, index) => ({
          companyId,
          cashTransactionId: created.id,
          accountId: line.accountId,
          description: line.description,
          amount: new Decimal(line.amount),
          currencyCode: line.currencyCode ?? input.currencyCode,
          exchangeRate: new Decimal(line.exchangeRate ?? input.exchangeRate ?? 1),
          costCenterId: line.costCenterId ?? null,
          entrySide:
            line.entrySide === 'CREDIT'
              ? 'CREDIT'
              : line.entrySide === 'DEBIT'
                ? 'DEBIT'
                : input.transactionKind === 'RECEIPT'
                  ? 'CREDIT'
                  : 'DEBIT',
          isTiedToInvoice: Boolean(line.isTiedToInvoice && line.invoiceId),
          invoiceId: line.invoiceId || null,
          lineOrder: index + 1,
        })),
      });
    }

    if (allocations.length) {
      await tx.paymentAllocation.createMany({
        data: allocations.map((row) => ({
          companyId,
          cashTransactionId: created.id,
          invoiceId: row.invoiceId,
          allocatedAmount: new Decimal(row.allocatedAmount),
        })),
      });
    }

    for (const line of lines) {
      const rate = Number(line.exchangeRate ?? input.exchangeRate ?? 1);
      const currency = line.currencyCode ?? input.currencyCode;
      if (currency !== 'EGP') {
        await tx.exchangeRateHistory.create({
          data: {
            companyId,
            currencyCode: currency,
            rate: new Decimal(rate),
            sourceType: cashVoucherFamily(input),
            sourceId: created.id,
            userId: userId ?? null,
          },
        });
      }
    }

    if (isVoucherDoc && input.sourceOrderId) {
      await this.markSourceOrderCompleted(tx, companyId, input.sourceOrderId, userId);
    }

    return this.decorateOrder(
      await tx.cashTransaction.findFirstOrThrow({
        where: { id: created.id, companyId },
        include: { lines: true, paymentAllocations: true },
      })
    );
  }

  /**
   * Draft voucher update (spec: vouchers.service.ts).
   * `expectedVersion` must match the row the client loaded.
   */
  async update(companyId: string, id: string, input: UpdateCashTransactionInput, userId?: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.cashTransaction.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new AppError(404, 'Cash transaction not found');
      if (existing.isPosted) {
        throw new AppError(422, 'لا يمكن تعديل سند مرحّل — فك الترحيل أولاً');
      }
      if (existing.isCancelled) {
        throw new AppError(422, 'لا يمكن تعديل سند ملغى');
      }
      if (existing.documentRole === 'ORDER') {
        const linkedVoucher = await this.findActiveVoucherForOrder(tx, companyId, id);
        if (existing.executionStatus === 'COMPLETED' || linkedVoucher) {
          throw new AppError(422, 'لا يمكن تعديل أمر مكتمل التنفيذ');
        }
      }

      const lines = input.lines ?? [];
      if (lines.length) {
        await this.assertVoucherLines(tx, companyId, lines);
        const { netCash } = splitVoucherLineTotals(lines, input.transactionKind);
        const isBankPayment = Boolean(input.bankAccountId) && input.transactionKind === 'PAYMENT';
        const isBankReceipt = Boolean(input.bankAccountId) && input.transactionKind === 'RECEIPT';
        if (netCash <= 0) {
          throw new AppError(
            422,
            isBankReceipt
              ? 'صافي المضاف للبنك يجب أن يكون أكبر من صفر'
              : input.transactionKind === 'RECEIPT'
                ? 'صافي المقبوض بالخزنة يجب أن يكون أكبر من صفر'
                : isBankPayment
                  ? 'صافي المخصوم من البنك يجب أن يكون أكبر من صفر'
                  : 'صافي المنصرف من الخزنة يجب أن يكون أكبر من صفر'
          );
        }
        if (Math.abs(netCash - Number(input.amount)) > 0.009) {
          throw new AppError(
            422,
            isBankReceipt
              ? 'صافي المضاف للبنك (الدائن − الأطراف المدينة) يجب أن يساوي مبلغ الإشعار'
              : input.transactionKind === 'RECEIPT'
                ? 'صافي المقبوض (الدائن − الأطراف المدينة) يجب أن يساوي مبلغ السند'
                : isBankPayment
                  ? 'صافي المخصوم من البنك (المدين − الأطراف الدائنة) يجب أن يساوي مبلغ الإشعار'
                  : 'صافي المنصرف (المدين − الأطراف الدائنة) يجب أن يساوي مبلغ السند'
          );
        }
      }

      if (input.referenceNumber && !input.bankReference) {
        input.bankReference = input.referenceNumber;
      }

      const isVoucherDoc = existing.documentRole !== 'ORDER';
      const nextSourceOrderId = isVoucherDoc ? input.sourceOrderId ?? null : existing.sourceOrderId;
      const prevSourceOrderId = existing.sourceOrderId ?? null;
      if (isVoucherDoc && nextSourceOrderId) {
        await this.assertSourceOrderAvailable(tx, companyId, nextSourceOrderId, {
          transactionKind: input.transactionKind,
          excludeVoucherId: id,
        });
      }

      const allocations = input.allocations ?? [];
      if (allocations.length) {
        await this.assertAllocations(tx, companyId, input, allocations);
      }
      if (input.safeId && input.bankAccountId) {
        throw new AppError(422, 'السند يقبل خزينة أو حساباً بنكياً — وليس الاثنين معاً');
      }

      const updateResult = await tx.cashTransaction.updateMany({
        where: {
          id,
          companyId,
          version: input.expectedVersion,
        },
        data: {
          date: input.date,
          hijriDate: resolveHijriDate(input.date, input.hijriDate),
          description: input.description,
          amount: new Decimal(input.amount),
          currencyCode: input.currencyCode,
          customerId: input.customerId ?? null,
          supplierId: input.supplierId ?? null,
          offsetAccountId: input.offsetAccountId ?? lines[0]?.accountId ?? null,
          safeId: input.safeId ?? null,
          bankAccountId: input.bankAccountId ?? null,
          exchangeRate: input.exchangeRate != null ? new Decimal(input.exchangeRate) : null,
          isRecurring: input.isRecurring ?? existing.isRecurring,
          departmentId: input.departmentId ?? null,
          sourceOrderId: nextSourceOrderId,
          bankReference: input.bankReference ?? null,
          valueDate: input.valueDate ?? null,
          version: { increment: 1 },
        },
      });
      assertUpdateCount(updateResult.count);

      if (existing.treasuryReceiptId) {
        await tx.treasuryReceipt.update({
          where: { id: existing.treasuryReceiptId },
          data: {
            date: input.date,
            description: input.description,
            customerId: input.customerId,
            supplierId: input.supplierId,
            accountId: input.offsetAccountId,
            safeId: input.safeId,
            bankAccountId: input.bankAccountId,
            amount: new Decimal(input.amount),
            currencyCode: input.currencyCode,
          },
        });
      }
      if (existing.treasuryPaymentId) {
        await tx.treasuryPayment.update({
          where: { id: existing.treasuryPaymentId },
          data: {
            date: input.date,
            description: input.description,
            customerId: input.customerId,
            supplierId: input.supplierId,
            accountId: input.offsetAccountId,
            safeId: input.safeId,
            bankAccountId: input.bankAccountId,
            amount: new Decimal(input.amount),
            currencyCode: input.currencyCode,
          },
        });
      }

      await tx.cashTransactionLine.deleteMany({ where: { cashTransactionId: id } });
      if (lines.length) {
        await tx.cashTransactionLine.createMany({
          data: lines.map((line, index) => ({
            companyId,
            cashTransactionId: id,
            accountId: line.accountId,
            description: line.description,
            amount: new Decimal(line.amount),
            currencyCode: line.currencyCode ?? input.currencyCode,
            exchangeRate: new Decimal(line.exchangeRate ?? input.exchangeRate ?? 1),
            costCenterId: line.costCenterId ?? null,
            entrySide:
            line.entrySide === 'CREDIT'
              ? 'CREDIT'
              : line.entrySide === 'DEBIT'
                ? 'DEBIT'
                : input.transactionKind === 'RECEIPT'
                  ? 'CREDIT'
                  : 'DEBIT',
            isTiedToInvoice: Boolean(line.isTiedToInvoice && line.invoiceId),
            invoiceId: line.invoiceId || null,
            lineOrder: index + 1,
          })),
        });
      }

      await tx.paymentAllocation.deleteMany({ where: { cashTransactionId: id } });
      if (allocations.length) {
        await tx.paymentAllocation.createMany({
          data: allocations.map((row) => ({
            companyId,
            cashTransactionId: id,
            invoiceId: row.invoiceId,
            allocatedAmount: new Decimal(row.allocatedAmount),
          })),
        });
      }

      await tx.exchangeRateHistory.deleteMany({ where: { companyId, sourceId: id } });
      for (const line of lines) {
        const rate = Number(line.exchangeRate ?? input.exchangeRate ?? 1);
        const currency = line.currencyCode ?? input.currencyCode;
        if (currency !== 'EGP') {
          await tx.exchangeRateHistory.create({
            data: {
              companyId,
              currencyCode: currency,
              rate: new Decimal(rate),
              sourceType: cashVoucherFamily(input),
              sourceId: id,
              userId: userId ?? null,
            },
          });
        }
      }

      if (isVoucherDoc) {
        if (prevSourceOrderId && prevSourceOrderId !== nextSourceOrderId) {
          await this.releaseSourceOrderIfUnused(tx, companyId, prevSourceOrderId, id);
        }
        if (nextSourceOrderId) {
          await this.markSourceOrderCompleted(tx, companyId, nextSourceOrderId, userId);
        }
      }

      return this.decorateOrder(
        await tx.cashTransaction.findFirstOrThrow({
          where: { id, companyId },
          include: { lines: true, paymentAllocations: true },
        })
      );
    });
  }

  private async assertVoucherLines(
    tx: Prisma.TransactionClient,
    companyId: string,
    lines: CreateCashTransactionLineInput[]
  ) {
    for (const line of lines) {
      const account = await tx.account.findFirst({
        where: { id: line.accountId, companyId, deletedAt: null },
        include: { children: { where: { deletedAt: null }, select: { id: true }, take: 1 } },
      });
      if (!account) throw new AppError(422, `الحساب غير موجود: ${line.accountId}`);
      if (!account.isActive) throw new AppError(422, `الحساب غير نشط: ${account.code}`);
      if (account.children.length > 0) {
        throw new AppError(422, `لا يمكن الترحيل على حساب مجمع: ${account.code}`);
      }
      const required = (account.costCenterRequired ?? '').trim();
      if ((required === 'إجباري' || required.toUpperCase() === 'REQUIRED') && !line.costCenterId) {
        throw new AppError(422, `مركز التكلفة إجباري للحساب ${account.code}`);
      }
      if (line.costCenterId) {
        const cc = await tx.costCenter.findFirst({
          where: { id: line.costCenterId, companyId, isActive: true },
        });
        if (!cc) throw new AppError(422, 'مركز التكلفة غير موجود أو غير نشط');
      }
    }
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.cashTransaction.findFirst({
      where: { id, companyId },
      include: {
        treasuryReceipt: true,
        treasuryPayment: true,
        lines: { orderBy: { lineOrder: 'asc' } },
        paymentAllocations: true,
        journalEntry: { select: { id: true, voucherNumber: true, isPosted: true } },
        department: { select: { id: true, code: true, arabicName: true } },
        sourceOrder: { select: { id: true, voucherNumber: true, amount: true } },
        safe: {
          include: {
            glAccount: { select: { id: true, code: true, arabicName: true } },
          },
        },
        bankAccount: {
          include: {
            glAccount: { select: { id: true, code: true, arabicName: true } },
          },
        },
      },
    });
    if (!row) {
      throw new AppError(404, 'Cash transaction not found');
    }
    if (row.documentRole === 'ORDER' && row.executionStatus === 'PENDING' && !row.isCancelled) {
      const linked = await this.findActiveVoucherForOrder(prisma, companyId, id);
      if (linked) {
        await this.markSourceOrderCompleted(prisma, companyId, id);
        return this.decorateOrder({
          ...row,
          executionStatus: 'COMPLETED' as const,
          executedAt: new Date(),
        });
      }
    }
    return this.decorateOrder(row);
  }

  async list(
    companyId: string,
    options?: {
      page?: number;
      limit?: number;
      isPosted?: boolean;
      isCancelled?: boolean;
      isRecurring?: boolean;
      transactionKind?: 'RECEIPT' | 'PAYMENT';
      documentRole?: 'ORDER' | 'VOUCHER';
      departmentId?: string;
      fundType?: 'CASHBOX' | 'BANK_ACCOUNT';
      voucherNumber?: string;
      search?: string;
      code?: string;
      number?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      executionStatus?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
    }
  ) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;
    const where: Prisma.CashTransactionWhereInput = { companyId };
    if (options?.isPosted !== undefined) where.isPosted = options.isPosted;
    if (options?.isCancelled !== undefined) where.isCancelled = options.isCancelled;
    if (options?.isRecurring !== undefined) where.isRecurring = options.isRecurring;
    if (options?.transactionKind) where.transactionKind = options.transactionKind;
    if (options?.documentRole) where.documentRole = options.documentRole;
    if (options?.departmentId) where.departmentId = options.departmentId;
    if (options?.executionStatus) where.executionStatus = options.executionStatus;
    const search = options?.search?.trim() || options?.voucherNumber?.trim();
    const code = options?.code?.trim();
    const number = options?.number?.trim();
    if (search || code || number) {
      const tokens = [search, number, code && number ? `${code}-${number}` : '', code && number ? `${code}${number}` : '']
        .map((t) => t?.trim())
        .filter((t): t is string => Boolean(t));
      where.OR = tokens.flatMap((token) => [
        { voucherNumber: token },
        { voucherNumber: { contains: token } },
      ]);
    }
    if (options?.fundType === 'CASHBOX') {
      where.safeId = { not: null };
      where.bankAccountId = null;
    } else if (options?.fundType === 'BANK_ACCOUNT') {
      where.bankAccountId = { not: null };
      where.safeId = null;
    }

    const [items, total] = await Promise.all([
      prisma.cashTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy:
          options?.sortBy === 'date'
            ? [{ date: options.sortDir === 'desc' ? 'desc' : 'asc' }, { voucherNumber: 'asc' }]
            : options?.sortBy === 'amount'
              ? [{ amount: options.sortDir === 'desc' ? 'desc' : 'asc' }, { voucherNumber: 'asc' }]
              : [{ voucherNumber: options.sortDir === 'desc' ? 'desc' : 'asc' }, { createdAt: 'asc' }],
        include: {
          lines: { orderBy: { lineOrder: 'asc' } },
          journalEntry: { select: { id: true, voucherNumber: true } },
        },
      }),
      prisma.cashTransaction.count({ where }),
    ]);

    const pendingOrderIds = items
      .filter(
        (row) =>
          row.documentRole === 'ORDER' &&
          row.executionStatus === 'PENDING' &&
          !row.isCancelled
      )
      .map((row) => row.id);
    const linkedIds = pendingOrderIds.length
      ? new Set(
          (
            await prisma.cashTransaction.findMany({
              where: {
                companyId,
                sourceOrderId: { in: pendingOrderIds },
                isCancelled: false,
              },
              select: { sourceOrderId: true },
            })
          )
            .map((row) => row.sourceOrderId)
            .filter((id): id is string => Boolean(id))
        )
      : new Set<string>();

    const decorated = items.map((row) =>
      linkedIds.has(row.id) ? { ...row, executionStatus: 'COMPLETED' as const } : row
    );

    return {
      items:
        options?.executionStatus === 'PENDING'
          ? decorated.filter((row) => row.executionStatus === 'PENDING')
          : decorated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async rollbackUnposted(companyId: string, id: string) {
    await prisma.$transaction(async (tx) => {
      const row = await tx.cashTransaction.findFirst({
        where: { id, companyId, isPosted: false },
        select: { id: true, treasuryPaymentId: true, treasuryReceiptId: true, sourceOrderId: true },
      });
      if (!row) return;
      await tx.exchangeRateHistory.deleteMany({ where: { companyId, sourceId: id } });
      await tx.paymentAllocation.deleteMany({ where: { cashTransactionId: id } });
      await tx.cashTransactionLine.deleteMany({ where: { cashTransactionId: id } });
      await tx.cashTransaction.delete({ where: { id } });
      if (row.treasuryPaymentId) {
        await tx.treasuryPayment.delete({ where: { id: row.treasuryPaymentId } }).catch(() => undefined);
      }
      if (row.treasuryReceiptId) {
        await tx.treasuryReceipt.delete({ where: { id: row.treasuryReceiptId } }).catch(() => undefined);
      }
      if (row.sourceOrderId) {
        await this.releaseSourceOrderIfUnused(tx, companyId, row.sourceOrderId);
      }
    });
  }

  async cancel(companyId: string, id: string, expectedVersion?: number) {
    const row = await prisma.cashTransaction.findFirst({ where: { id, companyId } });
    if (!row) throw new AppError(404, 'Cash transaction not found');
    if (row.isPosted) throw new AppError(422, 'لا يمكن إلغاء سند مرحّل — فك الترحيل أولاً');
    if (row.documentRole === 'ORDER') {
      const linkedVoucher = await prisma.cashTransaction.findFirst({
        where: { companyId, sourceOrderId: id, isCancelled: false },
        select: { id: true },
      });
      if (row.executionStatus === 'COMPLETED' || linkedVoucher) {
        throw new AppError(
          422,
          row.transactionKind === 'RECEIPT'
            ? 'لا يمكن إلغاء أمر تم توريده'
            : 'لا يمكن إلغاء أمر تم صرفه'
        );
      }
    }
    assertExpectedVersion(row.version, expectedVersion);
    await prisma.$transaction(async (tx) => {
      await journalPostingService.cascadeSourceJournalInTx(
        tx,
        companyId,
        [row.journalEntryId],
        'cancel',
        undefined,
        { sourceId: row.id, sourceNumber: row.voucherNumber ?? undefined }
      );
      const updateResult = await tx.cashTransaction.updateMany({
        where: {
          id,
          companyId,
          version: expectedVersion ?? row.version,
        },
        data: {
          isCancelled: true,
          executionStatus: 'CANCELLED',
          workflowStatus: 'DRAFT',
          version: { increment: 1 },
        },
      });
      assertUpdateCount(updateResult.count);
      if (row.documentRole !== 'ORDER' && row.sourceOrderId) {
        await this.releaseSourceOrderIfUnused(tx, companyId, row.sourceOrderId);
      }
    });
    return this.decorateOrder(await prisma.cashTransaction.findFirstOrThrow({ where: { id, companyId } }));
  }

  async toggleExecution(
    companyId: string,
    id: string,
    expectedKind: 'PAYMENT' | 'RECEIPT',
    userId?: string
  ) {
    const row = await prisma.cashTransaction.findFirst({ where: { id, companyId } });
    if (!row) throw new AppError(404, 'الأمر غير موجود');
    if ((row.documentRole ?? 'VOUCHER') !== 'ORDER') {
      throw new AppError(422, 'تأكيد التنفيذ متاح لأوامر الصرف والتوريد فقط');
    }
    if (row.transactionKind !== expectedKind) {
      throw new AppError(422, 'نوع الأمر لا يطابق مسار التنفيذ');
    }
    if (row.isCancelled || row.executionStatus === 'CANCELLED') {
      throw new AppError(422, 'لا يمكن تنفيذ أمر ملغى');
    }
    if (row.executionStatus === 'COMPLETED') {
      const linked = await prisma.cashTransaction.findFirst({
        where: { companyId, sourceOrderId: id, isCancelled: false },
        select: { id: true },
      });
      if (linked) {
        throw new AppError(
          422,
          expectedKind === 'RECEIPT'
            ? 'لا يمكن إرجاع أمر تم تحميله على سند توريد'
            : 'لا يمكن إرجاع أمر تم تحميله على سند صرف'
        );
      }
    }

    const nextStatus = row.executionStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    const updated = await prisma.cashTransaction.update({
      where: { id },
      data: {
        executionStatus: nextStatus,
        executedAt: nextStatus === 'COMPLETED' ? new Date() : null,
        executedBy: nextStatus === 'COMPLETED' ? userId ?? null : null,
        version: { increment: 1 },
      },
      include: {
        lines: { orderBy: { lineOrder: 'asc' } },
      },
    });
    return this.decorateOrder(updated);
  }

  async findPaymentOrder(
    companyId: string,
    ref: { code?: string; number?: string; departmentId?: string }
  ) {
    return this.findTreasuryOrder(companyId, 'PAYMENT', ref);
  }

  async findReceiptOrder(
    companyId: string,
    ref: { code?: string; number?: string; departmentId?: string }
  ) {
    return this.findTreasuryOrder(companyId, 'RECEIPT', ref);
  }

  private async findTreasuryOrder(
    companyId: string,
    transactionKind: 'PAYMENT' | 'RECEIPT',
    ref: { code?: string; number?: string; departmentId?: string }
  ) {
    const code = ref.code?.trim();
    const number = ref.number?.trim();
    const departmentId = ref.departmentId?.trim();
    const isReceipt = transactionKind === 'RECEIPT';
    const include = { lines: { orderBy: { lineOrder: 'asc' as const } } };
    const baseWhere = {
      companyId,
      documentRole: 'ORDER' as const,
      transactionKind,
      isCancelled: false,
    };

    if (departmentId && number) {
      const byDepartment = await prisma.cashTransaction.findFirst({
        where: {
          ...baseWhere,
          departmentId,
          OR: [
            { voucherNumber: number },
            { voucherNumber: { endsWith: `-${number}` } },
            { voucherNumber: { contains: number } },
          ],
        },
        include,
        orderBy: { createdAt: 'desc' },
      });
      if (byDepartment) return this.decorateLoadedOrder(byDepartment);
    }

    const tokens = [
      number,
      code,
      code && number ? `${code}-${number}` : '',
      code && number ? `${code}${number}` : '',
    ].filter((t): t is string => Boolean(t));
    if (!tokens.length) {
      throw new AppError(400, isReceipt ? 'أدخل القسم والرقم لأمر التوريد' : 'أدخل القسم والرقم لأمر الصرف');
    }
    const found = await prisma.cashTransaction.findFirst({
      where: {
        ...baseWhere,
        OR: tokens.flatMap((token) => [
          { voucherNumber: token },
          { voucherNumber: { contains: token } },
        ]),
      },
      include,
      orderBy: { createdAt: 'desc' },
    });
    if (!found) {
      throw new AppError(404, isReceipt ? 'أمر التوريد غير موجود' : 'أمر الصرف غير موجود');
    }
    return this.decorateLoadedOrder(found);
  }

  private async decorateLoadedOrder<
    T extends {
      id: string;
      companyId: string;
      executionStatus?: string | null;
      isCancelled?: boolean;
      createdBy?: string | null;
      executedBy?: string | null;
    },
  >(row: T) {
    if (row.executionStatus === 'PENDING' && !row.isCancelled) {
      const linked = await this.findActiveVoucherForOrder(prisma, row.companyId, row.id);
      if (linked) {
        await this.markSourceOrderCompleted(prisma, row.companyId, row.id);
        return this.decorateOrder({ ...row, executionStatus: 'COMPLETED' as const, executedAt: new Date() });
      }
    }
    return this.decorateOrder(row);
  }

  private async findActiveVoucherForOrder(
    db: Prisma.TransactionClient | typeof prisma,
    companyId: string,
    orderId: string
  ) {
    return db.cashTransaction.findFirst({
      where: { companyId, sourceOrderId: orderId, isCancelled: false },
      select: { id: true },
    });
  }

  private async assertSourceOrderAvailable(
    tx: Prisma.TransactionClient,
    companyId: string,
    orderId: string,
    opts: { transactionKind: 'PAYMENT' | 'RECEIPT'; excludeVoucherId?: string }
  ) {
    const order = await tx.cashTransaction.findFirst({
      where: { id: orderId, companyId },
      select: {
        id: true,
        documentRole: true,
        transactionKind: true,
        isCancelled: true,
        executionStatus: true,
        voucherNumber: true,
      },
    });
    if (!order || order.documentRole !== 'ORDER') {
      throw new AppError(422, opts.transactionKind === 'RECEIPT' ? 'أمر التوريد غير موجود' : 'أمر الصرف غير موجود');
    }
    if (order.transactionKind !== opts.transactionKind) {
      throw new AppError(422, 'نوع الأمر لا يطابق السند');
    }
    if (order.isCancelled || order.executionStatus === 'CANCELLED') {
      throw new AppError(
        422,
        opts.transactionKind === 'RECEIPT' ? 'لا يمكن تحميل أمر توريد ملغى' : 'لا يمكن تحميل أمر صرف ملغى'
      );
    }

    const alreadyOnThisVoucher = opts.excludeVoucherId
      ? await tx.cashTransaction.findFirst({
          where: {
            id: opts.excludeVoucherId,
            companyId,
            sourceOrderId: orderId,
            isCancelled: false,
          },
          select: { id: true },
        })
      : null;
    if (alreadyOnThisVoucher) return;

    const otherVoucher = await tx.cashTransaction.findFirst({
      where: {
        companyId,
        sourceOrderId: orderId,
        isCancelled: false,
        ...(opts.excludeVoucherId ? { id: { not: opts.excludeVoucherId } } : {}),
      },
      select: { id: true },
    });
    if (order.executionStatus === 'COMPLETED' || otherVoucher) {
      throw new AppError(
        422,
        opts.transactionKind === 'RECEIPT'
          ? 'تم توريد هذا الأمر بالفعل ولا يمكن تحميله مرة أخرى'
          : 'تم صرف هذا الأمر بالفعل ولا يمكن تحميله مرة أخرى'
      );
    }
  }

  private async markSourceOrderCompleted(
    tx: Prisma.TransactionClient | typeof prisma,
    companyId: string,
    orderId: string,
    userId?: string
  ) {
    await tx.cashTransaction.updateMany({
      where: { id: orderId, companyId, documentRole: 'ORDER', isCancelled: false },
      data: {
        executionStatus: 'COMPLETED',
        executedAt: new Date(),
        executedBy: userId ?? null,
        version: { increment: 1 },
      },
    });
  }

  private async releaseSourceOrderIfUnused(
    tx: Prisma.TransactionClient,
    companyId: string,
    orderId: string,
    excludeVoucherId?: string
  ) {
    const other = await tx.cashTransaction.findFirst({
      where: {
        companyId,
        sourceOrderId: orderId,
        isCancelled: false,
        ...(excludeVoucherId ? { id: { not: excludeVoucherId } } : {}),
      },
      select: { id: true },
    });
    if (other) return;
    await tx.cashTransaction.updateMany({
      where: { id: orderId, companyId, documentRole: 'ORDER', executionStatus: 'COMPLETED' },
      data: {
        executionStatus: 'PENDING',
        executedAt: null,
        executedBy: null,
        version: { increment: 1 },
      },
    });
  }

  private async decorateOrder<T extends { createdBy?: string | null; executedBy?: string | null }>(
    row: T
  ) {
    const ids = [row.createdBy, row.executedBy].filter((id): id is string => Boolean(id));
    if (ids.length === 0) {
      return { ...row, createdByName: null as string | null, executedByName: null as string | null };
    }
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, username: true },
    });
    const label = (id?: string | null) => {
      if (!id) return null;
      const user = users.find((u) => u.id === id);
      if (!user) return null;
      const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
      return full || user.username || null;
    };
    return {
      ...row,
      createdByName: label(row.createdBy),
      executedByName: label(row.executedBy),
    };
  }

  private async assertAllocations(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: CreateCashTransactionInput,
    allocations: CreateCashAllocationInput[]
  ) {
    const allocated = allocations.reduce((sum, row) => sum + Number(row.allocatedAmount), 0);
    const settlementTarget =
      input.transactionKind === 'RECEIPT' && (input.lines?.length ?? 0) > 0
        ? splitVoucherLineTotals(input.lines ?? [], 'RECEIPT').creditTotal
        : Number(input.amount);
    if (Math.abs(allocated - settlementTarget) > 0.009) {
      throw new AppError(422, 'إجمالي التوزيع على الفواتير يجب أن يساوي مبلغ السند تماماً');
    }
    const side: 'AP' | 'AR' = input.transactionKind === 'PAYMENT' ? 'AP' : 'AR';
    const allowedKinds =
      side === 'AP' ? ['PURCHASE', 'SALE_RETURN'] : ['SALE', 'PURCHASE_RETURN'];
    for (const row of allocations) {
      const invoice = await tx.invoice.findFirst({
        where: { id: row.invoiceId, companyId },
        select: {
          remainingAmount: true,
          supplierId: true,
          customerId: true,
          invoiceKind: true,
          isCancelled: true,
        },
      });
      if (!invoice) throw new AppError(422, 'فاتورة التوزيع غير موجودة');
      if (invoice.isCancelled) throw new AppError(422, 'لا يمكن التوزيع على فاتورة ملغاة');
      if (!invoice.invoiceKind || !allowedKinds.includes(invoice.invoiceKind)) {
        throw new AppError(
          422,
          side === 'AP'
            ? 'توزيع الصرف/الخصم يقبل فواتير ومردودات المشتريات فقط'
            : 'توزيع القبض/الإضافة يقبل فواتير ومردودات المبيعات فقط'
        );
      }
      const remaining = Number(invoice.remainingAmount ?? 0);
      if (remaining <= 0) throw new AppError(422, 'الفاتورة مسددة بالكامل');
      if (Number(row.allocatedAmount) - remaining > 0.009) {
        throw new AppError(422, 'المبلغ المراد سداده يتجاوز المتبقي على الفاتورة');
      }
      if (side === 'AP' && input.supplierId && invoice.supplierId && invoice.supplierId !== input.supplierId) {
        throw new AppError(422, 'الفاتورة لا تخص المورد المحدد');
      }
      if (side === 'AR' && input.customerId && invoice.customerId && invoice.customerId !== input.customerId) {
        throw new AppError(422, 'الفاتورة لا تخص العميل المحدد');
      }
    }
  }
}

export const cashTransactionService = new CashTransactionService();

/** Link legacy treasury voucher to unified cash transaction (idempotent). */
export async function ensureCashTransactionFromReceipt(
  companyId: string,
  receiptId: string
) {
  const existing = await prisma.cashTransaction.findFirst({
    where: { treasuryReceiptId: receiptId, companyId },
  });
  if (existing) return existing;

  const receipt = await prisma.treasuryReceipt.findFirst({
    where: { id: receiptId, companyId },
  });
  if (!receipt) {
    throw new AppError(404, 'Treasury receipt not found');
  }

  return prisma.cashTransaction.create({
    data: {
      companyId,
      branchId: receipt.branchId,
      fiscalYearId: receipt.fiscalYearId,
      transactionKind: 'RECEIPT',
      voucherNumber: receipt.voucherNumber ?? undefined,
      date: receipt.date,
      description: receipt.description ?? undefined,
      amount: receipt.amount,
      currencyCode: receipt.currencyCode,
      customerId: receipt.customerId,
      supplierId: receipt.supplierId,
      offsetAccountId: receipt.accountId,
      safeId: receipt.safeId,
      bankAccountId: receipt.bankAccountId,
      treasuryReceiptId: receipt.id,
    },
  });
}

export async function ensureCashTransactionFromPayment(
  companyId: string,
  paymentId: string
) {
  const existing = await prisma.cashTransaction.findFirst({
    where: { treasuryPaymentId: paymentId, companyId },
  });
  if (existing) return existing;

  const payment = await prisma.treasuryPayment.findFirst({
    where: { id: paymentId, companyId },
  });
  if (!payment) {
    throw new AppError(404, 'Treasury payment not found');
  }

  return prisma.cashTransaction.create({
    data: {
      companyId,
      branchId: payment.branchId,
      fiscalYearId: payment.fiscalYearId,
      transactionKind: 'PAYMENT',
      voucherNumber: payment.voucherNumber ?? undefined,
      date: payment.date,
      description: payment.description ?? undefined,
      amount: payment.amount,
      currencyCode: payment.currencyCode,
      customerId: payment.customerId,
      supplierId: payment.supplierId,
      offsetAccountId: payment.accountId,
      safeId: payment.safeId,
      bankAccountId: payment.bankAccountId,
      treasuryPaymentId: payment.id,
    },
  });
}
