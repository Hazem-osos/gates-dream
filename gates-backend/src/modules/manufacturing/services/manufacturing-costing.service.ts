import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { itemCostService } from '../../inventory/services/item-cost.service';
import { stockMovementService } from '../../inventory/services/stock-movement.service';
import { manufacturingAccountResolverService } from './manufacturing-account-resolver.service';
import { journalLines } from '../../trade/utils/journal-lines.util';

export class ManufacturingCostingService {
  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  async postMaterialIssue(
    ctx: JournalPostingContext,
    tx: Prisma.TransactionClient,
    params: {
      orderNumber: string;
      sourceYearId?: string;
      totalMaterialCost: number;
      issueDate: Date;
    }
  ) {
    const accounts = await manufacturingAccountResolverService.resolveAccounts(ctx.companyId);
    const legacyGlNum = await this.allocateGlNum(ctx);
    const amount = roundTo4(params.totalMaterialCost);

    return journalPostingService.createAndPostInTx(tx, ctx, {
      fiscalYearId: ctx.fiscalYearId!,
      legacyGlNum,
      date: params.issueDate,
      description: `Production material issue ${params.orderNumber}`,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: 'ProdIssue',
      sourceType: 'MO',
      sourceNumber: params.orderNumber,
      sourceYearId: params.sourceYearId,
      lines: journalLines([
        { accountId: accounts.wipMaterialsAccountId, debit: amount, credit: 0 },
        { accountId: accounts.rawInventoryAccountId, debit: 0, credit: amount },
      ]),
    });
  }

  async postLaborOverhead(
    ctx: JournalPostingContext,
    tx: Prisma.TransactionClient,
    params: {
      orderNumber: string;
      sourceYearId?: string;
      laborCost: number;
      overheadCost: number;
      postingDate: Date;
    }
  ) {
    const accounts = await manufacturingAccountResolverService.resolveAccounts(ctx.companyId);
    const total = roundTo4(params.laborCost + params.overheadCost);
    if (total <= 0) throw new AppError(422, 'Labor and overhead must be greater than zero');

    const legacyGlNum = await this.allocateGlNum(ctx);
    return journalPostingService.createAndPostInTx(tx, ctx, {
      fiscalYearId: ctx.fiscalYearId!,
      legacyGlNum,
      date: params.postingDate,
      description: `Production labor/overhead ${params.orderNumber}`,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: 'ProdOH',
      sourceType: 'MO',
      sourceNumber: `${params.orderNumber}-OH`,
      sourceYearId: params.sourceYearId,
      lines: journalLines([
        { accountId: accounts.wipLaborOverheadAccountId, debit: total, credit: 0 },
        { accountId: accounts.overheadAbsorptionAccountId, debit: 0, credit: total },
      ]),
    });
  }

  async postCompletion(
    ctx: JournalPostingContext,
    tx: Prisma.TransactionClient,
    params: {
      orderNumber: string;
      sourceYearId?: string;
      totalBatchCost: number;
      materialCost: number;
      laborOverheadCost: number;
      completionDate: Date;
    }
  ) {
    const accounts = await manufacturingAccountResolverService.resolveAccounts(ctx.companyId);
    const total = roundTo4(params.totalBatchCost);
    const materials = roundTo4(params.materialCost);
    const laborOh = roundTo4(params.laborOverheadCost);
    if (Math.abs(total - (materials + laborOh)) > 0.05) {
      throw new AppError(422, 'Completion cost split must equal total batch cost');
    }

    const legacyGlNum = await this.allocateGlNum(ctx);
    return journalPostingService.createAndPostInTx(tx, ctx, {
      fiscalYearId: ctx.fiscalYearId!,
      legacyGlNum,
      date: params.completionDate,
      description: `Production completion ${params.orderNumber}`,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: 'ProdComplete',
      sourceType: 'MO',
      sourceNumber: `${params.orderNumber}-FG`,
      sourceYearId: params.sourceYearId,
      lines: journalLines([
        { accountId: accounts.finishedGoodsAccountId, debit: total, credit: 0 },
        { accountId: accounts.wipMaterialsAccountId, debit: 0, credit: materials },
        { accountId: accounts.wipLaborOverheadAccountId, debit: 0, credit: laborOh },
      ]),
    });
  }

  async receiveFinishedGoodsInTx(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      branchId?: string;
      warehouseId: string;
      itemId: string;
      quantity: number;
      unitCost: number;
      orderNumber: string;
      sourceYearId?: string;
      documentDate: Date;
    }
  ) {
    await stockMovementService.postMovementInTx(tx, {
      companyId: params.companyId,
      branchId: params.branchId,
      warehouseId: params.warehouseId,
      itemId: params.itemId,
      quantityDelta: params.quantity,
      unitCost: params.unitCost,
      movementType: 'PROD_RECEIPT',
      sourceType: 'MO',
      sourceNumber: params.orderNumber,
      sourceYearId: params.sourceYearId,
      documentDate: params.documentDate,
    });

    await itemCostService.applyMovingAverageInTx(tx, {
      companyId: params.companyId,
      branchId: params.branchId!,
      itemId: params.itemId,
      invoiceDate: params.documentDate,
      itemCount: params.quantity,
      itemPrice: params.unitCost,
      sourceNum: params.orderNumber,
      sourceYearId: params.sourceYearId ?? String(new Date().getUTCFullYear()),
      sourceType: 'MO',
    });
  }
}

export const manufacturingCostingService = new ManufacturingCostingService();
