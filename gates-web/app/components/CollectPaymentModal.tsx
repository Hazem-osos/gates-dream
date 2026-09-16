"use client";
import React from 'react';
import { ActionButtons, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';

interface CollectPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CollectPaymentModal({ isOpen }: CollectPaymentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" style={{ direction: 'rtl' }}>
      <div className="flex w-full max-w-4xl flex-col rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-[#0A3D5E]">تحصيل الورقة</h2>
        <FormSectionCard title="بيانات التحصيل" bodyClassName="lg:grid-cols-2">
          <CompactFormField label="الشرح" placeholder="إدخل الشرح" />
          <CompactFormField label="التاريخ" type="date" />
          <CompactFormField label="الحساب" className="sm:col-span-2 lg:col-span-2">
            <div className="flex gap-2">
              <input type="text" className={compactControlClass} value="1212378971212" readOnly />
              <input
                type="text"
                className={compactControlClass}
                value="البنك الأهلي جاري مصري، فرع السادات"
                readOnly
              />
            </div>
          </CompactFormField>
          <CompactFormField label="مركز التكلفة" className="sm:col-span-2 lg:col-span-2">
            <div className="flex gap-2">
              <input type="text" className={compactControlClass} value="1212378971212" readOnly />
              <input type="text" className={compactControlClass} value="مركز التكلفة" readOnly />
            </div>
          </CompactFormField>
          <CompactFormField label="المبلغ" placeholder="إدخل المبلغ" />
          <CompactFormField label="العمولة" />
          <CompactFormField label="ج. العمولة" className="sm:col-span-2 lg:col-span-2">
            <div className="flex gap-2">
              <input type="text" className={compactControlClass} value=" " readOnly />
              <input
                type="text"
                className={compactControlClass}
                value="البنك الأهلي جاري مصري، فرع السادات"
                readOnly
              />
            </div>
          </CompactFormField>
          <CompactFormField label="مركز التكلفة" className="sm:col-span-2 lg:col-span-2">
            <div className="flex gap-2">
              <input type="text" className={compactControlClass} value="1212378971212" readOnly />
              <input type="text" className={compactControlClass} value="مركز التكلفة" readOnly />
            </div>
          </CompactFormField>
          <label className="flex items-center gap-2 sm:col-span-2 lg:col-span-2">
            <input type="checkbox" className="h-4 w-4 rounded border-[#0E78AA]/50 text-[#0E78AA]" />
            <span className="text-xs font-semibold text-[#094C6B]">دفع العمولة من حساب في البنك</span>
          </label>
        </FormSectionCard>
        <div className="mt-2 flex justify-end">
          <ActionButtons />
        </div>
      </div>
    </div>
  );
}
