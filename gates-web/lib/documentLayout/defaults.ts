import type { DocumentLayoutConfig } from './types';

/**
 * Mirrors `DOCUMENT_LAYOUT_DEFAULTS` in
 * `gates-backend/src/modules/document-layout/services/document-layout.service.ts`.
 * Used as the initial configurator state before the server value loads, and
 * as the "Reset to defaults" target.
 */
export const DEFAULT_DOCUMENT_LAYOUT_CONFIG: DocumentLayoutConfig = {
  documentType: 'ALL',
  layoutPreset: 'LIGHT',
  tableStyle: 'LIGHT',
  fontFamily: 'Cairo',
  primaryColor: '#1e293b',
  secondaryColor: '#64748b',
  textColor: '#0f172a',
  paperSize: 'A4',
  marginSize: 'NORMAL_15MM',
  logoUrl: null,
  logoPosition: 'LEFT',
  logoWidth: 150,
  companyNameAr: null,
  companyNameEn: null,
  taxId: null,
  commercialReg: null,
  tagline: null,
  footerText:
    'شكراً لتعاملكم معنا. جميع المستحقات واجبة السداد خلال 15 يوماً من تاريخ الاستلام. مستند رقم {invoice_no} — تاريخ الاستحقاق {due_date}.',
  bankDetails: [],
  showQrCode: true,
  showStampAndSignatures: true,
  signatureLabels: ['مهندس الموقع', 'الاستشاري', 'المراجعة المالية', 'المدير العام'],
  watermarkText: null,
  columnSettings: {
    showRetention: true,
    showAdvanceDeductions: true,
    showUnitDetails: true,
    showOverhead: false,
    showMultiCurrency: false,
    showWht: true,
    showSocialInsurance: true,
    showMaterialScrap: true,
    showPenalties: true,
    showDirectExecution: true,
    showEarlyPay: true,
  },
};

export function cloneDefaultConfig(): DocumentLayoutConfig {
  return JSON.parse(JSON.stringify(DEFAULT_DOCUMENT_LAYOUT_CONFIG));
}
