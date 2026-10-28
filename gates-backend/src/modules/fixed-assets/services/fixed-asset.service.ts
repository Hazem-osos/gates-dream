import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { journalSourceDocumentSlot } from '../../platform/utils/document-identity';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { autoGlPostingService } from '../../accounting/services/auto-gl-posting.service';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import { glAccountResolver } from '../../accounting/services/gl-account-resolver.service';
import { journalLines } from '../../trade/utils/journal-lines.util';
import {
  firstDepreciationMonth,
  isFullyDepreciated,
  monthKey,
  type DepreciableAsset,
} from '../domain/depreciation';
import type { AssetCreateBody, AssetUpdateBody } from '../schemas/fixed-asset.schemas';
import {
  FIXED_ASSET_JOURNAL_SOURCE,
  assertCompanyRefs,
  assertPostingAccounts,
  companyCurrency,
  lockAssetsInTx,
  num,
} from './fixed-asset-refs';

type AssetRow = Prisma.FixedAssetGetPayload<Record<string, never>>;

const FINANCIAL_FIELDS = [
  'code',
  'categoryId',
  'acquisitionType',
  'acquisitionDate',
  'inServiceDate',
  'cost',
  'vatAmount',
  'openingAccumulatedDepreciation',
  'openingDepreciatedThrough',
  'assetAccountId',
  'accumulatedDepreciationAccountId',
  'depreciationExpenseAccountId',
  'creditAccountId',
  'supplierId',
] as const;

export function toDepreciable(asset: AssetRow): DepreciableAsset {
  return {
    method: asset.depreciationMethod,
    cost: num(asset.cost),
    salvageValue: num(asset.salvageValue),
    usefulLifeMonths: asset.usefulLifeMonths,
    decliningRate: asset.decliningRate == null ? null : Number(asset.decliningRate),
    inServiceDate: asset.inServiceDate,
  };
}

function withBookValue<T extends AssetRow>(asset: T) {
  return {
    ...asset,
    bookValue: roundTo4(num(asset.cost) - num(asset.accumulatedDepreciation)),
  };
}

export class FixedAssetService {
  async list(
    companyId: string,
    query: { page: number; limit: number; search?: string; status?: AssetRow['status']; categoryId?: string; branchId?: string }
  ) {
    const where: Prisma.FixedAssetWhereInput = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { arabicName: { contains: query.search } },
              { englishName: { contains: query.search } },
              { barcode: { contains: query.search } },
              { serialNumber: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.fixedAsset.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { category: { select: { id: true, code: true, arabicName: true } } },
      }),
      prisma.fixedAsset.count({ where }),
    ]);
    return {
      data: rows.map(withBookValue),
      pagination: { page: query.page, limit: query.limit, total },
    };
  }

  async getById(companyId: string, id: string) {
    const asset = await prisma.fixedAsset.findFirst({
      where: { id, companyId },
      include: {
        category: { select: { id: true, code: true, arabicName: true, disposalGainAccountId: true, disposalLossAccountId: true } },
        disposals: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!asset) throw new AppError(404, 'الأصل غير موجود');
    const accountIds = [
      asset.assetAccountId,
      asset.accumulatedDepreciationAccountId,
      asset.depreciationExpenseAccountId,
      asset.creditAccountId,
    ].filter((v): v is string => Boolean(v));
    const [accounts, journal, supplier, employee, costCenter, branch] = await Promise.all([
      prisma.account.findMany({
        where: { companyId, id: { in: accountIds } },
        select: { id: true, code: true, arabicName: true },
      }),
      asset.journalEntryId
        ? prisma.journalEntry.findFirst({
            where: { id: asset.journalEntryId, companyId },
            select: { id: true, voucherNumber: true, isPosted: true, isCancelled: true, date: true },
          })
        : null,
      asset.supplierId
        ? prisma.supplier.findFirst({ where: { id: asset.supplierId, companyId }, select: { id: true, code: true, arabicName: true } })
        : null,
      asset.custodianEmployeeId
        ? prisma.employee.findFirst({ where: { id: asset.custodianEmployeeId, companyId }, select: { id: true, arabicName: true, employeeId: true } })
        : null,
      asset.costCenterId
        ? prisma.costCenter.findFirst({ where: { id: asset.costCenterId, companyId }, select: { id: true, code: true, arabicName: true } })
        : null,
      asset.branchId
        ? prisma.branch.findFirst({ where: { id: asset.branchId, companyId }, select: { id: true, arabicName: true } })
        : null,
    ]);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    return {
      ...withBookValue(asset),
      assetAccount: byId.get(asset.assetAccountId) ?? null,
      accumulatedDepreciationAccount: byId.get(asset.accumulatedDepreciationAccountId) ?? null,
      depreciationExpenseAccount: byId.get(asset.depreciationExpenseAccountId) ?? null,
      creditAccount: asset.creditAccountId ? byId.get(asset.creditAccountId) ?? null : null,
      journal,
      supplier,
      custodian: employee,
      costCenter,
      branch,
    };
  }

  private async loadForWrite(companyId: string, id: string): Promise<AssetRow> {
    const asset = await prisma.fixedAsset.findFirst({ where: { id, companyId } });
    if (!asset) throw new AppError(404, 'الأصل غير موجود');
    return asset;
  }

  /** Resolves category defaults and validates the full financial picture of a draft. */
  private async resolveDraft(
    companyId: string,
    input: AssetCreateBody | (AssetUpdateBody & Partial<AssetRow>),
    current?: AssetRow
  ) {
    const categoryId = (input.categoryId ?? current?.categoryId) as string;
    const category = await prisma.fixedAssetCategory.findFirst({ where: { id: categoryId, companyId } });
    if (!category) throw new AppError(422, 'فئة الأصول غير موجودة');

    const pick = <T>(value: T | null | undefined, fallback: T): T =>
      value === undefined || value === null ? fallback : value;

    const cost = roundTo4(Number(pick(input.cost as number | undefined, num(current?.cost))));
    const method = pick(
      input.depreciationMethod as AssetRow['depreciationMethod'] | undefined,
      current?.depreciationMethod ?? category.depreciationMethod
    );
    const usefulLifeMonths = pick(
      input.usefulLifeMonths as number | undefined,
      current?.usefulLifeMonths ?? category.usefulLifeMonths ?? 0
    );
    if (method !== 'NONE' && !(usefulLifeMonths > 0)) {
      throw new AppError(422, 'العمر الإنتاجي مطلوب (أو عرّفه على الفئة)');
    }
    const decliningRate =
      method === 'DECLINING_BALANCE'
        ? Number(pick(input.decliningRate as number | undefined, Number(current?.decliningRate ?? category.decliningRate ?? 0)))
        : null;
    if (method === 'DECLINING_BALANCE' && !(Number(decliningRate) > 0)) {
      throw new AppError(422, 'نسبة القسط المتناقص مطلوبة');
    }
    const salvageValue = roundTo4(
      Number(
        pick(
          input.salvageValue as number | undefined,
          current ? num(current.salvageValue) : roundTo4((cost * num(category.salvagePercent)) / 100)
        )
      )
    );
    if (salvageValue > cost) throw new AppError(422, 'القيمة التخريدية أكبر من التكلفة');

    const acquisitionType = pick(
      input.acquisitionType as AssetRow['acquisitionType'] | undefined,
      current?.acquisitionType ?? 'PURCHASE'
    );
    const acquisitionDate = pick(input.acquisitionDate as Date | undefined, current?.acquisitionDate as Date);
    const inServiceDate = pick(input.inServiceDate as Date | undefined, current?.inServiceDate as Date);
    if (inServiceDate < acquisitionDate) throw new AppError(422, 'تاريخ التشغيل لا يسبق تاريخ الشراء');

    const openingAccumulated = roundTo4(
      Number(pick(input.openingAccumulatedDepreciation as number | undefined, num(current?.openingAccumulatedDepreciation)))
    );
    const openingThrough =
      input.openingDepreciatedThrough !== undefined
        ? input.openingDepreciatedThrough ?? null
        : current?.openingDepreciatedThrough ?? null;
    if (openingAccumulated > 0 && !openingThrough) {
      throw new AppError(422, 'حدد آخر شهر يغطيه مجمع الإهلاك الافتتاحي');
    }
    if (openingAccumulated > roundTo4(cost - salvageValue) + 0.0001) {
      throw new AppError(422, 'مجمع الإهلاك الافتتاحي أكبر من القيمة القابلة للإهلاك');
    }
    if (openingThrough && monthKey(openingThrough) < firstDepreciationMonth(inServiceDate) - 1) {
      throw new AppError(422, 'تاريخ مجمع الإهلاك الافتتاحي يسبق تاريخ التشغيل');
    }

    const vatAmount =
      acquisitionType === 'PURCHASE'
        ? roundTo4(Number(pick(input.vatAmount as number | undefined, num(current?.vatAmount))))
        : 0;

    const assetAccountId = pick(input.assetAccountId, current?.assetAccountId ?? category.assetAccountId);
    const accumulatedDepreciationAccountId = pick(
      input.accumulatedDepreciationAccountId,
      current?.accumulatedDepreciationAccountId ?? category.accumulatedDepreciationAccountId
    );
    const depreciationExpenseAccountId = pick(
      input.depreciationExpenseAccountId,
      current?.depreciationExpenseAccountId ?? category.depreciationExpenseAccountId
    );
    if (!assetAccountId || !accumulatedDepreciationAccountId || !depreciationExpenseAccountId) {
      throw new AppError(422, 'حسابات الأصل ومجمع الإهلاك ومصروف الإهلاك مطلوبة (عرّفها على الفئة)');
    }
    const supplierId =
      input.supplierId !== undefined ? input.supplierId ?? null : current?.supplierId ?? null;
    const creditAccountId =
      input.creditAccountId !== undefined ? input.creditAccountId ?? null : current?.creditAccountId ?? null;

    await assertPostingAccounts(prisma, companyId, [
      assetAccountId,
      accumulatedDepreciationAccountId,
      depreciationExpenseAccountId,
      acquisitionType === 'PURCHASE' && !supplierId ? creditAccountId : null,
    ]);

    return {
      categoryId,
      cost: new Decimal(cost),
      vatAmount: new Decimal(vatAmount),
      salvageValue: new Decimal(salvageValue),
      usefulLifeMonths: method === 'NONE' ? Math.max(1, usefulLifeMonths || 1) : usefulLifeMonths,
      depreciationMethod: method,
      decliningRate: decliningRate == null ? null : new Decimal(decliningRate),
      acquisitionType,
      acquisitionDate,
      inServiceDate,
      openingAccumulatedDepreciation: new Decimal(openingAccumulated),
      openingDepreciatedThrough: openingAccumulated > 0 ? openingThrough : null,
      assetAccountId,
      accumulatedDepreciationAccountId,
      depreciationExpenseAccountId,
      supplierId: acquisitionType === 'PURCHASE' ? supplierId : null,
      creditAccountId: acquisitionType === 'PURCHASE' && !supplierId ? creditAccountId : null,
    };
  }

  private descriptive(input: Partial<AssetCreateBody>) {
    const out: Record<string, unknown> = {};
    for (const key of [
      'arabicName',
      'englishName',
      'branchId',
      'costCenterId',
      'custodianEmployeeId',
      'location',
      'serialNumber',
      'barcode',
      'invoiceReference',
      'warrantyExpiry',
      'notes',
    ] as const) {
      if (input[key] !== undefined) out[key] = input[key] === '' ? null : input[key];
    }
    return out;
  }

  async create(ctx: JournalPostingContext, body: AssetCreateBody) {
    const { companyId } = ctx;
    await assertCompanyRefs(prisma, companyId, body);
    const financial = await this.resolveDraft(companyId, body);

    return prisma.$transaction(async (tx) => {
      let code = body.code?.trim() || '';
      if (code) {
        const taken = await tx.fixedAsset.findFirst({ where: { companyId, code }, select: { id: true } });
        if (taken) throw new AppError(409, `كود الأصل ${code} مستخدم من قبل`);
      } else {
        code = await documentSequenceService.nextNumberInTx(tx, {
          companyId,
          branchId: null,
          fiscalYearId: null,
          docType: 'FA',
          scope: 'C',
          padding: 6,
          isAvailable: async (candidate) =>
            !(await tx.fixedAsset.findFirst({ where: { companyId, code: candidate }, select: { id: true } })),
        });
      }
      return tx.fixedAsset.create({
        data: {
          companyId,
          code,
          ...financial,
          ...this.descriptive(body),
          arabicName: body.arabicName,
          status: 'DRAFT',
          createdBy: ctx.userId,
        } as Prisma.FixedAssetUncheckedCreateInput,
      });
    });
  }

  async update(ctx: JournalPostingContext, id: string, body: AssetUpdateBody) {
    const { companyId } = ctx;
    const current = await this.loadForWrite(companyId, id);
    if (current.version !== body.version) {
      throw new AppError(409, 'تم تعديل الأصل من مستخدم آخر، أعد فتحه ثم عدّل');
    }
    if (current.status === 'DISPOSED') {
      const changedFinancial = Object.keys(body).some(
        (k) => k !== 'version' && !(k in this.descriptive(body))
      );
      if (changedFinancial) throw new AppError(409, 'الأصل مستبعد؛ يمكن تعديل البيانات الوصفية فقط');
    }
    await assertCompanyRefs(prisma, companyId, body);

    let data: Record<string, unknown> = { ...this.descriptive(body) };
    if (current.status === 'DRAFT') {
      if (body.code !== undefined && body.code && body.code !== current.code) {
        const taken = await prisma.fixedAsset.findFirst({
          where: { companyId, code: body.code, NOT: { id } },
          select: { id: true },
        });
        if (taken) throw new AppError(409, `كود الأصل ${body.code} مستخدم من قبل`);
        data.code = body.code;
      }
      data = { ...data, ...(await this.resolveDraft(companyId, body as never, current)) };
    } else {
      const touched = FINANCIAL_FIELDS.filter(
        (key) => body[key as keyof AssetUpdateBody] !== undefined
      ).filter((key) => {
        const next = body[key as keyof AssetUpdateBody];
        const prev = current[key as keyof AssetRow];
        if (next instanceof Date && prev instanceof Date) return next.getTime() !== prev.getTime();
        if (prev instanceof Decimal) return num(prev) !== Number(next);
        return (next ?? null) !== (prev ?? null);
      });
      if (touched.length > 0) {
        throw new AppError(
          409,
          'الأصل مُفعّل: التكلفة والتواريخ والحسابات لا تتغير إلا بعد إلغاء التفعيل (والأصل بدون إهلاك مرحل)'
        );
      }
      // EAS 10: estimates (life, salvage, method) are revised prospectively.
      const estimates: Record<string, unknown> = {};
      if (body.usefulLifeMonths !== undefined) estimates.usefulLifeMonths = body.usefulLifeMonths;
      if (body.salvageValue !== undefined) {
        if (body.salvageValue > num(current.cost)) throw new AppError(422, 'القيمة التخريدية أكبر من التكلفة');
        estimates.salvageValue = new Decimal(body.salvageValue);
      }
      if (body.depreciationMethod !== undefined) estimates.depreciationMethod = body.depreciationMethod;
      if (body.decliningRate !== undefined) {
        estimates.decliningRate = body.decliningRate == null ? null : new Decimal(body.decliningRate);
      }
      const method = (estimates.depreciationMethod ?? current.depreciationMethod) as AssetRow['depreciationMethod'];
      const rate = estimates.decliningRate !== undefined ? estimates.decliningRate : current.decliningRate;
      if (method === 'DECLINING_BALANCE' && !(Number(rate ?? 0) > 0)) {
        throw new AppError(422, 'نسبة القسط المتناقص مطلوبة');
      }
      data = { ...data, ...estimates };
    }

    return prisma.$transaction(async (tx) => {
      await lockAssetsInTx(tx, companyId, [id]);
      const fresh = await tx.fixedAsset.findFirstOrThrow({ where: { id, companyId } });
      if (fresh.version !== body.version || fresh.status !== current.status) {
        throw new AppError(409, 'تم تعديل الأصل من مستخدم آخر، أعد فتحه ثم عدّل');
      }
      if (fresh.status === 'ACTIVE' || fresh.status === 'FULLY_DEPRECIATED') {
        const projected = { ...fresh, ...data } as AssetRow;
        data.status = isFullyDepreciated(toDepreciable(projected), num(fresh.accumulatedDepreciation))
          ? 'FULLY_DEPRECIATED'
          : 'ACTIVE';
      }
      const { count } = await tx.fixedAsset.updateMany({
        where: { id, companyId, version: body.version },
        data: { ...data, version: { increment: 1 } } as Prisma.FixedAssetUncheckedUpdateManyInput,
      });
      if (count !== 1) throw new AppError(409, 'تم تعديل الأصل من مستخدم آخر، أعد فتحه ثم عدّل');
      return tx.fixedAsset.findFirstOrThrow({ where: { id, companyId } });
    });
  }

  async remove(ctx: JournalPostingContext, id: string) {
    const { companyId } = ctx;
    return prisma.$transaction(async (tx) => {
      await lockAssetsInTx(tx, companyId, [id]);
      const asset = await tx.fixedAsset.findFirst({ where: { id, companyId } });
      if (!asset) throw new AppError(404, 'الأصل غير موجود');
      if (asset.status !== 'DRAFT') throw new AppError(409, 'لا يُحذف إلا أصل غير مفعّل');
      const [lines, disposals] = await Promise.all([
        tx.fixedAssetDepreciationLine.count({ where: { assetId: id } }),
        tx.fixedAssetDisposal.count({ where: { assetId: id, companyId } }),
      ]);
      if (lines > 0 || disposals > 0) {
        throw new AppError(409, 'للأصل حركات إهلاك أو استبعاد سابقة؛ احذفها أولًا');
      }
      if (asset.journalEntryId) {
        // The unposted purchase entry is cancelled (never deleted, never reversed).
        await journalPostingService.cascadeSourceJournalInTx(tx, companyId, [asset.journalEntryId], 'cancel', ctx.userId);
      }
      await tx.fixedAsset.deleteMany({ where: { id, companyId, status: 'DRAFT' } });
      return { id };
    });
  }

  /** DRAFT → ACTIVE. A PURCHASE posts Dr asset (+ input VAT) / Cr supplier or account. */
  async activate(ctx: JournalPostingContext, id: string) {
    const { companyId } = ctx;
    const preview = await this.loadForWrite(companyId, id);
    const currency = await companyCurrency(prisma, companyId);
    const vatAccountId =
      num(preview.vatAmount) > 0 ? (await glAccountResolver.resolveCompanyDefaults(companyId)).vatInputAccountId : null;
    if (num(preview.vatAmount) > 0 && !vatAccountId) {
      throw new AppError(422, 'حساب ضريبة المدخلات غير معرّف في إعدادات الحسابات');
    }
    const partyAccountId =
      preview.acquisitionType === 'PURCHASE' && preview.supplierId
        ? await glAccountResolver.resolvePartyAccount({ companyId, supplierId: preview.supplierId })
        : null;

    return prisma.$transaction(async (tx) => {
      await lockAssetsInTx(tx, companyId, [id]);
      const asset = await tx.fixedAsset.findFirstOrThrow({ where: { id, companyId } });
      if (asset.status !== 'DRAFT') throw new AppError(409, 'الأصل مُفعّل بالفعل');

      const opening = num(asset.openingAccumulatedDepreciation);
      const status = isFullyDepreciated(toDepreciable(asset), opening) ? 'FULLY_DEPRECIATED' : 'ACTIVE';
      // Claim first: only one request flips DRAFT → ACTIVE.
      const { count } = await tx.fixedAsset.updateMany({
        where: { id, companyId, status: 'DRAFT' },
        data: {
          status,
          accumulatedDepreciation: new Decimal(opening),
          depreciatedThrough: asset.openingDepreciatedThrough,
          postedAt: new Date(),
          postedBy: ctx.userId,
          version: { increment: 1 },
        },
      });
      if (count !== 1) throw new AppError(409, 'الأصل مُفعّل بالفعل');

      if (asset.acquisitionType === 'PURCHASE') {
        const cost = num(asset.cost);
        const vat = num(asset.vatAmount);
        const creditAccountId = partyAccountId ?? asset.creditAccountId;
        if (!creditAccountId) throw new AppError(422, 'حدد المورد أو الحساب الدائن لقيد الشراء');
        const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, asset.acquisitionDate);
        const journal = await autoGlPostingService.commitInTx(tx, ctx, {
          sourceType: FIXED_ASSET_JOURNAL_SOURCE,
          sourceId: journalSourceDocumentSlot(asset.id, 'acquisition'),
          existingJournalId: asset.journalEntryId,
          sourceNumber: asset.code.slice(0, 30),
          date: asset.acquisitionDate,
          description: `شراء أصل ثابت ${asset.code} - ${asset.arabicName}`,
          currencyCode: currency,
          exchangeRate: 1,
          fiscalYearId,
          entryType: 'FA-ACQUISITION',
          requireAutoPostFlag: false,
          costCenterId: asset.costCenterId,
          lines: journalLines([
            { accountId: asset.assetAccountId, debit: cost, credit: 0, description: `تكلفة الأصل ${asset.code}` },
            ...(vat > 0 && vatAccountId
              ? [{ accountId: vatAccountId, debit: vat, credit: 0, description: 'ضريبة القيمة المضافة - مدخلات' }]
              : []),
            {
              accountId: creditAccountId,
              debit: 0,
              credit: roundTo4(cost + vat),
              description: `شراء الأصل ${asset.code}`,
              ...(partyAccountId && asset.supplierId
                ? { partnerId: asset.supplierId, partnerType: 'SUPPLIER' as const }
                : {}),
            },
          ]),
        });
        if (!journal) throw new AppError(500, 'تعذر إنشاء قيد شراء الأصل');
        await tx.fixedAsset.updateMany({ where: { id, companyId }, data: { journalEntryId: journal.id } });
      }
      return tx.fixedAsset.findFirstOrThrow({ where: { id, companyId } });
    });
  }

  /** ACTIVE → DRAFT, only while nothing has been depreciated or disposed in Gates. */
  async deactivate(ctx: JournalPostingContext, id: string) {
    const { companyId } = ctx;
    return prisma.$transaction(async (tx) => {
      await lockAssetsInTx(tx, companyId, [id]);
      const asset = await tx.fixedAsset.findFirst({ where: { id, companyId } });
      if (!asset) throw new AppError(404, 'الأصل غير موجود');
      if (asset.status === 'DRAFT') throw new AppError(409, 'الأصل غير مُفعّل');
      if (asset.status === 'DISPOSED') throw new AppError(409, 'ألغِ ترحيل الاستبعاد أولًا');
      const postedLines = await tx.fixedAssetDepreciationLine.count({
        where: { assetId: id, run: { status: 'POSTED', companyId } },
      });
      if (postedLines > 0) {
        throw new AppError(409, 'على الأصل إهلاك مرحل؛ ألغِ ترحيل تشغيلات الإهلاك أولًا');
      }
      const { count } = await tx.fixedAsset.updateMany({
        where: { id, companyId, status: { in: ['ACTIVE', 'FULLY_DEPRECIATED'] } },
        data: {
          status: 'DRAFT',
          accumulatedDepreciation: new Decimal(0),
          depreciatedThrough: null,
          postedAt: null,
          postedBy: null,
          version: { increment: 1 },
        },
      });
      if (count !== 1) throw new AppError(409, 'تغيرت حالة الأصل، أعد المحاولة');
      if (asset.journalEntryId) {
        await journalPostingService.unpostSourceJournalInTx(tx, ctx, asset.journalEntryId);
      }
      return tx.fixedAsset.findFirstOrThrow({ where: { id, companyId } });
    });
  }
}

export const fixedAssetService = new FixedAssetService();
