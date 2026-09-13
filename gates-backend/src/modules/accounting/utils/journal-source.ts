import { JournalSourceType } from '@prisma/client';
import { AUTO_GL_SOURCE } from '../types/auto-gl-posting.types';

const AUTO_GL_TO_KIND: Record<string, JournalSourceType> = {
  [AUTO_GL_SOURCE.SALES_INVOICE]: JournalSourceType.SALES_INVOICE,
  [AUTO_GL_SOURCE.PURCHASE_INVOICE]: JournalSourceType.PURCHASE_INVOICE,
  [AUTO_GL_SOURCE.SALE_RETURN]: JournalSourceType.SALES_RETURN,
  [AUTO_GL_SOURCE.PURCHASE_RETURN]: JournalSourceType.PURCHASE_RETURN,
  [AUTO_GL_SOURCE.TREASURY_RECEIPT]: JournalSourceType.RECEIPT_VOUCHER,
  [AUTO_GL_SOURCE.TREASURY_PAYMENT]: JournalSourceType.PAYMENT_VOUCHER,
  [AUTO_GL_SOURCE.CONTRACTOR_EXTRACT_PAYMENT]: JournalSourceType.PAYMENT_VOUCHER,
  [AUTO_GL_SOURCE.CHECK_COLLECT]: JournalSourceType.CHEQUE_ENDORSEMENT,
  [AUTO_GL_SOURCE.CHECK_BOUNCE]: JournalSourceType.CHEQUE_ENDORSEMENT,
  [AUTO_GL_SOURCE.CHECK_ENDORSE]: JournalSourceType.CHEQUE_ENDORSEMENT,
};

const KIND_VALUES = new Set<string>(Object.values(JournalSourceType));

export function isJournalSourceKind(value: string | null | undefined): value is JournalSourceType {
  return !!value && KIND_VALUES.has(value);
}

/**
 * Resolve the display/API origin. Accepts the long `JournalSourceType` name,
 * an Auto-GL short code (`SI`, `PI`, …), or an already-set `sourceKind`.
 */
export function resolveJournalSourceKind(
  sourceType?: string | null,
  sourceKind?: string | null
): JournalSourceType {
  if (isJournalSourceKind(sourceKind)) return sourceKind;
  if (isJournalSourceKind(sourceType)) return sourceType;
  if (sourceType && AUTO_GL_TO_KIND[sourceType]) return AUTO_GL_TO_KIND[sourceType];
  return JournalSourceType.MANUAL;
}

/**
 * Persist Auto-GL short codes unchanged. Long enum names (except MANUAL)
 * are stored so listings can still map legacy rows without `sourceKind`.
 */
export function persistJournalSourceType(
  sourceType?: string | null,
  sourceKind?: JournalSourceType
): string | undefined {
  if (sourceType && AUTO_GL_TO_KIND[sourceType]) return sourceType;
  if (isJournalSourceKind(sourceType) && sourceType !== JournalSourceType.MANUAL) {
    return sourceType;
  }
  if (sourceKind && sourceKind !== JournalSourceType.MANUAL) return sourceKind;
  return undefined;
}
