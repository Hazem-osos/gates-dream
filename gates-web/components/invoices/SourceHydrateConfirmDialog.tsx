'use client';

type Props = {
  open: boolean;
  sourceLabel: string;
  sourceNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SourceHydrateConfirmDialog({
  open,
  sourceLabel,
  sourceNumber,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4" dir="rtl">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-xl"
      >
        <h2 className="text-base font-bold text-[#0A3D5E]">استبدال بيانات الفاتورة</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          هل تريد استبدال البيانات والسطور الحالية ببيانات {sourceLabel} رقم {sourceNumber}؟
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-[#0E79AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0c6a96]"
          >
            استبدال
          </button>
        </div>
      </div>
    </div>
  );
}
