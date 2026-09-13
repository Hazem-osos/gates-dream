"use client";
import React from 'react';
import { ActionButtons, CompactFormField, FormSectionCard } from '@/components/ui';

interface DistributionAmountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const fields = [
  { label: 'المبلغ', type: 'number' },
  { label: 'عدد الدفعات', type: 'number' },
  { label: 'كل', type: 'number' },
  { label: 'يوم', type: 'number' },
  { label: 'الهجري', type: 'date-search' },
  { label: 'بدء من', type: 'date-search' },
  { label: 'دفعة أول', type: 'number' },
  { label: 'دفعة دورية', type: 'number' },
  { label: 'دفعة أخيرة', type: 'number' },
];

export default function DistributionAmountsModal({ isOpen, onClose }: DistributionAmountsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" style={{ direction: 'rtl' }}>
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="flex w-full max-w-2xl flex-col overflow-visible rounded-2xl border border-[#E6F0F7] bg-white shadow-2xl">
          <div className="w-full border-b border-[#E6F0F7] p-5 text-center">
            <h2 className="text-lg font-bold text-[#0A3D5E]">توزيع المبالغ</h2>
          </div>
          <div className="w-full p-5 pb-2">
            <FormSectionCard title="بيانات التوزيع" className="mb-0" bodyClassName="lg:grid-cols-2">
              {fields.map((field) => (
                <CompactFormField
                  key={field.label}
                  label={field.label}
                  type={field.type === 'date-search' ? 'date' : field.type}
                  defaultValue={field.type === 'date-search' ? undefined : 0}
                />
              ))}
            </FormSectionCard>
          </div>
          <div className="flex w-full items-center justify-end gap-3 border-t border-[#E6F0F7] p-4">
            <ActionButtons />
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0E78AA] text-lg font-bold text-white">?</button>
          </div>
        </div>
      </div>
    </div>
  );
}
