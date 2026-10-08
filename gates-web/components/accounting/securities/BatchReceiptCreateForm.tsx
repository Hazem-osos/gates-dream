'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Files } from 'lucide-react';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import {
  AdvancedFieldsSection,
  CompactFormField,
  compactControlClass,
} from '@/components/ui';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { CustomerSelect, SupplierSelect } from '@/app/components/form/PartySelect';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useCurrenciesQuery } from '@/lib/hooks/useMasterDataQueries';
import { pickCurrencyByCode, rateForCurrency } from '@/lib/accounting/fx-base';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { DocumentCurrencyRateFields } from '@/components/accounting/DocumentCurrencyRateFields';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { toHijriDate } from '@/lib/hijri-date';
import {
  securitiesBulkCreateHeaderFormSchema,
  type SecuritiesBulkCreateHeaderFormInput,
} from '@/lib/validation/accounting.schema';
import {
  BatchReceiptLinesGrid,
  createBlankBatchReceiptLines,
  emptyBatchReceiptLine,
  type BatchReceiptLine,
} from './BatchReceiptLinesGrid';
import { BatchReceiptStickyFooter } from './BatchReceiptStickyFooter';
import {
  BatchAmountDistributeModal,
  type DistributedPaperRow,
} from './BatchAmountDistributeModal';
import { Button } from '@/components/ui/button';
import { SecuritiesEntitySelect } from './SecuritiesEntitySelect';

type NamedParty = {
  id: string;
  code?: string;
  arabicName: string;
  englishName?: string;
};

type BatchCreateResult = { count: number; totalAmount: number };

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function defaultCurrencyId(
  currencies: { id: string; code: string; exchangeRate?: number | string | null }[],
  companyBase = 'EGP'
): string {
  if (!currencies.length) return '';
  return pickCurrencyByCode(currencies, companyBase)?.id || currencies[0].id;
}

function isEnteredLine(line: BatchReceiptLine): boolean {
  return (
    line.paperNumber.trim().length > 0 ||
    line.amount > 0 ||
    line.dueDate.trim().length > 0 ||
    line.bankName.trim().length > 0 ||
    line.branchName.trim().length > 0 ||
    line.description.trim().length > 0
  );
}

function isValidSaveLine(line: BatchReceiptLine): boolean {
  return line.paperNumber.trim().length > 0 && line.amount > 0 && line.dueDate.trim().length > 0;
}

export function BatchReceiptCreateForm({
  variant = 'batch',
  kind = 'receipt',
}: { variant?: 'batch' | 'opening'; kind?: 'receipt' | 'payment' } = {}) {
  const opening = variant === 'opening';
  const [paperKind, setPaperKind] = useState<'receipt' | 'payment'>(kind === 'payment' ? 'payment' : 'receipt');
  const payment = opening ? paperKind === 'payment' : kind === 'payment';
  const papersLabel = payment ? 'دفع' : 'قبض';
  const listHref = payment
    ? '/accounting/operations/securities/payment'
    : '/accounting/operations/securities/receipt';
  const batchHref = payment
    ? '/accounting/operations/securities/payment/bulk'
    : '/treasury/papers/batch-receipt/new';
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();
  const [lines, setLines] = useState<BatchReceiptLine[]>(() => createBlankBatchReceiptLines(3));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDistribute, setShowDistribute] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patternAccountId, setPatternAccountId] = useState('');
  const previousPatternRef = useRef('');

  const { data: currenciesResponse } = useCurrenciesQuery();
  const currencies = useMemo(() => currenciesResponse?.data || [], [currenciesResponse?.data]);
  const { code: companyBaseCurrency } = useCompanyBaseCurrency();

  const { data: customersResponse } = useApiQuery<NamedParty[]>(
    ['customers'],
    '/accounting/customers',
    { limit: 1000, isActive: true }
  );
  const customers = customersResponse?.data || [];

  const { data: suppliersResponse } = useApiQuery<NamedParty[]>(
    ['suppliers'],
    '/accounting/suppliers',
    { limit: 1000, isActive: true }
  );
  const suppliers = suppliersResponse?.data || [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SecuritiesBulkCreateHeaderFormInput>({
    resolver: zodResolver(securitiesBulkCreateHeaderFormSchema) as Resolver<SecuritiesBulkCreateHeaderFormInput>,
    defaultValues: {
      currencyId: '',
      exchangeRate: 1,
      partyName: '',
      partyId: '',
      partyType: payment ? 'supplier' : opening ? 'account' : 'customer',
      issueDate: todayIso(),
      hijriIssueDate: toHijriDate(todayIso()),
      entityName: '',
      entityId: '',
      costCenterId: '',
      notes: '',
    },
    mode: 'onTouched',
  });

  const { data: openingMetaResponse } = useApiQuery<{
    fiscalYearStartDate?: string;
    fiscalYearName?: string | null;
  }>(['opening-balance-meta'], '/accounting/opening-balance', undefined, { enabled: opening });
  const fiscalYearStart = openingMetaResponse?.data?.fiscalYearStartDate || '';
  const fiscalYearName = openingMetaResponse?.data?.fiscalYearName || '';
  const nextNumberPath = payment
    ? '/accounting/securities-payments/next-number'
    : '/accounting/securities-receipts/next-number';
  const { data: nextNumberResponse } = useApiQuery<{ automatic: boolean; number: string }>(
    ['opening-paper-next-number', payment ? 'payment' : 'receipt'],
    nextNumberPath,
    undefined,
    { enabled: opening, staleTime: 0 }
  );
  const nextSerial = nextNumberResponse?.data?.number?.trim() || '';
  const nextSerialManual = nextNumberResponse?.data?.automatic === false;
  const openingPartyClass = cn(compactControlClass, 'h-12 max-w-none text-base');

  const currencyId = watch('currencyId');
  const partyType = watch('partyType');
  const partyId = watch('partyId');
  const issueDate = watch('issueDate');
  const entityName = watch('entityName') || '';
  const partyName = watch('partyName') || '';
  const costCenterId = watch('costCenterId');
  const notes = watch('notes');

  useEffect(() => {
    if (currencies.length > 0 && !currencyId) {
      const id = defaultCurrencyId(currencies, companyBaseCurrency);
      const cur = currencies.find((c) => c.id === id);
      setValue('currencyId', id, { shouldValidate: false });
      setValue(
        'exchangeRate',
        rateForCurrency(cur?.code, companyBaseCurrency, cur?.exchangeRate),
        { shouldValidate: false }
      );
    }
  }, [companyBaseCurrency, currencies, currencyId, setValue]);

  useEffect(() => {
    if (!opening || !fiscalYearStart) return;
    setValue('issueDate', fiscalYearStart, { shouldValidate: true });
  }, [fiscalYearStart, opening, setValue]);

  useEffect(() => {
    if (issueDate) {
      setValue('hijriIssueDate', toHijriDate(issueDate), { shouldValidate: false });
    }
  }, [issueDate, setValue]);

  useEffect(() => {
    if (!opening || !patternAccountId) return;
    const previous = previousPatternRef.current;
    setLines((current) =>
      current.map((line) => {
        if (!line.accountId || line.accountId === previous) {
          return { ...line, accountId: patternAccountId };
        }
        return line;
      })
    );
    previousPatternRef.current = patternAccountId;
  }, [opening, patternAccountId]);

  const selectedCurrency = currencies.find((c) => c.id === currencyId);
  const validLines = useMemo(
    () => lines.filter((line) => isValidSaveLine(line) && (!opening || Boolean(line.accountId))),
    [lines, opening]
  );
  const totalAmount = useMemo(
    () => validLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [validLines]
  );
  const advancedFilledCount = [partyName, costCenterId, notes].filter((v) => String(v ?? '').trim().length > 0)
    .length;

  const resetParty = (nextType: 'customer' | 'supplier' | 'account') => {
    setValue('partyType', nextType, { shouldValidate: true });
    setValue('partyId', '', { shouldValidate: false });
    setValue('partyName', '', { shouldValidate: false });
  };

  const applyParty = (id: string, name?: string) => {
    setValue('partyId', id, { shouldValidate: true });
    if (name) {
      setValue('partyName', name, { shouldValidate: false });
      return;
    }
    const party = (partyType === 'customer' ? customers : suppliers).find((p) => p.id === id);
    if (party) {
      setValue('partyName', party.arabicName || party.englishName || '', { shouldValidate: false });
    }
  };

  const { data: partyAccountResponse } = useApiQuery<{
    code?: string | null;
    arabicName?: string | null;
  }>(
    ['opening-securities-party-account', partyId],
    partyId && partyType === 'account' ? `/accounting/accounts/${partyId}` : '/accounting/accounts',
    undefined,
    { enabled: Boolean(partyId) && partyType === 'account' }
  );

  useEffect(() => {
    if (partyType !== 'account' || !partyId) return;
    const account = partyAccountResponse?.data;
    if (!account?.arabicName) return;
    const label = account.code ? `[${account.code}] ${account.arabicName}` : account.arabicName;
    setValue('partyName', label, { shouldValidate: false });
  }, [partyAccountResponse?.data, partyId, partyType, setValue]);

  const handleAddRow = () => {
    setLines((prev) => [...prev, { ...emptyBatchReceiptLine(), accountId: patternAccountId }]);
  };

  const nextPaperNumbers = (count: number): string[] => {
    const seed = lines.find((line) => line.paperNumber.trim())?.paperNumber.trim() ?? '';
    const numeric = seed.match(/^(.*?)(\d+)$/);
    if (numeric) {
      const prefix = numeric[1];
      const start = parseInt(numeric[2], 10);
      const pad = numeric[2].length;
      return Array.from({ length: count }, (_, i) => `${prefix}${String(start + i).padStart(pad, '0')}`);
    }
    return Array.from({ length: count }, () => '');
  };

  const applyDistribution = (rows: DistributedPaperRow[]) => {
    const numbers = nextPaperNumbers(rows.length);
    const template = lines.find((line) => line.bankName.trim() || line.branchName.trim() || line.description.trim());
    setLines(
      rows.map((row, index) => ({
        paperNumber: numbers[index] || lines[index]?.paperNumber || '',
        amount: row.amount,
        dueDate: row.dueDate,
        bankName: lines[index]?.bankName || template?.bankName || '',
        branchName: lines[index]?.branchName || template?.branchName || '',
        description: lines[index]?.description || template?.description || '',
        accountId: lines[index]?.accountId || template?.accountId || patternAccountId,
      }))
    );
    setSuccess(`تم توزيع ${rows.length} ورقة على جدول الإدخال`);
  };

  const onSave = () => {
    void handleSubmit((values) => {
      setError('');
      const entered = lines.filter(isEnteredLine);
      if (opening && !fiscalYearStart) {
        setError('عرّف السنة المالية أولاً حتى يُثبَّت تاريخ التحرير على أول يوم فيها.');
        return;
      }
      if (entered.length === 0) {
        setError(opening ? 'أدخل شيكاً واحداً على الأقل في الجدول' : 'أدخل ورقة قبض واحدة على الأقل في جدول الإدخال');
        return;
      }
      const incomplete = entered.find(
        (line) => !isValidSaveLine(line) || (opening && !line.accountId)
      );
      if (incomplete) {
        setError(
          opening
            ? 'أكمل رقم الشيك والمبلغ وتاريخ الاستحقاق والحساب لكل شيك'
            : 'أكمل رقم الورقة والمبلغ وتاريخ الاستحقاق لكل ورقة مدخلة'
        );
        return;
      }
      const early = entered.find((line) => values.issueDate && line.dueDate < values.issueDate);
      if (early) {
        const number = early.paperNumber.trim();
        setError(
          number
            ? `تاريخ استحقاق الورقة ${number} لا يمكن أن يكون قبل تاريخ التحرير`
            : 'تاريخ الاستحقاق لا يمكن أن يكون قبل تاريخ التحرير'
        );
        return;
      }
      const endpoint = payment
        ? '/accounting/securities-payments/batch'
        : '/accounting/securities-receipts/batch';
      setSaving(true);
      void apiClient
        .post<BatchCreateResult>(endpoint, {
          issueDate: opening ? fiscalYearStart : values.issueDate,
          hijriIssueDate: values.hijriIssueDate || toHijriDate(opening ? fiscalYearStart : values.issueDate),
          partyId: values.partyId,
          partyType: values.partyType,
          entityName: values.entityName || undefined,
          entityId: values.entityId || undefined,
          partyName: values.partyName || undefined,
          currencyCode: selectedCurrency?.code || 'EGP',
          opening: opening || undefined,
          papers: entered.map((line) => ({
            paperNumber: line.paperNumber.trim(),
            amount: line.amount,
            dueDate: line.dueDate,
            hijriDueDate: toHijriDate(line.dueDate),
            bankName: opening ? undefined : line.bankName.trim() || undefined,
            branchName: opening ? undefined : line.branchName.trim() || undefined,
            accountId: opening ? line.accountId : undefined,
            description: line.description.trim() || values.notes?.trim() || undefined,
          })),
        })
        .then((res) => {
          invalidateQuery([payment ? 'securities-payments' : 'securities-receipts']);
          invalidateQuery(['opening-paper-next-number']);
          const count = res.data?.count ?? entered.length;
          if (opening) {
            setSuccess(`تم حفظ ${count} شيك بدون قيد تحرير. استوردهم من قيد الرصيد الافتتاحي.`);
            setLines(createBlankBatchReceiptLines(3).map((line) => ({ ...line, accountId: patternAccountId })));
            return;
          }
          setSuccess(`تم حفظ ${count} ورقة ${papersLabel} بنجاح`);
          router.push(listHref);
        })
        .catch((err: ApiError) => {
          setError(err.message || `حدث خطأ أثناء حفظ أوراق ${papersLabel}`);
        })
        .finally(() => setSaving(false));
    }, onFieldErrors(setError))();
  };

  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        title={opening ? 'أوراق مالية سابقة' : `إنشاء عدة أوراق ${papersLabel}`}
        breadcrumbs={
          opening
            ? [
                { label: 'المحاسبة', href: '/accounting' },
                { label: 'عمليات أساسية', href: '/accounting/operations/basic-operations/opening-balance' },
                { label: 'أوراق مالية سابقة' },
              ]
            : [
                { label: 'المحاسبة', href: '/accounting' },
                { label: 'الأوراق المالية', href: listHref },
                { label: 'إنشاء عدة أوراق' },
              ]
        }
        statusTone="neutral"
        statusLabel={opening ? 'شيكات أول المدة' : 'مسودة إدخال'}
        docNumber={opening ? (nextSerialManual ? 'يدوي' : nextSerial || '…') : undefined}
        showDocumentRef={opening}
        favoriteHref={opening ? '/accounting/operations/basic-operations/opening-securities' : batchHref}
        favoriteLabel={opening ? 'أوراق مالية سابقة' : `إنشاء عدة أوراق ${papersLabel}`}
        onCancel={() =>
          router.push(
            opening
              ? '/accounting/operations/basic-operations/opening-balance'
              : listHref
          )
        }
        cancelLabel="إلغاء"
        onSaveDraft={onSave}
        saveLabel={opening ? 'حفظ الشيكات' : `حفظ كافة أوراق ${papersLabel}`}
        savePending={saving}
        canSave={validLines.length > 0}
        hideStandalonePost
        onBrowseList={() => router.push(listHref)}
        browseListLabel="قائمة الأوراق"
        standardActions={{
          hasDocument: false,
          hidePostActions: true,
        }}
      />

      <form className="w-full text-base" onSubmit={(e) => e.preventDefault()}>
        <div className={`mb-4 grid grid-cols-1 gap-4 rounded-xl border border-border/80 bg-card shadow-sm ${opening ? 'p-5 md:grid-cols-2' : 'p-4 md:grid-cols-3'}`}>
          {opening ? (
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-foreground">نوع الأوراق</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`rounded-lg px-4 py-3 text-base font-semibold ${
                    paperKind === 'receipt' ? 'bg-[#0E78AA] text-white' : 'bg-[#EAF6FB] text-[#094C6B]'
                  }`}
                  onClick={() => setPaperKind('receipt')}
                >
                  أوراق قبض — مقبوض من
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-4 py-3 text-base font-semibold ${
                    paperKind === 'payment' ? 'bg-[#0E78AA] text-white' : 'bg-[#EAF6FB] text-[#094C6B]'
                  }`}
                  onClick={() => setPaperKind('payment')}
                >
                  أوراق دفع — مدفوع إلى
                </button>
              </div>
            </div>
          ) : null}
          {opening ? (
            <div className="space-y-1">
              <label className="text-sm font-bold text-foreground">المسلسل</label>
              <div className="flex h-12 items-center rounded-lg border border-[#0E78AA]/30 bg-[#EAF6FB] px-4 text-xl font-bold tabular-nums tracking-wide text-[#094C6B]">
                {nextSerialManual ? 'يدوي' : nextSerial || '…'}
              </div>
              <p className="text-xs text-muted-foreground">
                {nextSerialManual
                  ? 'الترقيم يدوي في إعدادات الورقة.'
                  : 'أول مسلسل هتاخده الشيكات دي عند الحفظ، والباقي يتسلسل بعده.'}
              </p>
            </div>
          ) : null}
          <DatePickerWithHijri
            label="تاريخ التحرير"
            required
            disabled={opening}
            value={issueDate}
            error={Boolean(errors.issueDate)}
            onChange={(d) => setValue('issueDate', d, { shouldValidate: true })}
          />
          {opening ? (
            <p className="text-xs text-muted-foreground">
              أول يوم في السنة المالية{fiscalYearName ? `: ${fiscalYearName}` : ''}. الشيكات دي لا تنشئ قيد تحرير.
            </p>
          ) : null}

          <div className={`space-y-2 ${opening ? 'md:col-span-2' : ''}`}>
            <label className={opening ? 'text-lg font-bold text-foreground' : 'text-xs font-semibold text-foreground'}>
              {payment ? 'مدفوع إلى' : 'مقبوض من'}
            </label>
            <div className={`flex gap-2 ${opening ? 'text-sm' : 'mb-1.5 text-xs'}`}>
              <button
                type="button"
                className={`rounded-md ${opening ? 'px-3 py-1.5' : 'px-2 py-0.5'} ${
                  partyType === 'customer' ? 'bg-[#0E78AA] text-white' : 'bg-[#EAF6FB] text-[#094C6B]'
                }`}
                onClick={() => resetParty('customer')}
              >
                عميل
              </button>
              <button
                type="button"
                className={`rounded-md ${opening ? 'px-3 py-1.5' : 'px-2 py-0.5'} ${
                  partyType === 'supplier' ? 'bg-[#0E78AA] text-white' : 'bg-[#EAF6FB] text-[#094C6B]'
                }`}
                onClick={() => resetParty('supplier')}
              >
                مورد
              </button>
              <button
                type="button"
                className={`rounded-md ${opening ? 'px-3 py-1.5' : 'px-2 py-0.5'} ${
                  partyType === 'account' ? 'bg-[#0E78AA] text-white' : 'bg-[#EAF6FB] text-[#094C6B]'
                }`}
                onClick={() => resetParty('account')}
              >
                حساب
              </button>
            </div>
            {partyType === 'customer' ? (
              <CustomerSelect
                value={partyId}
                onChange={applyParty}
                className={opening ? openingPartyClass : undefined}
                emptyLabel={payment ? 'اختر العميل...' : 'اختر الساحب / العميل...'}
              />
            ) : partyType === 'supplier' ? (
              <SupplierSelect
                value={partyId}
                onChange={applyParty}
                className={opening ? openingPartyClass : undefined}
                emptyLabel={payment ? 'اختر المورد...' : 'اختر الساحب / العميل...'}
              />
            ) : (
              <AccountSelect
                value={partyId}
                onChange={applyParty}
                leafOnly
                className={opening ? openingPartyClass : undefined}
                placeholder="اختر حساب حركة من الدليل..."
                emptyLabel="اختر حساب حركة..."
              />
            )}
            {errors.partyId ? (
              <span className="mt-1 block text-xs text-red-600">{errors.partyId.message}</span>
            ) : null}
          </div>

          {opening ? (
            <div className="space-y-1">
              <label className="text-sm font-semibold text-foreground">حساب النمط</label>
              <AccountSelect
                value={patternAccountId}
                onChange={setPatternAccountId}
                leafOnly
                className={openingPartyClass}
                placeholder="الحساب الذي تُحمَّل عليه الشيكات"
                emptyLabel="اختر حساب النمط..."
              />
              <p className="text-xs text-muted-foreground">
                ينزل في عمود الحساب لكل شيك، ويمكن تغييره لشيك واحد.
              </p>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">الجهة</label>
            <SecuritiesEntitySelect
              value={watch('entityId') || ''}
              valueLabel={entityName}
              onChange={(id, name) => {
                setValue('entityId', id, { shouldValidate: false });
                setValue('entityName', name, { shouldValidate: false });
              }}
            />
          </div>
        </div>

        <AdvancedFieldsSection title="الحقول المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <CompactFormField label="الاسم" placeholder={payment ? 'اسم المستفيد' : 'اسم الساحب'} error={errors.partyName?.message} {...register('partyName')} />
            <DocumentCurrencyRateFields
              currencies={currencies}
              currencyId={currencyId}
              exchangeRate={Number(watch('exchangeRate')) > 0 ? Number(watch('exchangeRate')) : 1}
              companyBaseCode={companyBaseCurrency}
              amount={totalAmount}
              showEquivalent
              selectClassName={`${compactControlClass} ${errors.currencyId ? 'border-red-400' : ''}`}
              onCurrencyIdChange={(id, nextRate) => {
                setValue('currencyId', id, { shouldValidate: true });
                setValue('exchangeRate', nextRate);
              }}
              onExchangeRateChange={(rate) => setValue('exchangeRate', rate)}
            />
            <CompactFormField label="مركز التكلفة الافتراضي">
              <CostCenterSelect
                value={costCenterId || ''}
                onChange={(id) => setValue('costCenterId', id, { shouldValidate: false })}
                emptyLabel="اختر مركز التكلفة"
              />
            </CompactFormField>
            <CompactFormField label="ملاحظات داخلية">
              <textarea
                rows={2}
                className={`${compactControlClass} min-h-[64px] py-2`}
                placeholder="ملاحظات لا تظهر في جدول الأوراق إلا إذا كان بيان السطر فارغاً"
                {...register('notes')}
              />
            </CompactFormField>
          </div>
        </AdvancedFieldsSection>
      </form>

      <section className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Files className="h-4 w-4 text-primary" />
            <span>{opening ? 'جدول الشيكات السابقة' : `جدول إدخال أوراق ${papersLabel}`}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {opening
                ? `شيكات ${papersLabel} أول المدة. لا يُنشأ لها قيد تحرير، وتُستورد مجمّعة على كل حساب في قيد الافتتاح.`
                : 'أدخل الأوراق الجديدة هنا قبل الحفظ — ليس قائمة عرض للأوراق السابقة'}
            </span>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowDistribute(true)}>
            توزيع مبالغ
          </Button>
        </div>
        <BatchReceiptLinesGrid
          lines={lines}
          onChange={setLines}
          onAddRow={handleAddRow}
          minDueDate={issueDate}
          variant={opening ? 'opening' : 'batch'}
        />
      </section>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <BatchReceiptStickyFooter
        paperCount={validLines.length}
        totalAmount={totalAmount}
        currencyCode={selectedCurrency?.code || 'EGP'}
        onSave={onSave}
        onCancel={() =>
          router.push(
            opening
              ? '/accounting/operations/basic-operations/opening-balance'
              : listHref
          )
        }
        savePending={saving}
        canSave={validLines.length > 0}
      />

      <BatchAmountDistributeModal
        open={showDistribute}
        onClose={() => setShowDistribute(false)}
        defaultAmount={totalAmount}
        defaultStartDate={issueDate}
        onApply={applyDistribution}
      />
    </ErpDocumentLayout>
  );
}
