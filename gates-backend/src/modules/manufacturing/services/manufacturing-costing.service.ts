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
import { SYSTEM_GL_CODES } from '../../accounting/data/system-account-map';
import { manufacturingAccountResolverService } from './manufacturing-account-resolver.service';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import { journalLines } from '../../trade/utils/journal-lines.util';

type MfgJeLine = {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  costCenterId?: string;
};

/** Legacy ManufactProcess / Gates UI: inventory issue lines post with inverted debit-credit vs textbook WIP. */
function flipMfgJournalLine<T extends MfgJeLine>(line: T): T {
  return { ...line, debit: line.credit, credit: line.debit };
}

function mfgJournalLines(rows: MfgJeLine[]) {
  return journalLines(rows.map(flipMfgJournalLine));
}

export class ManufacturingCostingService {
  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  async postMaterialIssue(
    ctx: JournalPostingContext,
    tx: Prisma.TransactionClient,
    params: {
      productionOrderId: string;
      orderNumber: string;
      sourceYearId?: string;
      totalMaterialCost: number;
      issueDate: Date;
      costCenterId?: string;
    }
  ) {
    const accounts = await manufacturingAccountResolverService.resolveAccounts(ctx.companyId);
    const legacyGlNum = await this.allocateGlNum(ctx);
    const amount = roundTo4(params.totalMaterialCost);
    const cc = params.costCenterId;

    return journalPostingService.createAndPostInTx(tx, ctx, {
      fiscalYearId: ctx.fiscalYearId!,
      legacyGlNum,
      date: params.issueDate,
      description: `Production material issue ${params.orderNumber}`,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: 'ProdIssue',
      sourceType: 'MO',
      sourceId: params.productionOrderId,
      sourceNumber: params.orderNumber,
      sourceYearId: params.sourceYearId,
      lines: mfgJournalLines([
        { accountId: accounts.wipMaterialsAccountId, debit: amount, credit: 0, costCenterId: cc },
        { accountId: accounts.rawInventoryAccountId, debit: 0, credit: amount, costCenterId: cc },
      ]),
    });
  }

  async postLaborOverhead(
    ctx: JournalPostingContext,
    tx: Prisma.TransactionClient,
    params: {
      productionOrderId: string;
      orderNumber: string;
      sourceYearId?: string;
      laborCost: number;
      overheadCost: number;
      postingDate: Date;
      costCenterId?: string;
    }
  ) {
    const accounts = await manufacturingAccountResolverService.resolveAccounts(ctx.companyId);
    const total = roundTo4(params.laborCost + params.overheadCost);
    if (total <= 0) throw new AppError(422, 'Labor and overhead must be greater than zero');

    const legacyGlNum = await this.allocateGlNum(ctx);
    const cc = params.costCenterId;
    return journalPostingService.createAndPostInTx(tx, ctx, {
      fiscalYearId: ctx.fiscalYearId!,
      legacyGlNum,
      date: params.postingDate,
      description: `Production labor/overhead ${params.orderNumber}`,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: 'ProdOH',
      sourceType: 'MO',
      sourceId: params.productionOrderId,
      sourceNumber: `${params.orderNumber}-OH`,
      sourceYearId: params.sourceYearId,
      lines: mfgJournalLines([
        { accountId: accounts.wipLaborOverheadAccountId, debit: total, credit: 0, costCenterId: cc },
        { accountId: accounts.overheadAbsorptionAccountId, debit: 0, credit: total, costCenterId: cc },
      ]),
    });
  }

  async postCompletion(
    ctx: JournalPostingContext,
    tx: Prisma.TransactionClient,
    params: {
      productionOrderId: string;
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
    if (total <= 0) {
      throw new AppError(422, 'Completion total must be positive');
    }
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
      sourceId: params.productionOrderId,
      sourceNumber: `${params.orderNumber}-FG`,
      sourceYearId: params.sourceYearId,
      lines: mfgJournalLines([
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
      productionOrderId?: string;
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
      sourceDocumentId: params.productionOrderId,
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

  async resolveExpenseAccountId(companyId: string, accountLabel: string): Promise<string> {
    const label = accountLabel.trim();
    const accounts = await manufacturingAccountResolverService.resolveAccounts(companyId);
    if (!label) return accounts.overheadAbsorptionAccountId;

    try {
      return await invoiceAccountResolverService.resolvePostingAccountId(companyId, label, [
        SYSTEM_GL_CODES.subcontractorCost,
        SYSTEM_GL_CODES.cogs,
      ]);
    } catch {
      const byName = await prisma.account.findFirst({
        where: {
          companyId,
          deletedAt: null,
          accountKind: 'POSTING',
          OR: [
            { arabicName: label },
            { arabicName: { contains: label } },
            { englishName: { contains: label } },
          ],
        },
        select: { id: true },
        orderBy: { code: 'asc' },
      });
      if (byName) {
        return invoiceAccountResolverService.resolvePostingAccountId(companyId, byName.id, [
          SYSTEM_GL_CODES.subcontractorCost,
        ]);
      }
      return accounts.overheadAbsorptionAccountId;
    }
  }

  /**
   * Unified production JE (before flip): Dr destination inventory + additional expense accounts,
   * Cr source inventory — posted with legacy debit/credit inversion via mfgJournalLines.
   */
  async postUnifiedMaterialAndAdditional(
    ctx: JournalPostingContext,
    tx: Prisma.TransactionClient,
    params: {
      productionOrderId: string;
      orderNumber: string;
      sourceYearId?: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      materialCost: number;
      additionalCosts: Array<{ accountId?: string; accountLabel?: string; value?: number }>;
      issueDate: Date;
      costCenterId?: string;
    }
  ) {
    const material = roundTo4(params.materialCost);
    const additionalRows = params.additionalCosts.filter((c) => (Number(c.value) || 0) > 0);
    const additionalTotal = roundTo4(
      additionalRows.reduce((s, c) => s + (Number(c.value) || 0), 0)
    );
    const totalCredit = roundTo4(material + additionalTotal);
    if (totalCredit <= 0) {
      throw new AppError(422, 'Material and additional costs are zero');
    }

    const [fromWh, toWh, defaultAccounts] = await Promise.all([
      prisma.warehouse.findFirst({
        where: { id: params.fromWarehouseId, companyId: ctx.companyId },
        select: { inventoryAccountId: true },
      }),
      prisma.warehouse.findFirst({
        where: { id: params.toWarehouseId, companyId: ctx.companyId },
        select: { inventoryAccountId: true },
      }),
      manufacturingAccountResolverService.resolveAccounts(ctx.companyId),
    ]);
    if (!fromWh || !toWh) throw new AppError(404, 'Warehouse not found for unified production entry');

    const fromInv = await manufacturingAccountResolverService.resolveWarehouseInventoryAccountId(
      ctx.companyId,
      fromWh.inventoryAccountId,
      '1142'
    );
    const toInv = await manufacturingAccountResolverService.resolveWarehouseInventoryAccountId(
      ctx.companyId,
      toWh.inventoryAccountId,
      '1141'
    );

    const cc = params.costCenterId;
    const lines: Array<{ accountId: string; debit: number; credit: number; costCenterId?: string }> =
      [];
    if (material > 0) {
      lines.push({ accountId: toInv, debit: material, credit: 0, costCenterId: cc });
    }
    for (const row of additionalRows) {
      const value = roundTo4(Number(row.value) || 0);
      const accountId =
        row.accountId?.trim() ||
        (await this.resolveExpenseAccountId(ctx.companyId, row.accountLabel ?? ''));
      lines.push({ accountId, debit: value, credit: 0, costCenterId: cc });
    }
    lines.push({ accountId: fromInv, debit: 0, credit: totalCredit, costCenterId: cc });

    const legacyGlNum = await this.allocateGlNum(ctx);
    return journalPostingService.createAndPostInTx(tx, ctx, {
      fiscalYearId: ctx.fiscalYearId!,
      legacyGlNum,
      date: params.issueDate,
      description: `Production unified ${params.orderNumber}`,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: 'ProdUnified',
      sourceType: 'MO',
      sourceId: params.productionOrderId,
      sourceNumber: `${params.orderNumber}-UNI`,
      sourceYearId: params.sourceYearId,
      lines: mfgJournalLines(lines),
    });
  }
}

export const manufacturingCostingService = new ManufacturingCostingService();
