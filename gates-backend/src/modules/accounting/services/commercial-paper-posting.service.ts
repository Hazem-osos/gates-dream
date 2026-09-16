import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { toHijriDate } from '../../../shared/utils/hijri-date';
import type { ExecuteMultiCollectionDto } from '../../treasury/dto/commercial-paper.dto';
import type { JournalEntryLineData } from '../types/journal-entry.types';
import { journalPostingService } from './journal-posting.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { resolveCompanyFxRate } from '../utils/company-fx-rate';

export type CommercialPaperKind = 'PAYMENT' | 'RECEIPT';

export interface CommercialPaperPostingCtx {
  companyId: string;
  branchId?: string | null;
  userId: string;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function money(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export class CommercialPaperPostingService {
  async executeMultiCollection(
    ctx: CommercialPaperPostingCtx,
    paperKind: CommercialPaperKind,
    paperId: string,
    input: ExecuteMultiCollectionDto
  ) {
    const paper =
      paperKind === 'PAYMENT'
        ? await prisma.securitiesPayment.findFirst({
            where: { id: paperId, companyId: ctx.companyId },
          })
        : await prisma.securitiesReceipt.findFirst({
            where: { id: paperId, companyId: ctx.companyId },
          });

    if (!paper) {
      throw new AppError(404, paperKind === 'PAYMENT' ? 'ورقة المدفوعات غير موجودة' : 'ورقة المقبوضات غير موجودة');
    }
    if (paper.isCancelled) {
      throw new AppError(400, 'لا يمكن تحصيل ورقة ملغاة');
    }
    if (paper.isPosted) {
      throw new AppError(400, 'الورقة محصّلة مسبقاً');
    }

    const collectionDate = asDate(input.collectionDate);
    if (Number.isNaN(collectionDate.getTime())) {
      throw new AppError(400, 'تاريخ التحصيل غير صالح');
    }

    const lines = (input.lines ?? []).filter((line) => line.accountId && Number(line.amount) > 0);
    if (lines.length === 0) {
      throw new AppError(400, 'أضف سطر تحصيل واحداً على الأقل');
    }

    const gross = money(lines.reduce((sum, line) => sum + Number(line.amount), 0));
    const commission = money(Number(input.commissionAmount) || 0);
    const paperAmount = money(Number(paper.amount));
    if (gross - paperAmount > 0.009) {
      throw new AppError(400, 'إجمالي سطور التحصيل يتجاوز مبلغ الورقة');
    }
    if (commission > 0 && !input.commissionAccountId) {
      throw new AppError(400, 'اختر حساب العمولة عند إدخال قيمة عمولة');
    }
    if (paperKind === 'RECEIPT' && commission - gross > 0.009) {
      throw new AppError(400, 'العمولة لا يمكن أن تتجاوز إجمالي التحصيل');
    }

    const accountIds = [
      input.destinationAccountId,
      ...lines.map((line) => line.accountId),
      ...(commission > 0 && input.commissionAccountId ? [input.commissionAccountId] : []),
    ];
    const uniqueIds = [...new Set(accountIds)];
    const found = await prisma.account.findMany({
      where: { companyId: ctx.companyId, id: { in: uniqueIds }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new AppError(400, 'أحد الحسابات المحددة غير موجود أو لا يتبع الشركة');
    }

    const net = paperKind === 'RECEIPT' ? money(gross - commission) : money(gross + commission);
    const hijriDate = input.hijriDate?.trim() || toHijriDate(collectionDate);
    const paperNumber =
      paperKind === 'PAYMENT'
        ? (paper as { paymentNumber?: string | null }).paymentNumber
        : (paper as { receiptNumber?: string | null }).receiptNumber;
    const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, collectionDate);
    const { exchangeRate } = await resolveCompanyFxRate(ctx.companyId, paper.currencyCode);

    const jeLines: JournalEntryLineData[] = [];
    let order = 1;

    if (paperKind === 'RECEIPT') {
      if (net > 0) {
        jeLines.push({
          accountId: input.destinationAccountId,
          debit: net,
          credit: 0,
          lineOrder: order++,
          description: input.notes || 'صافي المحصل',
        });
      }
      if (commission > 0 && input.commissionAccountId) {
        jeLines.push({
          accountId: input.commissionAccountId,
          debit: commission,
          credit: 0,
          lineOrder: order++,
          description: 'عمولة تحصيل',
        });
      }
      for (const line of lines) {
        jeLines.push({
          accountId: line.accountId,
          debit: 0,
          credit: money(line.amount),
          lineOrder: order++,
          description: line.description || undefined,
        });
      }
    } else {
      for (const line of lines) {
        jeLines.push({
          accountId: line.accountId,
          debit: money(line.amount),
          credit: 0,
          lineOrder: order++,
          description: line.description || undefined,
        });
      }
      if (commission > 0 && input.commissionAccountId) {
        jeLines.push({
          accountId: input.commissionAccountId,
          debit: commission,
          credit: 0,
          lineOrder: order++,
          description: 'عمولة تحصيل',
        });
      }
      jeLines.push({
        accountId: input.destinationAccountId,
        debit: 0,
        credit: net,
        lineOrder: order++,
        description: input.notes || 'صافي المنصرف',
      });
    }

    const posted = await prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(
        tx,
        {
          companyId: ctx.companyId,
          branchId: ctx.branchId ?? '',
          fiscalYearId,
          userId: ctx.userId,
        },
        {
          fiscalYearId,
          date: collectionDate,
          hijriDate,
          description:
            input.notes ||
            `تحصيل متعدد — ${paperKind === 'PAYMENT' ? 'ورقة مدفوعات' : 'ورقة مقبوضات'} ${paperNumber ?? paper.id.slice(0, 8)}`,
          currencyCode: paper.currencyCode,
          exchangeRate,
          entryType: 'MULTI_COLLECTION',
          sourceType: paperKind === 'PAYMENT' ? 'SECP' : 'SECR',
          sourceId: paper.id,
          sourceNumber: paperNumber ?? paper.id,
          lines: jeLines,
        }
      );

      await tx.multiCollectionLine.createMany({
        data: lines.map((line) => ({
          companyId: ctx.companyId,
          paperKind,
          paperId: paper.id,
          accountId: line.accountId,
          amount: new Decimal(money(line.amount)),
          description: line.description || null,
          collectionDate,
          hijriDate,
        })),
      });

      const headerPatch = {
        isPosted: true,
        postedAt: new Date(),
        journalEntryId: je.id,
        destinationAccountId: input.destinationAccountId,
        commissionAmount: new Decimal(commission),
        commissionAccountId: input.commissionAccountId || null,
      };

      if (paperKind === 'PAYMENT') {
        return tx.securitiesPayment.update({
          where: { id: paper.id },
          data: headerPatch,
          include: { customer: true, supplier: true },
        });
      }
      return tx.securitiesReceipt.update({
        where: { id: paper.id },
        data: headerPatch,
        include: { customer: true, supplier: true },
      });
    });

    const collectionLines = await prisma.multiCollectionLine.findMany({
      where: { companyId: ctx.companyId, paperKind, paperId: paper.id },
      include: { account: { select: { id: true, code: true, arabicName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...posted,
      multiCollectionLines: collectionLines,
      multiCollection: {
        gross,
        commission,
        net,
        journalEntryId: posted.journalEntryId,
      },
    };
  }

  async listLines(companyId: string, paperKind: CommercialPaperKind, paperId: string) {
    return prisma.multiCollectionLine.findMany({
      where: { companyId, paperKind, paperId },
      include: { account: { select: { id: true, code: true, arabicName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const commercialPaperPostingService = new CommercialPaperPostingService();
