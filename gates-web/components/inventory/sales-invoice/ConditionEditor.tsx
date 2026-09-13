'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';
import { ActionButtons } from '@/components/ui/ActionButtons';

type ConditionEditorProps = {
  conditions: string[];
  onConditionsChange: (next: string[]) => void;
  printTermsInputProps: UseFormRegisterReturn;
  paymentTermsMethodInputProps: UseFormRegisterReturn;
  onClose: () => void;
};

/** Invoice terms/conditions editor — loaded only when the user opens the modal. */
export function ConditionEditor({
  conditions,
  onConditionsChange,
  printTermsInputProps,
  paymentTermsMethodInputProps,
  onClose,
}: ConditionEditorProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="w-[700px] max-w-[95vw] overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-2xl"
        style={{ direction: 'rtl' }}
      >
        <div className="relative bg-gradient-to-l from-[#0E78AA] to-[#1E88E5] px-8 py-6">
          <h3 className="text-center text-2xl font-bold text-white">الشروط</h3>
          <button
            type="button"
            onClick={onClose}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-xl text-white/90 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-8 p-8">
          <div className="space-y-2">
            <label className="text-base font-semibold text-[#0A3D5E]">طريقة الدفع</label>
            <input
              type="text"
              className="w-full rounded-lg border border-[#D6EAF3] bg-white p-3 text-base text-gray-700 focus:border-[#0E78AA] focus:ring-2 focus:ring-[#0E78AA]/20"
              placeholder="شيك بنكي 60 يوم، تحويل فوري…"
              {...paymentTermsMethodInputProps}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-[#0E78AA] focus:ring-[#0E78AA]"
              {...printTermsInputProps}
            />
            <span className="text-base font-semibold text-[#0A3D5E]">طباعة الشروط والأحكام على الفاتورة</span>
          </label>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-base font-semibold text-[#0A3D5E]">الشروط</label>
              <button
                type="button"
                onClick={() => onConditionsChange([...conditions, `الشرط ${conditions.length + 1}`])}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E78AA] text-white transition-colors hover:bg-[#0A5F8A]"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => {
                      const next = [...conditions];
                      next[index] = e.target.value;
                      onConditionsChange(next);
                    }}
                    className="flex-1 rounded-lg border border-[#D6EAF3] bg-white p-3 text-base text-gray-700 focus:border-[#0E78AA] focus:ring-2 focus:ring-[#0E78AA]/20"
                    placeholder={`الشرط ${index + 1}`}
                  />
                  {conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onConditionsChange(conditions.filter((_, i) => i !== index))}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500 text-white transition-colors hover:bg-red-600"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end bg-gray-50 px-8 py-4">
          <ActionButtons
            onCancel={onClose}
            onSave={() => {
              onConditionsChange(conditions.map((c) => c.trim()).filter(Boolean));
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
