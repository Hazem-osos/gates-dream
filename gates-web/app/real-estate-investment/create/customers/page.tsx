'use client';

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { MasterCardShell } from '@/components/erp';
import { FormSectionCard, CompactFormField, compactControlClass } from '@/components/ui';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';
import type { ApiError } from '@/lib/api/types';

const emptyForm = () => ({
  code: '',
  arabicName: '',
  englishName: '',
  address: '',
  contactDate: '',
  gender: '',
  averagePrice: '',
  phone1: '',
  phone2: '',
  email: '',
  role: '',
  marketingChannel: '',
  roomsCount: '',
  area: '',
  bathroomsCount: '',
  facade: '',
  transferTo: 'بائع',
  employee: '',
  followUpDate: '',
});

const crumbs = [
  { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
  { label: 'العملاء' },
];

export default function CustomersPage() {
  const invalidateQuery = useInvalidateQuery();
  const [formData, setFormData] = useState(emptyForm);

  const saveMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/real-estate/customer-followup',
    'POST',
    {
      onSuccess: () => {
        toast.success('تم حفظ بيانات العميل بنجاح');
        invalidateQuery(['customer-followup']);
        handleNew();
      },
      onError: (error: ApiError) => {
        toast.error(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, contactDate: today, followUpDate: today }));
  }, []);

  const patch = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.arabicName) {
      toast.error('يرجى إدخال الاسم العربي');
      return;
    }
    saveMutation.mutate({
      code: formData.code || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      address: formData.address || undefined,
      followupDate: formData.followUpDate ? new Date(formData.followUpDate).toISOString() : undefined,
      notes: formData.address || undefined,
    });
  };

  const handleNew = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({ ...emptyForm(), contactDate: today, followUpDate: today });
  };

  return (
    <MasterCardShell
      title="تعريف العملاء"
      breadcrumbs={crumbs}
      favoriteHref="/real-estate-investment/create/customers"
      onSave={handleSave}
      savePending={saveMutation.isPending}
      onNew={handleNew}
    >
      <FormSectionCard title="البيانات الأساسية" subtitle="بيانات العميل والمتابعة" icon={User}>
        <CompactFormField label="الكود" value={formData.code} onChange={(e) => patch('code', e.target.value)} placeholder="إدخل رقم الكود" />
        <CompactFormField label="الإسم العربي" value={formData.arabicName} onChange={(e) => patch('arabicName', e.target.value)} placeholder="إدخل الإسم بالعربي" />
        <CompactFormField label="الإسم الإنجليزي" value={formData.englishName} onChange={(e) => patch('englishName', e.target.value)} placeholder="إدخل الإسم الإنجليزي" />
        <CompactFormField label="العنوان" value={formData.address} onChange={(e) => patch('address', e.target.value)} />
        <DatePickerWithHijri label="تاريخ الاتصال" value={formData.contactDate} onChange={(v) => patch('contactDate', v)} />
        <DatePickerWithHijri label="تاريخ المتابعة" value={formData.followUpDate} onChange={(v) => patch('followUpDate', v)} />
        <CompactFormField label="الجنس">
          <select className={compactControlClass} value={formData.gender} onChange={(e) => patch('gender', e.target.value)}>
            <option value="">اختر الجنس</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
        </CompactFormField>
        <CompactFormField label="متوسط السعر" value={formData.averagePrice} onChange={(e) => patch('averagePrice', e.target.value)} />
        <CompactFormField label="تليفون 1" value={formData.phone1} onChange={(e) => patch('phone1', e.target.value)} placeholder="إدخل رقم التليفون" />
        <CompactFormField label="تليفون 2" value={formData.phone2} onChange={(e) => patch('phone2', e.target.value)} placeholder="إدخل رقم التليفون" />
        <CompactFormField label="الإيميل" value={formData.email} onChange={(e) => patch('email', e.target.value)} placeholder="إدخل الإيميل" />
        <CompactFormField label="الدور">
          <select className={compactControlClass} value={formData.role} onChange={(e) => patch('role', e.target.value)}>
            <option value="">اختر الدور</option>
            <option value="الأول">الأول</option>
            <option value="الثاني">الثاني</option>
            <option value="الثالث">الثالث</option>
          </select>
        </CompactFormField>
        <CompactFormField label="قناة التسويق" value={formData.marketingChannel} onChange={(e) => patch('marketingChannel', e.target.value)} />
        <CompactFormField label="عدد الغرف">
          <select className={compactControlClass} value={formData.roomsCount} onChange={(e) => patch('roomsCount', e.target.value)}>
            <option value="">اختر عدد الغرف</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4+">4+</option>
          </select>
        </CompactFormField>
        <CompactFormField label="المساحة" value={formData.area} onChange={(e) => patch('area', e.target.value)} placeholder="إدخل المساحة" />
        <CompactFormField label="عدد الحمامات">
          <select className={compactControlClass} value={formData.bathroomsCount} onChange={(e) => patch('bathroomsCount', e.target.value)}>
            <option value="">اختر عدد الحمامات</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3+">3+</option>
          </select>
        </CompactFormField>
        <CompactFormField label="الواجهة" value={formData.facade} onChange={(e) => patch('facade', e.target.value)} />
        <CompactFormField label="الموظف" value={formData.employee} onChange={(e) => patch('employee', e.target.value)} />
        <CompactFormField label="التحويل إلى" className="sm:col-span-2">
          <div className="flex flex-wrap gap-4 pt-1">
            {['بائع', 'مدير مبيعات'].map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-[#094C6B]">
                <input
                  type="radio"
                  name="transferTo"
                  value={opt}
                  checked={formData.transferTo === opt}
                  onChange={(e) => patch('transferTo', e.target.value)}
                  className="accent-[#0E78AA]"
                />
                {opt}
              </label>
            ))}
          </div>
        </CompactFormField>
      </FormSectionCard>
    </MasterCardShell>
  );
}
