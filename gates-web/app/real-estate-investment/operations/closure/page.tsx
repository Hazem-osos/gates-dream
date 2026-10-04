'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileCheck } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { FormSectionCard, CompactFormField, compactControlClass } from '@/components/ui';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { queryKeys } from '@/lib/query/query-keys';

type LookupRow = {
  id: string;
  arabicName?: string;
  englishName?: string;
  code?: string;
  unitCode?: string;
  status?: string;
};

const emptyForm = () => ({
  unitId: '',
  customerId: '',
  closureDate: '',
  salePrice: '',
  paymentMethod: '',
  notes: '',
});

export default function ClosurePage() {
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();
  const [formData, setFormData] = useState(emptyForm);
  const [pending, setPending] = useState(false);

  const { data: customersResponse } = useApiQuery<LookupRow[]>(
    ['real-estate-customers'],
    '/accounting/customers',
    { limit: 1000, isActive: true }
  );
  const customers = customersResponse?.data || [];

  const { data: unitsResponse } = useApiQuery<LookupRow[]>(
    ['real-estate-units'],
    '/real-estate/units',
    { limit: 500 }
  );
  const units = unitsResponse?.data || [];

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, closureDate: today }));
  }, []);

  const patch = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.unitId) {
      toast.error('يرجى اختيار الوحدة');
      return;
    }
    if (!formData.customerId) {
      toast.error('يرجى اختيار العميل');
      return;
    }
    if (!formData.closureDate) {
      toast.error('يرجى تحديد تاريخ الإقفال');
      return;
    }
    if (!formData.salePrice) {
      toast.error('يرجى إدخال سعر البيع');
      return;
    }
    const salePrice = parseFloat(formData.salePrice);
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      toast.error('سعر البيع غير صالح');
      return;
    }

    setPending(true);
    try {
      const contractRes = await apiClient.post<{ id: string }>('/real-estate/contracts', {
        unitId: formData.unitId,
        customerId: formData.customerId,
        contractNumber: `REC-${Date.now()}`,
        contractDate: new Date(formData.closureDate).toISOString(),
        totalContractAmount: salePrice,
        downPayment: Math.min(salePrice * 0.2, salePrice),
        frequency: 'MONTHLY',
        installmentCount: 10,
      });
      const contractId = contractRes.data.id;
      await apiClient.post(`/real-estate/contracts/${contractId}/post-contract`);
      toast.success('تم إنشاء وترحيل عقد الإقفال بنجاح');
      invalidateQuery(['closures']);
      invalidateQuery(queryKeys.realEstate.contracts());
      router.replace(`/real-estate/contracts/${contractId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'تعذر حفظ الإقفال');
    } finally {
      setPending(false);
    }
  };

  const handleNew = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({ ...emptyForm(), closureDate: today });
  };

  return (
    <MasterCardShell
      title="الإقفال"
      breadcrumbs={[
        { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
        { label: 'الإقفال' },
      ]}
      favoriteHref="/real-estate-investment/operations/closure"
      onSave={handleSave}
      savePending={pending}
      onNew={handleNew}
    >
      <FormSectionCard title="بيانات الإقفال" subtitle="ينشئ عقد وحدة ويُرحّله مباشرة" icon={FileCheck}>
        <CompactFormField label="الوحدة" required>
          <select className={compactControlClass} value={formData.unitId} onChange={(e) => patch('unitId', e.target.value)}>
            <option value="">اختر الوحدة</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitCode || u.code || u.id} {u.status ? `(${u.status})` : ''}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="العميل" required>
          <select className={compactControlClass} value={formData.customerId} onChange={(e) => patch('customerId', e.target.value)}>
            <option value="">اختر العميل</option>
            {customers.map((cust) => (
              <option key={cust.id} value={cust.id}>
                {cust.arabicName || cust.code || cust.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <DatePickerWithHijri label="تاريخ الإقفال" value={formData.closureDate} onChange={(v) => patch('closureDate', v)} />
        <CompactFormField
          label="سعر البيع"
          type="number"
          value={formData.salePrice}
          onChange={(e) => patch('salePrice', e.target.value)}
          placeholder="إدخل سعر البيع"
        />
        <CompactFormField label="طريقة الدفع">
          <select className={compactControlClass} value={formData.paymentMethod} onChange={(e) => patch('paymentMethod', e.target.value)}>
            <option value="">اختر طريقة الدفع</option>
            <option value="cash">نقدي</option>
            <option value="bank">بنكي</option>
            <option value="installment">تقسيط</option>
          </select>
        </CompactFormField>
        <CompactFormField label="ملاحظات" className="sm:col-span-2">
          <textarea
            value={formData.notes}
            onChange={(e) => patch('notes', e.target.value)}
            className={`${compactControlClass} h-24 resize-none`}
            placeholder="أدخل الملاحظات هنا..."
          />
        </CompactFormField>
      </FormSectionCard>
    </MasterCardShell>
  );
}
