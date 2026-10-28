import { z } from 'zod';

const id = z.string().trim().min(1).max(191);
const optionalId = id.optional().nullable();
const money = z.coerce.number().finite().min(0).max(999_999_999_999);
const percent = z.coerce.number().finite().min(0).max(100);
const isoDate = z.coerce.date();
const text = (max: number) => z.string().trim().max(max);

export const METHODS = ['STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE'] as const;

export const idParamSchema = z.object({ id });

// ── Categories ──────────────────────────────────────────────────────────────

export const categoryBodySchema = z
  .object({
    code: text(30).min(1, 'كود الفئة مطلوب'),
    arabicName: text(200).min(1, 'اسم الفئة مطلوب'),
    englishName: text(200).optional().nullable(),
    parentId: optionalId,
    depreciationMethod: z.enum(METHODS).default('STRAIGHT_LINE'),
    usefulLifeMonths: z.coerce.number().int().min(1).max(1200).optional().nullable(),
    decliningRate: percent.optional().nullable(),
    salvagePercent: percent.default(0),
    assetAccountId: id,
    accumulatedDepreciationAccountId: id,
    depreciationExpenseAccountId: id,
    disposalGainAccountId: optionalId,
    disposalLossAccountId: optionalId,
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.depreciationMethod === 'DECLINING_BALANCE' && !(Number(v.decliningRate) > 0)) {
      ctx.addIssue({ code: 'custom', path: ['decliningRate'], message: 'نسبة القسط المتناقص مطلوبة' });
    }
  });

export type CategoryBody = z.infer<typeof categoryBodySchema>;

// ── Assets ──────────────────────────────────────────────────────────────────

const assetDescriptive = {
  arabicName: text(200).min(1, 'اسم الأصل مطلوب'),
  englishName: text(200).optional().nullable(),
  branchId: optionalId,
  costCenterId: optionalId,
  custodianEmployeeId: optionalId,
  location: text(200).optional().nullable(),
  serialNumber: text(100).optional().nullable(),
  barcode: text(100).optional().nullable(),
  invoiceReference: text(100).optional().nullable(),
  warrantyExpiry: isoDate.optional().nullable(),
  notes: text(4000).optional().nullable(),
};

/**
 * Fields that can be revised while the asset is in service (applied
 * prospectively). On create, missing values fall back to the category.
 */
const assetEstimates = {
  usefulLifeMonths: z.coerce.number().int().min(1).max(1200).optional().nullable(),
  salvageValue: money.optional().nullable(),
  depreciationMethod: z.enum(METHODS).optional().nullable(),
  decliningRate: percent.optional().nullable(),
};

export const assetCreateSchema = z
  .object({
    ...assetDescriptive,
    ...assetEstimates,
    code: text(30).optional().nullable(),
    categoryId: id,
    acquisitionType: z.enum(['PURCHASE', 'EXISTING']).default('PURCHASE'),
    acquisitionDate: isoDate,
    inServiceDate: isoDate,
    cost: money.refine((v) => v > 0, 'تكلفة الأصل يجب أن تكون أكبر من صفر'),
    /** Recoverable input VAT on a purchase — never part of the cost. */
    vatAmount: money.default(0),
    openingAccumulatedDepreciation: money.default(0),
    openingDepreciatedThrough: isoDate.optional().nullable(),
    assetAccountId: optionalId,
    accumulatedDepreciationAccountId: optionalId,
    depreciationExpenseAccountId: optionalId,
    creditAccountId: optionalId,
    supplierId: optionalId,
  })
  .superRefine((v, ctx) => {
    if (v.inServiceDate < v.acquisitionDate) {
      ctx.addIssue({ code: 'custom', path: ['inServiceDate'], message: 'تاريخ التشغيل لا يسبق تاريخ الشراء' });
    }
    if (Number(v.salvageValue ?? 0) > v.cost) {
      ctx.addIssue({ code: 'custom', path: ['salvageValue'], message: 'القيمة التخريدية أكبر من التكلفة' });
    }
    if (v.openingAccumulatedDepreciation > v.cost - Number(v.salvageValue ?? 0) + 0.0001) {
      ctx.addIssue({
        code: 'custom',
        path: ['openingAccumulatedDepreciation'],
        message: 'مجمع الإهلاك الافتتاحي أكبر من القيمة القابلة للإهلاك',
      });
    }
    if (v.openingAccumulatedDepreciation > 0 && !v.openingDepreciatedThrough) {
      ctx.addIssue({
        code: 'custom',
        path: ['openingDepreciatedThrough'],
        message: 'حدد آخر شهر يغطيه مجمع الإهلاك الافتتاحي',
      });
    }
    if (v.acquisitionType === 'EXISTING' && v.vatAmount > 0) {
      ctx.addIssue({ code: 'custom', path: ['vatAmount'], message: 'الضريبة تُسجل فقط مع قيد الشراء' });
    }
    if (v.depreciationMethod === 'DECLINING_BALANCE' && !(Number(v.decliningRate) > 0)) {
      ctx.addIssue({ code: 'custom', path: ['decliningRate'], message: 'نسبة القسط المتناقص مطلوبة' });
    }
  });

export type AssetCreateBody = z.infer<typeof assetCreateSchema>;

/** Draft assets accept every field; active assets only descriptive + estimate fields. */
export const assetUpdateSchema = z.object({
  ...Object.fromEntries(Object.entries(assetDescriptive).map(([k, s]) => [k, s.optional()])),
  usefulLifeMonths: z.coerce.number().int().min(1).max(1200).optional(),
  salvageValue: money.optional(),
  depreciationMethod: z.enum(METHODS).optional(),
  decliningRate: percent.optional().nullable(),
  code: text(30).optional().nullable(),
  categoryId: id.optional(),
  acquisitionType: z.enum(['PURCHASE', 'EXISTING']).optional(),
  acquisitionDate: isoDate.optional(),
  inServiceDate: isoDate.optional(),
  cost: money.optional(),
  vatAmount: money.optional(),
  openingAccumulatedDepreciation: money.optional(),
  openingDepreciatedThrough: isoDate.optional().nullable(),
  assetAccountId: optionalId,
  accumulatedDepreciationAccountId: optionalId,
  depreciationExpenseAccountId: optionalId,
  creditAccountId: optionalId,
  supplierId: optionalId,
  version: z.coerce.number().int().min(1),
});

export type AssetUpdateBody = z.infer<typeof assetUpdateSchema>;

export const assetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED']).optional(),
  categoryId: id.optional(),
  branchId: id.optional(),
});

// ── Depreciation runs ───────────────────────────────────────────────────────

/** Any date inside the month to depreciate through. */
export const runPeriodSchema = z.object({
  periodEnd: isoDate,
  notes: text(1000).optional().nullable(),
});

// ── Disposals ───────────────────────────────────────────────────────────────

export const disposalBodySchema = z
  .object({
    assetId: id,
    disposalType: z.enum(['SALE', 'SCRAP']),
    disposalDate: isoDate,
    proceeds: money.default(0),
    /** Output VAT on the sale, credited to the company VAT account. */
    vatAmount: money.default(0),
    proceedsAccountId: optionalId,
    customerId: optionalId,
    notes: text(1000).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.disposalType === 'SCRAP' && (v.proceeds > 0 || v.vatAmount > 0)) {
      ctx.addIssue({ code: 'custom', path: ['proceeds'], message: 'الاستبعاد بدون بيع لا يكون له متحصلات' });
    }
    if (v.disposalType === 'SALE' && v.proceeds + v.vatAmount > 0 && !v.customerId && !v.proceedsAccountId) {
      ctx.addIssue({ code: 'custom', path: ['proceedsAccountId'], message: 'حدد العميل أو حساب المتحصلات' });
    }
  });

export type DisposalBody = z.infer<typeof disposalBodySchema>;

export const movementReportQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  categoryId: id.optional(),
});
