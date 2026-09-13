"use client";
import React from 'react';
import { ActionButtons, CompactFormField, FormSectionCard } from '@/components/ui';

interface ReturnPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReturnPaymentModal({ isOpen }: ReturnPaymentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" style={{ direction: 'rtl' }}>
      <div className="flex w-full max-w-2xl flex-col rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 className="mb-4 text-lg font-bold text-[#0A3D5E]">ارتداد الورقة</h2>
        <FormSectionCard title="بيانات الرد" bodyClassName="lg:grid-cols-2">
          <CompactFormField label="الشرح" placeholder="إدخل الشرح" className="sm:col-span-2 lg:col-span-2" />
          <CompactFormField label="التاريخ" type="date" />
        </FormSectionCard>
        <div className="mt-2 flex justify-end">
          <ActionButtons />
        </div>
      </div>
    </div>
  );
}
