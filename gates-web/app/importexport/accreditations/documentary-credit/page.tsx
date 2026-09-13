'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  Banknote,
  FileText,
  MoreVertical,
  Package,
  Scale,
} from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  WorkflowStepper,
  compactControlClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { UserPermissions } from '@/components/ui/UserPermissions';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';
import { cn } from '@/lib/utils';

const LC_STEPS = [
  { id: 'open', label: 'فتح الاعتماد' },
  { id: 'docs', label: 'وصول المستندات' },
  { id: 'customs', label: 'التخليص الجمركي' },
  { id: 'receipt', label: 'استلام البضاعة' },
  { id: 'settlement', label: 'التسوية المالية' },
] as const;

type AllocationMethod = 'value' | 'weight' | 'manual';

type ExpenseLine = { id: string; label: string; amount: string };

type GoodsLine = {
  id: string;
  name: string;
  qty: string;
  weight: string;
  unitCost: string;
  manualExtra: string;
};

const DEFAULT_EXPENSES: ExpenseLine[] = [
  { id: '1', label: 'شحن بحري', amount: '8500' },
  { id: '2', label: 'تأمين', amount: '3200' },
  { id: '3', label: 'جمارك', amount: '16900' },
  { id: '4', label: 'تفريغ', amount: '1500' },
];

const DEFAULT_GOODS: GoodsLine[] = [
  { id: '1', name: 'مادة خام A', qty: '100', weight: '0.5', unitCost: '120', manualExtra: '' },
  { id: '2', name: 'مادة خام B', qty: '50', weight: '1.2', unitCost: '340', manualExtra: '' },
  { id: '3', name: 'قطع غيار', qty: '200', weight: '0.15', unitCost: '45', manualExtra: '' },
];

const JOURNAL_ROWS = [
  [1, '12-12-2024', '00012344', 'مصاريف جمارك', '16900', '0', 'سند قيد يومية', '00005757'],
  [2, '12-12-2024', '00012345', 'مصاريف شحن', '8500', '0', 'سند قيد يومية', '00005758'],
  [3, '12-12-2024', '00012346', 'مصاريف تأمين', '0', '25400', 'سند قيد يومية', '00005759'],
  [4, '12-12-2024', '00012347', 'مصاريف بنكية', '0', '20456', 'سند قيد يومية', '00005760'],
  [5, '12-12-2024', '00012348', 'مصاريف إدارية', '0', '0', 'سند قيد يومية', '00005761'],
  [6, '12-12-2024', '00012349', 'مصاريف أخرى', '0', '0', 'سند قيد يومية', '00005762'],
  [7, '12-12-2024', '00012350', 'مصاريف إضافية', '0', '0', 'سند قيد يومية', '00005763'],
] as const;

function parseNum(value: string): number {
  const n = parseFloat(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function formatNum(value: number, digits = 2): string {
  return value.toLocaleString('ar-EG', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function DocumentaryCreditPage() {
  useBackendReachability();

  const [serial, setSerial] = useState('');
  const [supplier, setSupplier] = useState('');
  const [account, setAccount] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [description, setDescription] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('closed');
  const [approvalNumber, setApprovalNumber] = useState('');
  const [approvalValue, setApprovalValue] = useState('');
  const [currency, setCurrency] = useState('جنية مصري');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [shippingMethod, setShippingMethod] = useState('بحري');
  const [paymentMethod, setPaymentMethod] = useState('فيزا');
  const [date1, setDate1] = useState('2025-11-26');
  const [date2, setDate2] = useState('2025-11-26');
  const [date3, setDate3] = useState('2025-11-26');
  const [date4, setDate4] = useState('2025-11-26');
  const [date5, setDate5] = useState('2025-11-26');
  const [date6, setDate6] = useState('2025-11-26');
  const [date7, setDate7] = useState('2025-11-26');
  const [date8, setDate8] = useState('2025-11-26');
  const [date9, setDate9] = useState('2025-11-26');
  const [date10, setDate10] = useState('2025-11-26');
  const [shippingPort, setShippingPort] = useState('');
  const [billOfLading, setBillOfLading] = useState('123455');
  const [taxEntry, setTaxEntry] = useState('');
  const [entry, setEntry] = useState('');

  const [lcStep, setLcStep] = useState<number | null>(null);
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('value');
  const [expenses, setExpenses] = useState<ExpenseLine[]>(DEFAULT_EXPENSES);
  const [goods, setGoods] = useState<GoodsLine[]>(DEFAULT_GOODS);

  const derivedStepIndex = approvalStatus === 'closed' ? 4 : 0;
  const currentStepIndex = lcStep ?? derivedStepIndex;

  const lcValue = parseNum(approvalValue);
  const rate = parseNum(exchangeRate) || 1;
  const localEquivalent = lcValue * rate;

  const expenseTotal = useMemo(
    () => expenses.reduce((sum, line) => sum + parseNum(line.amount), 0),
    [expenses]
  );

  const allocatedGoods = useMemo(() => {
    const sumBases = goods.reduce((sum, line) => {
      const qty = parseNum(line.qty);
      const weight = parseNum(line.weight);
      const unitCost = parseNum(line.unitCost);
      const base =
        allocationMethod === 'weight' ? qty * weight : qty * unitCost;
      return sum + base;
    }, 0);

    return goods.map((line) => {
      const qty = parseNum(line.qty);
      const weight = parseNum(line.weight);
      const unitCost = parseNum(line.unitCost);
      const originalTotal = qty * unitCost;
      const base =
        allocationMethod === 'weight' ? qty * weight : originalTotal;

      let allocatedExtra = 0;
      if (allocationMethod === 'manual') {
        allocatedExtra = parseNum(line.manualExtra);
      } else if (sumBases > 0) {
        allocatedExtra = expenseTotal * (base / sumBases);
      }

      const finalTotal = originalTotal + allocatedExtra;
      const finalUnitCost = qty > 0 ? finalTotal / qty : unitCost;

      return {
        ...line,
        originalTotal,
        allocatedExtra,
        finalTotal,
        finalUnitCost,
      };
    });
  }, [goods, allocationMethod, expenseTotal]);

  const advancedFilledCount = [
    account,
    costCenter,
    description,
    shippingPort,
    billOfLading,
    taxEntry,
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  const updateExpense = (id: string, amount: string) => {
    setExpenses((prev) =>
      prev.map((line) => (line.id === id ? { ...line, amount } : line))
    );
  };

  const updateGoods = (id: string, field: keyof GoodsLine, value: string) => {
    setGoods((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const selectCls = compactControlClass;

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6" dir="rtl">
      <PageHeader
        title="اعتماد مستندي"
        breadcrumbs={[
          { label: 'الاستيراد والتصدير', href: '/importexport' },
          { label: 'الاعتمادات' },
          { label: 'اعتماد مستندي' },
        ]}
        actions={<UserPermissions />}
        statusBadge={
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              approvalStatus === 'open'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            )}
          >
            {approvalStatus === 'open' ? 'مفتوح' : 'مغلق'}
          </span>
        }
      />

      <section className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <WorkflowStepper
          steps={[...LC_STEPS]}
          currentIndex={currentStepIndex}
          onStepClick={(index) => setLcStep(index)}
        />
      </section>

      <section className="mb-4 rounded-xl border border-[#0E79AA]/20 bg-gradient-to-l from-[#0E79AA0D] to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0E79AA] text-white">
              <Banknote className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-500">الالتزام المالي للاعتماد</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#0E79AA]">
                {approvalValue.trim() ? formatNum(lcValue) : '—'}{' '}
                <span className="text-base font-semibold text-slate-600">{currency}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <CompactFormField
              label="سعر الصرف"
              type="number"
              min="0"
              step="0.0001"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="w-36"
            />
            <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-2">
              <p className="text-[11px] font-medium text-slate-500">المعادل المحلي</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">
                {formatNum(localEquivalent)} <span className="text-sm font-medium">ج.م</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">حالة الاعتماد</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">فتح</span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only"
                checked={approvalStatus === 'open'}
                onChange={() => {
                  setApprovalStatus(approvalStatus === 'open' ? 'closed' : 'open');
                  setLcStep(null);
                }}
              />
              <span
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors',
                  approvalStatus === 'open' ? 'bg-[#0E79AA]' : 'bg-slate-300'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    approvalStatus === 'open' ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </span>
            </label>
            <span className="text-xs text-slate-500">غلق</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-[#0E79AA] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0B6188]"
          >
            الاعتماد
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#0E79AA] transition-colors hover:bg-[#0E79AA0D]"
          >
            تحديث
          </button>
        </div>
      </div>

      <FormSectionCard title="بيانات الاعتماد الأساسية" icon={FileText} subtitle="الحقول الرئيسية للاعتماد المستندي">
        <CompactFormField
          label="المسلسل"
          placeholder="إدخل رقم المسلسل"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <CompactFormField
          label="المورد"
          placeholder="إدخل اسم المورد"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
        <CompactFormField
          label="رقم الاعتماد"
          placeholder="إدخل رقم الاعتماد"
          value={approvalNumber}
          onChange={(e) => setApprovalNumber(e.target.value)}
        />
        <CompactFormField
          label="قيمة الاعتماد"
          placeholder="إدخل قيمة الاعتماد"
          value={approvalValue}
          onChange={(e) => setApprovalValue(e.target.value)}
        />
        <CompactFormField label="العملة">
          <select
            className={selectCls}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="جنية مصري">جنية مصري</option>
            <option value="دولار أمريكي">دولار أمريكي</option>
            <option value="يورو">يورو</option>
          </select>
        </CompactFormField>
      </FormSectionCard>

      <AdvancedFieldsSection badgeCount={advancedFilledCount}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CompactFormField
            label="الحساب"
            placeholder="إدخل رقم الحساب"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
          <CompactFormField
            label="مركز التكلفة"
            placeholder="إدخل مركز التكلفة"
            value={costCenter}
            onChange={(e) => setCostCenter(e.target.value)}
          />
          <CompactFormField
            label="الشرح"
            placeholder="إدخل الشرح"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
              <option value="شيك">شيك</option>
              <option value="تحويل بنكي">تحويل بنكي</option>
            </select>
          </CompactFormField>
          <CompactFormField
            label="ميناء الشحن"
            placeholder="إدخل اسم الميناء"
            value={shippingPort}
            onChange={(e) => setShippingPort(e.target.value)}
          />
          <CompactFormField
            label="البوليصة"
            placeholder="إدخل رقم البوليصة"
            value={billOfLading}
            onChange={(e) => setBillOfLading(e.target.value)}
          />
          <CompactFormField
            label="قيد الضريبة"
            placeholder="إدخل قيد الضريبة"
            value={taxEntry}
            onChange={(e) => setTaxEntry(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CompactFormField label="التاريخ (1)" type="date" value={date1} onChange={(e) => setDate1(e.target.value)} />
          <CompactFormField label="التاريخ (2)" type="date" value={date2} onChange={(e) => setDate2(e.target.value)} />
          <CompactFormField label="الفتح (1)" type="date" value={date3} onChange={(e) => setDate3(e.target.value)} />
          <CompactFormField label="الفتح (2)" type="date" value={date4} onChange={(e) => setDate4(e.target.value)} />
          <CompactFormField label="الإغلاق (1)" type="date" value={date5} onChange={(e) => setDate5(e.target.value)} />
          <CompactFormField label="الإغلاق (2)" type="date" value={date6} onChange={(e) => setDate6(e.target.value)} />
          <CompactFormField label="الشحن (1)" type="date" value={date7} onChange={(e) => setDate7(e.target.value)} />
          <CompactFormField label="الشحن (2)" type="date" value={date8} onChange={(e) => setDate8(e.target.value)} />
          <CompactFormField label="الوصول (1)" type="date" value={date9} onChange={(e) => setDate9(e.target.value)} />
          <CompactFormField label="الوصول (2)" type="date" value={date10} onChange={(e) => setDate10(e.target.value)} />
        </div>
      </AdvancedFieldsSection>

      <section className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <header className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-[#0E79AA]" aria-hidden />
          <h2 className="text-sm font-bold text-slate-900">مصفوفة توزيع التكلفة landed</h2>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">طريقة التوزيع:</span>
          {(
            [
              { id: 'value' as const, label: 'حسب القيمة' },
              { id: 'weight' as const, label: 'حسب الوزن' },
              { id: 'manual' as const, label: 'يدوي' },
            ] as const
          ).map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => setAllocationMethod(method.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                allocationMethod === method.id
                  ? 'bg-[#0E79AA] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              {method.label}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">المصاريف الإضافية</p>
            <div className={denseTableWrapClass}>
              <table className={denseTableClass}>
                <thead className={denseTheadClass}>
                  <tr>
                    <th className={denseThClass}>البند</th>
                    <th className={denseThClass}>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((line) => (
                    <tr key={line.id} className={denseTrClass}>
                      <td className={denseTdClass}>{line.label}</td>
                      <td className={denseTdClass}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={cn(compactControlClass, 'h-8')}
                          value={line.amount}
                          onChange={(e) => updateExpense(line.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className={cn(denseTrClass, 'bg-[#0E79AA0D] font-semibold')}>
                    <td className={denseTdClass}>الإجمالي</td>
                    <td className={cn(denseTdClass, 'tabular-nums text-[#0E79AA]')}>
                      {formatNum(expenseTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4">
            <div className="text-center">
              <Scale className="mx-auto mb-2 h-8 w-8 text-[#0E79AA]" aria-hidden />
              <p className="text-sm font-semibold text-slate-700">إجمالي المصاريف للتوزيع</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#0E79AA]">
                {formatNum(expenseTotal)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {allocationMethod === 'value'
                  ? 'يُوزَّع حسب قيمة البضاعة'
                  : allocationMethod === 'weight'
                    ? 'يُوزَّع حسب الوزن'
                    : 'إدخال يدوي لكل صنف'}
              </p>
            </div>
          </div>
        </div>

        <div className={denseTableWrapClass}>
          <table className={denseTableClass}>
            <thead className={denseTheadClass}>
              <tr>
                <th className={denseThClass}>الصنف</th>
                <th className={denseThClass}>الكمية</th>
                <th className={denseThClass}>الوزن</th>
                <th className={denseThClass}>تكلفة الوحدة الأصلية</th>
                <th className={denseThClass}>إضافي موزّع</th>
                <th className={denseThClass}>التكلفة النهائية</th>
                <th className={denseThClass}>Original → Final</th>
              </tr>
            </thead>
            <tbody>
              {allocatedGoods.map((line) => (
                <tr key={line.id} className={denseTrClass}>
                  <td className={denseTdClass}>
                    <input
                      type="text"
                      className={cn(compactControlClass, 'h-8 min-w-[8rem]')}
                      value={line.name}
                      onChange={(e) => updateGoods(line.id, 'name', e.target.value)}
                    />
                  </td>
                  <td className={denseTdClass}>
                    <input
                      type="number"
                      min="0"
                      className={cn(compactControlClass, 'h-8 w-20')}
                      value={line.qty}
                      onChange={(e) => updateGoods(line.id, 'qty', e.target.value)}
                    />
                  </td>
                  <td className={denseTdClass}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={cn(compactControlClass, 'h-8 w-20')}
                      value={line.weight}
                      onChange={(e) => updateGoods(line.id, 'weight', e.target.value)}
                    />
                  </td>
                  <td className={cn(denseTdClass, 'tabular-nums')}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={cn(compactControlClass, 'h-8 w-24')}
                      value={line.unitCost}
                      onChange={(e) => updateGoods(line.id, 'unitCost', e.target.value)}
                    />
                  </td>
                  <td className={cn(denseTdClass, 'tabular-nums')}>
                    {allocationMethod === 'manual' ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={cn(compactControlClass, 'h-8 w-24')}
                        value={line.manualExtra}
                        onChange={(e) => updateGoods(line.id, 'manualExtra', e.target.value)}
                      />
                    ) : (
                      formatNum(line.allocatedExtra)
                    )}
                  </td>
                  <td className={cn(denseTdClass, 'tabular-nums font-semibold text-[#0E79AA]')}>
                    {formatNum(line.finalUnitCost)}
                  </td>
                  <td className={denseTdClass}>
                    <span className="inline-flex items-center gap-1 text-xs tabular-nums text-slate-600">
                      {formatNum(parseNum(line.unitCost))}
                      <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
                      +{formatNum(line.allocatedExtra)}
                      <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
                      <span className="font-semibold text-slate-900">
                        {formatNum(line.finalUnitCost)}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <header className="mb-3">
          <h2 className="text-sm font-bold text-slate-900">حركات القيد المرتبطة بالاعتماد</h2>
          <p className="text-xs text-slate-500">عرض فقط — ليست جدول إدخال</p>
        </header>
        <div className={denseTableWrapClass}>
          <table className={denseTableClass}>
            <thead className={denseTheadClass}>
              <tr>
                <th className={denseThClass}>م</th>
                <th className={denseThClass}>التاريخ</th>
                <th className={denseThClass}>رقم القيد</th>
                <th className={denseThClass}>الشرح</th>
                <th className={denseThClass}>مدين</th>
                <th className={denseThClass}>دائن</th>
                <th className={denseThClass}>المصدر</th>
                <th className={denseThClass}>رقمه</th>
                <th className={denseThClass}>
                  <MoreVertical className="h-4 w-4" aria-hidden />
                </th>
              </tr>
            </thead>
            <tbody>
              {JOURNAL_ROWS.map((row) => (
                <tr key={row[0]} className={denseTrClass}>
                  {row.map((cell, i) => (
                    <td key={i} className={cn(denseTdClass, i === 3 ? 'text-right' : 'text-center')}>
                      {cell}
                    </td>
                  ))}
                  <td className={cn(denseTdClass, 'text-center')}>
                    <button type="button" className="rounded p-1 hover:bg-slate-100">
                      <MoreVertical className="h-4 w-4 text-slate-400" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-4">
        <CompactFormField
          label="القيد"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          className="w-40"
        />
        <DebitCreditTotals debit={25.4456} credit={27.4456} className="flex-1" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          <CrudButtons />
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-[#0E79AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6188]"
          >
            <Image src="/grommet-icons_view.svg" alt="" width={16} height={16} />
            معاينة
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-[#0E79AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B6188]"
          >
            <Image src="/iconoir_design-nib.svg" alt="" width={16} height={16} />
            تصميم
          </button>
        </div>
        <ActionButtons />
      </div>
    </div>
  );
}
