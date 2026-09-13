'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { AI_DOCUMENT_CATEGORIES, uploadAiKnowledgeDocument } from '@/lib/ai/upload-document';

type Props = {
  category?: string;
  referenceId?: string;
  title?: string;
  compact?: boolean;
  showCategorySelect?: boolean;
  variant?: 'default' | 'icon';
};

export function AiKnowledgeUploadButton({
  category = 'CONTRACT',
  referenceId,
  title,
  compact = false,
  showCategorySelect = true,
  variant = 'default',
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docCategory, setDocCategory] = useState(category);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const iconOnly = variant === 'icon';

  return (
    <div className={iconOnly ? 'relative flex items-center' : 'flex flex-wrap items-center gap-2'}>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setUploading(true);
          setNote(null);
          try {
            const res = await uploadAiKnowledgeDocument({
              file,
              category: docCategory,
              referenceId,
              title,
            });
            setNote(`تم فهرسة «${res.data?.title ?? file.name}» (${res.data?.totalChunks ?? 0} مقطع)`);
          } catch (err) {
            setNote(err instanceof Error ? err.message : 'تعذّر رفع المستند');
          } finally {
            setUploading(false);
          }
        }}
      />
      {!iconOnly && showCategorySelect ? (
        <select
          value={docCategory}
          onChange={(event) => setDocCategory(event.target.value)}
          className="h-8 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-2 text-[11px] text-[#094C6B]"
        >
          {AI_DOCUMENT_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={
          iconOnly
            ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-[#0E79AA] disabled:opacity-50'
            : 'inline-flex h-8 items-center gap-1 rounded-lg border border-[#D6EAF3] px-2 text-[11px] text-[#0E79AA] hover:bg-[#DEEFF6] disabled:opacity-50'
        }
        title="إرفاق عقد أو مستند PDF للتحليل"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        {iconOnly || compact ? null : 'رفع مستند'}
      </button>
      {note ? (
        <p className={iconOnly ? 'sr-only' : 'text-[11px] text-[#094C6B]'}>{note}</p>
      ) : null}
    </div>
  );
}
