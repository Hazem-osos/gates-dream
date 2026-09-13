'use client';

import { ActionButtons, CompactFormField, FormSectionCard } from '@/components/ui';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function EndorsePaymentModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" style={{ direction: 'rtl' }}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="إغلاق" onClick={onClose} />
      <div className="relative flex w-full max-w-xl flex-col rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-[#0A3D5E]">تظهير ورقة مقبوضات</h2>
        <FormSectionCard title="بيانات التظهير" bodyClassName="lg:grid-cols-2">
          <CompactFormField label="المظهَّر إليه" placeholder="اسم المستفيد الجديد" className="sm:col-span-2 lg:col-span-2" />
          <CompactFormField label="تاريخ التظهير" type="date" />
          <CompactFormField label="الشرح" placeholder="إدخل الشرح" className="sm:col-span-2 lg:col-span-2" />
        </FormSectionCard>
        <div className="mt-2 flex justify-end">
          <ActionButtons />
        </div>
      </div>
    </div>
  );
}
