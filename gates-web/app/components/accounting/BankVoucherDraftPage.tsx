'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import {
  EditableJournalLinesTable,
  type EditableJournalLine,
} from '@/components/accounting/EditableJournalLinesTable';
import PaymentsDistributionModal from '@/components/LazyPaymentsDistributionModal';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  compactControlClass,
} from '@/components/ui';
import { DebitCreditTotals } from '@/components/accounting/DebitCreditTotals';
import { CrudButtons } from '@/components/ui/CrudButtons';
import {
  bankVoucherUiFormSchema,
  type BankVoucherUiFormInput,
} from '@/lib/validation/accounting.schema';

function defaultBankValues(): BankVoucherUiFormInput {
  const t = new Date().toISOString().split('T')[0];
  return {
    isAdvanced: true,
    isCyclic: true,
    isApproved: false,
    isPosted: false,
    isRestored: false,
    voucherStatus: 'غير مرحل',
    voucherNumber: '',
    description: '',
    date: t,
    hijriDate: '',
    currency: 'جنية مصري',
    invoice: '',
    style: '',
    treasury: 'الخزينة الرئيسية',
    treasuryId: '1212378971212',
    balance: '102,323,324,333',
    otherParty: '',
    debit: '25.4456',
    credit: '27.4456',
    counterpartyBank: '',
  };
}

export default function BankVoucherDraftPage({ title, logTag }: { title: string; logTag: string }) {
  const router = useRouter();
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [allocations, setAllocations] = useState<{ invoiceId: string; allocatedAmount: number }[]>([]);
  const [lines, setLines] = useState<EditableJournalLine[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
  } = useForm<BankVoucherUiFormInput>({
    resolver: zodResolver(bankVoucherUiFormSchema) as Resolver<BankVoucherUiFormInput>,
    defaultValues: defaultBankValues(),
    mode: 'onTouched',
  });

  const descriptionW = watch('description');
  const isAdvanced = watch('isAdvanced');
  const isApproved = watch('isApproved');
  const isPosted = watch('isPosted');
  const voucherStatus = watch('voucherStatus');

  const lineTotals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { debit, credit };
  }, [lines]);

  const onValid: SubmitHandler<BankVoucherUiFormInput> = (data) => {
    console.info(`[${logTag}] validated draft`, { ...data, lines });
  };

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0E78AA] text-center">{title}</h1>
      </div>
      <div className="mb-4 flex items-center gap-4">
        <span
          className={`text-sm font-medium transition-colors duration-200 ${!isAdvanced ? 'text-[#0E78AA]' : 'text-gray-700'}`}
        >
          عرض عادي
        </span>
        <label className="inline-flex cursor-pointer items-center">
          <Controller
            name="isAdvanced"
            control={control}
            render={({ field: { value, onChange } }) => (
              <>
                <input type="checkbox" className="sr-only" checked={value} onChange={() => onChange(!value)} />
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0E78AA] ${value ? 'bg-[#0E78AA]' : 'bg-white'}`}
                />
              </>
            )}
          />
        </label>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium transition-colors duration-200 ${isAdvanced ? 'text-[#0E78AA]' : 'text-gray-700'}`}
          >
            عرض الملغي
          </span>
          {isAdvanced && <span className="text-sm font-medium text-[#0E78AA] underline">استعاده</span>}
        </div>
      </div>

      <AdvancedFieldsSection title="إعدادات متقدمة" badgeCount={5}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-9 rounded-lg border border-[#D6EAF3] bg-white px-4 text-xs font-bold text-[#094C6B] hover:border-[#0E78AA] hover:text-[#0E78AA]"
            onClick={() => router.push('/accounting/cards/supplier')}
          >
            أضف مورد
          </button>
          <button
            type="button"
            className="h-9 rounded-lg border border-[#D6EAF3] bg-white px-4 text-xs font-bold text-[#094C6B] hover:border-[#0E78AA] hover:text-[#0E78AA]"
            onClick={() => setShowPaymentsModal(true)}
          >
            توزيع السدادات على الفواتير
            {allocations.length > 0 ? ` (${allocations.length})` : ''}
          </button>
          <button type="button" className="h-9 rounded-lg border border-[#D6EAF3] bg-white px-4 text-xs font-bold text-[#094C6B]">
            حالة الإعتمادات
          </button>
          <button type="button" className="h-9 rounded-lg border border-[#D6EAF3] bg-white px-4 text-xs font-bold text-[#094C6B]">
            سند دوري
          </button>
          <button type="button" className="h-9 rounded-lg border border-[#D6EAF3] bg-white px-4 text-xs font-bold text-[#094C6B]">
            فلترة
          </button>
        </div>
      </AdvancedFieldsSection>

      <FormSectionCard title="بيانات السند" subtitle="رقم السند والتاريخ والعملة">
        <div className="col-span-full mb-1 flex justify-end gap-2">
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#094C6B]">
            <Image src="/help.svg" alt="?" width={20} height={20} />
          </button>
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#094C6B]">
            <Image src="/magnifying-glass-1.svg" alt="بحث" width={20} height={20} className="filter brightness-0 invert" />
          </button>
        </div>

        <div className="col-span-full flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#094C6B]">سند دوري</span>
            <Controller
              name="isCyclic"
              control={control}
              render={({ field: { value, onChange } }) => (
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-[#0E78AA] focus:ring-2 focus:ring-[#0E78AA]"
                  checked={value}
                  onChange={(e) => onChange(e.target.checked)}
                />
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#094C6B]">{isApproved ? 'إعتماد' : 'إلغاء إعتماد'}</span>
            <Controller
              name="isApproved"
              control={control}
              render={({ field: { value, onChange } }) => (
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" className="sr-only" checked={value} onChange={(e) => onChange(e.target.checked)} />
                  <div
                    className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                      value ? 'bg-[#0E78AA]' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                        value ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </div>
                </label>
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#094C6B]">{isPosted ? 'فك ترحيل' : 'ترحيل'}</span>
            <Controller
              name="isPosted"
              control={control}
              render={({ field: { value, onChange } }) => (
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" className="sr-only" checked={value} onChange={(e) => onChange(e.target.checked)} />
                  <div
                    className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                      value ? 'bg-[#0E78AA]' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                        value ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </div>
                </label>
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#094C6B]">حالة السند</span>
            <button
              type="button"
              className={`rounded px-3 py-1 text-xs font-bold transition-colors ${
                voucherStatus === 'غير مرحل' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-400'
              }`}
              onClick={() => setValue('voucherStatus', 'غير مرحل')}
            >
              غير مرحل
            </button>
          </div>
        </div>

        <CompactFormField label="رقم السند" placeholder="إدخل رقم السند" {...register('voucherNumber')} />
        <CompactFormField label="التاريخ" type="date" {...register('date')} />
        <CompactFormField label="العملة">
          <select className={compactControlClass} {...register('currency')}>
            <option value="جنية مصري">جنية مصري</option>
          </select>
        </CompactFormField>
        <CompactFormField label="الشرح" placeholder="إدخل الشرح" {...register('description')} />
      </FormSectionCard>

      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={2}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CompactFormField label="الفاتورة">
            <select className={compactControlClass} {...register('invoice')}>
              <option value="شاملة">شاملة</option>
            </select>
          </CompactFormField>
          <CompactFormField label="النمط">
            <select className={compactControlClass} {...register('style')}>
              <option value="النمط">النمط</option>
            </select>
          </CompactFormField>
        </div>
      </AdvancedFieldsSection>

      <FormSectionCard title="الصندوق والرصيد">
        <CompactFormField label="الصندوق" className="sm:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-2">
            <input type="text" className={`${compactControlClass} w-32`} readOnly {...register('treasuryId')} />
            <input type="text" className={compactControlClass} readOnly {...register('treasury')} />
            <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0E78AA] hover:bg-[#0B5A7A]">
              <Image src="/magnifying-glass-1.svg" alt="بحث" width={20} height={20} className="filter brightness-0 invert" />
            </button>
          </div>
        </CompactFormField>
        <CompactFormField label="الرصيد">
          <input type="text" className={compactControlClass} readOnly {...register('balance')} />
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard title="تصنيف الأطراف">
        <select className={compactControlClass}>
          <option>أطراف دائنة أخرى</option>
        </select>
        <select className={compactControlClass}>
          <option>القسم</option>
        </select>
        <select className={compactControlClass}>
          <option>الرقم</option>
        </select>
        <button type="button" className="h-9 cursor-not-allowed rounded-lg border border-[#D6EAF3] bg-[#EEF7FB] px-4 text-xs font-bold text-[#B0B0B0]" disabled>
          تحميل
        </button>
      </FormSectionCard>

      <FormSectionCard title="بنود السند" subtitle="جدول إدخال — يُرسل مع الحفظ" bodyClassName="grid-cols-1">
        <EditableJournalLinesTable
          lines={lines}
          onChange={setLines}
          headerDescription={descriptionW}
        />
      </FormSectionCard>

      <FormSectionCard title="الأطراف">
        <div className="col-span-full">
          <DebitCreditTotals
            debit={lineTotals.debit}
            credit={lineTotals.credit}
            debitLabel="أطراف مدينة"
            creditLabel="أطراف دائنة"
          />
        </div>
        <CompactFormField label="القيد">
          <input type="text" className={compactControlClass} readOnly {...register('otherParty')} />
        </CompactFormField>
        <CompactFormField label="البنك" placeholder="إدخل الصندوق" {...register('counterpartyBank')} />
      </FormSectionCard>

      <FormStickyFooter
        onSave={() => void handleSubmit(onValid)()}
        onCancel={() => {
          reset(defaultBankValues());
          setLines([]);
        }}
        saveText="حفظ"
        extraActions={
          <CrudButtons
            extraItems={[
              { id: 'preview', label: 'معاينة', onClick: () => {} },
              { id: 'design', label: 'تصميم', onClick: () => {} },
            ]}
          />
        }
      />
      <PaymentsDistributionModal
        isOpen={showPaymentsModal}
        onClose={() => setShowPaymentsModal(false)}
        side={title.includes('قبض') || title.includes('إضافة') ? 'receivable' : 'payable'}
        receiptTotal={lineTotals.debit || lineTotals.credit}
        draftMode
        onApplyDraft={setAllocations}
      />
    </div>
  );
}
