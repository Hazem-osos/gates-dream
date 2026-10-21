import type { StatusTone } from '@/components/ui/StatusBadge';

/** لم يُحفظ بعد على السيرفر (لا يوجد معرّف مستند). Never «مسودة» on saved documents. */
export const DOCUMENT_UNSAVED_LABEL = 'جديد';

/** @deprecated Use DOCUMENT_UNSAVED_LABEL — kept for serial placeholders. */
export const DOCUMENT_NEW_LABEL = 'جديد';

/** محفوظ على السيرفر ولم يُرحَّل بعد. */
export const DOCUMENT_UNPOSTED_LABEL = 'غير مرحّل';

export const DOCUMENT_POSTED_LABEL = 'مرحّل';

export const DOCUMENT_CANCELLED_LABEL = 'ملغي';

export type DocumentLifecycleInput = {
  /** Server id — null/undefined means browser-only draft. */
  documentId?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
};

export type DocumentLifecycleStatus = {
  label: string;
  tone: StatusTone;
  phase: 'unsaved' | 'unposted' | 'posted' | 'cancelled';
};

/**
 * Standard ERP voucher lifecycle (inventory, invoices, treasury, …):
 * جديد (unsaved) → غير مرحّل → مرحّل; فك الترحيل → غير مرحّل; إلغاء → ملغي.
 */
export function resolveDocumentLifecycleStatus(
  input: DocumentLifecycleInput
): DocumentLifecycleStatus {
  const hasId = Boolean(input.documentId?.trim());
  if (input.isCancelled) {
    return { label: DOCUMENT_CANCELLED_LABEL, tone: 'danger', phase: 'cancelled' };
  }
  if (input.isPosted) {
    return { label: DOCUMENT_POSTED_LABEL, tone: 'success', phase: 'posted' };
  }
  if (hasId) {
    return { label: DOCUMENT_UNPOSTED_LABEL, tone: 'warning', phase: 'unposted' };
  }
  return { label: DOCUMENT_UNSAVED_LABEL, tone: 'neutral', phase: 'unsaved' };
}

/** Status for a saved row in «السابق» lists — never مسودة, since the row exists on the server. */
export function savedDocumentRowStatus(row: {
  isPosted?: boolean | null;
  isCancelled?: boolean | null;
}): DocumentLifecycleStatus {
  return resolveDocumentLifecycleStatus({
    documentId: 'saved',
    isPosted: Boolean(row.isPosted),
    isCancelled: Boolean(row.isCancelled),
  });
}

export function unpostedDocumentStatusLabel(hasSavedId: boolean): string {
  return hasSavedId ? DOCUMENT_UNPOSTED_LABEL : DOCUMENT_UNSAVED_LABEL;
}

/** Legacy page helpers that still label saved vouchers as «مسودة» or unsaved «جديد». */
export function isLegacyDraftStatusLabel(label: string | undefined | null): boolean {
  const t = label?.trim();
  if (!t) return false;
  if (t === DOCUMENT_UNSAVED_LABEL) return true;
  if (t === DOCUMENT_NEW_LABEL) return true;
  if (/^مسودة(\s|\(|$)/.test(t)) return true;
  return false;
}

/**
 * Badge text/tone for ErpDocumentPageHeader: lifecycle wins over misleading «مسودة»
 * when the document already has a server id (e.g. after فك الترحيل).
 */
export function resolveErpDocumentHeaderBadge(
  lifecycle: DocumentLifecycleInput | undefined,
  overrideLabel?: string | null,
  overrideTone?: StatusTone | null
): { label: string; tone: StatusTone } {
  const lifecycleStatus = lifecycle ? resolveDocumentLifecycleStatus(lifecycle) : null;
  if (!lifecycleStatus) {
    return {
      label: overrideLabel?.trim() || '',
      tone: overrideTone ?? 'neutral',
    };
  }
  const override = overrideLabel?.trim();
  if (!override) {
    return { label: lifecycleStatus.label, tone: overrideTone ?? lifecycleStatus.tone };
  }
  if (lifecycleStatus.phase !== 'unsaved' && isLegacyDraftStatusLabel(override)) {
    return { label: lifecycleStatus.label, tone: overrideTone ?? lifecycleStatus.tone };
  }
  return {
    label: override,
    tone: overrideTone ?? lifecycleStatus.tone,
  };
}
