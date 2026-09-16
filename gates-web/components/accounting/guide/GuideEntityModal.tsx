'use client';

import type { ReactNode } from 'react';
import { FormStickyFooter } from '@/components/ui';

export function GuideEntityModal({
  open,
  title,
  subtitle,
  hint,
  saving,
  saveText,
  onClose,
  onSave,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  hint?: string;
  saving?: boolean;
  saveText?: string;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-label="إغلاق" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl" dir="rtl">
        <div className="p-6 pb-0">
          <h2 className="mb-1 text-xl font-bold text-[#0E79AA]">{title}</h2>
          {subtitle ? <p className="mb-1 text-sm text-slate-500">{subtitle}</p> : null}
          {hint ? <p className="mb-4 text-xs text-[#0E79AA]">{hint}</p> : subtitle ? <div className="mb-3" /> : null}
          {children}
        </div>
        <FormStickyFooter
          onCancel={onClose}
          onSave={onSave}
          saveLoading={saving}
          cancelText="إلغاء"
          saveText={saveText}
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
