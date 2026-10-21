import {
  resolveDocumentLifecycleStatus,
  type DocumentLifecycleInput,
  type DocumentLifecycleStatus,
} from '@/lib/documents/document-status-labels';

export type DocumentLifecycleAction = 'new' | 'save' | 'edit' | 'post' | 'unpost' | 'restore' | 'void';

export type DocumentActionState = { enabled: boolean; hint?: string };

export type DocumentActionPolicy = Record<DocumentLifecycleAction, DocumentActionState> & {
  phase: DocumentLifecycleStatus['phase'];
};

export type DocumentActionPolicyOptions = {
  /** Opening documents stay editable after cancel. */
  allowEditWhenCancelled?: boolean;
  /** Manufacturing screens that update the posted journal in place on save. */
  allowEditWhenPosted?: boolean;
};

export const POSTED_LOCK_HINT = 'المستند مرحل ومثبت محاسبياً. فك الترحيل أولاً من قائمة (...)';
export const CANCELLED_LOCK_HINT = 'المستند ملغي. استعده أولاً من قائمة (...)';
export const DOCUMENT_UNSAVED_ACTION_HINT = 'احفظ المستند أولاً';
const UNSAVED_HINT = DOCUMENT_UNSAVED_ACTION_HINT;

const on: DocumentActionState = { enabled: true };
const off = (hint?: string): DocumentActionState => ({ enabled: false, hint });

/**
 * Single lifecycle matrix for every transaction screen (toolbar + قائمة (...)):
 * - جديد (لم يُحفظ): جديد + حفظ فقط.
 * - غير مرحّل: الكل متاح عدا فك الترحيل والاستعادة.
 * - مرحّل: جديد + فك الترحيل فقط.
 * - ملغي: جديد + استعادة فقط.
 */
export function resolveDocumentActionPolicy(
  input: DocumentLifecycleInput,
  options: DocumentActionPolicyOptions = {}
): DocumentActionPolicy {
  const { phase } = resolveDocumentLifecycleStatus(input);
  switch (phase) {
    case 'unsaved':
      return {
        phase,
        new: on,
        save: on,
        edit: off(UNSAVED_HINT),
        post: off(UNSAVED_HINT),
        unpost: off(UNSAVED_HINT),
        restore: off(UNSAVED_HINT),
        void: off(UNSAVED_HINT),
      };
    case 'unposted':
      return {
        phase,
        new: on,
        save: on,
        edit: on,
        post: on,
        unpost: off('المستند غير مرحّل'),
        restore: off('المستند غير ملغي'),
        void: on,
      };
    case 'posted':
      return {
        phase,
        new: on,
        save: options.allowEditWhenPosted ? on : off(POSTED_LOCK_HINT),
        edit: options.allowEditWhenPosted ? on : off(POSTED_LOCK_HINT),
        post: off('المستند مرحّل بالفعل'),
        unpost: on,
        restore: off('المستند غير ملغي'),
        void: off('المستند مرحل. فك الترحيل أولاً ثم ألغه'),
      };
    case 'cancelled':
      return {
        phase,
        new: on,
        save: options.allowEditWhenCancelled ? on : off(CANCELLED_LOCK_HINT),
        edit: options.allowEditWhenCancelled ? on : off('المستند ملغي ولا يمكن تعديله'),
        post: off(CANCELLED_LOCK_HINT),
        unpost: off(CANCELLED_LOCK_HINT),
        restore: on,
        void: off('المستند ملغي بالفعل'),
      };
  }
}
