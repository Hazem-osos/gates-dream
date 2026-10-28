import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { autoGlPostingService } from '../../accounting/services/auto-gl-posting.service';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { glAccountResolver } from '../../accounting/services/gl-account-resolver.service';
import { journalLines } from '../../trade/utils/journal-lines.util';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import {
  depreciateMonths,
  disposalGainLoss,
  firstDepreciationMonth,
  lastDepreciationMonthOnDisposal,
  monthEndDate,
  monthKey,
} from '../domain/depreciation';
import type { DisposalBody } from '../schemas/fixed-asset.schemas';
import { toDepreciable } from './fixed-asset.service';
import {
  FIXED_ASSET_JOURNAL_SOURCE,
  accumulatedAtYearStart,
  assertCompanyRefs,
  assertPostingAccounts,
  companyCurrency,
  describeJournalLines,
  isoDay,
  lockAssetsInTx,
  nextDepreciationMonth,
  num,
} from './fixed-asset-refs';
import type { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient | typeof prisma;

interface DisposalComputation {
  catchUp: number;
  catchUpMonths: number;
  lastMonth: number;
  cost: number;
  accumulated: number;
  bookValue: number;
  gainLoss: number;
  lines: JournalEntryLineData[];
  newDepreciatedThrough: Date | null;
}

export class FixedAssetDisposalService {
  private async compute(
    db: Db,
    companyId: string,
    body: DisposalBody,
    accounts: { proceedsAccountId: string | null; vatOutputAccountId: string | null }
  ): Promise<DisposalComputation & { asset: Prisma.FixedAssetGetPayload<{ include: { category: true } }> }> {
    const asset = await db.fixedAsset.findFirst({
      where: { id: body.assetId, companyId },
      include: { category: true },
    });
    if (!asset) throw new AppError(404, 'الأصل غير موجود');
    if (asset.status !== 'ACTIVE' && asset.status !== 'FULLY_DEPRECIATED') {
      throw new AppError(409, asset.status === 'DISPOSED' ? 'الأصل مستبعد بالفعل' : 'فعّل الأصل قبل استبعاده');
    }
    if (body.disposalDate < asset.inServiceDate && body.disposalDate < asset.acquisitionDate) {
      throw new AppError(422, 'تاريخ الاستبعاد يسبق تاريخ شراء الأصل');
    }

    const lastMonth = lastDepreciationMonthOnDisposal(body.disposalDate);
    if (asset.depreciatedThrough && monthKey(asset.depreciatedThrough) > lastMonth) {
      throw new AppError(
        409,
        `يوجد إهلاك مرحل حتى ${isoDay(asset.depreciatedThrough)} بعد تاريخ الاستبعاد؛ ألغِ ترحيل تشغيلات الإهلاك اللاحقة أولًا`
      );
    }

    const depreciable = toDepreciable(asset);
    const from = nextDepreciationMonth(asset.depreciatedThrough, firstDepreciationMonth(asset.inServiceDate));
    let catchUp = 0;
    let catchUpMonths = 0;
    let accumulated = num(asset.accumulatedDepreciation);
    if (from <= lastMonth && asset.depreciationMethod !== 'NONE') {
      const yearStart = await accumulatedAtYearStart(db, asset, from);
      const result = depreciateMonths(depreciable, from, lastMonth, {
        accumulated,
        accumulatedAtYearStart: yearStart,
      });
      catchUp = roundTo4(result.lines.reduce((sum, l) => sum + l.amount, 0));
      catchUpMonths = result.lines.length;
      accumulated = result.state.accumulated;
    }

    const cost = num(asset.cost);
    const proceeds = roundTo4(body.disposalType === 'SALE' ? body.proceeds : 0);
    const vat = roundTo4(body.disposalType === 'SALE' ? body.vatAmount : 0);
    const { bookValue, gainLoss } = disposalGainLoss(cost, accumulated, proceeds);

    const gainAccountId = asset.category.disposalGainAccountId;
    const lossAccountId = asset.category.disposalLossAccountId;
    if (gainLoss > 0 && !gainAccountId) {
      throw new AppError(422, `عرّف حساب أرباح بيع الأصول على الفئة ${asset.category.arabicName}`);
    }
    if (gainLoss < 0 && !lossAccountId) {
      throw new AppError(422, `عرّف حساب خسائر استبعاد الأصول على الفئة ${asset.category.arabicName}`);
    }
    if (vat > 0 && !accounts.vatOutputAccountId) {
      throw new AppError(422, 'حساب ضريبة المخرجات غير معرّف في إعدادات الحسابات');
    }
    if (proceeds + vat > 0 && !accounts.proceedsAccountId) {
      throw new AppError(422, 'حدد العميل أو حساب المتحصلات');
    }

    const label = `${asset.code} - ${asset.arabicName}`;
    const lines = journalLines([
      ...(catchUp > 0
        ? [
            {
              accountId: asset.depreciationExpenseAccountId,
              debit: catchUp,
              credit: 0,
              description: `إهلاك حتى تاريخ الاستبعاد ${label}`,
              ...(asset.costCenterId ? { costCenterId: asset.costCenterId } : {}),
            },
            {
              accountId: asset.accumulatedDepreciationAccountId,
              debit: 0,
              credit: catchUp,
              description: `مجمع إهلاك حتى تاريخ الاستبعاد ${label}`,
            },
          ]
        : []),
      {
        accountId: asset.accumulatedDepreciationAccountId,
        debit: accumulated,
        credit: 0,
        description: `إقفال مجمع إهلاك ${label}`,
      },
      ...(proceeds + vat > 0 && accounts.proceedsAccountId
        ? [
            {
              accountId: accounts.proceedsAccountId,
              debit: roundTo4(proceeds + vat),
              credit: 0,
              description: `متحصلات بيع ${label}`,
              ...(body.customerId ? { partnerId: body.customerId, partnerType: 'CUSTOMER' as const } : {}),
            },
          ]
        : []),
      ...(gainLoss < 0 && lossAccountId
        ? [{ accountId: lossAccountId, debit: -gainLoss, credit: 0, description: `خسائر استبعاد ${label}` }]
        : []),
      { accountId: asset.assetAccountId, debit: 0, credit: cost, description: `استبعاد تكلفة ${label}` },
      ...(vat > 0 && accounts.vatOutputAccountId
        ? [{ accountId: accounts.vatOutputAccountId, debit: 0, credit: vat, description: 'ضريبة القيمة المضافة - مخرجات' }]
        : []),
      ...(gainLoss > 0 && gainAccountId
        ? [{ accountId: gainAccountId, debit: 0, credit: gainLoss, description: `أرباح بيع ${label}` }]
        : []),
    ]);

    return {
      asset,
      catchUp,
      catchUpMonths,
      lastMonth,
      cost,
      accumulated,
      bookValue,
      gainLoss,
      lines,
      newDepreciatedThrough: catchUpMonths > 0 ? monthEndDate(lastMonth) : asset.depreciatedThrough,
    };
  }

  private async resolveAccounts(companyId: string, body: DisposalBody) {
    await assertCompanyRefs(prisma, companyId, { customerId: body.customerId });
    let proceedsAccountId: string | null = null;
    if (body.disposalType === 'SALE' && body.proceeds + body.vatAmount > 0) {
      if (body.customerId) {
        proceedsAccountId = await glAccountResolver.resolvePartyAccount({ companyId, customerId: body.customerId });
      } else if (body.proceedsAccountId) {
        await assertPostingAccounts(prisma, companyId, [body.proceedsAccountId]);
        proceedsAccountId = body.proceedsAccountId;
      }
    }
    const vatOutputAccountId =
      body.vatAmount > 0 ? (await glAccountResolver.resolveCompanyDefaults(companyId)).vatOutputAccountId ?? null : null;
    return { proceedsAccountId, vatOutputAccountId };
  }

  async preview(companyId: string, body: DisposalBody) {
    const accounts = await this.resolveAccounts(companyId, body);
    const result = await this.compute(prisma, companyId, body, accounts);
    return {
      assetId: result.asset.id,
      catchUpDepreciation: result.catchUp,
      catchUpMonths: result.catchUpMonths,
      cost: result.cost,
      accumulatedDepreciation: result.accumulated,
      bookValue: result.bookValue,
      gainLoss: result.gainLoss,
      journal: await describeJournalLines(prisma, companyId, result.lines),
    };
  }

  async post(ctx: JournalPostingContext, body: DisposalBody) {
    const { companyId } = ctx;
    const accounts = await this.resolveAccounts(companyId, body);
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, body.disposalDate);
    const currency = await companyCurrency(prisma, companyId);

    return prisma.$transaction(async (tx) => {
      await lockAssetsInTx(tx, companyId, [body.assetId]);
      const result = await this.compute(tx, companyId, body, accounts);
      const { asset } = result;

      // Claim the asset first: a second disposal (or a concurrent run) sees it gone.
      const { count } = await tx.fixedAsset.updateMany({
        where: { id: asset.id, companyId, status: { in: ['ACTIVE', 'FULLY_DEPRECIATED'] } },
        data: {
          status: 'DISPOSED',
          accumulatedDepreciation: new Decimal(result.accumulated),
          depreciatedThrough: result.newDepreciatedThrough,
          version: { increment: 1 },
        },
      });
      if (count !== 1) throw new AppError(409, 'الأصل مستبعد بالفعل');

      const disposalNumber = await documentSequenceService.nextNumberInTx(tx, {
        companyId,
        branchId: null,
        fiscalYearId: null,
        docType: 'FADSP',
        scope: 'C',
        padding: 6,
        isAvailable: async (candidate) =>
          !(await tx.fixedAssetDisposal.findFirst({
            where: { companyId, disposalNumber: candidate },
            select: { id: true },
          })),
      });

      const disposal = await tx.fixedAssetDisposal.create({
        data: {
          companyId,
          disposalNumber,
          assetId: asset.id,
          disposalType: body.disposalType,
          disposalDate: body.disposalDate,
          status: 'POSTED',
          activeAssetKey: asset.id,
          proceeds: new Decimal(body.disposalType === 'SALE' ? body.proceeds : 0),
          vatAmount: new Decimal(body.disposalType === 'SALE' ? body.vatAmount : 0),
          proceedsAccountId: body.customerId ? null : body.proceedsAccountId ?? null,
          customerId: body.customerId ?? null,
          catchUpDepreciation: new Decimal(result.catchUp),
          catchUpMonths: result.catchUpMonths,
          costAmount: new Decimal(result.cost),
          accumulatedAmount: new Decimal(result.accumulated),
          bookValue: new Decimal(result.bookValue),
          gainLoss: new Decimal(result.gainLoss),
          previousStatus: asset.status,
          previousDepreciatedThrough: asset.depreciatedThrough,
          branchId: ctx.branchId ?? null,
          notes: body.notes ?? null,
          postedAt: new Date(),
          postedBy: ctx.userId,
          createdBy: ctx.userId,
        },
      });

      const journal = await autoGlPostingService.commitInTx(tx, ctx, {
        sourceType: FIXED_ASSET_JOURNAL_SOURCE,
        sourceId: disposal.id,
        sourceNumber: disposalNumber,
        date: body.disposalDate,
        description: `${body.disposalType === 'SALE' ? 'بيع' : 'استبعاد'} الأصل ${asset.code} - ${asset.arabicName}`,
        currencyCode: currency,
        exchangeRate: 1,
        fiscalYearId,
        entryType: 'FA-DISPOSAL',
        requireAutoPostFlag: false,
        lines: result.lines,
      });
      if (!journal) throw new AppError(500, 'تعذر إنشاء قيد الاستبعاد');
      await tx.fixedAssetDisposal.updateMany({
        where: { id: disposal.id, companyId },
        data: { journalEntryId: journal.id },
      });
      return tx.fixedAssetDisposal.findFirstOrThrow({ where: { id: disposal.id, companyId } });
    });
  }

  /** Unpost in place and give the asset back its pre-disposal state. */
  async unpost(ctx: JournalPostingContext, id: string) {
    const { companyId } = ctx;
    return prisma.$transaction(async (tx) => {
      const disposal = await tx.fixedAssetDisposal.findFirst({ where: { id, companyId } });
      if (!disposal) throw new AppError(404, 'مستند الاستبعاد غير موجود');
      if (disposal.status !== 'POSTED') throw new AppError(409, 'مستند الاستبعاد غير مرحل');
      await lockAssetsInTx(tx, companyId, [disposal.assetId]);

      const { count } = await tx.fixedAssetDisposal.updateMany({
        where: { id, companyId, status: 'POSTED' },
        data: { status: 'UNPOSTED', activeAssetKey: null, postedAt: null, postedBy: null },
      });
      if (count !== 1) throw new AppError(409, 'مستند الاستبعاد غير مرحل');

      const { count: restored } = await tx.fixedAsset.updateMany({
        where: { id: disposal.assetId, companyId, status: 'DISPOSED' },
        data: {
          status: disposal.previousStatus,
          accumulatedDepreciation: { decrement: disposal.catchUpDepreciation },
          depreciatedThrough: disposal.previousDepreciatedThrough,
          version: { increment: 1 },
        },
      });
      if (restored !== 1) throw new AppError(409, 'تغيرت حالة الأصل، أعد المحاولة');

      if (disposal.journalEntryId) {
        await journalPostingService.unpostSourceJournalInTx(tx, ctx, disposal.journalEntryId);
      }
      return tx.fixedAssetDisposal.findFirstOrThrow({ where: { id, companyId } });
    });
  }

  /** Delete an unposted disposal; its journal is cancelled, never reversed. */
  async remove(ctx: JournalPostingContext, id: string) {
    const { companyId } = ctx;
    return prisma.$transaction(async (tx) => {
      const disposal = await tx.fixedAssetDisposal.findFirst({ where: { id, companyId } });
      if (!disposal) throw new AppError(404, 'مستند الاستبعاد غير موجود');
      const { count } = await tx.fixedAssetDisposal.deleteMany({ where: { id, companyId, status: 'UNPOSTED' } });
      if (count !== 1) throw new AppError(409, 'ألغِ ترحيل الاستبعاد قبل حذفه');
      if (disposal.journalEntryId) {
        await journalPostingService.cascadeSourceJournalInTx(tx, companyId, [disposal.journalEntryId], 'cancel', ctx.userId);
      }
      return { id };
    });
  }

  async list(companyId: string) {
    return prisma.fixedAssetDisposal.findMany({
      where: { companyId },
      orderBy: { disposalDate: 'desc' },
      include: { asset: { select: { id: true, code: true, arabicName: true } } },
      take: 500,
    });
  }
}

export const fixedAssetDisposalService = new FixedAssetDisposalService();
