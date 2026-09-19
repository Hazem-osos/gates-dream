'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Banknote, MoreVertical, Package, Scale } from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import {
  CompactFormField,
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
import { MasterCardShell, ErpFormHeaderCard, erpFormGridClass } from '@/components/erp';
import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';
import { toast } from '@/lib/feedback/toast';
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
  const [openDate, setOpenDate] = useState('2025-11-26');
  const [closeDate, setCloseDate] = useState('2025-11-26');
  const [shipDate, setShipDate] = useState('2025-11-26');
  const [arriveDate, setArriveDate] = useState('2025-11-26');
  const [shippingPort, setShippingPort] = useState('');
  const [billOfLading, setBillOfLading] = useState('');
  const [taxEntry, setTaxEntry] = useState('');
  const [entry, setEntry] = useState('');
  const [lcStep, setLcStep] = useState<number | null>(null);
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('value');
  const [expenses, setExpenses] = useState<ExpenseLine[]>(DEFAULT_EXPENSES);
  const [goods, setGoods] = useState<GoodsLine[]>(DEFAULT_GOODS);

  const currentStepIndex = lcStep ?? (approvalStatus === 'closed' ? 4 : 0);
  const lcValue = parseNum(approvalValue);
  const localEquivalent = lcValue * (parseNum(exchangeRate) || 1);
  const expenseTotal = useMemo(
    () => expenses.reduce((sum, line) => sum + parseNum(line.amount), 0),
    [expenses]
  );

  const allocatedGoods = useMemo(() => {
    const sumBases = goods.reduce((sum, line) => {
      const qty = parseNum(line.qty);
      const weight = parseNum(line.weight);
      const unitCost = parseNum(line.unitCost);
      return sum + (allocationMethod === 'weight' ? qty * weight : qty * unitCost);
    }, 0);

    return goods.map((line) => {
      const qty = parseNum(line.qty);
      const weight = parseNum(line.weight);
      const unitCost = parseNum(line.unitCost);
      const originalTotal = qty * unitCost;
      const base = allocationMethod === 'weight' ? qty * weight : originalTotal;
      const allocatedExtra =
        allocationMethod === 'manual'
          ? parseNum(line.manualExtra)
          : sumBases > 0
            ? expenseTotal * (base / sumBases)
            : 0;
      const finalTotal = originalTotal + allocatedExtra;
      return {
        ...line,
        allocatedExtra,
        finalUnitCost: qty > 0 ? finalTotal / qty : unitCost,
      };
    });
  }, [goods, allocationMethod, expenseTotal]);

  const resetNew = () => {
    setSerial('');
    setSupplier('');
    setAccount('');
    setCostCenter('');
    setDescription('');
    setApprovalStatus('closed');
    setApprovalNumber('');
    setApprovalValue('');
    setCurrency('جنية مصري');
    setExchangeRate('1');
    setShippingMethod('بحري');
    setPaymentMethod('فيزا');
    setShippingPort('');
    setBillOfLading('');
    setTaxEntry('');
    setEntry('');
    setLcStep(null);
    setAllocationMethod('value');
    setExpenses(DEFAULT_EXPENSES);
    setGoods(DEFAULT_GOODS);
  };

  return (
    <MasterCardShell
      title="اعتماد مستندي"
      breadcrumbs={[
        { label: 'الاستيراد والتصدير', href: '/importexport' },
        { label: 'الاعتمادات' },
        { label: 'اعتماد مستندي' },
      ]}
      docNumber={serial || approvalNumber || 'جديد'}
      statusLabel={approvalStatus === 'open' ? 'مفتوح' : 'مغلق'}
      onSave={() => {
        toast.success('تم الحفظ');
        resetNew();
      }}
      onNew={resetNew}
      favoriteHref="/importexport/accreditations/documentary-credit"
      extraActions={
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
      }
      moreMenuItems={[
        { id: 'preview', label: 'معاينة', onClick: () => toast.message('المعاينة') },
        { id: 'design', label: 'تصميم', onClick: () => toast.message('التصميم') },
      ]}
    >
      <section className="mb-3 rounded-xl border border-slate-200/80 bg-white p-3">
        <WorkflowStepper
          steps={[...LC_STEPS]}
          currentIndex={currentStepIndex}
          onStepClick={(index) => setLcStep(index)}
        />
      </section>

      <section className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#0E79AA]/20 bg-gradient-to-l from-[#0E79AA0D] to-white p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E79AA] text-white">
            <Banknote className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold text-slate-500">الالتزام المالي للاعتماد</p>
            <p className="text-xl font-bold tabular-nums text-[#0E79AA]">
              {approvalValue.trim() ? formatNum(lcValue) : '—'}{' '}
              <span className="text-sm font-medium text-slate-600">{currency}</span>
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-white px-4 py-2">
          <p className="text-[11px] font-medium text-slate-500">المعادل المحلي</p>
          <p className="text-lg font-bold tabular-nums text-slate-900">
            {formatNum(localEquivalent)} <span className="text-sm font-medium">ج.م</span>
          </p>
        </div>
      </section>

      <ErpFormHeaderCard
        extrasLabel="خيارات إضافية"
        row1={
          <>
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
          </>
        }
        row2={
          <>
            <CompactFormField label="العملة">
              <select
                className={compactControlClass}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="جنية مصري">جنية مصري</option>
                <option value="دولار أمريكي">دولار أمريكي</option>
                <option value="يورو">يورو</option>
              </select>
            </CompactFormField>
            <CompactFormField
              label="سعر الصرف"
              type="number"
              min="0"
              step="0.0001"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
            />
            <CompactFormField label="طريقة الشحن">
              <select
                className={compactControlClass}
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
                className={compactControlClass}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="فيزا">فيزا</option>
                <option value="شيك">شيك</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
              </select>
            </CompactFormField>
          </>
        }
        extras={
          <div className={erpFormGridClass}>
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
            <CompactFormField
              label="الفتح"
              type="date"
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
            />
            <CompactFormField
              label="الإغلاق"
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
            />
            <CompactFormField
              label="الشحن"
              type="date"
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
            />
            <CompactFormField
              label="الوصول"
              type="date"
              value={arriveDate}
              onChange={(e) => setArriveDate(e.target.value)}
            />
          </div>
        }
      />

      <FormSectionCard title="مصفوفة توزيع التكلفة" subtitle="توزيع المصاريف على الأصناف" icon={Package}>
        <div className="col-span-full space-y-4">
          <div className="flex flex-wrap items-center gap-2">
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                          onChange={(e) =>
                            setExpenses((prev) =>
                              prev.map((row) => (row.id === line.id ? { ...row, amount: e.target.value } : row))
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className={cn(denseTrClass, 'bg-[#0E79AA0D] font-semibold')}>
                    <td className={denseTdClass}>الإجمالي</td>
                    <td className={cn(denseTdClass, 'tabular-nums text-[#0E79AA]')}>{formatNum(expenseTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4">
              <div className="text-center">
                <Scale className="mx-auto mb-2 h-8 w-8 text-[#0E79AA]" aria-hidden />
                <p className="text-sm font-semibold text-slate-700">إجمالي المصاريف للتوزيع</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[#0E79AA]">{formatNum(expenseTotal)}</p>
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
                  <th className={denseThClass}>تكلفة الوحدة</th>
                  <th className={denseThClass}>إضافي موزّع</th>
                  <th className={denseThClass}>التكلفة النهائية</th>
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
                        onChange={(e) =>
                          setGoods((prev) =>
                            prev.map((row) => (row.id === line.id ? { ...row, name: e.target.value } : row))
                          )
                        }
                      />
                    </td>
                    <td className={denseTdClass}>
                      <input
                        type="number"
                        min="0"
                        className={cn(compactControlClass, 'h-8 w-20')}
                        value={line.qty}
                        onChange={(e) =>
                          setGoods((prev) =>
                            prev.map((row) => (row.id === line.id ? { ...row, qty: e.target.value } : row))
                          )
                        }
                      />
                    </td>
                    <td className={denseTdClass}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={cn(compactControlClass, 'h-8 w-20')}
                        value={line.weight}
                        onChange={(e) =>
                          setGoods((prev) =>
                            prev.map((row) => (row.id === line.id ? { ...row, weight: e.target.value } : row))
                          )
                        }
                      />
                    </td>
                    <td className={denseTdClass}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={cn(compactControlClass, 'h-8 w-24')}
                        value={line.unitCost}
                        onChange={(e) =>
                          setGoods((prev) =>
                            prev.map((row) => (row.id === line.id ? { ...row, unitCost: e.target.value } : row))
                          )
                        }
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
                          onChange={(e) =>
                            setGoods((prev) =>
                              prev.map((row) =>
                                row.id === line.id ? { ...row, manualExtra: e.target.value } : row
                              )
                            )
                          }
                        />
                      ) : (
                        formatNum(line.allocatedExtra)
                      )}
                    </td>
                    <td className={cn(denseTdClass, 'tabular-nums font-semibold text-[#0E79AA]')}>
                      <span className="inline-flex items-center gap-1">
                        {formatNum(parseNum(line.unitCost))}
                        <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden />
                        {formatNum(line.finalUnitCost)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </FormSectionCard>

      <FormSectionCard title="حركات القيد" subtitle="عرض فقط — ليست جدول إدخال">
        <div className="col-span-full space-y-3">
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
          <div className="flex flex-wrap items-center gap-4">
            <CompactFormField
              label="القيد"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              className="w-40"
            />
            <DebitCreditTotals debit={25.4456} credit={27.4456} className="flex-1" />
          </div>
        </div>
      </FormSectionCard>
    </MasterCardShell>
  );
}
