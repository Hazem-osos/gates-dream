import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { contractingProjectService } from './contracting-project.service';
import { contractingAccountResolverService } from './contracting-account-resolver.service';
import { calculateSubcontractorExtractAmounts } from './extract-calculation.util';

function linesWithOrder(
  rows: Array<{
    accountId: string;
    debit: number;
    credit: number;
    costCenterId?: string;
  }>
) {
  const nonZero = rows.filter((row) => row.debit > 0 || row.credit > 0);
  return nonZero.map((row, idx) => ({
    ...row,
    lineOrder: idx + 1,
  }));
}

export class SubcontractorExtractService {
  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  async createDraft(
    companyId: string,
    input: {
      projectId: string;
      projectSubcontractId: string;
      extractNumber: string;
      grossAmount: number;
      penaltyAmount?: number;
      materialDeductionAmount?: number;
      periodStart?: Date;
      periodEnd?: Date;
    }
  ) {
    const project = await contractingProjectService.getById(companyId, input.projectId);
    const sub = await prisma.projectSubcontract.findFirst({
      where: { id: input.projectSubcontractId, projectId: project.id },
    });
    if (!sub) throw new AppError(404, 'Project subcontract not found');

    const settings = await contractingAccountResolverService.getSettings(companyId);
    const amounts = calculateSubcontractorExtractAmounts({
      grossAmount: input.grossAmount,
      advanceRecoveryPercent: Number(sub.advanceRecoveryPercent),
      retentionPercent: Number(sub.retentionPercent),
      whtRate: Number(settings.defaultWhtRate),
      penaltyAmount: input.penaltyAmount,
      materialDeductionAmount: input.materialDeductionAmount,
      maxAdvanceRecovery: Number(sub.advancePaymentBalance),
    });

    return prisma.subcontractorExtract.create({
      data: {
        companyId,
        projectId: project.id,
        projectSubcontractId: sub.id,
        subcontractorId: sub.subcontractorId,
        extractNumber: input.extractNumber,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        grossAmount: new Decimal(amounts.grossAmount),
        advanceDeductionAmount: new Decimal(amounts.advanceDeductionAmount),
        retentionAmount: new Decimal(amounts.retentionAmount),
        penaltyAmount: new Decimal(amounts.penaltyAmount),
        materialDeductionAmount: new Decimal(amounts.materialDeductionAmount),
        whtAmount: new Decimal(amounts.whtAmount),
        netAmount: new Decimal(amounts.netAmount),
        status: 'DRAFT',
      },
    });
  }

  async post(ctx: JournalPostingContext, extractId: string) {
    const extract = await prisma.subcontractorExtract.findFirst({
      where: { id: extractId, companyId: ctx.companyId },
      include: { project: true, projectSubcontract: true },
    });
    if (!extract) throw new AppError(404, 'Subcontractor extract not found');
    if (extract.status === 'POSTED') throw new AppError(400, 'Extract already posted');

    const accounts = await contractingAccountResolverService.resolveAccounts(ctx.companyId);
    const gross = roundTo4(Number(extract.grossAmount));
    const penalty = roundTo4(Number(extract.penaltyAmount ?? 0));
    const material = roundTo4(Number(extract.materialDeductionAmount ?? 0));
    const expenseDebit = roundTo4(gross - penalty - material);
    const advance = roundTo4(Number(extract.advanceDeductionAmount));
    const retention = roundTo4(Number(extract.retentionAmount));
    const wht = roundTo4(Number(extract.whtAmount));
    const net = roundTo4(Number(extract.netAmount));
    const ccId = extract.project.costCenterId ?? undefined;
    const legacyGlNum = await this.allocateGlNum(ctx);

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: new Date(),
        description: `Subcontractor extract ${extract.extractNumber}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType: 'SubExtract',
        sourceType: 'SE',
        sourceNumber: extract.extractNumber,
        sourceYearId: extract.periodEnd
          ? String(extract.periodEnd.getUTCFullYear())
          : undefined,
        lines: linesWithOrder([
          {
            accountId: accounts.projectExpenseAccountId,
            debit: expenseDebit,
            credit: 0,
            costCenterId: ccId,
          },
          {
            accountId: accounts.subcontractorPayableAccountId,
            debit: 0,
            credit: net,
          },
          {
            accountId: accounts.retentionWithheldForOthersAccountId,
            debit: 0,
            credit: retention,
          },
          {
            accountId: accounts.subcontractorAdvanceAccountId,
            debit: 0,
            credit: advance,
          },
          { accountId: accounts.whtPayableAccountId, debit: 0, credit: wht },
        ]),
      });

      if (extract.projectSubcontractId) {
        const sub = extract.projectSubcontract!;
        const newBal = roundTo4(Number(sub.advancePaymentBalance) - advance);
        await tx.projectSubcontract.update({
          where: { id: sub.id },
          data: { advancePaymentBalance: new Decimal(Math.max(0, newBal)) },
        });
      }

      return tx.subcontractorExtract.update({
        where: { id: extractId },
        data: {
          status: 'POSTED',
          journalEntryId: je.id,
          postedAt: new Date(),
        },
      });
    });
  }

  async list(companyId: string, projectId?: string) {
    return prisma.subcontractorExtract.findMany({
      where: {
        companyId,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        projectSubcontract: {
          include: { subcontractor: { select: { id: true, arabicName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}

export const subcontractorExtractService = new SubcontractorExtractService();
