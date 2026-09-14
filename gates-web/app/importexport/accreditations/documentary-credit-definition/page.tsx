'use client';

import { Banknote, FileText } from 'lucide-react';
import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { UserPermissions } from '@/components/ui/UserPermissions';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import { printPageContent } from '@/lib/print/printHtml';

function parseNum(value: string): number {
  const n = parseFloat(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function formatNum(value: number): string {
  return value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function DocumentaryCreditDefinitionPage() {
  useBackendReachability();

  const [serialNumber, setSerialNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [description, setDescription] = useState('');
  const [shippingPort, setShippingPort] = useState('');
  const [creditValue, setCreditValue] = useState('');
  const [creditNumber, setCreditNumber] = useState('');
  const [currency, setCurrency] = useState('جنية مصري');
  const [shippingMethod, setShippingMethod] = useState('بحري');
  const [paymentMethod, setPaymentMethod] = useState('فيزا');
  const [openingDate, setOpeningDate] = useState('26-11-2025');
  const [closingDate, setClosingDate] = useState('26-11-2025');
  const [shippingDate, setShippingDate] = useState('26-11-2025');

  const selectCls = compactControlClass;
  const commitmentValue = parseNum(creditValue);

  const advancedFilledCount = [
    description,
    shippingPort,
    openingDate,
    closingDate,
    shippingDate,
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6" dir="rtl" data-print-root="">
      <PageHeader
        title="تعريف الإعتماد المستندي"
        breadcrumbs={[
          { label: 'الاستيراد والتصدير', href: '/importexport' },
          { label: 'الاعتمادات' },
          { label: 'تعريف الإعتماد المستندي' },
        ]}
        actions={<UserPermissions />}
      />

      <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#0E79AA]/20 bg-gradient-to-l from-[#0E79AA0D] to-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E79AA] text-white">
            <Banknote className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">ملخص التزام LC</p>
            <p className="text-lg font-bold tabular-nums text-[#0E79AA]">
              {creditValue.trim() ? formatNum(commitmentValue) : '—'}{' '}
              <span className="text-sm font-medium text-slate-600">{currency}</span>
            </p>
          </div>
        </div>
        {creditNumber.trim() ? (
          <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-right">
            <p className="text-[11px] text-slate-500">رقم الاعتماد</p>
            <p className="text-sm font-semibold text-slate-800">{creditNumber}</p>
          </div>
        ) : null}
      </section>

      <FormSectionCard
        title="البيانات الأساسية"
        icon={FileText}
        subtitle="تعريف الاعتماد المستندي"
      >
        <CompactFormField
          label="المسلسل"
          placeholder="إدخل رقم المسلسل"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
        />
        <CompactFormField
          label="المورد"
          placeholder="إدخل اسم المورد"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
        <CompactFormField
          label="رقم الإعتماد"
          placeholder="رقم الإعتماد"
          value={creditNumber}
          onChange={(e) => setCreditNumber(e.target.value)}
        />
        <CompactFormField
          label="قيمة الإعتماد"
          placeholder="قيمة الإعتماد"
          value={creditValue}
          onChange={(e) => setCreditValue(e.target.value)}
        />
        <CompactFormField label="العملة">
          <select
            className={selectCls}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="جنية مصري">جنية مصري</option>
            <option value="الدولار الأمريكي">الدولار الأمريكي</option>
            <option value="اليورو">اليورو</option>
          </select>
        </CompactFormField>
      </FormSectionCard>

      <AdvancedFieldsSection badgeCount={advancedFilledCount}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CompactFormField
            label="الشرح"
            placeholder="إدخل الشرح"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <CompactFormField
            label="ميناء الشحن"
            placeholder="إدخل اسم الميناء"
            value={shippingPort}
            onChange={(e) => setShippingPort(e.target.value)}
          />
          <CompactFormField label="طريقة الشحن">
            <select
              className={selectCls}
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value)}
            >
              <option value="بحري">بحري</option>
              <option value="جوي">جوي</option>
              <option value="برى">برى</option>
            </select>
          </CompactFormField>
          <CompactFormField label="وسيلة الدفع">
            <select
              className={selectCls}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="فيزا">فيزا</option>
              <option value="ماستر كارد">ماستر كارد</option>
              <option value="تحويل بنكي">تحويل بنكي</option>
            </select>
          </CompactFormField>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CompactFormField
            label="الفتح"
            type="date"
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
          />
          <CompactFormField
            label="الإغلاق"
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
          />
          <CompactFormField
            label="الشحن"
            type="date"
            value={shippingDate}
            onChange={(e) => setShippingDate(e.target.value)}
          />
        </div>
      </AdvancedFieldsSection>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <CrudButtons />
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-[#0E79AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6188]"
          >
            <span className="text-lg leading-none">✕</span>
            إلغاء
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-[#0E79AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6188]"
            onClick={() => void printPageContent('اعتماد مستندي')}
          >
            <span className="text-lg leading-none">🖨️</span>
            طباعة
          </button>
        </div>
        <ActionButtons />
      </div>
    </div>
  );
}
