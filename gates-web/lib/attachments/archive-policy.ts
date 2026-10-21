import type { DocumentCategory } from '@/lib/attachments/types';
import type { TransactionSettings } from '@/lib/transaction-settings/types';

export type ArchiveMandatoryMode = 'ANY' | 'ALL_CATEGORIES' | 'SELECTED_CATEGORIES';

export function parseArchiveMandatoryCategories(raw: unknown): DocumentCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is DocumentCategory => typeof v === 'string');
}

export function archivePolicyFromSettings(settings: TransactionSettings | null | undefined) {
  const requireOnSave = Boolean(settings?.archiveRequireOnSave);
  const mode = (settings?.archiveMandatoryMode ?? 'ANY') as ArchiveMandatoryMode;
  const categories = parseArchiveMandatoryCategories(settings?.archiveMandatoryCategories);
  return { requireOnSave, mode, categories };
}

export function archivePolicySatisfied(input: {
  requireOnSave: boolean;
  mode: ArchiveMandatoryMode;
  categories: DocumentCategory[];
  attachmentCategories: DocumentCategory[];
}): { ok: boolean; message?: string } {
  if (!input.requireOnSave) return { ok: true };
  if (input.attachmentCategories.length === 0) {
    return {
      ok: false,
      message: 'يجب إرفاق مستند واحد على الأقل في الأرشيف قبل الحفظ (حسب إعدادات الشاشة).',
    };
  }
  if (input.mode === 'ANY') return { ok: true };
  const present = new Set(input.attachmentCategories);
  if (input.mode === 'ALL_CATEGORIES') {
    const missing = input.categories.filter((c) => !present.has(c));
    if (missing.length > 0) {
      return {
        ok: false,
        message: 'يجب إرفاق ملف لكل نوع مستند مطلوب في الأرشيف قبل الحفظ.',
      };
    }
    return { ok: true };
  }
  if (input.mode === 'SELECTED_CATEGORIES') {
    const required = input.categories.length ? input.categories : [];
    if (!required.length) return { ok: true };
    const hasOne = required.some((c) => present.has(c));
    if (!hasOne) {
      return {
        ok: false,
        message: 'يجب إرفاق نوع مستند مطلوب واحد على الأقل في الأرشيف قبل الحفظ.',
      };
    }
  }
  return { ok: true };
}
