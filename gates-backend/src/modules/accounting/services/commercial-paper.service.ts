import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { toHijriDate } from '../../../shared/utils/hijri-date';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import type { CreateBatchReceiptPapersDto } from '../../treasury/dto/batch-receipt-paper.dto';

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

export class CommercialPaperService {
  async createBatchReceiptPapersInTx(
    companyId: string,
    dto: CreateBatchReceiptPapersDto,
    branchId?: string | null
  ) {
    if (!dto.papers?.length) {
      throw new AppError(400, 'أضف ورقة واحدة على الأقل');
    }

    const invalidAmount = dto.papers.some((paper) => !(Number(paper.amount) > 0));
    if (invalidAmount) {
      throw new AppError(400, 'جميع المبالغ يجب أن تكون أكبر من صفر');
    }

    const issueDate = asDate(dto.issueDate);
    if (Number.isNaN(issueDate.getTime())) {
      throw new AppError(400, 'تاريخ التحرير غير صالح');
    }

    const hijriIssueDate = dto.hijriIssueDate?.trim() || toHijriDate(issueDate);
    const currencyCode = dto.currencyCode?.trim() || 'EGP';
    const issuerName = dto.partyName?.trim() || undefined;
    const entityName = dto.entityName?.trim() || undefined;

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
      throw new AppError(400, 'الساحب / العميل غير موجود');
    }

    const createdPapers = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const paper of dto.papers) {
        const dueDate = asDate(paper.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
          throw new AppError(400, `تاريخ استحقاق غير صالح للورقة ${paper.paperNumber}`);
        }

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
            receiptNumber,
            date: issueDate,
            hijriDate: hijriIssueDate,
            description: paperDescription(paper.description, paper.branchName),
            securityType: 'check',
            customerId: customer?.id,
            supplierId: supplier?.id,
            issuerName,
            issuerBank: paper.bankName?.trim() || undefined,
            securityNumber: paper.paperNumber.trim(),
            dueDate,
            amount: new Decimal(paper.amount),
            currencyCode,
            entityName,
            isReceived: true,
            isPosted: false,
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
}

export const commercialPaperService = new CommercialPaperService();
