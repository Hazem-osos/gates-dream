'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { CompactFormField, FormSectionCard } from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { toast } from '@/lib/feedback/toast';

const EMPTY = {
  supplier: '',
  alertDays: 1,
  outgoingGuarantee: false,
  incomingGuarantee: false,
  guaranteeCheck: false,
};

export default function LetterOfGuaranteeSettingsPage() {
  useBackendReachability();
  const [form, setForm] = useState(EMPTY);
  const patch = (next: Partial<typeof EMPTY>) => setForm((prev) => ({ ...prev, ...next }));

  return (
    <MasterCardShell
      title="إعدادات خطاب الضمان"
      breadcrumbs={[
        { label: 'الاستيراد والتصدير', href: '/importexport' },
        { label: 'الاعتمادات' },
        { label: 'إعدادات خطاب الضمان' },
      ]}
      docNumber="إعدادات"
      statusLabel="إعدادات"
      onSave={() => toast.success('تم حفظ الإعدادات')}
      favoriteHref="/importexport/accreditations/letter-of-guarantee-settings"
    >
      <FormSectionCard title="حساب الضمانات" subtitle="الحساب ومهلة الإنذار" icon={Shield}>
        <CompactFormField
          label="حساب الضمانات"
          className="sm:col-span-2"
          placeholder="إدخل إسم المورد"
          value={form.supplier}
          onChange={(e) => patch({ supplier: e.target.value })}
        />
        <CompactFormField
          label="إنشاء إنذار قبل عدد من الأيام يساوي"
          type="number"
          min="1"
          value={form.alertDays}
          onChange={(e) => patch({ alertDays: parseInt(e.target.value, 10) || 1 })}
        />
      </FormSectionCard>

      <FormSectionCard title="قيود الخطاب" subtitle="متى لا يُنشأ قيد تلقائي">
        <label className="flex items-center gap-3 text-sm text-[#094C6B]">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-[#0E78AA] focus:ring-[#0E78AA]"
            checked={form.outgoingGuarantee}
            onChange={(e) => patch({ outgoingGuarantee: e.target.checked })}
          />
          خطاب الضمان الصادر لا يولد قيد
        </label>
        <label className="flex items-center gap-3 text-sm text-[#094C6B]">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-[#0E78AA] focus:ring-[#0E78AA]"
            checked={form.incomingGuarantee}
            onChange={(e) => patch({ incomingGuarantee: e.target.checked })}
          />
          خطاب الضمان الوارد لا يولد قيد
        </label>
        <label className="flex items-center gap-3 text-sm text-[#094C6B]">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-[#0E78AA] focus:ring-[#0E78AA]"
            checked={form.guaranteeCheck}
            onChange={(e) => patch({ guaranteeCheck: e.target.checked })}
          />
          شيك الضمان لا يولد قيد
        </label>
      </FormSectionCard>
    </MasterCardShell>
  );
}
