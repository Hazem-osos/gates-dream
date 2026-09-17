'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MasterCardShell } from '@/components/erp';
import { CompactFormField, AdvancedFieldsSection, FormSectionCard } from '@/components/ui';
import { toast } from '@/lib/feedback/toast';

const radioClass =
  'inline-flex cursor-pointer items-center rounded-full border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D5E] has-[:checked]:border-[#0E78AA] has-[:checked]:bg-[#0E78AA] has-[:checked]:text-white';

const crumbs = [
  { label: 'الاستثمار العقاري', href: '/real-estate-investment' },
  { label: 'وحدة للبيع للغير' },
];

export default function UnitSaleOthers() {
  useBackendReachability();

  return (
    <MasterCardShell
      title="تعريف وحدة للبيع للغير"
      breadcrumbs={crumbs}
      favoriteHref="/real-estate-investment/create/unit-sale-others"
      onSave={() => toast.success('تم الحفظ')}
      extraActions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm">أرشفة</Button>
          <Button type="button" variant="secondary" size="sm">ترحيل للبيع</Button>
        </div>
      }
      moreMenuItems={[{ id: 'cancel-res', label: 'إلغاء الحجز', destructive: true, onClick: () => toast.success('تم إلغاء الحجز') }]}
    >
      <FormSectionCard title="البيانات الأساسية" subtitle="هوية الوحدة والمساحات وسعر البيع" icon={Home}>
        <CompactFormField label="الإسم العربي" placeholder="إدخل الإسم بالعربي" />
        <CompactFormField label="الكود" placeholder="إدخل رقم الكود" />
        <CompactFormField label="عنوان الوحدة" placeholder="إدخل عنوان الوحدة" />
        <CompactFormField label="المساحة" placeholder="إدخل المساحة بالارقام" />
        <CompactFormField label="عدد الغرف" placeholder="إدخل العدد بالارقام" />
        <CompactFormField label="الدور" placeholder="إدخل الدور بالارقام" />
        <CompactFormField label="عدد الحمامات" placeholder="إدخل العدد بالارقام" />
        <CompactFormField label="المالك" placeholder="إدخل الإسم بالعربي" />
        <CompactFormField label="سعر البيع" placeholder="0,00" />
        <CompactFormField label="نوع المعاملة" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            <label className={radioClass}>
              <input type="radio" name="dealType" className="sr-only" defaultChecked />
              بيع للغير
            </label>
            <label className={radioClass}>
              <input type="radio" name="dealType" className="sr-only" />
              إعادة بيع
            </label>
          </div>
        </CompactFormField>
        <CompactFormField label="نوع الدفع" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            <label className={radioClass}>
              <input type="radio" name="payType" className="sr-only" defaultChecked />
              كاش
            </label>
            <label className={radioClass}>
              <input type="radio" name="payType" className="sr-only" />
              قسط
            </label>
          </div>
        </CompactFormField>
      </FormSectionCard>

      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CompactFormField label="تليفون 1" placeholder="إدخل رقم التليفون" />
          <CompactFormField label="تليفون 2" placeholder="إدخل رقم التليفون" />
          <CompactFormField label="العنوان" placeholder="إدخل العنوان" />
          <CompactFormField label="الإيميل" placeholder="إدخل البريد الإلكتروني" />
          <CompactFormField label="عدد السنوات" placeholder="0,00" />
          <CompactFormField label="الإجمالي" placeholder="0,00" />
          <CompactFormField label="الواجهة" placeholder="0,00" />
          <CompactFormField label="دفعة مقدمة" placeholder="0,00" />
          <CompactFormField label="دفعة سنوية" placeholder="0,00" />
          <CompactFormField label="عدد الشهور" placeholder="إدخل العدد بالارقام" />
          <CompactFormField label="رقم الوحدة" placeholder="0,00" />
          <CompactFormField label="سعر المتر" placeholder="0,00" />
          <CompactFormField label="التشطيب" className="sm:col-span-2 lg:col-span-3">
            <div className="flex flex-wrap gap-2">
              <label className={radioClass}>
                <input type="radio" name="finishType" className="sr-only" defaultChecked />
                تشطيب كامل
              </label>
              <label className={radioClass}>
                <input type="radio" name="finishType" className="sr-only" />
                نصف تشطيب
              </label>
              <label className={radioClass}>
                <input type="radio" name="finishType" className="sr-only" />
                بدون
              </label>
            </div>
          </CompactFormField>
          <CompactFormField label="الإستلام" className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              <label className={radioClass}>
                <input type="radio" name="deliveryType" className="sr-only" defaultChecked />
                إستلام فوري
              </label>
              <label className={radioClass}>
                <input type="radio" name="deliveryType" className="sr-only" />
                إستلام لاحق
              </label>
            </div>
          </CompactFormField>
        </div>
      </AdvancedFieldsSection>
    </MasterCardShell>
  );
}
