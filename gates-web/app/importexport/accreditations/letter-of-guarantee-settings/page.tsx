'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { ActionButtons } from '@/components/ui/ActionButtons';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
} from '@/components/ui';

export default function LetterOfGuaranteeSettingsPage() {
  useBackendReachability();

  const [supplier, setSupplier] = useState('');
  const [alertDays, setAlertDays] = useState(1);
  const [outgoingGuarantee, setOutgoingGuarantee] = useState(false);
  const [incomingGuarantee, setIncomingGuarantee] = useState(false);
  const [guaranteeCheck, setGuaranteeCheck] = useState(false);

  const advancedFilledCount = [outgoingGuarantee, incomingGuarantee, guaranteeCheck].filter(Boolean).length;

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      <div className="mb-6">
        <div className="text-right">
          <h1 className="mb-2 text-xl font-bold text-[#0E78AA]">إعدادات خطاب الضمان</h1>
          <div className="h-1 w-full rounded bg-sky-700"></div>
        </div>
      </div>

      <FormSectionCard title="البيانات الأساسية" subtitle="حساب الضمانات ومهلة الإنذار" icon={Shield}>
        <CompactFormField
          label="حساب الضمانات"
          className="sm:col-span-2"
          placeholder="إدخل إسم المورد"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
        <CompactFormField
          label="إنشاء إنذار قبل عدد من الأيام يساوي"
          type="number"
          min="1"
          value={alertDays}
          onChange={(e) => setAlertDays(parseInt(e.target.value) || 1)}
        />
      </FormSectionCard>

      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
        <div className="grid grid-cols-1 gap-3">
          <CompactFormField label="قيود الخطاب">
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm text-[#094C6B]">
                <input
                  type="checkbox"
                  id="outgoing-guarantee"
                  className="h-4 w-4 rounded border-gray-300 text-[#0E78AA] focus:ring-[#0E78AA]"
                  checked={outgoingGuarantee}
                  onChange={(e) => setOutgoingGuarantee(e.target.checked)}
                />
                خطاب الضمان الصادر لا يولد قيد
              </label>
              <label className="flex items-center gap-3 text-sm text-[#094C6B]">
                <input
                  type="checkbox"
                  id="incoming-guarantee"
                  className="h-4 w-4 rounded border-gray-300 text-[#0E78AA] focus:ring-[#0E78AA]"
                  checked={incomingGuarantee}
                  onChange={(e) => setIncomingGuarantee(e.target.checked)}
                />
                خطاب الضمان الوارد لا يولد قيد
              </label>
              <label className="flex items-center gap-3 text-sm text-[#094C6B]">
                <input
                  type="checkbox"
                  id="guarantee-check"
                  className="h-4 w-4 rounded border-gray-300 text-[#0E78AA] focus:ring-[#0E78AA]"
                  checked={guaranteeCheck}
                  onChange={(e) => setGuaranteeCheck(e.target.checked)}
                />
                شيك الضمان لا يولد قيد
              </label>
            </div>
          </CompactFormField>
        </div>
      </AdvancedFieldsSection>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <ActionButtons />
      </div>
    </div>
  );
}
