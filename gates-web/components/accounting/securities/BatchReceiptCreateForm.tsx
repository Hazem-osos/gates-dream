'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useCurrenciesQuery } from '@/lib/hooks/useMasterDataQueries';
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

function defaultCurrencyId(currencies: { id: string; code: string }[]): string {
  if (!currencies.length) return '';
  return (currencies.find((c) => c.code === 'EGP') || currencies[0]).id;
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

export function BatchReceiptCreateForm() {
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();
  const [lines, setLines] = useState<BatchReceiptLine[]>(() => createBlankBatchReceiptLines(3));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDistribute, setShowDistribute] = useState(false);

  const { data: currenciesResponse } = useCurrenciesQuery();
  const currencies = useMemo(() => currenciesResponse?.data || [], [currenciesResponse?.data]);

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
      partyName: '',
      partyId: '',
      partyType: 'customer',
      issueDate: todayIso(),
      hijriIssueDate: toHijriDate(todayIso()),
      entityName: '',
      costCenterId: '',
      notes: '',
    },
    mode: 'onTouched',
  });

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
      setValue('currencyId', defaultCurrencyId(currencies), { shouldValidate: false });
    }
  }, [currencies, currencyId, setValue]);

  useEffect(() => {
    if (issueDate) {
      setValue('hijriIssueDate', toHijriDate(issueDate), { shouldValidate: false });
    }
  }, [issueDate, setValue]);

  const selectedCurrency = currencies.find((c) => c.id === currencyId);
  const validLines = useMemo(() => lines.filter(isValidSaveLine), [lines]);
  const totalAmount = useMemo(
    () => validLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0),
    [validLines]
  );
  const advancedFilledCount = [partyName, costCenterId, notes].filter((v) => String(v ?? '').trim().length > 0)
    .length;

  const applyParty = (id: string) => {
    setValue('partyId', id, { shouldValidate: true });
    const party = (partyType === 'customer' ? customers : suppliers).find((p) => p.id === id);
    if (party) {
      setValue('partyName', party.arabicName || party.englishName || '', { shouldValidate: false });
    }
  };

  const mutation = useApiMutation<BatchCreateResult, Record<string, unknown>>(
    '/accounting/securities-receipts/batch',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        invalidateQuery(['securities-receipts']);
        setSuccess(`تم حفظ ${res.data?.count ?? validLines.length} ورقة قبض بنجاح`);
        router.push('/accounting/operations/securities/reciept');
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء حفظ أوراق القبض');
      },
    }
  );

  const handleAddRow = () => {
    setLines((prev) => [...prev, emptyBatchReceiptLine()]);
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
      }))
    );
    setSuccess(`تم توزيع ${rows.length} ورقة على جدول الإدخال`);
  };

  const onSave = () => {
    void handleSubmit((values) => {
      setError('');
      const entered = lines.filter(isEnteredLine);
      if (entered.length === 0) {
        setError('أدخل ورقة قبض واحدة على الأقل في جدول الإدخال');
        return;
      }
      const incomplete = entered.find((line) => !isValidSaveLine(line));
      if (incomplete) {
        setError('أكمل رقم الورقة والمبلغ وتاريخ الاستحقاق لكل ورقة مدخلة');
        return;
      }
      mutation.mutate({
        issueDate: values.issueDate,
        hijriIssueDate: values.hijriIssueDate || toHijriDate(values.issueDate),
        partyId: values.partyId,
        partyType: values.partyType,
        entityName: values.entityName || undefined,
        partyName: values.partyName || undefined,
        currencyCode: selectedCurrency?.code || 'EGP',
        papers: entered.map((line) => ({
          paperNumber: line.paperNumber.trim(),
          amount: line.amount,
          dueDate: line.dueDate,
          hijriDueDate: toHijriDate(line.dueDate),
          bankName: line.bankName.trim() || undefined,
          branchName: line.branchName.trim() || undefined,
          description: line.description.trim() || values.notes?.trim() || undefined,
        })),
      });
    }, onFieldErrors(setError))();
  };

  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        title="إنشاء عدة أوراق قبض"
        breadcrumbs={[
          { label: 'المحاسبة', href: '/accounting' },
          { label: 'الأوراق المالية', href: '/accounting/operations/securities/reciept' },
          { label: 'إنشاء عدة أوراق' },
        ]}
        statusTone="neutral"
        statusLabel="مسودة إدخال"
        showDocumentRef={false}
        favoriteHref="/treasury/papers/batch-receipt/new"
        favoriteLabel="إنشاء عدة أوراق قبض"
        onCancel={() => router.push('/accounting/operations/securities/reciept')}
        cancelLabel="إلغاء"
        onSaveDraft={onSave}
        saveLabel="حفظ كافة أوراق القبض"
        savePending={mutation.isPending}
        canSave={validLines.length > 0}
        hideStandalonePost
        onBrowseList={() => router.push('/accounting/operations/securities/reciept')}
        browseListLabel="قائمة الأوراق"
        standardActions={{
          hasDocument: false,
          hidePostActions: true,
          extraItems: [
            {
              id: 'distribute',
              label: 'توزيع مبالغ',
              onClick: () => setShowDistribute(true),
            },
          ],
        }}
      />

      <form className="w-full text-base" onSubmit={(e) => e.preventDefault()}>
        <div className="mb-4 grid grid-cols-1 gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-3">
          <DatePickerWithHijri
            label="تاريخ التحرير"
            required
            value={issueDate}
            error={Boolean(errors.issueDate)}
            onChange={(d) => setValue('issueDate', d, { shouldValidate: true })}
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">مقبوض من</label>
            <div className="mb-1.5 flex gap-2 text-xs">
              <button
                type="button"
                className={`rounded-md px-2 py-0.5 ${
                  partyType === 'customer' ? 'bg-[#0E78AA] text-white' : 'bg-[#EAF6FB] text-[#094C6B]'
                }`}
                onClick={() => {
                  setValue('partyType', 'customer', { shouldValidate: true });
                  setValue('partyId', '', { shouldValidate: false });
                  setValue('partyName', '', { shouldValidate: false });
                }}
              >
                عميل
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-0.5 ${
                  partyType === 'supplier' ? 'bg-[#0E78AA] text-white' : 'bg-[#EAF6FB] text-[#094C6B]'
                }`}
                onClick={() => {
                  setValue('partyType', 'supplier', { shouldValidate: true });
                  setValue('partyId', '', { shouldValidate: false });
                  setValue('partyName', '', { shouldValidate: false });
                }}
              >
                مورد
              </button>
            </div>
            {partyType === 'customer' ? (
              <CustomerSelect
                value={partyId}
                onChange={applyParty}
                emptyLabel="اختر الساحب / العميل..."
              />
            ) : (
              <SupplierSelect
                value={partyId}
                onChange={applyParty}
                emptyLabel="اختر الساحب / العميل..."
              />
            )}
            {errors.partyId ? (
              <span className="mt-1 block text-xs text-red-600">{errors.partyId.message}</span>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">الجهة</label>
            <input
              type="text"
              value={entityName}
              onChange={(e) => setValue('entityName', e.target.value, { shouldValidate: false })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:ring-1 focus-visible:ring-primary"
              placeholder="اسم المؤسسة / الشركة / الجهة"
            />
          </div>
        </div>

        <AdvancedFieldsSection title="الحقول المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <CompactFormField label="الاسم" placeholder="اسم الساحب" error={errors.partyName?.message} {...register('partyName')} />
            <CompactFormField label="العملة" error={errors.currencyId?.message}>
              <select className={`${compactControlClass} ${errors.currencyId ? 'border-red-400' : ''}`} {...register('currencyId')}>
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.arabicName || currency.englishName || currency.code}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField label="مركز التكلفة الافتراضي">
              <CostCenterSelect
                value={costCenterId || ''}
                onChange={(id) => setValue('costCenterId', id, { shouldValidate: false })}
                emptyLabel="اختر مركز التكلفة"
              />
            </CompactFormField>
            <CompactFormField label="ملاحظات داخلية" className="md:col-span-3">
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
            <span>جدول إدخال أوراق القبض</span>
            <span className="text-xs font-normal text-muted-foreground">
              أدخل الأوراق الجديدة هنا قبل الحفظ — ليس قائمة عرض للأوراق السابقة
            </span>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setShowDistribute(true)}>
            توزيع مبالغ
          </Button>
        </div>
        <BatchReceiptLinesGrid lines={lines} onChange={setLines} onAddRow={handleAddRow} />
      </section>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <BatchReceiptStickyFooter
        paperCount={validLines.length}
        totalAmount={totalAmount}
        currencyCode={selectedCurrency?.code || 'EGP'}
        onSave={onSave}
        onCancel={() => router.push('/accounting/operations/securities/reciept')}
        savePending={mutation.isPending}
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
