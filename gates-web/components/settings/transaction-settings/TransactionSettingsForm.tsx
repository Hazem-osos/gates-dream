'use client';

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { Button } from '@/components/ui/button';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';
import {
  DOCUMENT_TYPE_TITLE,
  type CostCenterAllocationTarget,
  type CostCenterPostingSide,
  type NumberingMode,
  type PricingPolicy,
  type SequenceMode,
  type TransactionDocumentType,
  type TransactionSettings,
  canLoadSourceOrder,
  isJournalLikeDocumentType,
  isSecuritiesDocumentType,
  isTreasuryDocumentType,
} from '@/lib/transaction-settings/types';
import {
  readSalesPrintPrefs,
  writeSalesPrintPrefs,
  type DefaultPrintKind,
} from '@/lib/printer/print-prefs';
import type { ThermalRollWidth } from '@/lib/printer/types';

type SwitchRowProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
};

function SwitchRow({ checked, onChange, label, hint }: SwitchRowProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E6F0F7] bg-white px-3 py-3 hover:border-[#0E79AA]/40">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[#0E79AA]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#0A3D5E]">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#D6EAF3] bg-[#F8FBFD] p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-[#0A3D5E]">{title}</h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function TransactionSettingsForm({
  documentType,
  compact = false,
  hidePageTitle = false,
}: {
  documentType: TransactionDocumentType;
  compact?: boolean;
  hidePageTitle?: boolean;
}) {
  const invalidate = useInvalidateQuery();
  const { data, isLoading } = useApiQuery<TransactionSettings>(
    ['transaction-settings', documentType],
    `/transaction-settings/${documentType}`
  );
  const [form, setForm] = useState<Partial<TransactionSettings>>({});
  const [printKind, setPrintKind] = useState<DefaultPrintKind>('a4');
  const [thermalWidth, setThermalWidth] = useState<ThermalRollWidth>(80);

  useEffect(() => {
    if (data?.data) setForm(data.data);
  }, [data?.data]);

  useEffect(() => {
    const prefs = readSalesPrintPrefs();
    setPrintKind(prefs.kind);
    setThermalWidth(prefs.widthMm);
  }, []);

  const save = useApiMutation<TransactionSettings, Partial<TransactionSettings>>(
    `/transaction-settings/${documentType}`,
    'PATCH',
    {
      onSuccess: () => {
        toast.success('تم حفظ إعدادات المستند');
        invalidate(['transaction-settings', documentType]);
      },
    }
  );

  const patch = <K extends keyof TransactionSettings>(key: K, value: TransactionSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const title = DOCUMENT_TYPE_TITLE[documentType];
  const treasury = isTreasuryDocumentType(documentType);
  const journalLike = isJournalLikeDocumentType(documentType);
  const securities = isSecuritiesDocumentType(documentType);
  const hideStockPolicies = treasury || journalLike || securities;
  const isBankAdvice = documentType === 'BANK_DEBIT_ADVICE' || documentType === 'BANK_CREDIT_ADVICE';
  const isReceiptLike = documentType === 'RECEIPT_VOUCHER' || documentType === 'BANK_CREDIT_ADVICE';

  const accountField = (
    key: 'defaultCashAccountId' | 'defaultBankGlAccountId' | 'defaultOffsetAccountId' | 'defaultChargesAccountId',
    refKey:
      | 'defaultCashAccount'
      | 'defaultBankGlAccount'
      | 'defaultOffsetAccount'
      | 'defaultChargesAccount',
    label: string,
    hint: string
  ) => (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">{label}</label>
      <AccountSelect
        value={form[key] ?? ''}
        onChange={(id) => patch(key, id || null)}
        leafOnly
        selectedAccount={
          form[refKey]
            ? {
                id: form[refKey]!.id,
                code: form[refKey]!.code ?? '',
                arabicName: form[refKey]!.arabicName,
              }
            : null
        }
        placeholder="اختر من شجرة حسابات هذه الشركة"
      />
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{hint}</p>
    </div>
  );

  return (
    <div className={compact ? 'space-y-4' : 'mx-auto max-w-4xl space-y-4'} dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        {compact || hidePageTitle ? (
          <p className="text-sm text-slate-500">عدّل السياسات ثم احفظ — تُطبَّق على الحركات الجديدة فوراً.</p>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-[#0E79AA]" />
              <h1 className="text-xl font-bold text-[#0A3D5E]">{title}</h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {treasury
                ? 'حدّد من شجرة حسابات شركتك: الصندوق أو البنك، الحساب المقابل، ومصاريف العمولة. كل عميل يختار حساباته بنفسه.'
                : 'سياسات الترقيم، الترحيل، التسعير، الضرائب، ومراكز التكلفة لهذا النوع من المستندات.'}
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={save.isPending || isLoading}
          onClick={() => {
            if (documentType === 'SALES_INVOICE') {
              writeSalesPrintPrefs({ kind: printKind, widthMm: thermalWidth });
            }
            save.mutate(form);
          }}
        >
          حفظ الإعدادات
        </Button>
      </header>

      <Section title="1. نظام الترقيم وسلسلة الحركات">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#0A3D5E]">نوع الترقيم</p>
            <div className="flex gap-2">
              {([
                ['AUTOMATIC', 'تلقائي من النظام'],
                ['MANUAL', 'يدوي بواسطة المستخدم'],
              ] as [NumberingMode, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch('numberingMode', id)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                    form.numberingMode === id
                      ? 'border-[#0E79AA] bg-[#0E79AA]/10 text-[#0E79AA]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#0A3D5E]">سلسلة الترقيم عبر السنوات</p>
            <div className="flex gap-2">
              {([
                ['CONTINUOUS', 'متصل: يكمل نفس المسلسل'],
                ['ANNUAL_RESET', 'منفصل: يبدأ من 1 كل سنة مالية'],
              ] as [SequenceMode, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch('sequenceMode', id)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                    form.sequenceMode === id
                      ? 'border-[#0E79AA] bg-[#0E79AA]/10 text-[#0E79AA]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {documentType === 'SALES_RETURN' ? (
        <Section title="سياسات وقواعد الإرجاع">
          <SwitchRow
            checked={form.allowStandaloneReturns !== false}
            onChange={(v) => patch('allowStandaloneReturns', v)}
            label="السماح بالمردود الحر (دون التقيد بفاتورة بيع أصلية)"
            hint="إتاحة تسجيل مردود مبيعات مباشر وتحديد الأصناف يدوياً دون اشتراط اختيار فاتورة بيع سابقة كمرجع للحركة."
          />
          <SwitchRow
            checked={form.enforceOriginalPrice !== false}
            onChange={(v) => patch('enforceOriginalPrice', v)}
            label="إلزام الرد بنفس أسعار الفاتورة الأصلية"
            hint="تثبيت سعر إرجاع الصنف بنفس السعر المسجل في فاتورة البيع الأصلية ومنع تعديله."
          />
        </Section>
      ) : null}

      {documentType === 'PURCHASE_RETURN' ? (
        <Section title="سياسات وقواعد إرجاع المشتريات">
          <SwitchRow
            checked={form.allowStandaloneReturns !== false}
            onChange={(v) => patch('allowStandaloneReturns', v)}
            label="السماح بالمردود الحر (دون التقيد بفاتورة مشتريات أصلية)"
            hint="إتاحة تسجيل مردود مشتريات وتحديد الأصناف والأسعار يدوياً دون اشتراط اختيار فاتورة مشتريات سابقة."
          />
          <SwitchRow
            checked={form.enforceOriginalPrice !== false}
            onChange={(v) => patch('enforceOriginalPrice', v)}
            label="إلزام الرد بنفس أسعار فاتورة الشراء الأصلية"
            hint="تثبيت سعر إعادة الصنف للمورد بنفس السعر المسجل في فاتورة الشراء الأصلية ومنع تعديله يدوياً."
          />
        </Section>
      ) : null}

      <Section title="2. سلوك الحفظ والطباعة والترحيل">
        <SwitchRow
          checked={form.autoPostOnSave === true}
          onChange={(v) => patch('autoPostOnSave', v)}
          label="الترحيل التلقائي عند الحفظ"
          hint={
            treasury
              ? 'ترحيل السند وتثبيت أثره على الصندوق أو البنك فور الحفظ.'
              : 'ترحيل الفاتورة وتثبيت أثرها فور الضغط على حفظ دون إبقائها مسودة.'
          }
        />
        <SwitchRow
          checked={form.autoPrintOnSave === true}
          onChange={(v) => patch('autoPrintOnSave', v)}
          label="الطباعة التلقائية بعد الحفظ"
          hint="فتح نافذة الطباعة / أمر الطابعة الحرارية مباشرة بمجرد نجاح الحفظ."
        />
        {documentType === 'SALES_INVOICE' && form.autoPrintOnSave === true ? (
          <div className="rounded-xl border border-[#E6F0F7] bg-white px-3 py-3">
            <p className="mb-2 text-sm font-semibold text-[#0A3D5E]">نوع الطباعة الافتراضي</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  ['a4', 'فاتورة A4 عادية'],
                  ['thermal', 'إيصال حراري بلوتوث'],
                ] as [DefaultPrintKind, string][]
              ).map(([id, label]) => (
                <label key={id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="default-print-kind"
                    className="accent-[#0E79AA]"
                    checked={printKind === id}
                    onChange={() => {
                      setPrintKind(id);
                      writeSalesPrintPrefs({ kind: id });
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            {printKind === 'thermal' ? (
              <div className="mt-3 flex gap-2">
                {([80, 58] as ThermalRollWidth[]).map((mm) => (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => {
                      setThermalWidth(mm);
                      writeSalesPrintPrefs({ widthMm: mm });
                    }}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                      thermalWidth === mm
                        ? 'border-[#0E79AA] bg-[#0E79AA]/10 text-[#0E79AA]'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {mm}mm
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <SwitchRow
          checked={form.generateEntryOnSave !== false}
          onChange={(v) => patch('generateEntryOnSave', v)}
          label="توليد قيد يومية محاسبي تلقائياً"
          hint="إنشاء قيود اليومية تلقائياً مع الحركة من الحسابات التي تختارها تحت."
        />
        {hideStockPolicies ? null : (
          <SwitchRow
            checked={form.affectStock !== false}
            onChange={(v) => patch('affectStock', v)}
            label="التأثير على أرصدة المخازن"
            hint={
              documentType === 'PURCHASE_RETURN'
                ? 'خصم البضاعة من المخزن تلقائياً عند حفظ مردود المشتريات.'
                : 'خصم الكميات من المخزن تلقائياً دون الحاجة لإذن صرف مخزني منفصل.'
            }
          />
        )}
      </Section>

      {canLoadSourceOrder(documentType) ? (
        <Section title="تحميل الأمر من القسم والرقم">
          <SwitchRow
            checked={form.allowEditLoadedOrder !== false}
            onChange={(v) => patch('allowEditLoadedOrder', v)}
            label="السماح بتعديل الأمر بعد التحميل"
            hint="لو مقفولة، الأمر بيتحمّل في الصفحة وكل الخانات تقفل. لو مفتوحة تقدر تعدّل بعد التحميل عادي."
          />
        </Section>
      ) : null}

      <Section title="العملة وسعر الصرف">
        <SwitchRow
          checked={form.showFxColumns !== false}
          onChange={(v) => patch('showFxColumns', v)}
          label="إظهار أعمدة العملة وسعر الصرف دائماً"
          hint="لو مفعّلة، أعمدة العملة وسعر الصرف تظهر في الحركة الجديدة. تقدر تلغيها أو تشغّلها استثناءً من الخيارات الإضافية على نفس الصفحة."
        />
      </Section>

      {securities ? (
        <Section title="الحساب الافتراضي لقيد التحرير">
          <p className="text-xs leading-5 text-slate-500">
            {documentType === 'SECURITIES_RECEIPT'
              ? 'هذا الحساب يظهر في خانة الحساب على ورقة المقبوضات ويبقى المدين، والدائن حساب العميل.'
              : 'هذا الحساب يظهر في خانة الحساب على ورقة المدفوعات ويبقى الدائن، والمدين حساب المورد.'}
          </p>
          {accountField(
            'defaultOffsetAccountId',
            'defaultOffsetAccount',
            documentType === 'SECURITIES_RECEIPT' ? 'حساب أوراق القبض الافتراضي' : 'حساب أوراق الدفع الافتراضي',
            'لو المستخدم ما اختارش حساب على الورقة، القيد بيستخدم الحساب ده.'
          )}
        </Section>
      ) : null}

      {treasury ? (
        <Section title="3. الحسابات من شجرة هذه الشركة">
          <p className="text-xs leading-5 text-slate-500">
            كل شركة ليها دليل حسابات مختلف. اختار أنت الحساب من شجرتك — النظام مش بيفترض كود ثابت.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {isBankAdvice
              ? accountField(
                  'defaultBankGlAccountId',
                  'defaultBankGlAccount',
                  'حساب البنك (أصل)',
                  'الحساب في الشجرة المربوط بحركة البنك على هذا الإشعار.'
                )
              : accountField(
                  'defaultCashAccountId',
                  'defaultCashAccount',
                  'حساب الصندوق (أصل)',
                  'حساب النقدية الذي يُستخدم في سند القبض أو الصرف إذا لم يُحدَّد صندوق آخر.'
                )}
            {accountField(
              'defaultOffsetAccountId',
              'defaultOffsetAccount',
              isReceiptLike ? 'الحساب المقابل الافتراضي (عميل / إيراد)' : 'الحساب المقابل الافتراضي (مورد / مصروف)',
              'أول سطر في السند يتفتح على هذا الحساب. تقدر تغيّره في كل حركة.'
            )}
            {accountField(
              'defaultChargesAccountId',
              'defaultChargesAccount',
              documentType === 'BANK_CREDIT_ADVICE'
                ? 'حساب إيراد الإضافة / العمولة'
                : documentType === 'BANK_DEBIT_ADVICE'
                  ? 'حساب مصروف الخصم / العمولة'
                  : 'حساب مصروف أو عمولة إضافية',
              'اختياري. لو الحركة فيها عمولة أو مصروف بنكي، يترحل من هنا.'
            )}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">مركز التكلفة الافتراضي</label>
              <CostCenterSelect
                value={form.defaultCostCenterId ?? ''}
                onChange={(id) => patch('defaultCostCenterId', id || null)}
              />
            </div>
          </div>
        </Section>
      ) : null}

      {hideStockPolicies ? null : (
      <Section title="3. الرقابة والتحكم وحراسات الأسعار">
        <SwitchRow
          checked={form.allowItemPriceOverride !== false}
          onChange={(v) => patch('allowItemPriceOverride', v)}
          label="السماح بتعديل سعر الصنف في الفاتورة"
          hint="إمكانية كتابة سعر مخصص للسطر دون المساس بالسعر المسجل في كارت الصنف."
        />
        <SwitchRow
          checked={form.preventSellingBelowCost !== false}
          onChange={(v) => patch('preventSellingBelowCost', v)}
          label="منع البيع بأقل من سعر التكلفة"
          hint="حظر اعتماد الفاتورة إذا كان سعر البيع يقل عن متوسط التكلفة المرجح للصنف."
        />
        <SwitchRow
          checked={form.preventNegativeStock !== false}
          onChange={(v) => patch('preventNegativeStock', v)}
          label="منع الحركة بالسالب على رصيد الصنف"
          hint="منع حفظ الفاتورة في حال تجاوز الكمية المباعة للرصيد الفعلي المتوفر بالمخزن."
        />
      </Section>
      )}

      {hideStockPolicies ? null : (
      <Section title="4. الضرائب والخصومات">
        <SwitchRow
          checked={form.autoApplyVat !== false}
          onChange={(v) => patch('autoApplyVat', v)}
          label="تطبيق ضريبة القيمة المضافة افتراضياً"
          hint="تحديد خانة ض.ق.م (14%) تلقائياً لكل فاتورة جديدة."
        />
        <SwitchRow
          checked={form.autoApplyWht === true}
          onChange={(v) => patch('autoApplyWht', v)}
          label="تطبيق ضريبة خصم المنبع افتراضياً"
          hint="تفعيل نسبة الخصم والتحصيل الضريبي تلقائياً في السطور الجديدة."
        />
        <SwitchRow
          checked={form.autoApplyDevelopmentTax === true}
          onChange={(v) => patch('autoApplyDevelopmentTax', v)}
          label="تطبيق ضريبة رسم التنمية افتراضياً"
          hint="تفعيل ضريبة رسم التنمية تلقائياً مع كل فاتورة جديدة."
        />
        <SwitchRow
          checked={form.cascadingDiscounts === true}
          onChange={(v) => patch('cascadingDiscounts', v)}
          label="الخصومات المتسلسلة (المتتالية)"
          hint="كل خصم يتم تطبيقه على صافي القيمة بعد احتساب الخصم السابق وليس على القيمة الإجمالية."
        />
      </Section>
      )}

      {hideStockPolicies ? null : (
      <Section title="5. الحسابات ومراكز التكلفة الافتراضية وسياسة التسعير">
        <SwitchRow
          checked={form.showAllAccountsInCustomerField === true}
          onChange={(v) => patch('showAllAccountsInCustomerField', v)}
          label="إظهار كافة الحسابات في خانة العميل"
          hint="إتاحة البحث في شجرة الحسابات بالكامل بدلاً من حصرها في حسابات مجموعة العملاء فقط."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {documentType === 'PURCHASE_RETURN' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">
                حساب مردودات المشتريات الافتراضي
              </label>
              <AccountSelect
                value={form.defaultPurchaseReturnAccountId ?? ''}
                onChange={(id) => patch('defaultPurchaseReturnAccountId', id || null)}
                leafOnly
                selectedAccount={
                  form.defaultPurchaseReturnAccount
                    ? {
                        id: form.defaultPurchaseReturnAccount.id,
                        code: form.defaultPurchaseReturnAccount.code ?? '',
                        arabicName: form.defaultPurchaseReturnAccount.arabicName,
                      }
                    : null
                }
                placeholder="مردودات ومسموحات المشتريات"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">حساب المبيعات الافتراضي</label>
              <AccountSelect
                value={form.defaultSalesAccountId ?? ''}
                onChange={(id) => patch('defaultSalesAccountId', id || null)}
                leafOnly
                statementType="INCOME_STATEMENT"
                selectedAccount={
                  form.defaultSalesAccount
                    ? {
                        id: form.defaultSalesAccount.id,
                        code: form.defaultSalesAccount.code ?? '',
                        arabicName: form.defaultSalesAccount.arabicName,
                      }
                    : null
                }
                placeholder="حسابات المبيعات والإيرادات"
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">المخزن الافتراضي للفاتورة</label>
            <WarehouseSelect
              value={form.defaultWarehouseId ?? ''}
              onChange={(id) => patch('defaultWarehouseId', id || null)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">مركز التكلفة الافتراضي</label>
            <CostCenterSelect
              value={form.defaultCostCenterId ?? ''}
              onChange={(id) => patch('defaultCostCenterId', id || null)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">سياسة التسعير الافتراضية للسطور</label>
            <select
              className="h-10 w-full rounded-xl border border-[#D6EAF3] bg-white px-3 text-sm text-[#0A3D5E]"
              value={form.pricingPolicy ?? 'LAST_SALE'}
              onChange={(e) => patch('pricingPolicy', e.target.value as PricingPolicy)}
            >
              <option value="COST">التكلفة (متوسط التكلفة المرجح)</option>
              <option value="LAST_PURCHASE">آخر سعر شراء</option>
              <option value="LAST_SALE">آخر سعر بيع عام</option>
              <option value="LAST_SALE_TO_CUSTOMER">آخر سعر بيع لنفس العميل المحدد</option>
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#0A3D5E]">طرف مركز التكلفة</p>
            <div className="flex gap-2">
              {([
                ['DEBIT', 'مدين'],
                ['CREDIT', 'دائن'],
              ] as [CostCenterPostingSide, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch('costCenterSide', id)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                    form.costCenterSide === id
                      ? 'border-[#0E79AA] bg-[#0E79AA]/10 text-[#0E79AA]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#0A3D5E]">حساب مركز التكلفة (في الجرد المستمر)</p>
            <div className="flex gap-2">
              {([
                ['SALES', 'حساب المبيعات'],
                ['COST_OF_GOODS_SOLD', 'حساب تكلفة البضاعة المباعة (COGS)'],
              ] as [CostCenterAllocationTarget, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch('costCenterAllocationTarget', id)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                    form.costCenterAllocationTarget === id
                      ? 'border-[#0E79AA] bg-[#0E79AA]/10 text-[#0E79AA]'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>
      )}
    </div>
  );
}
