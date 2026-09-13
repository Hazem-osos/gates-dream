import { randomBytes } from 'node:crypto';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { advancedRightsService } from '../../platform/services/advanced-rights.service';
import { itemCostService } from '../../inventory/services/item-cost.service';
import { stockMovementService } from '../../inventory/services/stock-movement.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { tradeAccountResolverService } from './trade-account-resolver.service';
import { journalLines } from '../utils/journal-lines.util';

export interface OpenLetterOfCreditInput {
  lcNumber: string;
  supplierId: string;
  bankAccountId?: string;
  warehouseId: string;
  currencyCode?: string;
  exchangeRate: number;
  totalAmountFx: number;
  expiryDate?: Date;
  issueDate?: Date;
  sourceYearId?: string;
}

export interface LcExpenseInput {
  expenseType: string;
  description?: string;
  amount: number;
  currencyCode?: string;
  exchangeRate?: number;
  expenseDate?: Date;
}

export interface LcClearanceLineInput {
  itemId: string;
  unitId?: string;
  quantity: number;
  merchandiseBase?: number;
  lineOrder?: number;
}

export class LetterOfCreditService {
  /**
   * `journalEntry.sourceNumber` is `@db.VarChar(30)`, so a fresh short random token (rather
   * than the LC number, which is user-provided and can be arbitrarily long) is used to keep
   * each lifecycle event's `activeSourceKey` slot distinct — see the note in `open()`.
   */
  private eventSourceNumber(tag: string): string {
    return `${tag}:${randomBytes(6).toString('hex')}`;
  }

  private async allocateGlNum(ctx: JournalPostingContext): Promise<string | undefined> {
    return documentSequenceService.nextGlNumber(ctx);
  }

  /**
   * Legacy `ETPost`/`ETUnPost` — the Etemad (اعتماد مستندي, documentary
   * credit) family from `untEtemad*.pas`, which is what this module is the
   * web port of. See `legacy-advanced-rights-families.ts`.
   */
  private async assertEtemadRight(
    ctx: JournalPostingContext,
    mode: 'post' | 'unpost'
  ): Promise<void> {
    await advancedRightsService.assertCanPostFamily(
      ctx.companyId,
      ctx.userId,
      ctx.branchId,
      mode === 'post' ? 'etPost' : 'etUnpost',
      { isAdmin: ctx.isAdmin, actionLabel: `${mode} letters of credit` }
    );
  }

  async getById(companyId: string, id: string) {
    const lc = await prisma.letterOfCredit.findFirst({
      where: { id, companyId },
      include: { expenses: true, receiptLines: true },
    });
    if (!lc) throw new AppError(404, 'Letter of credit not found');
    return lc;
  }

  async open(ctx: JournalPostingContext, input: OpenLetterOfCreditInput) {
    await this.assertEtemadRight(ctx, 'post');
    const merchandiseBase = roundTo4(input.totalAmountFx * input.exchangeRate);
    const accounts = await tradeAccountResolverService.resolveTradeAccounts(ctx.companyId);
    const creditAccountId = await tradeAccountResolverService.resolveSupplierApAccountId(
      ctx.companyId,
      input.supplierId
    );

    const legacyGlNum = await this.allocateGlNum(ctx);

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: input.issueDate ?? new Date(),
        description: `Open LC ${input.lcNumber}`,
        currencyCode: input.currencyCode ?? 'EGP',
        exchangeRate: 1,
        entryType: 'LCOpen',
        sourceType: 'LC',
        // M14/Phase1 fix: activeSourceKey is companyId|sourceType|sourceNumber|sourceYearId
        // with no entryType component. An LC posts several *concurrently active* journal
        // entries over its life (open, N expenses, clearance) — reusing the LC number for
        // all of them collided on the unique constraint the moment a second event posted.
        // The LC number/description already give full traceability.
        sourceNumber: this.eventSourceNumber('LCO'),
        sourceYearId: input.sourceYearId,
        lines: journalLines([
          { accountId: accounts.openLcWipAccountId, debit: merchandiseBase, credit: 0 },
          { accountId: creditAccountId, debit: 0, credit: merchandiseBase },
        ]),
      });

      return tx.letterOfCredit.create({
        data: {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          fiscalYearId: ctx.fiscalYearId,
          sourceYearId: input.sourceYearId,
          lcNumber: input.lcNumber,
          supplierId: input.supplierId,
          bankAccountId: input.bankAccountId,
          warehouseId: input.warehouseId,
          currencyCode: input.currencyCode ?? 'EGP',
          exchangeRate: new Decimal(input.exchangeRate),
          totalAmountFx: new Decimal(input.totalAmountFx),
          merchandiseBase: new Decimal(merchandiseBase),
          status: 'OPEN',
          expiryDate: input.expiryDate,
          issueDate: input.issueDate ?? new Date(),
          openingJournalEntryId: je.id,
        },
        include: { expenses: true },
      });
    });
  }

  async addExpense(ctx: JournalPostingContext, lcId: string, input: LcExpenseInput) {
    await this.assertEtemadRight(ctx, 'post');
    const lc = await this.getById(ctx.companyId, lcId);
    if (lc.status === 'CLOSED') {
      throw new AppError(400, 'Cannot add expenses to a closed letter of credit');
    }

    const rate = input.exchangeRate ?? 1;
    const amountBase = roundTo4(input.amount * rate);
    const accounts = await tradeAccountResolverService.resolveTradeAccounts(ctx.companyId);

    if (!lc.bankAccountId) {
      throw new AppError(422, 'LC bank account is required to post landed expenses');
    }
    const bankGlId = await treasuryAccountResolverService.resolveBankGlAccountId(
      ctx.companyId,
      lc.bankAccountId
    );

    const legacyGlNum = await this.allocateGlNum(ctx);

    return prisma.$transaction(async (tx) => {
      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: input.expenseDate ?? new Date(),
        description: `LC ${lc.lcNumber} expense ${input.expenseType}`,
        currencyCode: input.currencyCode ?? lc.currencyCode,
        exchangeRate: rate,
        entryType: 'LCExp',
        sourceType: 'LC',
        // An LC can carry many expense postings (bank commission, customs, freight, ...),
        // each its own concurrently-active JE — see the M14/Phase1 fix note in `open()`.
        sourceNumber: this.eventSourceNumber('LCE'),
        sourceYearId: lc.sourceYearId ?? undefined,
        lines: journalLines([
          { accountId: accounts.openLcWipAccountId, debit: amountBase, credit: 0 },
          { accountId: bankGlId, debit: 0, credit: amountBase },
        ]),
      });

      return tx.lcExpense.create({
        data: {
          companyId: ctx.companyId,
          lcId,
          expenseType: input.expenseType,
          description: input.description,
          amount: new Decimal(input.amount),
          currencyCode: input.currencyCode ?? lc.currencyCode,
          exchangeRate: new Decimal(rate),
          amountBase: new Decimal(amountBase),
          expenseDate: input.expenseDate ?? new Date(),
          journalEntryId: je.id,
        },
      });
    });
  }

  async clear(
    ctx: JournalPostingContext,
    lcId: string,
    lines: LcClearanceLineInput[]
  ) {
    await this.assertEtemadRight(ctx, 'post');
    const lc = await prisma.letterOfCredit.findFirst({
      where: { id: lcId, companyId: ctx.companyId },
      include: { expenses: true },
    });
    if (!lc) throw new AppError(404, 'Letter of credit not found');
    if (lc.status === 'CLOSED') throw new AppError(400, 'Letter of credit is already closed');
    if (!lc.warehouseId) throw new AppError(422, 'LC warehouse is required for clearance');

    const expenseTotal = lc.expenses.reduce(
      (sum, e) => sum + Number(e.amountBase),
      0
    );
    const merchandiseBase = Number(lc.merchandiseBase);
    const qtyTotal = lines.reduce((s, l) => s + l.quantity, 0);
    if (qtyTotal <= 0) throw new AppError(422, 'At least one receipt line is required');

    let lineMerchSum = 0;
    const normalized = lines.map((line, idx) => {
      const merch =
        line.merchandiseBase ??
        roundTo4((merchandiseBase * line.quantity) / qtyTotal);
      lineMerchSum += merch;
      return { ...line, merchandiseBase: merch, lineOrder: line.lineOrder ?? idx + 1 };
    });

    if (Math.abs(lineMerchSum - merchandiseBase) > 0.05) {
      throw new AppError(
        422,
        'Receipt line merchandise must equal LC merchandise base before allocation'
      );
    }

    const accounts = await tradeAccountResolverService.resolveTradeAccounts(ctx.companyId);
    const clearDate = new Date();
    const legacyGlNum = await this.allocateGlNum(ctx);

    const receiptRows: Array<{
      itemId: string;
      unitId?: string;
      quantity: number;
      merchandiseBase: number;
      allocatedExpenseBase: number;
      landedUnitCostBase: number;
      lineOrder: number;
    }> = [];

    for (const line of normalized) {
      const share = merchandiseBase > 0 ? line.merchandiseBase / merchandiseBase : 0;
      const allocatedExpense = roundTo4(expenseTotal * share);
      const landedTotal = roundTo4(line.merchandiseBase + allocatedExpense);
      const landedUnit = line.quantity > 0 ? roundTo4(landedTotal / line.quantity) : 0;
      receiptRows.push({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: line.quantity,
        merchandiseBase: line.merchandiseBase,
        allocatedExpenseBase: allocatedExpense,
        landedUnitCostBase: landedUnit,
        lineOrder: line.lineOrder,
      });
    }

    const totalLanded = receiptRows.reduce(
      (s, r) => s + roundTo4(r.landedUnitCostBase * r.quantity),
      0
    );
    const wipBalance = roundTo4(merchandiseBase + expenseTotal);
    if (Math.abs(totalLanded - wipBalance) > 0.05) {
      throw new AppError(422, 'Landed cost total must match WIP balance');
    }

    return prisma.$transaction(async (tx) => {
      const inventoryLines = receiptRows.map((row) => ({
        accountId: accounts.inventoryAccountId,
        debit: roundTo4(row.landedUnitCostBase * row.quantity),
        credit: 0,
      }));
      const wipCredit = roundTo4(inventoryLines.reduce((s, l) => s + l.debit, 0));

      const je = await journalPostingService.createAndPostInTx(tx, ctx, {
        fiscalYearId: ctx.fiscalYearId!,
        legacyGlNum,
        date: clearDate,
        description: `Clear LC ${lc.lcNumber} to inventory`,
        currencyCode: lc.currencyCode,
        exchangeRate: 1,
        entryType: 'LCClear',
        sourceType: 'LC',
        // Clearance can happen over several partial deliveries — see the M14/Phase1 fix
        // note in `open()`; the JE-level key is randomized, but stock movement/item cost
        // tracking below intentionally keep the bare LC number (different tables, different
        // idempotency semantics).
        sourceNumber: this.eventSourceNumber('LCC'),
        sourceYearId: lc.sourceYearId ?? undefined,
        lines: journalLines([
          ...inventoryLines,
          {
            accountId: accounts.openLcWipAccountId,
            debit: 0,
            credit: wipCredit,
          },
        ]),
      });

      for (const row of receiptRows) {
        await tx.lcReceiptLine.create({
          data: {
            lcId,
            itemId: row.itemId,
            unitId: row.unitId,
            quantity: new Decimal(row.quantity),
            merchandiseBase: new Decimal(row.merchandiseBase),
            allocatedExpenseBase: new Decimal(row.allocatedExpenseBase),
            landedUnitCostBase: new Decimal(row.landedUnitCostBase),
            lineOrder: row.lineOrder,
          },
        });

        await stockMovementService.postMovementInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          warehouseId: lc.warehouseId!,
          itemId: row.itemId,
          quantityDelta: row.quantity,
          unitCost: row.landedUnitCostBase,
          movementType: 'LC_RECEIPT',
          sourceType: 'LC',
          sourceNumber: lc.lcNumber,
          sourceYearId: lc.sourceYearId ?? undefined,
          documentDate: clearDate,
        });

        await itemCostService.applyMovingAverageInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId!,
          itemId: row.itemId,
          invoiceDate: clearDate,
          itemCount: row.quantity,
          itemPrice: row.landedUnitCostBase,
          sourceNum: lc.lcNumber,
          sourceYearId: lc.sourceYearId ?? String(new Date().getUTCFullYear()),
          sourceType: 'LC',
        });
      }

      return tx.letterOfCredit.update({
        where: { id: lcId },
        data: {
          status: 'CLOSED',
          totalLandedCost: new Decimal(wipCredit),
          clearingJournalEntryId: je.id,
          clearedAt: clearDate,
        },
        include: { expenses: true, receiptLines: true },
      });
    });
  }

  /**
   * Wave 2 fix: reverses a CLOSED LC's clearance — dated contra entry
   * against the clearance JE, reverses the inventory receipt movements and
   * the moving-average cost applied for each receipt line, and deletes the
   * receipt line rows so the LC returns to OPEN with its WIP balance intact.
   */
  async unclose(ctx: JournalPostingContext, lcId: string) {
    await this.assertEtemadRight(ctx, 'unpost');
    const lc = await prisma.letterOfCredit.findFirst({
      where: { id: lcId, companyId: ctx.companyId },
      include: { receiptLines: true },
    });
    if (!lc) throw new AppError(404, 'Letter of credit not found');
    if (lc.status !== 'CLOSED') throw new AppError(400, 'Letter of credit is not closed');
    if (!lc.clearingJournalEntryId) {
      throw new AppError(400, 'LC has no clearance journal entry to reverse');
    }

    return prisma.$transaction(async (tx) => {
      await journalPostingService.reverseJournalEntryInTx(tx, ctx, lc.clearingJournalEntryId!, {
        reason: 'LC clearance unposted',
      });

      for (const row of lc.receiptLines) {
        await stockMovementService.postMovementInTx(tx, {
          companyId: ctx.companyId,
          branchId: ctx.branchId,
          warehouseId: lc.warehouseId!,
          itemId: row.itemId,
          quantityDelta: -Number(row.quantity),
          unitCost: Number(row.landedUnitCostBase),
          movementType: 'LC_RECEIPT_REVERSAL',
          sourceType: 'LC',
          sourceNumber: lc.lcNumber,
          sourceYearId: lc.sourceYearId ?? undefined,
          documentDate: new Date(),
        });
      }
      // Cost history is keyed per (item, sourceType, sourceNumber, sourceYearId); remove the
      // row for every distinct item this LC's receipt lines touched.
      const distinctItemIds = Array.from(new Set(lc.receiptLines.map((r) => r.itemId)));
      for (const itemId of distinctItemIds) {
        await itemCostService.removeCostHistoryBySourceInTx(tx, {
          companyId: ctx.companyId,
          itemId,
          sourceType: 'LC',
          sourceNumber: lc.lcNumber,
          sourceYearId: lc.sourceYearId ?? String(new Date().getUTCFullYear()),
        });
      }
      await tx.lcReceiptLine.deleteMany({ where: { lcId } });

      return tx.letterOfCredit.update({
        where: { id: lcId },
        data: {
          status: 'OPEN',
          totalLandedCost: new Decimal(0),
          clearingJournalEntryId: null,
          clearedAt: null,
        },
        include: { expenses: true, receiptLines: true },
      });
    });
  }
}

export const letterOfCreditService = new LetterOfCreditService();
