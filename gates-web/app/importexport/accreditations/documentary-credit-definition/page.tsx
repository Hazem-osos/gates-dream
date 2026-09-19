'use client';

import { Banknote } from 'lucide-react';
import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { CompactFormField, compactControlClass } from '@/components/ui';
import { MasterCardShell, ErpFormHeaderCard, erpFormGridClass } from '@/components/erp';
import { toast } from '@/lib/feedback/toast';
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

const EMPTY = {
  serialNumber: '',
  supplier: '',
  description: '',
  shippingPort: '',
  creditValue: '',
  creditNumber: '',
  currency: 'جنية مصري',
  shippingMethod: 'بحري',
  paymentMethod: 'فيزا',
  openingDate: '2025-11-26',
  closingDate: '2025-11-26',
  shippingDate: '2025-11-26',
};

export default function DocumentaryCreditDefinitionPage() {
  useBackendReachability();
  const [form, setForm] = useState(EMPTY);
  const patch = (next: Partial<typeof EMPTY>) => setForm((prev) => ({ ...prev, ...next }));
  const resetNew = () => setForm(EMPTY);
  const commitmentValue = parseNum(form.creditValue);

  return (
    <MasterCardShell
      title="تعريف الإعتماد المستندي"
      breadcrumbs={[
        { label: 'الاستيراد والتصدير', href: '/importexport' },
        { label: 'الاعتمادات' },
        { label: 'تعريف الإعتماد المستندي' },
      ]}
      docNumber={form.serialNumber || 'جديد'}
      statusLabel={form.serialNumber ? 'تعديل' : 'جديد'}
      onSave={() => {
        toast.success('تم الحفظ');
        resetNew();
      }}
      onNew={resetNew}
      favoriteHref="/importexport/accreditations/documentary-credit-definition"
      moreMenuItems={[
        { id: 'print', label: 'طباعة', onClick: () => void printPageContent('اعتماد مستندي') },
      ]}
    >
      <section className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#0E79AA]/20 bg-gradient-to-l from-[#0E79AA0D] to-white p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E79AA] text-white">
            <Banknote className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">ملخص التزام LC</p>
            <p className="text-lg font-bold tabular-nums text-[#0E79AA]">
              {form.creditValue.trim() ? formatNum(commitmentValue) : '—'}{' '}
              <span className="text-sm font-medium text-slate-600">{form.currency}</span>
            </p>
          </div>
        </div>
        {form.creditNumber.trim() ? (
          <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-right">
            <p className="text-[11px] text-slate-500">رقم الاعتماد</p>
            <p className="text-sm font-semibold text-slate-800">{form.creditNumber}</p>
          </div>
        ) : null}
      </section>

      <ErpFormHeaderCard
        extrasLabel="خيارات إضافية"
        row1={
          <>
            <CompactFormField
              label="المسلسل"
              placeholder="إدخل رقم المسلسل"
              value={form.serialNumber}
              onChange={(e) => patch({ serialNumber: e.target.value })}
            />
            <CompactFormField
              label="المورد"
              placeholder="إدخل اسم المورد"
              value={form.supplier}
              onChange={(e) => patch({ supplier: e.target.value })}
            />
            <CompactFormField
              label="رقم الإعتماد"
              placeholder="رقم الإعتماد"
              value={form.creditNumber}
              onChange={(e) => patch({ creditNumber: e.target.value })}
            />
            <CompactFormField
              label="قيمة الإعتماد"
              placeholder="قيمة الإعتماد"
              value={form.creditValue}
              onChange={(e) => patch({ creditValue: e.target.value })}
            />
          </>
        }
        row2={
          <>
            <CompactFormField label="العملة">
              <select
                className={compactControlClass}
                value={form.currency}
                onChange={(e) => patch({ currency: e.target.value })}
              >
                <option value="جنية مصري">جنية مصري</option>
                <option value="الدولار الأمريكي">الدولار الأمريكي</option>
                <option value="اليورو">اليورو</option>
              </select>
            </CompactFormField>
            <CompactFormField
              label="الفتح"
              type="date"
              value={form.openingDate}
              onChange={(e) => patch({ openingDate: e.target.value })}
            />
            <CompactFormField
              label="الإغلاق"
              type="date"
              value={form.closingDate}
              onChange={(e) => patch({ closingDate: e.target.value })}
            />
            <CompactFormField
              label="الشحن"
              type="date"
              value={form.shippingDate}
              onChange={(e) => patch({ shippingDate: e.target.value })}
            />
          </>
        }
        extras={
          <div className={erpFormGridClass}>
            <CompactFormField
              label="الشرح"
              placeholder="إدخل الشرح"
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
            <CompactFormField
              label="ميناء الشحن"
              placeholder="إدخل اسم الميناء"
              value={form.shippingPort}
              onChange={(e) => patch({ shippingPort: e.target.value })}
            />
            <CompactFormField label="طريقة الشحن">
              <select
                className={compactControlClass}
                value={form.shippingMethod}
                onChange={(e) => patch({ shippingMethod: e.target.value })}
              >
                <option value="بحري">بحري</option>
                <option value="جوي">جوي</option>
                <option value="برى">برى</option>
              </select>
            </CompactFormField>
            <CompactFormField label="وسيلة الدفع">
              <select
                className={compactControlClass}
                value={form.paymentMethod}
                onChange={(e) => patch({ paymentMethod: e.target.value })}
              >
                <option value="فيزا">فيزا</option>
                <option value="ماستر كارد">ماستر كارد</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
              </select>
            </CompactFormField>
          </div>
        }
      />
    </MasterCardShell>
  );
}
