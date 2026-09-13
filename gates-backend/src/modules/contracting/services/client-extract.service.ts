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
import { calculateClientExtractAmounts } from './extract-calculation.util';

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

export class ClientExtractService {
  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  async createDraft(
    companyId: string,
    input: {
      projectId: string;
      extractNumber: string;
      grossAmount: number;
      periodStart?: Date;
      periodEnd?: Date;
    }
  ) {
    const project = await contractingProjectService.getById(companyId, input.projectId);
    const settings = await contractingAccountResolverService.getSettings(companyId);

    const amounts = calculateClientExtractAmounts({
      grossAmount: input.grossAmount,
      advanceDeductionPercent: Number(project.advanceDeductionPercent),
      retentionPercent: Number(project.retentionPercent),
      vatRate: Number(settings.defaultVatRate),
      whtRate: Number(settings.defaultWhtRate),
      maxAdvanceRecovery: Number(project.advancePaymentBalance),
    });

    return prisma.clientExtract.create({
      data: {
        companyId,
        projectId: project.id,
        extractNumber: input.extractNumber,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        grossAmount: new Decimal(amounts.grossAmount),
        advanceDeductionAmount: new Decimal(amounts.advanceDeductionAmount),
        retentionAmount: new Decimal(amounts.retentionAmount),
        vatAmount: new Decimal(amounts.vatAmount),
        whtAmount: new Decimal(amounts.whtAmount),
        netAmount: new Decimal(amounts.netAmount),
        status: 'DRAFT',
      },
    });
  }

  async post(ctx: JournalPostingContext, extractId: string) {
    const extract = await prisma.clientExtract.findFirst({
      where: { id: extractId, companyId: ctx.companyId },
      include: { project: true },
    });
    if (!extract) throw new AppError(404, 'Client extract not found');
    if (extract.status === 'POSTED') throw new AppError(400, 'Extract already posted');

    const accounts = await contractingAccountResolverService.resolveAccounts(ctx.companyId);
    const gross = roundTo4(Number(extract.grossAmount));
    const advance = roundTo4(Number(extract.advanceDeductionAmount));
    const retention = roundTo4(Number(extract.retentionAmount));
    const vat = roundTo4(Number(extract.vatAmount));
    const wht = roundTo4(Number(extract.whtAmount));
    const net = roundTo4(Number(extract.netAmount));
    const ccId = extract.project.costCenterId ?? undefined;

    const legacyGlNum = await this.allocateGlNum(ctx);

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: new Date(),
        description: `Client extract ${extract.extractNumber}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType: 'ClientExtract',
        sourceType: 'CE',
        sourceNumber: extract.extractNumber,
        sourceYearId: extract.periodEnd
          ? String(extract.periodEnd.getUTCFullYear())
          : undefined,
        lines: linesWithOrder([
          { accountId: accounts.clientReceivableAccountId, debit: net, credit: 0 },
          {
            accountId: accounts.retentionHeldByOthersAccountId,
            debit: retention,
            credit: 0,
          },
          {
            accountId: accounts.customerAdvanceAccountId,
            debit: advance,
            credit: 0,
          },
          { accountId: accounts.whtAssetAccountId, debit: wht, credit: 0 },
          {
            accountId: accounts.contractingRevenueAccountId,
            debit: 0,
            credit: gross,
            costCenterId: ccId,
          },
          { accountId: accounts.outputVatAccountId, debit: 0, credit: vat },
        ]),
      });

      const newAdvanceBalance = roundTo4(
        Number(extract.project.advancePaymentBalance) - advance
      );
      await tx.contractingProject.update({
        where: { id: extract.projectId },
        data: { advancePaymentBalance: new Decimal(Math.max(0, newAdvanceBalance)) },
      });

      return tx.clientExtract.update({
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
    return prisma.clientExtract.findMany({
      where: {
        companyId,
        ...(projectId ? { projectId } : {}),
      },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}

export const clientExtractService = new ClientExtractService();
