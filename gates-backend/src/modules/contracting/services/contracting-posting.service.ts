import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';
import {
  journalPostingService,
} from '../../accounting/services/journal-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { contractingAccountResolverService } from './contracting-account-resolver.service';

type ExtractRow = {
  id: string;
  extractNumber: string;
  extractType: string;
  extractDate: Date;
  periodEnd: Date | null;
  currentExecutedAmount: { toString(): string };
  advancePaymentDeduction: { toString(): string };
  retentionDeduction: { toString(): string };
  whtDeduction: { toString(): string };
  penalties: { toString(): string };
  vatAmount: { toString(): string };
  netPayableAmount: { toString(): string };
  project: { costCenterId: string | null; id: string; advancePaymentBalance: { toString(): string } };
  projectSubcontractId: string | null;
  projectSubcontract?: {
    id: string;
    advancePaymentBalance: { toString(): string };
  } | null;
};

function withLineOrder(
  rows: Array<{
    accountId: string;
    debit: number;
    credit: number;
    costCenterId?: string;
    description?: string;
  }>
): JournalEntryLineData[] {
  return rows
    .filter((r) => r.debit > 0 || r.credit > 0)
    .map((row, idx) => ({
      accountId: row.accountId,
      debit: row.debit,
      credit: row.credit,
      lineOrder: idx + 1,
      costCenterId: row.costCenterId,
      description: row.description,
    }));
}

export class ContractingPostingService {
  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  buildClientJournalLines(
    extract: ExtractRow,
    accounts: Awaited<ReturnType<typeof contractingAccountResolverService.resolveAccounts>>
  ): JournalEntryLineData[] {
    const ccId = extract.project.costCenterId ?? undefined;
    const current = roundTo4(Number(extract.currentExecutedAmount));
    const advance = roundTo4(Number(extract.advancePaymentDeduction));
    const retention = roundTo4(Number(extract.retentionDeduction));
    const wht = roundTo4(Number(extract.whtDeduction));
    const penalties = roundTo4(Number(extract.penalties));
    const vat = roundTo4(Number(extract.vatAmount));
    const net = roundTo4(Number(extract.netPayableAmount));

    return withLineOrder([
      {
        accountId: accounts.clientReceivableAccountId,
        debit: net,
        credit: 0,
        description: 'Customer AR — net collectible',
      },
      {
        accountId: accounts.retentionHeldByOthersAccountId,
        debit: retention,
        credit: 0,
        description: 'Retention asset (تأمين أعمال محتجز)',
      },
      {
        accountId: accounts.customerAdvanceAccountId,
        debit: advance,
        credit: 0,
        description: 'Advance payment amortization',
      },
      {
        accountId: accounts.whtAssetAccountId,
        debit: wht,
        credit: 0,
        description: 'WHT receivable (أ.ت.ص)',
      },
      ...(penalties > 0 && accounts.penaltiesExpenseAccountId
        ? [
            {
              accountId: accounts.penaltiesExpenseAccountId,
              debit: penalties,
              credit: 0,
              description: 'Penalties / price differences',
            },
          ]
        : []),
      {
        accountId: accounts.contractingRevenueAccountId,
        debit: 0,
        credit: current,
        costCenterId: ccId,
        description: 'Contract revenue — current period',
      },
      {
        accountId: accounts.outputVatAccountId,
        debit: 0,
        credit: vat,
        description: 'Output VAT',
      },
    ]);
  }

  buildSubcontractorJournalLines(
    extract: ExtractRow,
    accounts: Awaited<ReturnType<typeof contractingAccountResolverService.resolveAccounts>>
  ): JournalEntryLineData[] {
    const ccId = extract.project.costCenterId ?? undefined;
    const current = roundTo4(Number(extract.currentExecutedAmount));
    const advance = roundTo4(Number(extract.advancePaymentDeduction));
    const retention = roundTo4(Number(extract.retentionDeduction));
    const wht = roundTo4(Number(extract.whtDeduction));
    const penalties = roundTo4(Number(extract.penalties));
    const vat = roundTo4(Number(extract.vatAmount));
    const net = roundTo4(Number(extract.netPayableAmount));

    const costDebit = current;

    return withLineOrder([
      {
        accountId: accounts.projectExpenseAccountId,
        debit: costDebit,
        credit: 0,
        costCenterId: ccId,
        description: 'Subcontractor cost — current period',
      },
      ...(vat > 0 && accounts.inputVatAccountId
        ? [
            {
              accountId: accounts.inputVatAccountId,
              debit: vat,
              credit: 0,
              description: 'Input VAT',
            },
          ]
        : []),
      {
        accountId: accounts.subcontractorPayableAccountId,
        debit: 0,
        credit: net,
        description: 'Subcontractor AP — net payable',
      },
      {
        accountId: accounts.retentionWithheldForOthersAccountId,
        debit: 0,
        credit: retention,
        description: 'Retention payable',
      },
      {
        accountId: accounts.subcontractorAdvanceAccountId,
        debit: 0,
        credit: advance,
        description: 'Advance recovery',
      },
      {
        accountId: accounts.whtPayableAccountId,
        debit: 0,
        credit: wht,
        description: 'WHT payable',
      },
    ]);
  }

  async postContractExtract(ctx: JournalPostingContext, extractId: string) {
    const extract = await prisma.contractExtract.findFirst({
      where: { id: extractId, companyId: ctx.companyId },
      include: {
        project: true,
        projectSubcontract: true,
      },
    });
    if (!extract) throw new AppError(404, 'Contract extract not found');
    if (extract.status === 'POSTED') throw new AppError(400, 'Extract already posted');
    if (extract.status !== 'APPROVED' && extract.status !== 'DRAFT') {
      throw new AppError(400, 'Extract must be DRAFT or APPROVED to post');
    }

    const accounts = await contractingAccountResolverService.resolveAccounts(ctx.companyId);
    const legacyGlNum = await this.allocateGlNum(ctx);
    const entryType =
      extract.extractType === 'CLIENT' ? 'ClientExtract' : 'SubExtract';
    const sourceType = extract.extractType === 'CLIENT' ? 'CE' : 'SE';

    const lines =
      extract.extractType === 'CLIENT'
        ? this.buildClientJournalLines(extract, accounts)
        : this.buildSubcontractorJournalLines(extract, accounts);

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: extract.extractDate,
        description: `Contract extract ${extract.extractNumber}`,
        currencyCode: 'EGP',
        exchangeRate: 1,
        entryType,
        sourceType,
        sourceNumber: extract.extractNumber,
        sourceYearId: extract.periodEnd
          ? String(extract.periodEnd.getUTCFullYear())
          : String(extract.extractDate.getUTCFullYear()),
        lines,
      });

      if (extract.extractType === 'CLIENT') {
        const advance = roundTo4(Number(extract.advancePaymentDeduction));
        const newBal = roundTo4(Number(extract.project.advancePaymentBalance) - advance);
        await tx.contractingProject.update({
          where: { id: extract.projectId },
          data: { advancePaymentBalance: new Decimal(Math.max(0, newBal)) },
        });
      } else if (extract.projectSubcontractId && extract.projectSubcontract) {
        const advance = roundTo4(Number(extract.advancePaymentDeduction));
        const newBal = roundTo4(
          Number(extract.projectSubcontract.advancePaymentBalance) - advance
        );
        await tx.projectSubcontract.update({
          where: { id: extract.projectSubcontractId },
          data: { advancePaymentBalance: new Decimal(Math.max(0, newBal)) },
        });
      }

      return tx.contractExtract.update({
        where: { id: extractId },
        data: {
          status: 'POSTED',
          journalEntryId: je.id,
          postedAt: new Date(),
        },
        include: { lines: { include: { boqItem: true } }, project: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a POSTED extract — dated contra entry against the
   * extract JE and restores the advance-payment balance it drew down.
   */
  async unpostContractExtract(ctx: JournalPostingContext, extractId: string) {
    const extract = await prisma.contractExtract.findFirst({
      where: { id: extractId, companyId: ctx.companyId },
      include: { project: true, projectSubcontract: true },
    });
    if (!extract) throw new AppError(404, 'Contract extract not found');
    if (extract.status !== 'POSTED') {
      throw new AppError(400, 'Only a POSTED extract can be unposted');
    }
    if (!extract.journalEntryId) {
      throw new AppError(400, 'Extract has no journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, extract.journalEntryId!, {
        reason: 'Contract extract unposted',
      });

      const advance = roundTo4(Number(extract.advancePaymentDeduction));
      if (extract.extractType === 'CLIENT') {
        const newBal = roundTo4(Number(extract.project.advancePaymentBalance) + advance);
        await tx.contractingProject.update({
          where: { id: extract.projectId },
          data: { advancePaymentBalance: new Decimal(newBal) },
        });
      } else if (extract.projectSubcontractId && extract.projectSubcontract) {
        const newBal = roundTo4(Number(extract.projectSubcontract.advancePaymentBalance) + advance);
        await tx.projectSubcontract.update({
          where: { id: extract.projectSubcontractId },
          data: { advancePaymentBalance: new Decimal(newBal) },
        });
      }

      return tx.contractExtract.update({
        where: { id: extractId },
        data: { status: 'APPROVED', journalEntryId: null, postedAt: null },
        include: { lines: { include: { boqItem: true } }, project: true },
      });
    });
  }
}

export const contractingPostingService = new ContractingPostingService();
