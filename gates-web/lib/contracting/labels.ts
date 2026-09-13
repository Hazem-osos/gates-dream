import type { StatusTone } from '@/components/ui/StatusBadge';
import type {
  BOQCostElementType,
  BoqItemUnit,
  ClientInvoiceStatus,
  MeasurementSheetStatus,
  ProjectBOQItemStatus,
  ProjectLgStatus,
  ProjectLgType,
  SiteStockMaterialStatus,
} from './types';

export const BOQ_UNIT_LABEL: Record<BoqItemUnit, string> = {
  M2: 'م²',
  M3: 'م³',
  TON: 'طن',
  ITEM: 'عدد',
  LM: 'م.ط',
  LS: 'مقطوعية',
};

export const BOQ_STATUS_LABEL: Record<ProjectBOQItemStatus, string> = {
  PENDING_PRICING: 'بانتظار التسعير',
  PRICED: 'مسعّر',
  APPROVED_IN_CONTRACT: 'معتمد بالعقد',
};

export const BOQ_STATUS_TONE: Record<ProjectBOQItemStatus, StatusTone> = {
  PENDING_PRICING: 'warning',
  PRICED: 'info',
  APPROVED_IN_CONTRACT: 'success',
};

export const ELEMENT_LABEL: Record<BOQCostElementType, string> = {
  MATERIAL: 'خامات',
  LABOR: 'عمالة',
  EQUIPMENT: 'معدات',
  SUBCONTRACTOR: 'مقاول باطن',
  SITE_EXPENSE: 'مصاريف موقع',
};

export const ELEMENT_TYPES: BOQCostElementType[] = [
  'MATERIAL',
  'LABOR',
  'EQUIPMENT',
  'SUBCONTRACTOR',
  'SITE_EXPENSE',
];

export const SHEET_STATUS_LABEL: Record<MeasurementSheetStatus, string> = {
  DRAFT: 'مسودة',
  SITE_ENGINEER_VERIFIED: 'مراجعة مهندس الموقع',
  CONSULTANT_APPROVED: 'معتمد استشاري',
  INVOICED_IN_EXTRACT: 'مدرج بالمستخلص',
};

export const SHEET_STATUS_TONE: Record<MeasurementSheetStatus, StatusTone> = {
  DRAFT: 'warning',
  SITE_ENGINEER_VERIFIED: 'info',
  CONSULTANT_APPROVED: 'success',
  INVOICED_IN_EXTRACT: 'neutral',
};

export const CLIENT_INVOICE_LABEL: Record<ClientInvoiceStatus, string> = {
  DRAFT: 'مسودة',
  SUBMITTED_TO_CLIENT: 'مقدم للعميل',
  CLIENT_APPROVED: 'معتمد من العميل',
  FINANCE_POSTED: 'مرحل حسابات',
  REJECTED: 'مرفوض',
  PAID: 'مدفوع',
};

export const CLIENT_INVOICE_TONE: Record<ClientInvoiceStatus, StatusTone> = {
  DRAFT: 'warning',
  SUBMITTED_TO_CLIENT: 'info',
  CLIENT_APPROVED: 'info',
  FINANCE_POSTED: 'success',
  REJECTED: 'danger',
  PAID: 'success',
};

export const SITE_STOCK_LABEL: Record<SiteStockMaterialStatus, string> = {
  STORED_ON_SITE: 'مخزّن بالموقع',
  INSTALLED_AND_DEDUCTED: 'مركّب ومخصوم',
  REJECTED: 'مرفوض',
};

export const SITE_STOCK_TONE: Record<SiteStockMaterialStatus, StatusTone> = {
  STORED_ON_SITE: 'info',
  INSTALLED_AND_DEDUCTED: 'success',
  REJECTED: 'danger',
};

export const LG_TYPE_LABEL: Record<ProjectLgType, string> = {
  BID_BOND_INITIAL: 'ابتدائي / عطاء',
  ADVANCE_PAYMENT_BOND: 'دفعة مقدمة',
  PERFORMANCE_BOND_FINAL: 'نهائي / حسن تنفيذ',
  RETENTION_RELEASE_BOND: 'بدل تأمين أعمال',
};

export const LG_STATUS_LABEL: Record<ProjectLgStatus, string> = {
  ACTIVE_ISSUED: 'ساري',
  EXTENDED: 'ممدد',
  AMENDED_VALUE: 'معدّل القيمة',
  RELEASED_RETURNED: 'مفرج عنه',
  LIQUIDATED_CONFISCATED: 'مصادر',
};

export const LG_STATUS_TONE: Record<ProjectLgStatus, StatusTone> = {
  ACTIVE_ISSUED: 'success',
  EXTENDED: 'info',
  AMENDED_VALUE: 'warning',
  RELEASED_RETURNED: 'neutral',
  LIQUIDATED_CONFISCATED: 'danger',
};
