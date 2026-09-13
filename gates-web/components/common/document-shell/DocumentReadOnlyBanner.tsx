'use client';

import { useOptionalDocumentMode } from './DocumentModeContext';

export function DocumentReadOnlyBanner() {
  const mode = useOptionalDocumentMode();
  if (!mode?.isReadOnly) return null;
  return (
    <div className="mb-3 rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-2.5 text-sm text-[#0A3D5E]">
      المستند في وضع العرض فقط. للتعديل، اضغط على <strong>تعديل</strong> من قائمة الإجراءات (...).
    </div>
  );
}
