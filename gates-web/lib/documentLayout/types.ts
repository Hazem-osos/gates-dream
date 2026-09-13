/**
 * Document Layout & Print Customization Engine — shared frontend types.
 * Mirrors `gates-backend/prisma/schema.prisma#DocumentLayoutConfig` and
 * `gates-backend/src/modules/document-layout/schemas/document-layout.schema.ts`.
 * Keep both sides in sync when adding a field.
 */

export type DocumentLayoutType =
  | 'ALL'
  | 'CONTRACTOR_INVOICE'
  | 'REAL_ESTATE_RECEIPT'
  | 'TAX_INVOICE'
  | 'DEBIT_NOTE'
  | 'PAYMENT_SCHEDULE';

export type DocumentLayoutPreset =
  | 'LIGHT'
  | 'BUBBLE'
  | 'WAVE'
  | 'CORPORATE_DUAL'
  | 'MINIMAL_BORDER'
  | 'ARCHITECTURAL_GRID';

export type DocumentTableStyle = 'LIGHT' | 'BOXED' | 'STRIPED' | 'BUBBLE' | 'COMPACT' | 'BORDERLESS';

export type DocumentPaperSize = 'A4' | 'LETTER' | 'A5_LANDSCAPE';

export type DocumentMarginSize = 'COMPACT_8MM' | 'NORMAL_15MM' | 'WIDE_20MM';

export type DocumentLogoPosition = 'LEFT' | 'CENTER' | 'RIGHT';

export interface BankDetailEntry {
  bankName: string;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
}

export interface DocumentColumnSettings {
  showRetention?: boolean;
  showAdvanceDeductions?: boolean;
  showUnitDetails?: boolean;
  showOverhead?: boolean;
  showMultiCurrency?: boolean;
  showWht?: boolean;
  showSocialInsurance?: boolean;
  showMaterialScrap?: boolean;
  showPenalties?: boolean;
  showDirectExecution?: boolean;
  showEarlyPay?: boolean;
}

export interface DocumentLayoutConfig {
  id?: string | null;
  companyId?: string;
  branchId?: string | null;
  documentType: DocumentLayoutType;
  layoutPreset: DocumentLayoutPreset;
  tableStyle: DocumentTableStyle;
  fontFamily: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  paperSize: DocumentPaperSize;
  marginSize: DocumentMarginSize;
  logoUrl?: string | null;
  logoPosition: DocumentLogoPosition;
  logoWidth: number;
  companyNameAr?: string | null;
  companyNameEn?: string | null;
  taxId?: string | null;
  commercialReg?: string | null;
  tagline?: string | null;
  footerText?: string | null;
  bankDetails?: BankDetailEntry[] | null;
  showQrCode: boolean;
  showStampAndSignatures: boolean;
  signatureLabels?: string[] | null;
  watermarkText?: string | null;
  columnSettings?: DocumentColumnSettings | null;
  createdAt?: string;
  updatedAt?: string;
}

export const FONT_FAMILY_OPTIONS: Array<{ value: string; label: string; stack: string; googleFont?: string }> = [
  { value: 'Cairo', label: 'Cairo — القاهرة', stack: "'Cairo', 'Segoe UI', sans-serif", googleFont: 'Cairo:wght@400;500;600;700;800' },
  { value: 'Alexandria', label: 'Alexandria — الإسكندرية', stack: "'Alexandria', 'Segoe UI', sans-serif", googleFont: 'Alexandria:wght@400;500;600;700;800' },
  { value: 'Tajawal', label: 'Tajawal — تجول', stack: "'Tajawal', 'Segoe UI', sans-serif", googleFont: 'Tajawal:wght@400;500;700;800' },
  { value: 'Inter', label: 'Inter', stack: "'Inter', 'Segoe UI', sans-serif", googleFont: 'Inter:wght@400;500;600;700' },
  { value: 'Roboto', label: 'Roboto', stack: "'Roboto', 'Segoe UI', sans-serif", googleFont: 'Roboto:wght@400;500;700' },
];

export const LAYOUT_PRESET_OPTIONS: Array<{ value: DocumentLayoutPreset; label: string; hint: string }> = [
  { value: 'LIGHT', label: 'بسيط (Light)', hint: 'رأس نظيف بخط رفيع، مناسب لجميع المستندات' },
  { value: 'BUBBLE', label: 'فقاعي (Bubble)', hint: 'شرائح مستديرة وألوان ناعمة للعناوين' },
  { value: 'WAVE', label: 'متموج (Wave)', hint: 'فاصل رأس متموج بلون العلامة التجارية' },
  { value: 'CORPORATE_DUAL', label: 'مؤسسي مزدوج (Corporate Dual)', hint: 'شريط رأس ثنائي اللون بمظهر رسمي' },
  { value: 'MINIMAL_BORDER', label: 'حدود بسيطة (Minimal Border)', hint: 'حدود شعرية فقط بدون تعبئة ألوان' },
  { value: 'ARCHITECTURAL_GRID', label: 'شبكي هندسي (Architectural Grid)', hint: 'مظهر مخططات هندسية — مثالي للمستخلصات' },
];

export const TABLE_STYLE_OPTIONS: Array<{ value: DocumentTableStyle; label: string }> = [
  { value: 'LIGHT', label: 'خفيف' },
  { value: 'BOXED', label: 'محاط بحدود' },
  { value: 'STRIPED', label: 'مخطط (صفوف متبادلة)' },
  { value: 'BUBBLE', label: 'فقاعي' },
  { value: 'COMPACT', label: 'مضغوط' },
  { value: 'BORDERLESS', label: 'بدون حدود' },
];

export const PAPER_SIZE_OPTIONS: Array<{ value: DocumentPaperSize; label: string }> = [
  { value: 'A4', label: 'A4 (210×297مم)' },
  { value: 'LETTER', label: 'Letter (216×279مم)' },
  { value: 'A5_LANDSCAPE', label: 'A5 عرضي (210×148مم)' },
];

export const MARGIN_SIZE_OPTIONS: Array<{ value: DocumentMarginSize; label: string; mm: number }> = [
  { value: 'COMPACT_8MM', label: 'ضيق (8مم)', mm: 8 },
  { value: 'NORMAL_15MM', label: 'عادي (15مم)', mm: 15 },
  { value: 'WIDE_20MM', label: 'واسع (20مم)', mm: 20 },
];

export const LOGO_POSITION_OPTIONS: Array<{ value: DocumentLogoPosition; label: string }> = [
  { value: 'LEFT', label: 'يسار' },
  { value: 'CENTER', label: 'وسط' },
  { value: 'RIGHT', label: 'يمين' },
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentLayoutType, string> = {
  ALL: 'كل المستندات (الافتراضي العام)',
  CONTRACTOR_INVOICE: 'مستخلصات مقاولي الباطن',
  REAL_ESTATE_RECEIPT: 'إيصالات أقساط عقارية',
  TAX_INVOICE: 'الفاتورة الضريبية',
  DEBIT_NOTE: 'إشعار الخصم',
  PAYMENT_SCHEDULE: 'جدول سداد الأقساط',
};

/** Live-preview mock document kinds (right panel switcher). */
export type PreviewMockKind = 'CONTRACTOR_INVOICE' | 'REAL_ESTATE_RECEIPT' | 'TAX_INVOICE' | 'DEBIT_NOTE';

export const PREVIEW_MOCK_LABELS: Record<PreviewMockKind, string> = {
  CONTRACTOR_INVOICE: 'مستخلص مقاول باطن',
  REAL_ESTATE_RECEIPT: 'إيصال قسط عقاري',
  TAX_INVOICE: 'فاتورة ضريبية',
  DEBIT_NOTE: 'إشعار خصم',
};

/** API aliases accepted by GET/PUT /document-layouts/:documentType */
export const DOCUMENT_LAYOUT_TYPE_ALIASES: Record<string, DocumentLayoutType> = {
  SUBCONTRACT_INVOICE: 'CONTRACTOR_INVOICE',
  MOSTAKHLAS: 'CONTRACTOR_INVOICE',
};

export function normalizeDocumentLayoutType(value: string | undefined | null): DocumentLayoutType | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  const known: DocumentLayoutType[] = [
    'ALL',
    'CONTRACTOR_INVOICE',
    'REAL_ESTATE_RECEIPT',
    'TAX_INVOICE',
    'DEBIT_NOTE',
    'PAYMENT_SCHEDULE',
  ];
  if (known.includes(upper as DocumentLayoutType)) return upper as DocumentLayoutType;
  return DOCUMENT_LAYOUT_TYPE_ALIASES[upper] ?? null;
}
