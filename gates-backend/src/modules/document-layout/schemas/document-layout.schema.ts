import { z } from 'zod';

export const DOCUMENT_LAYOUT_TYPES = [
  'ALL',
  'CONTRACTOR_INVOICE',
  'REAL_ESTATE_RECEIPT',
  'TAX_INVOICE',
  'DEBIT_NOTE',
  'PAYMENT_SCHEDULE',
] as const;

/** API aliases accepted from the frontend / Module A wording. */
export const DOCUMENT_LAYOUT_TYPE_ALIASES: Record<string, (typeof DOCUMENT_LAYOUT_TYPES)[number]> = {
  SUBCONTRACT_INVOICE: 'CONTRACTOR_INVOICE',
  MOSTAKHLAS: 'CONTRACTOR_INVOICE',
};

export function normalizeDocumentLayoutType(value: string | undefined | null): (typeof DOCUMENT_LAYOUT_TYPES)[number] | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  if ((DOCUMENT_LAYOUT_TYPES as readonly string[]).includes(upper)) {
    return upper as (typeof DOCUMENT_LAYOUT_TYPES)[number];
  }
  return DOCUMENT_LAYOUT_TYPE_ALIASES[upper] ?? null;
}

export const DOCUMENT_LAYOUT_PRESETS = [
  'LIGHT',
  'BUBBLE',
  'WAVE',
  'CORPORATE_DUAL',
  'MINIMAL_BORDER',
  'ARCHITECTURAL_GRID',
] as const;

export const DOCUMENT_TABLE_STYLES = [
  'LIGHT',
  'BOXED',
  'STRIPED',
  'BUBBLE',
  'COMPACT',
  'BORDERLESS',
] as const;

export const DOCUMENT_PAPER_SIZES = ['A4', 'LETTER', 'A5_LANDSCAPE'] as const;

export const DOCUMENT_MARGIN_SIZES = ['COMPACT_8MM', 'NORMAL_15MM', 'WIDE_20MM'] as const;

export const DOCUMENT_LOGO_POSITIONS = ['LEFT', 'CENTER', 'RIGHT'] as const;

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Invalid hex color');

export const bankDetailEntrySchema = z.object({
  bankName: z.string().max(150),
  accountName: z.string().max(150).optional().nullable(),
  accountNumber: z.string().max(60).optional().nullable(),
  iban: z.string().max(60).optional().nullable(),
  swift: z.string().max(30).optional().nullable(),
});

export const columnSettingsSchema = z
  .object({
    showRetention: z.boolean().optional(),
    showAdvanceDeductions: z.boolean().optional(),
    showUnitDetails: z.boolean().optional(),
    showOverhead: z.boolean().optional(),
    showMultiCurrency: z.boolean().optional(),
    showWht: z.boolean().optional(),
    showSocialInsurance: z.boolean().optional(),
    showMaterialScrap: z.boolean().optional(),
    showPenalties: z.boolean().optional(),
    showDirectExecution: z.boolean().optional(),
    showEarlyPay: z.boolean().optional(),
  })
  .partial();

const documentTypeInput = z
  .string()
  .transform((value, ctx) => {
    const normalized = normalizeDocumentLayoutType(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid documentType' });
      return z.NEVER;
    }
    return normalized;
  });

export const documentLayoutConfigUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120).default('تخطيط'),
  isDefault: z.boolean().optional(),
  branchId: z.string().uuid().optional().nullable(),
  documentType: documentTypeInput.default('ALL'),
  layoutPreset: z.enum(DOCUMENT_LAYOUT_PRESETS).default('LIGHT'),
  tableStyle: z.enum(DOCUMENT_TABLE_STYLES).default('LIGHT'),
  fontFamily: z.string().trim().min(1).max(60).default('Cairo'),
  primaryColor: hexColor.default('#1e293b'),
  secondaryColor: hexColor.default('#64748b'),
  textColor: hexColor.default('#0f172a'),
  paperSize: z.enum(DOCUMENT_PAPER_SIZES).default('A4'),
  marginSize: z.enum(DOCUMENT_MARGIN_SIZES).default('NORMAL_15MM'),
  logoUrl: z.string().max(2_000_000).optional().nullable(),
  logoPosition: z.enum(DOCUMENT_LOGO_POSITIONS).default('LEFT'),
  logoWidth: z.coerce.number().int().min(40).max(400).default(150),
  companyNameAr: z.string().trim().max(200).optional().nullable(),
  companyNameEn: z.string().trim().max(200).optional().nullable(),
  taxId: z.string().trim().max(60).optional().nullable(),
  commercialReg: z.string().trim().max(60).optional().nullable(),
  tagline: z.string().trim().max(200).optional().nullable(),
  footerText: z.string().max(4000).optional().nullable(),
  bankDetails: z.array(bankDetailEntrySchema).max(10).optional().nullable(),
  showQrCode: z.boolean().default(true),
  showStampAndSignatures: z.boolean().default(true),
  signatureLabels: z.array(z.string().max(80)).max(8).optional().nullable(),
  watermarkText: z.string().trim().max(60).optional().nullable(),
  columnSettings: columnSettingsSchema.optional().nullable(),
});

export type DocumentLayoutConfigUpsertInput = z.infer<typeof documentLayoutConfigUpsertSchema>;

export const documentLayoutQuerySchema = z.object({
  documentType: documentTypeInput.optional(),
  branchId: z.string().uuid().optional(),
});

export const documentLayoutResolveQuerySchema = z.object({
  documentType: documentTypeInput,
  branchId: z.string().uuid().optional(),
});

export const documentLayoutTypeParamSchema = z.object({
  documentType: documentTypeInput,
});
