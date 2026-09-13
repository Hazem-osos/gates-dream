import type { DocumentCategory, Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';

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
] as const satisfies readonly DocumentCategory[];

export type DocumentLinkField =
  | 'subcontractId'
  | 'subcontractInvoiceId'
  | 'sitePenaltyId'
  | 'materialReconciliationId'
  | 'executiveMeasurementSheetId'
  | 'clientContractId'
  | 'clientInvoiceId'
  | 'letterOfGuaranteeId'
  | 'propertyUnitId'
  | 'unitContractId';

export const DOCUMENT_LINK_FIELDS = [
  'subcontractId',
  'subcontractInvoiceId',
  'sitePenaltyId',
  'materialReconciliationId',
  'executiveMeasurementSheetId',
  'clientContractId',
  'clientInvoiceId',
  'letterOfGuaranteeId',
  'propertyUnitId',
  'unitContractId',
] as const satisfies readonly DocumentLinkField[];

export type DocumentEntityLinks = Partial<Record<DocumentLinkField, string>>;

export const ENTITY_TYPE_TO_LINK: Record<string, DocumentLinkField> = {
  SUBCONTRACT: 'subcontractId',
  SUBCONTRACT_INVOICE: 'subcontractInvoiceId',
  SITE_PENALTY: 'sitePenaltyId',
  MATERIAL_RECONCILIATION: 'materialReconciliationId',
  EXECUTIVE_MEASUREMENT_SHEET: 'executiveMeasurementSheetId',
  CLIENT_CONTRACT: 'clientContractId',
  CLIENT_INVOICE: 'clientInvoiceId',
  LETTER_OF_GUARANTEE: 'letterOfGuaranteeId',
  PROPERTY_UNIT: 'propertyUnitId',
  UNIT_CONTRACT: 'unitContractId',
};

export const LINK_TO_ENTITY_TYPE: Record<DocumentLinkField, string> = {
  subcontractId: 'SUBCONTRACT',
  subcontractInvoiceId: 'SUBCONTRACT_INVOICE',
  sitePenaltyId: 'SITE_PENALTY',
  materialReconciliationId: 'MATERIAL_RECONCILIATION',
  executiveMeasurementSheetId: 'EXECUTIVE_MEASUREMENT_SHEET',
  clientContractId: 'CLIENT_CONTRACT',
  clientInvoiceId: 'CLIENT_INVOICE',
  letterOfGuaranteeId: 'LETTER_OF_GUARANTEE',
  propertyUnitId: 'PROPERTY_UNIT',
  unitContractId: 'UNIT_CONTRACT',
};

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_CAD_ATTACHMENT_BYTES = 50 * 1024 * 1024;
export const PRESIGN_UPLOAD_SECONDS = 15 * 60;
export const PRESIGN_DOWNLOAD_SECONDS = 5 * 60;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/acad',
  'application/x-acad',
  'application/dxf',
  'image/vnd.dwg',
  'image/x-dwg',
  'application/octet-stream',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.ms-excel',
  'application/zip',
]);

const ALLOWED_EXT = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.dwg',
  '.dxf',
  '.docx',
  '.xlsx',
  '.doc',
  '.xls',
  '.zip',
]);

export function fileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

export function assertAllowedFile(fileName: string, mimeType: string, category: DocumentCategory): void {
  const ext = fileExtension(fileName);
  const mimeOk = ALLOWED_MIME.has(mimeType);
  const extOk = ALLOWED_EXT.has(ext);
  if (!extOk) {
    throw new AppError(400, 'امتداد الملف غير مسموح');
  }
  if (!mimeOk && ext !== '.dwg' && ext !== '.dxf') {
    throw new AppError(400, 'نوع الملف غير مسموح');
  }
  if (category === 'CAD_DRAWING' && !['.dwg', '.dxf', '.pdf'].includes(ext)) {
    throw new AppError(400, 'رسومات CAD تقبل DWG أو DXF أو PDF فقط');
  }
  if (category === 'SITE_PHOTO_DEFECT' && !mimeType.startsWith('image/')) {
    throw new AppError(400, 'صور العيوب يجب أن تكون صورة');
  }
}

export function maxBytesForCategory(category: DocumentCategory): number {
  return category === 'CAD_DRAWING' ? MAX_CAD_ATTACHMENT_BYTES : MAX_ATTACHMENT_BYTES;
}

export function linksFromInput(input: DocumentEntityLinks): DocumentEntityLinks {
  const links: DocumentEntityLinks = {};
  for (const field of DOCUMENT_LINK_FIELDS) {
    const value = input[field]?.trim();
    if (value) links[field] = value;
  }
  return links;
}

export function deriveEntityPointer(links: DocumentEntityLinks, fallback?: { entityType?: string; entityId?: string }) {
  for (const field of DOCUMENT_LINK_FIELDS) {
    const id = links[field];
    if (id) {
      return { entityType: LINK_TO_ENTITY_TYPE[field], entityId: id };
    }
  }
  return {
    entityType: fallback?.entityType ?? '',
    entityId: fallback?.entityId ?? '',
  };
}

export function toPublicAttachment(row: {
  id: string;
  originalFileName: string;
  storedFileName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageProvider: string;
  fileCategory: DocumentCategory;
  entityType: string;
  entityId: string;
  description: string | null;
  uploadedByUserId: string;
  uploadedById: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
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
}) {
  return {
    id: row.id,
    originalFileName: row.originalFileName || row.fileName,
    storedFileName: row.storedFileName || row.fileName,
    fileSize: row.fileSize,
    mimeType: row.mimeType,
    storageProvider: row.storageProvider,
    fileCategory: row.fileCategory,
    entityType: row.entityType,
    entityId: row.entityId,
    description: row.description,
    uploadedByUserId: row.uploadedByUserId || row.uploadedById,
    isArchived: row.isArchived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    subcontractId: row.subcontractId,
    subcontractInvoiceId: row.subcontractInvoiceId,
    sitePenaltyId: row.sitePenaltyId,
    materialReconciliationId: row.materialReconciliationId,
    executiveMeasurementSheetId: row.executiveMeasurementSheetId,
    clientContractId: row.clientContractId,
    clientInvoiceId: row.clientInvoiceId,
    letterOfGuaranteeId: row.letterOfGuaranteeId,
    propertyUnitId: row.propertyUnitId,
    unitContractId: row.unitContractId,
  };
}

export type AttachmentCreateData = Prisma.DocumentAttachmentUncheckedCreateInput;
