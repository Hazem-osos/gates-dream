export const DOCUMENT_CATEGORIES = [
  'GENERAL',
  'CAD_DRAWING',
  'CONSULTANT_REPORT',
  'SITE_PHOTO_DEFECT',
  'BANK_LG_STAMPED_LETTER',
  'SIGNED_INVOICE_COPY',
  'PAYMENT_RECEIPT',
  'CONTRACT_LEGAL_DOC',
  'BOQ_SPECIFICATION',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  GENERAL: 'عام',
  CAD_DRAWING: 'رسم أوتوكاد',
  CONSULTANT_REPORT: 'تقرير استشاري',
  SITE_PHOTO_DEFECT: 'صورة عيب موقعي',
  BANK_LG_STAMPED_LETTER: 'خطاب ضمان مختوم',
  SIGNED_INVOICE_COPY: 'نسخة مستخلص موقّعة',
  PAYMENT_RECEIPT: 'إيصال سداد',
  CONTRACT_LEGAL_DOC: 'مستند عقد قانوني',
  BOQ_SPECIFICATION: 'مواصفات بنود',
};

export type DocumentAttachment = {
  id: string;
  originalFileName: string;
  storedFileName: string;
  fileSize: number;
  mimeType: string;
  storageProvider: string;
  fileCategory: DocumentCategory;
  entityType: string;
  entityId: string;
  description: string | null;
  uploadedByUserId: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  subcontractId: string | null;
  subcontractInvoiceId: string | null;
  sitePenaltyId: string | null;
  materialReconciliationId: string | null;
  executiveMeasurementSheetId: string | null;
  clientContractId: string | null;
  clientInvoiceId: string | null;
  letterOfGuaranteeId: string | null;
  propertyUnitId: string | null;
  unitContractId: string | null;
};

export type AttachmentLinkFilters = {
  subcontractId?: string;
  subcontractInvoiceId?: string;
  sitePenaltyId?: string;
  materialReconciliationId?: string;
  executiveMeasurementSheetId?: string;
  clientContractId?: string;
  clientInvoiceId?: string;
  letterOfGuaranteeId?: string;
  propertyUnitId?: string;
  unitContractId?: string;
  entityType?: string;
  entityId?: string;
};

export type PresignUploadResponse = {
  attachment: DocumentAttachment;
  upload: {
    url: string;
    method: 'PUT';
    headers: Record<string, string>;
    expiresAt: string;
    uploadToken?: string;
    storageProvider: string;
  };
};
