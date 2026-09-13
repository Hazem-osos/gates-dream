'use client';

import { useCallback, useState } from 'react';
import { MessageSquarePlus, X } from 'lucide-react';
import type { InternalNoteEntry } from '@/lib/invoices/payment-split.types';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
import { Button } from '@/components/ui/button';

const TAG_PRESETS = [
  { id: 'collect', label: '⚠️ متابعة تحصيل' },
  { id: 'delivery', label: '🚚 تعليمات تسليم خاصة' },
  { id: 'mgmt', label: '👤 خاص بالإدارة' },
] as const;

function newNoteId() {
  return crypto.randomUUID();
}

type Props = {
  notes: InternalNoteEntry[];
  onChange: (notes: InternalNoteEntry[]) => void;
  disabled?: boolean;
  className?: string;
};

function NotesEditorBody({
  notes,
  onChange,
  disabled,
  onDone,
}: Props & { onDone?: () => void }) {
  const { displayName } = useCurrentUserProfile();
  const [draft, setDraft] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const toggleTag = (label: string) => {
    setActiveTags((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  };

  const addNote = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    const now = new Date().toISOString();
    const entry: InternalNoteEntry = {
      id: newNoteId(),
      body,
      tags: activeTags.length ? [...activeTags] : undefined,
      authorName: displayName || 'مستخدم',
      createdAt: now,
    };
    onChange([entry, ...notes]);
    setDraft('');
    setActiveTags([]);
  }, [draft, activeTags, displayName, notes, onChange]);

  return (
    <div className="space-y-3" data-internal-notes="">
      <p className="text-sm text-slate-600">لا تظهر هذه الملاحظات للعميل أو على الطباعة.</p>
      <div className="flex flex-wrap gap-1.5">
        {TAG_PRESETS.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => toggleTag(t.label)}
            className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${
              activeTags.includes(t.label)
                ? 'border-[#0E78AA] bg-[#E3F6FC] text-[#094C6B]'
                : 'border-[#D6EAF3] bg-white text-slate-700 hover:bg-[#F6FBFD]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        className="min-h-[100px] w-full resize-y rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] p-3 text-sm text-gray-800 focus:border-[#0E78AA] focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/20 disabled:opacity-60"
        placeholder="اكتب ملاحظة للفريق…"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={disabled || !draft.trim()}
          onClick={addNote}
        >
          إضافة ملاحظة
        </Button>
        {onDone ? (
          <Button type="button" variant="outline" size="sm" onClick={onDone}>
            تم
          </Button>
        ) : null}
      </div>
      {notes.length > 0 ? (
        <ul className="max-h-52 space-y-2 overflow-y-auto border-t border-[#E6F0F7] pt-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-[#E6F0F7] bg-white p-2.5 text-sm text-gray-800"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-[#094C6B]">{n.authorName ?? '—'}</span>
                <span>{new Date(n.createdAt).toLocaleString('ar-EG')}</span>
                {n.tags?.map((tag) => (
                  <span key={tag} className="rounded bg-[#E3F6FC] px-1.5 py-0.5 text-[#094C6B]">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">لا توجد ملاحظات بعد.</p>
      )}
    </div>
  );
}

export function InternalNotesScratchpad({ notes, onChange, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const count = notes.length;

  return (
    <>
      <div className={className ?? 'flex justify-end'}>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="gap-2 shadow-sm font-semibold"
          onClick={() => setOpen(true)}
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          ملاحظات داخلية
          {count > 0 ? (
            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-xs">
              {count}
            </span>
          ) : null}
        </Button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="internal-notes-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-2xl"
            style={{ direction: 'rtl' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-l from-[#0E78AA] to-[#1E88E5] px-5 py-4">
              <h2 id="internal-notes-title" className="text-center text-lg font-bold text-white">
                ملاحظات داخلية
              </h2>
              <button
                type="button"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/90 hover:bg-white/10 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <NotesEditorBody
                notes={notes}
                onChange={onChange}
                disabled={disabled}
                onDone={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
