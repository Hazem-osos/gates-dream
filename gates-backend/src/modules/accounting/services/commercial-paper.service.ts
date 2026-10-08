import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { assertPaperDueOnOrAfterIssue } from '../utils/paper-due-date';
import { toHijriDate } from '../../../shared/utils/hijri-date';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import type { CreateBatchReceiptPapersDto } from '../../treasury/dto/batch-receipt-paper.dto';
import { resolveSecuritiesEntity } from './securities-entity.service';
import { commercialPaperPostingService } from './commercial-paper-posting.service';
import { SECURITIES_PAPER_CASES } from '../utils/securities-paper-case';
import { openingBalanceService } from './opening-balance.service';
import { groupOpeningPapers } from '../utils/opening-paper-groups';
import {
  acquireUniqueKey,
  duplicateUniqueKeyMessage,
  repeatedUniqueValue,
  UNIQUE_KINDS,
} from '../../../shared/database/company-unique-key';

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function money(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function paperDescription(description?: string, branchName?: string): string | undefined {
  const parts = [description?.trim(), branchName?.trim() ? `فرع: ${branchName.trim()}` : undefined].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length ? parts.join(' — ') : undefined;
}

async function requireCompanyAccount(companyId: string, accountId: string | undefined): Promise<string> {
  const id = accountId?.trim();
  if (!id) throw new AppError(400, 'اختر حساب الورقة');
  const account = await prisma.account.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true },
  });
  if (!account) throw new AppError(400, 'حساب الورقة غير موجود');
  return account.id;
}

async function openingIssueDate(companyId: string, requested: Date): Promise<Date> {
  const meta = await openingBalanceService.resolveOpeningDate(companyId);
  const start = new Date(`${meta.fiscalYearStartDateIso}T00:00:00.000Z`);
  return Number.isNaN(start.getTime()) ? requested : start;
}

async function resolveBatchPaperParty(
  companyId: string,
  dto: CreateBatchReceiptPapersDto,
  missingLabel: string
): Promise<{ customerId?: string; supplierId?: string; partyAccountId?: string }> {
  if (dto.partyType === 'account') {
    const account = await prisma.account.findFirst({
      where: { id: dto.partyId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!account) {
      throw new AppError(400, 'الحساب غير موجود');
    }
    return { partyAccountId: account.id };
  }

  const customer =
    dto.partyType !== 'supplier'
      ? await prisma.customer.findFirst({
          where: { id: dto.partyId, companyId },
          select: { id: true },
        })
      : null;
  const supplier =
    !customer
      ? await prisma.supplier.findFirst({
          where: { id: dto.partyId, companyId },
          select: { id: true },
        })
      : null;

  if (!customer && !supplier) {
    throw new AppError(400, missingLabel);
  }
  return { customerId: customer?.id, supplierId: supplier?.id };
}

export class CommercialPaperService {
  async createBatchReceiptPapersInTx(
    companyId: string,
    dto: CreateBatchReceiptPapersDto,
    branchId?: string | null
  ) {
    if (!dto.papers?.length) {
      throw new AppError(400, 'أضف ورقة واحدة على الأقل');
    }
    const repeatedNumber = repeatedUniqueValue(dto.papers.map((paper) => paper.paperNumber));
    if (repeatedNumber) {
      throw new AppError(409, duplicateUniqueKeyMessage(UNIQUE_KINDS.chequeNumber, repeatedNumber));
    }

    const invalidAmount = dto.papers.some((paper) => !(Number(paper.amount) > 0));
    if (invalidAmount) {
      throw new AppError(400, 'جميع المبالغ يجب أن تكون أكبر من صفر');
    }

    const requestedIssueDate = asDate(dto.issueDate);
    if (Number.isNaN(requestedIssueDate.getTime())) {
      throw new AppError(400, 'تاريخ التحرير غير صالح');
    }
    const issueDate = dto.opening
      ? await openingIssueDate(companyId, requestedIssueDate)
      : requestedIssueDate;

    const hijriIssueDate = dto.opening
      ? toHijriDate(issueDate.toISOString().slice(0, 10))
      : dto.hijriIssueDate?.trim() || toHijriDate(issueDate);
    const currencyCode = dto.currencyCode?.trim() || 'EGP';
    const issuerName = dto.partyName?.trim() || undefined;
    const entity = await resolveSecuritiesEntity(companyId, {
      entityId: dto.entityId,
      entityName: dto.entityName,
    });
    const entityName = entity?.arabicName || dto.entityName?.trim() || undefined;

    const party = await resolveBatchPaperParty(companyId, dto, 'الساحب / العميل غير موجود');

    const createdPapers = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const paper of dto.papers) {
        const dueDate = asDate(paper.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          throw new AppError(400, `تاريخ استحقاق غير صالح للورقة ${paper.paperNumber}`);
        }
        assertPaperDueOnOrAfterIssue(issueDate, dueDate, paper.paperNumber);
        const securityNumber = await acquireUniqueKey(
          tx,
          companyId,
          UNIQUE_KINDS.chequeNumber,
          paper.paperNumber
        );
        if (!securityNumber) throw new AppError(400, 'رقم الشيك مطلوب');
        const destinationAccountId = dto.opening
          ? await requireCompanyAccount(companyId, paper.accountId)
          : undefined;

        const receiptNumber =
          (await documentSequenceService.nextNumberForFamilyInTx(tx, {
            companyId,
            branchId: branchId ?? null,
            fiscalYearId: null,
            docType: 'CK',
            legacySuffix: 'CK01',
            seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
              const existing = await tx.securitiesReceipt.findMany({
                where: { companyId },
                select: { receiptNumber: true },
              });
              return existing.map((row) => row.receiptNumber);
            }),
            isAvailable: async (candidate) => {
              const taken = await tx.securitiesReceipt.findFirst({
                where: { companyId, receiptNumber: candidate },
                select: { id: true },
              });
              return !taken;
            },
          })) ||
          paper.paperNumber.trim();

        const row = await tx.securitiesReceipt.create({
          data: {
            companyId,
            branchId: branchId ?? undefined,
            serial: receiptNumber,
            receiptNumber,
            date: issueDate,
            hijriDate: hijriIssueDate,
            description: paperDescription(paper.description, paper.branchName),
            securityType: 'check',
            customerId: party.customerId,
            supplierId: party.supplierId,
            partyAccountId: party.partyAccountId,
            destinationAccountId,
            issuerName,
            issuerBank: paper.bankName?.trim() || undefined,
            securityNumber,
            dueDate,
            amount: new Decimal(paper.amount),
            currencyCode,
            entityId: entity?.id,
            entityName,
            isReceived: true,
            isPosted: Boolean(dto.opening),
            postedAt: dto.opening ? new Date() : undefined,
            isOpening: Boolean(dto.opening),
            isApproved: false,
            isCancelled: false,
          },
        });
        rows.push(row);
      }
      return rows;
    });

    const totalAmount = money(
      createdPapers.reduce((sum, row) => sum + Number(row.amount), 0)
    );

    return { count: createdPapers.length, totalAmount };
  }

  async createBatchPaymentPapersInTx(
    companyId: string,
    dto: CreateBatchReceiptPapersDto,
    branchId?: string | null
  ) {
    if (!dto.papers?.length) {
      throw new AppError(400, 'أضف ورقة واحدة على الأقل');
    }
    const repeatedNumber = repeatedUniqueValue(dto.papers.map((paper) => paper.paperNumber));
    if (repeatedNumber) {
      throw new AppError(409, duplicateUniqueKeyMessage(UNIQUE_KINDS.chequeNumber, repeatedNumber));
    }

    const invalidAmount = dto.papers.some((paper) => !(Number(paper.amount) > 0));
    if (invalidAmount) {
      throw new AppError(400, 'جميع المبالغ يجب أن تكون أكبر من صفر');
    }

    const requestedIssueDate = asDate(dto.issueDate);
    if (Number.isNaN(requestedIssueDate.getTime())) {
      throw new AppError(400, 'تاريخ التحرير غير صالح');
    }
    const issueDate = dto.opening
      ? await openingIssueDate(companyId, requestedIssueDate)
      : requestedIssueDate;

    const hijriIssueDate = dto.opening
      ? toHijriDate(issueDate.toISOString().slice(0, 10))
      : dto.hijriIssueDate?.trim() || toHijriDate(issueDate);
    const currencyCode = dto.currencyCode?.trim() || 'EGP';
    const payeeName = dto.partyName?.trim() || undefined;
    const entity = await resolveSecuritiesEntity(companyId, {
      entityId: dto.entityId,
      entityName: dto.entityName,
    });
    const entityName = entity?.arabicName || dto.entityName?.trim() || undefined;
    const defaultDestinationAccountId = dto.opening
      ? null
      : await commercialPaperPostingService.resolveDefaultNotesAccount(companyId, 'PAYMENT');

    const party = await resolveBatchPaperParty(companyId, dto, 'المدفوع إليه غير موجود');

    const createdPapers = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const paper of dto.papers) {
        const dueDate = asDate(paper.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          throw new AppError(400, `تاريخ استحقاق غير صالح للورقة ${paper.paperNumber}`);
        }
        assertPaperDueOnOrAfterIssue(issueDate, dueDate, paper.paperNumber);
        const securityNumber = await acquireUniqueKey(
          tx,
          companyId,
          UNIQUE_KINDS.chequeNumber,
          paper.paperNumber
        );
        if (!securityNumber) throw new AppError(400, 'رقم الشيك مطلوب');
        const destinationAccountId = dto.opening
          ? await requireCompanyAccount(companyId, paper.accountId)
          : defaultDestinationAccountId;

        const paymentNumber =
          (await documentSequenceService.nextNumberForFamilyInTx(tx, {
            companyId,
            branchId: branchId ?? null,
            fiscalYearId: null,
            docType: 'PK-SECURITIES',
            legacySuffix: 'PK01',
            seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
              const existing = await tx.securitiesPayment.findMany({
                where: { companyId },
                select: { paymentNumber: true },
              });
              return existing.map((row) => row.paymentNumber);
            }),
            isAvailable: async (candidate) => {
              const taken = await tx.securitiesPayment.findFirst({
                where: { companyId, paymentNumber: candidate },
                select: { id: true },
              });
              return !taken;
            },
          })) || paper.paperNumber.trim();

        const row = await tx.securitiesPayment.create({
          data: {
            companyId,
            branchId: branchId ?? undefined,
            serial: paymentNumber,
            paymentNumber,
            date: issueDate,
            hijriDate: hijriIssueDate,
            description: paperDescription(paper.description, paper.branchName),
            securityType: 'check',
            customerId: party.customerId,
            supplierId: party.supplierId,
            partyAccountId: party.partyAccountId,
            destinationAccountId: destinationAccountId ?? undefined,
            payeeName,
            payeeBank: paper.bankName?.trim() || undefined,
            securityNumber,
            dueDate,
            amount: new Decimal(paper.amount),
            currencyCode,
            entityId: entity?.id,
            entityName,
            isPaid: true,
            isPosted: Boolean(dto.opening),
            postedAt: dto.opening ? new Date() : undefined,
            isOpening: Boolean(dto.opening),
            isApproved: false,
            isCancelled: false,
            paperCase: SECURITIES_PAPER_CASES.ISSUED,
          },
        });
        rows.push(row);
      }
      return rows;
    });

    const totalAmount = money(createdPapers.reduce((sum, row) => sum + Number(row.amount), 0));
    return { count: createdPapers.length, totalAmount };
  }

  /** مجموع شيكات الأوراق المالية السابقة على كل حساب، قبض ودفع، بدون الملغي. */
  async peekNextPaperSerial(
    companyId: string,
    kind: 'RECEIPT' | 'PAYMENT',
    branchId?: string | null
  ) {
    const receipt = kind === 'RECEIPT';
    return documentSequenceService.peekNextForFamily({
      companyId,
      branchId: branchId ?? null,
      fiscalYearId: null,
      docType: receipt ? 'CK' : 'PK-SECURITIES',
      legacySuffix: receipt ? 'CK01' : 'PK01',
      seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
        if (receipt) {
          const rows = await prisma.securitiesReceipt.findMany({
            where: { companyId },
            select: { receiptNumber: true },
          });
          return rows.map((row) => row.receiptNumber);
        }
        const rows = await prisma.securitiesPayment.findMany({
          where: { companyId },
          select: { paymentNumber: true },
        });
        return rows.map((row) => row.paymentNumber);
      }),
      isAvailable: async (candidate) => {
        const taken = receipt
          ? await prisma.securitiesReceipt.findFirst({
              where: { companyId, receiptNumber: candidate },
              select: { id: true },
            })
          : await prisma.securitiesPayment.findFirst({
              where: { companyId, paymentNumber: candidate },
              select: { id: true },
            });
        return !taken;
      },
    });
  }

  async getOpeningPapersTotal(companyId: string) {
    const [receipts, payments] = await Promise.all([
      prisma.securitiesReceipt.findMany({
        where: { companyId, isOpening: true, isCancelled: false },
        select: { amount: true, destinationAccountId: true },
      }),
      prisma.securitiesPayment.findMany({
        where: { companyId, isOpening: true, isCancelled: false },
        select: { amount: true, destinationAccountId: true },
      }),
    ]);
    const fallback = await this.openingAccountFallback(companyId);
    const { groups, missingAccount } = groupOpeningPapers(
      [
        ...receipts.map((row) => ({
          accountId: row.destinationAccountId,
          direction: 'RECEIPT' as const,
          amount: Number(row.amount),
        })),
        ...payments.map((row) => ({
          accountId: row.destinationAccountId,
          direction: 'PAYMENT' as const,
          amount: Number(row.amount),
        })),
      ],
      fallback
    );
    if (missingAccount) {
      throw new AppError(
        400,
        'في شيكات سابقة من غير حساب. حدّد حساب النمط من شاشة الأوراق المالية السابقة ثم أعد الحفظ.'
      );
    }
    return {
      totalAmount: money(groups.reduce((sum, row) => sum + row.amount, 0)),
      papersCount: groups.reduce((sum, row) => sum + row.count, 0),
      lines: groups,
    };
  }

  private async openingAccountFallback(companyId: string) {
    const resolve = async (kind: 'RECEIPT' | 'PAYMENT') => {
      try {
        return await commercialPaperPostingService.resolveDefaultNotesAccount(companyId, kind);
      } catch {
        return null;
      }
    };
    const [receiptAccountId, paymentAccountId] = await Promise.all([
      resolve('RECEIPT'),
      resolve('PAYMENT'),
    ]);
    return { receiptAccountId, paymentAccountId };
  }
}

export const commercialPaperService = new CommercialPaperService();
