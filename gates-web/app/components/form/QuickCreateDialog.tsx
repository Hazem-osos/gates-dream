'use client';

import React from 'react';
import { ActionButtons } from '@/components/ui';

type QuickCreateDialogProps = {
  open: boolean;
  title: string;
  titleId: string;
  children: React.ReactNode;
  error?: string;
  saving?: boolean;
  saveDisabled?: boolean;
  onClose: () => void;
  onSave: () => void;
};

export function QuickCreateDialog({
  open,
  title,
  titleId,
  children,
  error,
  saving,
  saveDisabled,
  onClose,
  onSave,
}: QuickCreateDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 id={titleId} className="mb-4 text-lg font-bold text-[#0A3D5E]">
          {title}
        </h2>
        {children}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-3">
          <ActionButtons
            onCancel={onClose}
            onSave={onSave}
            saveText={saving ? 'جاري الحفظ…' : 'حفظ'}
            cancelText="إلغاء"
            saveDisabled={Boolean(saving || saveDisabled)}
          />
        </div>
      </div>
    </div>
  );
}

export function QuickCreateKindChooser({
  open,
  title = 'إضافة جديد',
  options,
  onClose,
  onPick,
}: {
  open: boolean;
  title?: string;
  options: { id: string; label: string }[];
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-kind-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 id="quick-kind-title" className="mb-4 text-lg font-bold text-[#0A3D5E]">
          {title}
        </h2>
        <p className="mb-3 text-sm text-slate-600">اختر نوع السجل المراد إضافته</p>
        <div className="grid gap-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-2.5 text-right font-semibold text-[#094C6B] hover:border-[#0E78AA] hover:bg-[#EEF7FB]"
              onClick={() => onPick(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
          onClick={onClose}
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
