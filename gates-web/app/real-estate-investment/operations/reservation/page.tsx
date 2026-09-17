'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { FormSectionCard, CompactFormField, compactControlClass } from '@/components/ui';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';
import type { ApiError } from '@/lib/api/types';

type LookupRow = {
  id: string;
  arabicName?: string;
  englishName?: string;
  code?: string;
};

const emptyForm = () => ({
  propertyId: '',
  customerId: '',
  reservationDate: '',
  reservationAmount: '',
  notes: '',
  expiryDate: '',
});

export default function ReservationPage() {
  const invalidateQuery = useInvalidateQuery();
  const [formData, setFormData] = useState(emptyForm);

  const { data: propertiesResponse } = useApiQuery<LookupRow[]>(
    ['properties'],
    '/real-estate/properties',
    { limit: 1000, isActive: true }
  );
  const properties = propertiesResponse?.data || [];

  const { data: customersResponse } = useApiQuery<LookupRow[]>(
    ['real-estate-customers'],
    '/accounting/customers',
    { limit: 1000, isActive: true }
  );
  const customers = customersResponse?.data || [];

  const reservationMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/real-estate/reservations',
    'POST',
    {
      onSuccess: () => {
        toast.success('تم حفظ الحجز بنجاح');
        invalidateQuery(['reservations']);
        handleNew();
      },
      onError: (error: ApiError) => {
        toast.error(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, reservationDate: today }));
  }, []);

  const patch = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.propertyId) {
      toast.error('يرجى اختيار العقار');
      return;
    }
    if (!formData.customerId) {
      toast.error('يرجى اختيار العميل');
      return;
    }
    if (!formData.reservationDate) {
      toast.error('يرجى تحديد تاريخ الحجز');
      return;
    }
    reservationMutation.mutate({
      propertyId: formData.propertyId,
      customerId: formData.customerId,
      reservationDate: new Date(formData.reservationDate).toISOString(),
      reservationAmount: formData.reservationAmount ? parseFloat(formData.reservationAmount) : undefined,
      notes: formData.notes || undefined,
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : undefined,
    });
  };

  const handleNew = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({ ...emptyForm(), reservationDate: today });
  };

  return (
    <MasterCardShell
      title="الحجز"
      breadcrumbs={[
        { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
        { label: 'الحجز' },
      ]}
      favoriteHref="/real-estate-investment/operations/reservation"
      onSave={handleSave}
      savePending={reservationMutation.isPending}
      onNew={handleNew}
    >
      <FormSectionCard title="بيانات الحجز" subtitle="العقار والعميل وتاريخ الحجز" icon={CalendarCheck}>
        <CompactFormField label="العقار">
          <select className={compactControlClass} value={formData.propertyId} onChange={(e) => patch('propertyId', e.target.value)}>
            <option value="">اختر العقار</option>
            {properties.map((prop) => (
              <option key={prop.id} value={prop.id}>
                {prop.code || prop.arabicName || prop.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="العميل">
          <select className={compactControlClass} value={formData.customerId} onChange={(e) => patch('customerId', e.target.value)}>
            <option value="">اختر العميل</option>
            {customers.map((cust) => (
              <option key={cust.id} value={cust.id}>
                {cust.arabicName || cust.code || cust.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <DatePickerWithHijri label="تاريخ الحجز" value={formData.reservationDate} onChange={(v) => patch('reservationDate', v)} />
        <DatePickerWithHijri label="تاريخ الانتهاء" value={formData.expiryDate} onChange={(v) => patch('expiryDate', v)} />
        <CompactFormField
          label="مبلغ الحجز"
          type="number"
          value={formData.reservationAmount}
          onChange={(e) => patch('reservationAmount', e.target.value)}
          placeholder="إدخل مبلغ الحجز"
        />
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
