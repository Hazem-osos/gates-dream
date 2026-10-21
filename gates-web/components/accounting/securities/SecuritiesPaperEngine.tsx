'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { pinDocumentTabQuery } from '@/lib/navigation/tab-memory';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Files } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
import { ErpFormHeaderCard, ErpFieldError } from '@/components/erp/ErpFormHeaderCard';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import { erpInputClass, erpInputErrorClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import {
  DocumentSectionNumberPair,
  sectionNumberInputClass,
  sectionNumberLabelClass,
} from '@/components/erp/DocumentSectionNumberPair';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { VoucherAccountCombobox } from '@/components/accounting/vouchers/VoucherAccountCombobox';
import { RequiredDot } from '@/components/erp/RequiredDot';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useCurrenciesQuery } from '@/lib/hooks/useMasterDataQueries';
import { pickCurrencyByCode, rateForCurrency } from '@/lib/accounting/fx-base';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { printSecuritiesCheque } from '@/lib/print/printSecuritiesCheque';
import { DocumentCurrencyRateFields } from '@/components/accounting/DocumentCurrencyRateFields';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import {
  isAlreadyPostedError,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { toHijri } from '@/lib/dates/hijri';
import { SecuritiesDateHijriField } from './SecuritiesDateHijriField';
import {
  SecuritiesBounceModal,
  SecuritiesCollectModal,
  SecuritiesEndorseModal,
} from './SecuritiesLifecycleModals';
import { MultiCollectionModal } from './MultiCollectionModal';
import {
  buildSecuritiesPaperDescription,
  isoDateOnly,
  resolveSecuritiesPaperCase,
  securitiesPaperStatus,
  securitiesPaperTitle,
  paperPartyDisplayName,
  unpostBlockedByPaperCase,
  type SecuritiesPaperKind,
  type SecuritiesPaperRecord,
} from './securities-paper-status';
import { isTransactionSerialAutomatic } from '@/lib/transaction-settings/serial-mode';
import type { TransactionSettings } from '@/lib/transaction-settings/types';
import { SecuritiesEntitySelect } from './SecuritiesEntitySelect';
import PaymentsDistributionModal from '@/components/LazyPaymentsDistributionModal';
import {
  DocumentFormLock,
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';

function makeFormSchema(kind: SecuritiesPaperKind) {
  return z
    .object({
      date: z.string().min(1, 'يرجى إدخال تاريخ التحرير'),
      hijriDate: z.string().optional(),
      dueDate: z.string().min(1, 'يرجى إدخال تاريخ الاستحقاق'),
      dueHijriDate: z.string().optional(),
      currencyId: z.string().min(1, 'اختر العملة'),
      exchangeRate: z.coerce.number().positive().optional(),
      partyType: z.enum(['customer', 'supplier', 'account']),
      partyId: z.string().min(1, kind === 'payment' ? 'يرجى اختيار المورد أو حساب حركة' : 'يرجى اختيار العميل أو حساب حركة'),
      accountId: z.string().optional(),
      costCenterId: z.string().optional(),
      securityType: z.enum(['check', 'promissory-note', 'bond', 'other']),
      serial: z.string().optional(),
      documentNumber: z.string().optional(),
      securityNumber: z.string().min(1, 'يرجى إدخال رقم الشيك'),
      description: z.string().optional(),
      partyName: z.string().optional(),
      entityName: z.string().optional(),
      entityId: z.string().optional(),
      bankName: z.string().optional(),
      amount: z.string(),
      paidTo: z.string().optional(),
      depositInBank: z.boolean(),
      payBeneficiaryFirst: z.boolean(),
      bearerCheque: z.boolean(),
      depositAccountId: z.string().optional(),
      bankIssueDate: z.string().optional(),
      bankHijriDate: z.string().optional(),
      department: z.string().optional(),
      refNumber: z.string().optional(),
    })
    .superRefine((d, ctx) => {
      const amt = parseFloat(String(d.amount).replace(/,/g, ''));
      if (!Number.isFinite(amt) || amt <= 0) {
        ctx.addIssue({ code: 'custom', message: 'يرجى إدخال مبلغ صحيح', path: ['amount'] });
      }
      if (d.date && d.dueDate && d.dueDate < d.date) {
        ctx.addIssue({
          code: 'custom',
          message: 'تاريخ الاستحقاق لا يمكن أن يكون قبل تاريخ التحرير',
          path: ['dueDate'],
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof makeFormSchema>>;

async function resolvePartyFromAccount(
  kind: SecuritiesPaperKind,
  accountId: string
): Promise<{ id: string; arabicName?: string } | null> {
  if (!accountId) return null;
  try {
    const path = kind === 'payment' ? '/accounting/suppliers' : '/accounting/customers';
    const res = await apiClient.get<Array<{ id: string; arabicName?: string }>>(
      path,
      { accountId, limit: 1, isActive: true },
      { skipErrorNotify: true }
    );
    const row = Array.isArray(res.data) ? res.data[0] : undefined;
    return row?.id ? row : null;
  } catch {
    return null;
  }
}

type PaperAllocation = { invoiceId: string; allocatedAmount: number };

function parsePaperAllocations(value: unknown): PaperAllocation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      invoiceId: String((row as { invoiceId?: unknown })?.invoiceId || ''),
      allocatedAmount: Number((row as { allocatedAmount?: unknown })?.allocatedAmount),
    }))
    .filter((row) => row.invoiceId && Number.isFinite(row.allocatedAmount) && row.allocatedAmount > 0);
}

const advancedActionClass =
  'inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-bold text-gray-700 transition-colors hover:border-[#0E78AA] hover:text-[#0E78AA] disabled:opacity-40';

type Named = { id: string; code?: string; arabicName: string; englishName?: string };
type Currency = Named & { code: string; exchangeRate?: number | string | null };
function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function defaultCurrencyId(currencies: Currency[], companyBase = 'EGP'): string {
  if (!currencies.length) return '';
  return pickCurrencyByCode(currencies, companyBase)?.id || currencies[0].id;
}

function emptyForm(
  currencies: Currency[],
  kind: SecuritiesPaperKind = 'receipt',
  defaultAccountId = ''
): FormValues {
  const date = todayIso();
  return {
    date,
    hijriDate: toHijri(date),
    dueDate: date,
    dueHijriDate: toHijri(date),
    currencyId: defaultCurrencyId(currencies),
    exchangeRate: 1,
    partyType: kind === 'payment' ? 'supplier' : 'customer',
    partyId: '',
    accountId: defaultAccountId,
    costCenterId: '',
    securityType: 'check',
    serial: '',
    documentNumber: '',
    securityNumber: '',
    description: '',
    partyName: '',
    entityName: '',
    entityId: '',
    bankName: '',
    amount: '',
    paidTo: '',
    depositInBank: false,
    payBeneficiaryFirst: false,
    bearerCheque: false,
    depositAccountId: '',
    bankIssueDate: '',
    bankHijriDate: '',
    department: '',
    refNumber: '',
  };
}

function resolvedPaperSerial(record: SecuritiesPaperRecord): string {
  return String(record.serial || record.receiptNumber || record.paymentNumber || '').trim();
}

function paperDraftHasEntry(values: FormValues): boolean {
  return [
    values.partyId,
    values.partyName,
    values.paidTo,
    values.securityNumber,
    values.documentNumber,
    values.serial,
    values.amount,
    values.bankName,
    values.description,
    values.entityName,
    values.costCenterId,
    values.refNumber,
    values.depositAccountId,
  ].some((value) => String(value ?? '').trim());
}

type Props = { kind: SecuritiesPaperKind };

export function SecuritiesPaperEngine({ kind }: Props) {
  return (
    <DocumentModeProvider>
      <Suspense
        fallback={
          <p className="p-6 text-sm text-muted-foreground">
            {kind === 'payment' ? 'جاري فتح ورقة المدفوعات…' : 'جاري فتح ورقة المقبوضات…'}
          </p>
        }
      >
        <SecuritiesPaperEngineInner kind={kind} />
      </Suspense>
    </DocumentModeProvider>
  );
}

function SecuritiesPaperEngineInner({ kind }: Props) {
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const lastViewLockedIdRef = useRef<string | null>(null);
  const resetNewRef = useRef<() => void>(() => {});
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const idFromUrl = searchParams.get('id')?.trim() || null;
  const invalidateQuery = useInvalidateQuery();
  const title = securitiesPaperTitle(kind);
  const apiPath = kind === 'payment' ? '/accounting/securities-payments' : '/accounting/securities-receipts';
  const listKey = kind === 'payment' ? 'securities-payments' : 'securities-receipts';
  const settingsDocumentType = kind === 'payment' ? 'SECURITIES_PAYMENT' : 'SECURITIES_RECEIPT';
  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', settingsDocumentType],
    `/transaction-settings/${settingsDocumentType}`
  );
  const autoPostOnSave = txSettingsRes?.data?.autoPostOnSave === true;
  const autoPostOnSaveRef = useRef(autoPostOnSave);
  autoPostOnSaveRef.current = autoPostOnSave;
  const { consumeShouldRepost, resetKeepPosted, markUnpostedForEdit } = useRepostAfterUnpost(
    txSettingsRes?.data?.autoPostOnSave
  );
  const { data: defaultsRes } = useApiQuery<{ notesAccountId?: string }>(
    [listKey, 'defaults'],
    `${apiPath}/defaults`
  );
  const defaultAccountId =
    txSettingsRes?.data?.defaultOffsetAccountId || defaultsRes?.data?.notesAccountId || '';
  const autoNumbering = isTransactionSerialAutomatic(txSettingsRes?.data?.numberingMode);
  const bulkHref =
    kind === 'payment'
      ? '/accounting/operations/securities/payment/bulk'
      : '/treasury/papers/batch-receipt/new';
  const favoriteHref =
    kind === 'payment'
      ? '/accounting/operations/securities/payment'
      : '/accounting/operations/securities/receipt';
  const paidToLabel = kind === 'payment' ? 'مدفوع إلى' : 'مقبوض من';
  const formSchema = useMemo(() => makeFormSchema(kind), [kind]);

  const [showList, setShowList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId((prev) => (prev === idFromUrl ? prev : idFromUrl));
  }, [idFromUrl]);
  const { data: nextNumberResponse } = useApiQuery<{ automatic: boolean; number: string }>(
    ['securities-paper-next-number', kind],
    `${apiPath}/next-number`,
    undefined,
    { enabled: !selectedId, staleTime: 0 }
  );
  const paperSerialAutomatic = autoNumbering && nextNumberResponse?.data?.automatic === true;
  const previewPaperNumber = nextNumberResponse?.data?.number?.trim() || '';
  const [loaded, setLoaded] = useState<SecuritiesPaperRecord | null>(null);
  const { data: openingJournalRes } = useApiQuery<{ isPosted?: boolean }>(
    ['opening-balance-meta', 'paper-lock'],
    '/accounting/opening-balance',
    undefined,
    { enabled: Boolean(loaded?.isOpening), staleTime: 0, refetchOnMount: 'always' }
  );
  const openingJournalPosted = Boolean(loaded?.isOpening && openingJournalRes?.data?.isPosted);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCollect, setShowCollect] = useState(false);
  const [showMulti, setShowMulti] = useState(false);
  const [multiPending, setMultiPending] = useState(false);
  const [cancelLineId, setCancelLineId] = useState<string | null>(null);
  const [showReturn, setShowReturn] = useState(false);
  const [showEndorse, setShowEndorse] = useState(false);
  const [depositSaving, setDepositSaving] = useState(false);
  const [actionPaperId, setActionPaperId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [allocations, setAllocations] = useState<PaperAllocation[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: emptyForm([], kind),
    mode: 'onTouched',
  });

  const date = watch('date');
  const dueDate = watch('dueDate');
  const bankIssueDate = watch('bankIssueDate');
  const { code: companyBaseCurrency } = useCompanyBaseCurrency();
  const { profile: companyPrintProfile } = useCompanyPrintProfile();
  const currencyId = watch('currencyId');
  const exchangeRateWatch = watch('exchangeRate');
  const partyType = watch('partyType');
  const partyId = watch('partyId');
  const depositInBank = watch('depositInBank');
  const securityType = watch('securityType');
  const payBeneficiaryFirst = watch('payBeneficiaryFirst');
  const bearerCheque = watch('bearerCheque');
  const amountWatch = watch('amount');
  const securityNumber = watch('securityNumber');
  const documentNumber = watch('documentNumber');
  const serialWatch = watch('serial');

  useEffect(() => {
    if (selectedId || loaded?.id || !paperSerialAutomatic || !previewPaperNumber) return;
    setValue('serial', previewPaperNumber, { shouldDirty: false, shouldValidate: false });
    setValue('documentNumber', previewPaperNumber, { shouldDirty: false, shouldValidate: false });
  }, [loaded?.id, paperSerialAutomatic, previewPaperNumber, selectedId, setValue]);
  const partyName = watch('partyName');
  const accountIdWatch = watch('accountId');
  const draftValues = useMemo(
    () => getValues(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot for draft autosave only
    [
      date,
      dueDate,
      bankIssueDate,
      currencyId,
      exchangeRateWatch,
      partyType,
      partyId,
      accountIdWatch,
      depositInBank,
      securityType,
      payBeneficiaryFirst,
      bearerCheque,
      amountWatch,
      securityNumber,
      documentNumber,
      partyName,
      serialWatch,
      getValues,
    ]
  );
  const { restoreOffer, acceptRestore, dismissRestore, clearDraft } = useDraftAutosave<FormValues>({
    documentType: kind === 'payment' ? 'securities-payment' : 'securities-receipt',
    mode: 'new',
    value: draftValues,
    enabled: !selectedId,
    applyRestore: (payload) => {
      reset(payload);
      setMode('create');
    },
    isEmpty: (payload) => !paperDraftHasEntry(payload),
    restoreMessage:
      kind === 'payment'
        ? 'يوجد مسودة ورقة مدفوعات غير محفوظة'
        : 'يوجد مسودة ورقة مقبوضات غير محفوظة',
  });

  const { data: partyCardRes } = useApiQuery<{ arabicName?: string; englishName?: string }>(
    [partyType === 'supplier' ? 'supplier-card' : 'customer-card', partyId],
    partyId
      ? partyType === 'supplier'
        ? `/accounting/suppliers/${partyId}`
        : `/accounting/customers/${partyId}`
      : '/accounting/customers',
    undefined,
    { enabled: Boolean(partyId) && partyType !== 'account' }
  );
  const { data: partyAccountRes } = useApiQuery<{ arabicName?: string; code?: string }>(
    ['paper-party-account', partyId],
    partyId && partyType === 'account' ? `/accounting/accounts/${partyId}` : '/accounting/accounts',
    undefined,
    { enabled: Boolean(partyId) && partyType === 'account' }
  );

  useEffect(() => {
    const cardName = partyCardRes?.data?.arabicName || partyCardRes?.data?.englishName || '';
    const account = partyAccountRes?.data;
    const accountName = account?.arabicName
      ? account.code
        ? `[${account.code}] ${account.arabicName}`
        : account.arabicName
      : '';
    const name = partyType === 'account' ? accountName : cardName;
    if (!name) return;
    setValue('partyName', name, { shouldValidate: false });
    setValue('paidTo', name, { shouldValidate: false });
  }, [partyAccountRes?.data, partyCardRes?.data, partyType, setValue]);

  useEffect(() => {
    setValue('hijriDate', toHijri(date || ''), { shouldValidate: false });
  }, [date, setValue]);
  useEffect(() => {
    setValue('dueHijriDate', toHijri(dueDate || ''), { shouldValidate: false });
  }, [dueDate, setValue]);
  useEffect(() => {
    setValue('bankHijriDate', toHijri(bankIssueDate || ''), { shouldValidate: false });
  }, [bankIssueDate, setValue]);

  const { data: currenciesResponse } = useCurrenciesQuery();
  const currencies = useMemo(() => (currenciesResponse?.data ?? []) as Currency[], [currenciesResponse?.data]);
  const { data: departmentsResponse } = useApiQuery<Named[]>(['hr-departments'], '/hr/departments', {
    limit: 200,
  });
  const departments = useMemo(() => departmentsResponse?.data ?? [], [departmentsResponse?.data]);
  const { data: recordResponse } = useApiQuery<SecuritiesPaperRecord>(
    [listKey, 'one', selectedId],
    selectedId ? `${apiPath}/${selectedId}` : apiPath,
    undefined,
    { enabled: Boolean(selectedId) }
  );

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

  const hydrateFromRecord = useCallback(
    (record: SecuritiesPaperRecord) => {
      setLoaded(record);
      const partyIsSupplier = Boolean(record.supplierId);
      const partyIsCustomer = Boolean(record.customerId);
      const name = paperPartyDisplayName(record);
      const issue = isoDateOnly(record.date) || todayIso();
      const due = isoDateOnly(record.dueDate);
      reset({
        ...emptyForm(currencies, kind, defaultAccountId),
        date: issue,
        hijriDate: record.hijriDate || toHijri(issue),
        dueDate: due,
        dueHijriDate: toHijri(due),
        currencyId:
          currencies.find((c) => c.code === record.currencyCode)?.id ||
          defaultCurrencyId(currencies, companyBaseCurrency),
        exchangeRate: rateForCurrency(
          record.currencyCode,
          companyBaseCurrency,
          currencies.find((c) => c.code === record.currencyCode)?.exchangeRate
        ),
        partyType: record.partyAccountId && !partyIsCustomer && !partyIsSupplier
          ? 'account'
          : partyIsSupplier
            ? 'supplier'
            : partyIsCustomer
              ? 'customer'
              : kind === 'payment'
                ? 'supplier'
                : 'customer',
        partyId: record.supplierId || record.customerId || record.partyAccountId || '',
        accountId: record.destinationAccountId || defaultAccountId || '',
        depositInBank: Boolean(record.depositAccountId),
        depositAccountId: record.depositAccountId || '',
        bankIssueDate: isoDateOnly(record.depositDate),
        bankHijriDate: toHijri(isoDateOnly(record.depositDate)),
        securityType: (record.securityType as FormValues['securityType']) || 'check',
        serial: resolvedPaperSerial(record),
        documentNumber: record.paymentNumber || record.receiptNumber || '',
        securityNumber: record.securityNumber || '',
        description: record.description || '',
        partyName: name,
        entityName: record.entityName || record.entity?.arabicName || '',
        entityId: record.entityId || record.entity?.id || '',
        bankName: (kind === 'payment' ? record.payeeBank : record.issuerBank) || '',
        amount: record.amount != null ? String(record.amount) : '',
        payBeneficiaryFirst: Boolean(record.payBeneficiaryFirst),
        bearerCheque: Boolean(record.bearerCheque),
      });
      setAllocations(parsePaperAllocations(record.invoiceAllocations));
    },
    [companyBaseCurrency, currencies, defaultAccountId, kind, reset]
  );

  useEffect(() => {
    const record = recordResponse?.data;
    if (!record || !selectedId || record.id !== selectedId) return;
    if (!isReadOnly) return;
    hydrateFromRecord(record);
  }, [hydrateFromRecord, isReadOnly, recordResponse?.data, selectedId]);

  const applyParty = (id: string, name?: string, type?: 'customer' | 'supplier') => {
    setValue('partyType', type || (kind === 'payment' ? 'supplier' : 'customer'), { shouldValidate: false });
    setValue('partyId', id, { shouldValidate: true });
    if (name) {
      setValue('partyName', name, { shouldValidate: false });
      setValue('paidTo', name, { shouldValidate: false });
    }
  };

  const syncPaperTab = (id: string | null) => {
    pinDocumentTabQuery(id, favoriteHref);
    router.replace(id ? `${favoriteHref}?id=${encodeURIComponent(id)}` : favoriteHref, {
      scroll: false,
    });
  };

  const applyLoaded = (record: SecuritiesPaperRecord, fallbackId: string) => {
    const id = record.id || fallbackId;
    setSelectedId(id);
    setLoaded(record);
    lastViewLockedIdRef.current = id;
    const latestJournal =
      record.journals?.[record.journals.length - 1]?.id || record.journalEntryId || null;
    if (latestJournal) setSelectedJournalId(latestJournal);
    syncPaperTab(id);
    invalidateQuery([listKey]);
    invalidateQuery([`${listKey}-browse`]);
    invalidateQuery([listKey, 'one', id]);
    invalidateQuery(['journal-entry']);
    if (latestJournal) invalidateQuery(['journal-entry', latestJournal]);
  };

  const postPaperAfterSave = async (id: string) => {
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/post`, {});
      if (res.data) {
        applyLoaded(res.data, id);
        hydrateFromRecord(res.data);
      }
    } catch (err) {
      if (isAlreadyPostedError(err)) {
        invalidateQuery([listKey, 'one', id]);
        return;
      }
      throw err;
    }
  };

  const createMutation = useApiMutation<SecuritiesPaperRecord, Record<string, unknown>>(apiPath, 'POST', {
    showSuccessToast: false,
    onSuccess: (res) => {
      const created = res?.data;
      resetKeepPosted();
      clearDraft();
      if (!created?.id) {
        setSuccess(
          kind === 'payment'
            ? 'تم حفظ ورقة المدفوعات وإنشاء قيد التحرير'
            : 'تم حفظ ورقة المقبوضات وإنشاء قيد التحرير'
        );
        return;
      }
      applyLoaded(created, created.id);
      hydrateFromRecord(created);
      invalidateQuery(['securities-paper-next-number', kind]);
      lockToView();
      if (autoPostOnSaveRef.current && !created.isPosted) {
        void postPaperAfterSave(created.id)
          .then(() => {
            setSuccess(
              kind === 'payment'
                ? 'تم حفظ ورقة المدفوعات وترحيل قيد التحرير'
                : 'تم حفظ ورقة المقبوضات وترحيل قيد التحرير'
            );
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'تم الحفظ لكن تعذر ترحيل الورقة');
          });
        return;
      }
      const posted = Boolean(created.isPosted);
      setSuccess(
        posted
          ? kind === 'payment'
            ? 'تم حفظ ورقة المدفوعات وترحيل قيد التحرير'
            : 'تم حفظ ورقة المقبوضات وترحيل قيد التحرير'
          : kind === 'payment'
            ? 'تم حفظ ورقة المدفوعات وإنشاء قيد التحرير'
            : 'تم حفظ ورقة المقبوضات وإنشاء قيد التحرير'
      );
    },
    onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
  });

  const status = securitiesPaperStatus(loaded);
  const docNumber =
    serialWatch ||
    (loaded ? resolvedPaperSerial(loaded) : '') ||
    securityNumber ||
    documentNumber ||
    loaded?.securityNumber ||
    '';
  const amountNum = parseFloat(String(amountWatch || '').replace(/,/g, '')) || 0;
  const multiCollected = (loaded?.multiCollectionLines ?? []).reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0
  );
  const multiRemaining = Math.max(0, Math.round((amountNum - multiCollected) * 100) / 100);
  const paperCase = loaded?.id ? resolveSecuritiesPaperCase(loaded) : 'ISSUED';
  const hasDocument = Boolean(selectedId || loaded?.id);
  const cancelled = Boolean(loaded?.isCancelled);
  const lifecycleLocked = Boolean(
    loaded?.id &&
      (cancelled ||
        paperCase === 'COLLECTED' ||
        paperCase === 'BOUNCED' ||
        paperCase === 'ENDORSED' ||
        paperCase === 'MULTI_COLLECTED')
  );
  const locked = lifecycleLocked || (hasDocument && isReadOnly);

  useEffect(() => {
    if (!selectedId) return;
    if (lastViewLockedIdRef.current === selectedId) return;
    lastViewLockedIdRef.current = selectedId;
    lockToView();
  }, [selectedId, lockToView]);
  const journals = loaded?.journals ?? [];
  const activeJournalId =
    selectedJournalId && journals.some((row) => row.id === selectedJournalId)
      ? selectedJournalId
      : journals[journals.length - 1]?.id || loaded?.journalEntryId || null;

  useEffect(() => {
    if (locked) return;
    const next = buildSecuritiesPaperDescription(
      kind,
      securityNumber || '',
      partyName || '',
      dueDate || ''
    );
    if (next) setValue('description', next, { shouldValidate: false });
  }, [kind, securityNumber, partyName, dueDate, locked, setValue]);

  const advancedFilled = [watch('department'), watch('refNumber'), watch('costCenterId')].filter(
    (v) => String(v ?? '').trim()
  ).length;
  const actionId = actionPaperId || selectedId;

  const resetNew = () => {
    clearDraft();
    resetKeepPosted();
    lastViewLockedIdRef.current = null;
    setSelectedId(null);
    setLoaded(null);
    setSelectedJournalId(null);
    reset(emptyForm(currencies, kind, defaultAccountId));
    setMode('create');
    syncPaperTab(null);
    setError('');
    setSuccess('');
    setAllocations([]);
    setShowPaymentsModal(false);
  };
  resetNewRef.current = resetNew;

  useEffect(() => {
    if (locked) return;
    if (!defaultAccountId || accountIdWatch) return;
    setValue('accountId', defaultAccountId, { shouldValidate: false });
  }, [accountIdWatch, defaultAccountId, locked, setValue]);

  const buildPayload = (values: FormValues): Record<string, unknown> => {
    const selectedCurrency = currencies.find((c) => c.id === values.currencyId);
    return {
      date: new Date(values.date).toISOString(),
      securityType: values.securityType,
      amount: parseFloat(String(values.amount).replace(/,/g, '')),
      currencyCode: selectedCurrency?.code || 'EGP',
      serial: values.serial || undefined,
      description: values.description || undefined,
      entityName: values.entityName || undefined,
      entityId: values.entityId || undefined,
      hijriDate: values.hijriDate || toHijri(values.date) || undefined,
      customerId: values.partyType === 'customer' ? values.partyId || null : null,
      supplierId: values.partyType === 'supplier' ? values.partyId || null : null,
      partyAccountId: values.partyType === 'account' ? values.partyId || null : null,
      destinationAccountId: values.accountId || null,
      securityNumber: values.securityNumber || undefined,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
      ...(kind === 'payment'
        ? {
            paymentNumber: values.documentNumber || values.serial || undefined,
            payeeName: values.partyName || undefined,
            payeeBank: values.bankName || undefined,
          }
        : {
            receiptNumber: values.documentNumber || values.serial || undefined,
            issuerName: values.partyName || undefined,
            issuerBank: values.bankName || undefined,
            depositAccountId: values.depositInBank ? values.depositAccountId || null : null,
            depositDate:
              values.depositInBank && values.bankIssueDate
                ? new Date(values.bankIssueDate).toISOString()
                : null,
          }),
      allocations: allocations.length ? allocations : [],
      payBeneficiaryFirst: Boolean(values.payBeneficiaryFirst),
      bearerCheque: Boolean(values.bearerCheque),
    };
  };

  const printChequeFromForm = () => {
    const values = getValues();
    if (values.securityType !== 'check') {
      setError('طباعة الشيك متاحة لنوع «شيك» فقط');
      return;
    }
    const amt = parseFloat(String(values.amount).replace(/,/g, ''));
    const currency = currencies.find((c) => c.id === values.currencyId);
    void printSecuritiesCheque({
      kind,
      companyName: companyPrintProfile?.nameAr,
      chequeNumber: values.securityNumber || '',
      issueDate: values.date || todayIso(),
      dueDate: values.dueDate || undefined,
      payeeName: values.partyName || values.paidTo || '',
      bankName: values.bankName || values.entityName || '',
      amount: amt,
      currencyCode: currency?.code || loaded?.currencyCode || companyBaseCurrency || 'EGP',
      payBeneficiaryFirst: Boolean(values.payBeneficiaryFirst),
      bearerCheque: Boolean(values.bearerCheque),
    });
  };

  const firstFormError = (errs: FieldErrors<FormValues>): string => {
    for (const value of Object.values(errs)) {
      if (value && typeof value === 'object' && 'message' in value && value.message) {
        return String(value.message);
      }
    }
    return 'أكمل الحقول المطلوبة قبل الحفظ';
  };

  const onSave = () => {
    if (saving || createMutation.isPending) return;
    void handleSubmit(
      async (values) => {
        setError('');
        setSuccess('');
        const manualSerial = values.serial?.trim() || values.documentNumber?.trim();
        if (!selectedId && !autoNumbering && !manualSerial) {
          setError('أدخل المسلسل يدوياً — الترقيم مضبوط على يدوي في إعدادات الورقة');
          return;
        }
        if (kind === 'receipt' && values.depositInBank) {
          if (!values.depositAccountId?.trim()) {
            setError('اختر حساب أوراق القبض برسم التحصيل');
            return;
          }
          if (!values.bankIssueDate?.trim()) {
            setError('أدخل تاريخ الإيداع في البنك');
            return;
          }
        }
        const body = buildPayload(values);
        if (selectedId) {
          setSaving(true);
          try {
            const updated = await apiClient.put<SecuritiesPaperRecord>(`${apiPath}/${selectedId}`, body);
            if (updated.data) applyLoaded(updated.data, selectedId);
            else {
              invalidateQuery([listKey]);
              invalidateQuery([listKey, 'one', selectedId]);
              invalidateQuery(['journal-entry']);
            }
            const fromUnpost = consumeShouldRepost();
            const savedUnposted = !(updated.data?.isPosted ?? loaded?.isPosted);
            if (selectedId && (fromUnpost || (autoPostOnSaveRef.current && savedUnposted))) {
              try {
                await postPaperAfterSave(selectedId);
                setSuccess('تم حفظ التعديلات وترحيل الورقة');
              } catch (repostErr) {
                setError(
                  repostErr instanceof Error
                    ? repostErr.message
                    : 'تم الحفظ لكن تعذر ترحيل الورقة'
                );
                return;
              }
            } else {
              setSuccess('تم تحديث الورقة وقيد التحرير');
            }
            resetKeepPosted();
            lockToView();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء التحديث');
          } finally {
            setSaving(false);
          }
          return;
        }
        createMutation.mutate(body);
      },
      (errs) => setError(firstFormError(errs))
    )();
  };

  const onPostDoc = async () => {
    const id = selectedId || loaded?.id;
    if (!id) return;
    setPosting(true);
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/post`, {});
      applyLoaded(res.data ?? { ...loaded, id, isPosted: true }, id);
      setSuccess('تم ترحيل الورقة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر ترحيل الورقة');
    } finally {
      setPosting(false);
    }
  };

  const onUnpostDoc = async () => {
    const id = selectedId || loaded?.id;
    if (!id) return;
    if (loaded?.isOpening) {
      if (openingJournalPosted) {
        setError('فك ترحيل قيد الرصيد الافتتاحي أولاً ثم عدّل الشيك.');
      } else {
        unlockForEdit();
        setSuccess('قيد الرصيد الافتتاحي غير مرحّل. تقدر تعدّل الشيك، وبعد الترحيل يتحدث رصيده.');
      }
      return;
    }
    const laterEventHint = unpostBlockedByPaperCase(paperCase);
    if (laterEventHint) {
      setError(laterEventHint);
      return;
    }
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/unpost`, {});
      const next = res.data ?? { ...loaded, id, isPosted: false };
      applyLoaded(next, id);
      hydrateFromRecord(next);
      markUnpostedForEdit();
      unlockForEdit();
      setSuccess('تم فك ترحيل الورقة — تقدر تعدّل وتحفظ');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فك ترحيل الورقة');
    }
  };

  const undoPaperCase = async () => {
    const id = selectedId || loaded?.id;
    if (!id) return;
    try {
      if (paperCase === 'COLLECTED') {
        const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/uncollect`, {});
        applyLoaded(res.data ?? { ...loaded, id, paperCase: 'ISSUED' }, id);
        lockToView();
        setSuccess('تم فك التحصيل وعادت الورقة محررة');
        return;
      }
      if (paperCase === 'ENDORSED') {
        const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/unendorse`, {});
        applyLoaded(res.data ?? { ...loaded, id, paperCase: 'ISSUED', isPosted: false }, id);
        lockToView();
        setSuccess('تم فك التظهير وعادت الورقة محررة');
        return;
      }
      if (paperCase === 'BOUNCED') {
        const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/restore`, {});
        applyLoaded(res.data ?? { ...loaded, id, paperCase: 'ISSUED', isCancelled: false }, id);
        lockToView();
        setSuccess('تم فك الارتداد وعادت الورقة محررة');
        return;
      }
      setError('لا توجد حالة لفكها');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فك حالة الورقة');
    }
  };

  const onCancelDoc = async () => {
    if (!selectedId) {
      resetNew();
      return;
    }
    if (paperCase !== 'ISSUED') {
      setError('فك حالة الورقة أولاً قبل الإلغاء');
      return;
    }
    if (loaded?.isCancelled) return;
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${selectedId}/cancel`, {});
      const next = res.data ?? { ...loaded, id: selectedId, isCancelled: true, isPosted: false };
      applyLoaded(next, selectedId);
      hydrateFromRecord(next);
      lockToView();
      setSuccess('تم إلغاء الورقة — حالتها ملغي');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الورقة');
    }
  };

  const onRestoreDoc = async () => {
    const id = selectedId || loaded?.id;
    if (!id) return;
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/restore`, {});
      const next = res.data ?? { ...loaded, id, isCancelled: false, paperCase: 'ISSUED' };
      applyLoaded(next, id);
      hydrateFromRecord(next);
      lockToView();
      setSuccess('تم استعادة الورقة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر استعادة الورقة');
    }
  };

  const openLifecycle = (action: 'collect' | 'bounce' | 'endorse') => {
    const id = selectedId || loaded?.id || null;
    if (!id) {
      setError('احفظ الورقة أولاً');
      return;
    }
    if (!loaded?.isPosted) {
      setError('رحّل الورقة أولاً');
      return;
    }
    setActionPaperId(id);
    if (action === 'collect') setShowCollect(true);
    if (action === 'bounce') setShowReturn(true);
    if (action === 'endorse') {
      if (kind !== 'receipt') return;
      setShowEndorse(true);
    }
  };

  const openMultiCollect = () => {
    const id = selectedId || loaded?.id || null;
    if (!id) {
      setError('احفظ الورقة أولاً');
      return;
    }
    if (!loaded?.isPosted) {
      setError('رحّل الورقة أولاً');
      return;
    }
    setActionPaperId(id);
    setShowMulti(true);
  };

  const savePending = saving || createMutation.isPending;

  const postedLocked = loaded?.isOpening
    ? openingJournalPosted
    : Boolean(loaded?.id && loaded.isPosted);
  const editLocked = lifecycleLocked || postedLocked;

  const startEdit = () => {
    if (lifecycleLocked) {
      setError(`الورقة حالتها «${status.label}» — فك الحالة أولاً حتى يُفتح التعديل`);
      return;
    }
    if (loaded?.isOpening && openingJournalPosted) {
      setError('فك ترحيل قيد الرصيد الافتتاحي أولاً ثم عدّل الشيك.');
      return;
    }
    if (postedLocked) {
      setError('الورقة مرحّلة. فك الترحيل أولاً من قائمة (...) ثم عدّل أو رحّل من جديد');
      return;
    }
    unlockForEdit();
  };

  const persistDeposit = async (on: boolean, accountId: string, date: string) => {
    const id = selectedId || loaded?.id;
    if (!id || cancelled || paperCase !== 'ISSUED') return;
    if (on && !accountId) {
      setError('اختر حساب أوراق القبض برسم التحصيل');
      return;
    }
    setDepositSaving(true);
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/deposit`, {
        accountId: on ? accountId : null,
        date: on && date ? new Date(date).toISOString() : null,
      });
      if (res.data) {
        applyLoaded(res.data, id);
        hydrateFromRecord(res.data);
      }
      setSuccess(on ? 'تم حفظ الإيداع وإنشاء القيد' : 'تم إلغاء الإيداع');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الإيداع');
    } finally {
      setDepositSaving(false);
    }
  };

  const needsPostBeforeLifecycle = paperCase === 'ISSUED' && !loaded?.isPosted;

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      <PageDraftRestoreGate<FormValues>
        restoreOffer={restoreOffer}
        hide={Boolean(selectedId)}
        message={
          kind === 'payment'
            ? 'يوجد مسودة ورقة مدفوعات غير محفوظة.'
            : 'يوجد مسودة ورقة مقبوضات غير محفوظة.'
        }
        acceptRestore={acceptRestore}
        dismissRestore={() => {
          dismissRestore();
          reset(emptyForm(currencies, kind, defaultAccountId));
          setMode('create');
        }}
        onRestored={(payload) => {
          reset(payload);
          setMode('create');
        }}
      />

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/accounting', label: 'المحاسبة' },
          { label: 'الأوراق المالية' },
          { label: title },
        ]}
        title={title}
        currentId={selectedId || loaded?.id || null}
        docNumber={docNumber}
        statusTone={status.tone}
        statusLabel={`حالة الورقة: ${status.label}`}
        saveLabel="حفظ"
        onSaveDraft={onSave}
        savePending={savePending}
        canSave={!savePending && !editLocked}
        hideStandalonePost
        saveDisabledHint={
          lifecycleLocked
            ? `الورقة حالتها «${status.label}» — فك الحالة أولاً حتى يمكن التعديل`
            : postedLocked
              ? 'الورقة مرحّلة. فك الترحيل أولاً من قائمة (...)'
              : undefined
        }
        favoriteHref={favoriteHref}
        favoriteLabel={title}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        extraActions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={`${formActionButtonClass} gap-1.5`}
            onClick={() => router.push(bulkHref)}
          >
            <Files className="h-3.5 w-3.5" />
            إنشاء عدة أوراق
          </Button>
        }
        standardActions={{
          hasDocument: Boolean(selectedId || loaded?.id),
          isPosted: Boolean(loaded?.isPosted),
          isCancelled: Boolean(loaded?.isCancelled),
          postPending: posting,
          onNew: resetNew,
          newLabel: 'جديد',
          onEdit: startEdit,
          onPost: () => void onPostDoc(),
          onUnpost: () => void onUnpostDoc(),
          unpostLockedHint: unpostBlockedByPaperCase(paperCase) || undefined,
          onVoid: () => void onCancelDoc(),
          onRestore: () => void onRestoreDoc(),
          onPrint:
            securityType === 'check'
              ? () => printChequeFromForm()
              : undefined,
          printLabel: 'طباعة الشيك',
          voidLabel: 'إلغاء الورقة',
          restoreLabel: 'استعادة الورقة',
          voidConfirmMessage:
            'سيتم إلغاء الورقة وقيدها مع الإبقاء عليها في السابق بحالة ملغي. يمكن استعادتها لاحقاً.',
          extraItems: [
            {
              id: 'collect',
              label: paperCase === 'COLLECTED' || paperCase === 'MULTI_COLLECTED' ? 'فك التحصيل' : 'تحصيل',
              disabled:
                !hasDocument ||
                needsPostBeforeLifecycle ||
                paperCase === 'MULTI_COLLECTED' ||
                (paperCase !== 'ISSUED' && paperCase !== 'COLLECTED'),
              hint: needsPostBeforeLifecycle
                ? 'رحّل الورقة أولاً'
                : paperCase === 'MULTI_COLLECTED'
                  ? 'ألغِ كل تحصيل من شاشة التحصيل المتعدد'
                  : paperCase !== 'ISSUED' && paperCase !== 'COLLECTED'
                    ? `الورقة حالتها «${status.label}»`
                    : undefined,
              onClick: () => {
                if (paperCase === 'MULTI_COLLECTED') return;
                if (paperCase === 'COLLECTED') {
                  void undoPaperCase();
                  return;
                }
                openLifecycle('collect');
              },
            },
            {
              id: 'multi-collect',
              label: 'تحصيل متعدد',
              disabled:
                !hasDocument ||
                Boolean(loaded?.isCancelled) ||
                needsPostBeforeLifecycle ||
                (paperCase !== 'ISSUED' && paperCase !== 'MULTI_COLLECTED'),
              hint: !hasDocument
                ? undefined
                : loaded?.isCancelled
                  ? 'الورقة ملغاة'
                  : needsPostBeforeLifecycle
                    ? 'رحّل الورقة أولاً'
                    : paperCase !== 'ISSUED' && paperCase !== 'MULTI_COLLECTED'
                      ? `الورقة حالتها «${status.label}»`
                      : undefined,
              onClick: openMultiCollect,
            },
            {
              id: 'bounce',
              label: paperCase === 'BOUNCED' ? 'فك الارتداد' : 'ارتداد',
              disabled:
                !hasDocument ||
                needsPostBeforeLifecycle ||
                (paperCase !== 'ISSUED' && paperCase !== 'BOUNCED'),
              hint: needsPostBeforeLifecycle
                ? 'رحّل الورقة أولاً'
                : paperCase !== 'ISSUED' && paperCase !== 'BOUNCED'
                  ? `الورقة حالتها «${status.label}»`
                  : undefined,
              onClick: () => (paperCase === 'BOUNCED' ? void undoPaperCase() : openLifecycle('bounce')),
            },
            ...(kind === 'receipt' || paperCase === 'ENDORSED'
              ? [
                  {
                    id: 'endorse',
                    label: paperCase === 'ENDORSED' ? 'فك التظهير' : 'تظهير',
                    disabled:
                      !hasDocument ||
                      needsPostBeforeLifecycle ||
                      (paperCase !== 'ISSUED' && paperCase !== 'ENDORSED'),
                    hint: needsPostBeforeLifecycle
                      ? 'رحّل الورقة أولاً'
                      : paperCase !== 'ISSUED' && paperCase !== 'ENDORSED'
                        ? `الورقة حالتها «${status.label}»`
                        : undefined,
                    onClick: () =>
                      paperCase === 'ENDORSED' ? void undoPaperCase() : openLifecycle('endorse'),
                  },
                ]
              : []),
          ],
          transactionSettingsDocumentType: settingsDocumentType,
        }}
      />

      <DocumentReadOnlyBanner />

      <div data-tour={kind === 'receipt' ? 'incoming-cheques-table' : undefined}>
      <DocumentFormLock>
      <ErpFormHeaderCard
        extrasLabel="الإعدادات المتقدمة"
        sourceActions={
          <DocumentSectionNumberPair>
            <div className="w-[8.5rem] shrink-0">
              <label className={sectionNumberLabelClass}>القسم</label>
              <select className={sectionNumberInputClass} disabled={locked} {...register('department')}>
                <option value="">اختر القسم</option>
                {departments.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.code ? `${row.code} - ` : ''}
                    {row.arabicName || row.englishName || ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-[9.5rem] min-w-0">
              <label className={sectionNumberLabelClass}>الرقم</label>
              <input
                className={sectionNumberInputClass}
                placeholder="الرقم المرجعي"
                disabled={locked}
                {...register('refNumber')}
              />
            </div>
          </DocumentSectionNumberPair>
        }
        extras={
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <DocumentCurrencyRateFields
              currencies={currencies}
              currencyId={currencyId}
              exchangeRate={Number(exchangeRateWatch) > 0 ? Number(exchangeRateWatch) : 1}
              companyBaseCode={companyBaseCurrency}
              disabled={locked}
              amount={amountNum}
              showEquivalent
              onCurrencyIdChange={(id, nextRate) => {
                setValue('currencyId', id, { shouldDirty: true, shouldValidate: true });
                setValue('exchangeRate', nextRate, { shouldDirty: true });
              }}
              onExchangeRateChange={(rate) => setValue('exchangeRate', rate, { shouldDirty: true })}
            />
            <div>
              <label className={erpLabelClass}>مركز التكلفة</label>
              <CostCenterSelect
                value={watch('costCenterId') || ''}
                onChange={(id) => setValue('costCenterId', id, { shouldValidate: false })}
                className={erpInputClass}
                disabled={locked}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className={advancedActionClass}
                disabled={locked}
                onClick={() => setShowPaymentsModal(true)}
              >
                توزيع السدادات على الفواتير
                {allocations.length > 0 ? (
                  <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1 text-[10px] text-[#094C6B]">
                    {allocations.length}
                  </span>
                ) : null}
              </button>
            </div>
            {advancedFilled ? (
              <p className="self-end text-xs text-slate-500 lg:col-span-4">{advancedFilled} حقول متقدمة مُعبأة</p>
            ) : null}
          </div>
        }
        row1={
          <>
            <div>
              <label className={erpLabelClass}>المسلسل</label>
              <input
                className={erpInputClass}
                placeholder={paperSerialAutomatic ? 'تلقائي' : 'أدخل المسلسل'}
                disabled={locked || paperSerialAutomatic}
                {...register('serial')}
              />
            </div>
            <div>
              <label className={erpLabelClass}>
                رقم الشيك
                <RequiredDot hint="رقم الشيك مطلوب" />
              </label>
              <input
                className={`${erpInputClass} ${errors.securityNumber ? erpInputErrorClass : ''}`}
                placeholder="رقم الشيك"
                disabled={locked}
                {...register('securityNumber')}
              />
              <ErpFieldError message={errors.securityNumber?.message} show={Boolean(errors.securityNumber)} />
            </div>
            <div>
              <label className={erpLabelClass}>نوع الورقة</label>
              <select className={erpInputClass} disabled={locked} {...register('securityType')}>
                <option value="check">شيك</option>
                <option value="promissory-note">سند إذني</option>
                <option value="bond">سند</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div className="min-w-0 max-w-[min(100%,var(--erp-field-desc-max,44rem))] flex-[1.6] basis-[min(16rem,100%)] space-y-1">
              <label className="text-xs font-semibold text-foreground">
                {paidToLabel}
                <RequiredDot hint={kind === 'payment' ? 'المورد مطلوب' : 'العميل مطلوب'} />
              </label>
              <VoucherAccountCombobox
                value={partyType === 'account' ? partyId : ''}
                partyId={partyType === 'customer' || partyType === 'supplier' ? partyId : undefined}
                partyKind={
                  partyType === 'customer' ? 'CUSTOMER' : partyType === 'supplier' ? 'SUPPLIER' : undefined
                }
                valueLabel={partyName || undefined}
                disabled={locked}
                className={erpInputClass}
                onPick={(pick) => {
                  if (pick.kind === 'CUSTOMER') {
                    applyParty(pick.partyId, undefined, 'customer');
                    return;
                  }
                  if (pick.kind === 'SUPPLIER') {
                    applyParty(pick.partyId, undefined, 'supplier');
                    return;
                  }
                  const accountId = pick.accountId;
                  if (!accountId) {
                    setValue('partyId', '', { shouldValidate: true });
                    return;
                  }
                  void resolvePartyFromAccount(kind, accountId).then((party) => {
                    if (party) {
                      applyParty(
                        party.id,
                        party.arabicName,
                        kind === 'payment' ? 'supplier' : 'customer'
                      );
                      return;
                    }
                    setValue('partyType', 'account', { shouldValidate: false });
                    setValue('partyId', accountId, { shouldValidate: true });
                  });
                }}
              />
              <ErpFieldError message={errors.partyId?.message} show={Boolean(errors.partyId)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">الجهة</label>
              <SecuritiesEntitySelect
                value={watch('entityId') || ''}
                valueLabel={watch('entityName') || ''}
                disabled={locked}
                onChange={(id, name) => {
                  setValue('entityId', id, { shouldValidate: false });
                  setValue('entityName', name, { shouldValidate: false });
                }}
              />
            </div>
          </>
        }
        row2={
          <>
            <SecuritiesDateHijriField
              label="تاريخ التحرير"
              gregorian={date}
              hijri={watch('hijriDate') || ''}
              onGregorianChange={(v) => {
                setValue('date', v, { shouldValidate: true });
                void trigger('dueDate');
              }}
              error={errors.date?.message}
              required
              disabled={locked}
            />
            <SecuritiesDateHijriField
              label="تاريخ الاستحقاق"
              gregorian={dueDate || ''}
              hijri={watch('dueHijriDate') || ''}
              min={date || undefined}
              onGregorianChange={(v) => setValue('dueDate', v, { shouldValidate: true })}
              error={errors.dueDate?.message}
              required
              disabled={locked}
            />
            <div>
              <label className={erpLabelClass}>
                القيمة
                <RequiredDot hint="القيمة مطلوبة" />
              </label>
              <input
                inputMode="decimal"
                className={`${erpInputClass} ${errors.amount ? erpInputErrorClass : ''}`}
                placeholder="0.00"
                disabled={locked}
                {...register('amount')}
              />
              <ErpFieldError message={errors.amount?.message} show={Boolean(errors.amount)} />
            </div>
            <div>
              <label className={erpLabelClass}>الشرح / البيان</label>
              <input
                className={erpInputClass}
                placeholder={
                  kind === 'payment'
                    ? 'شيك رقم … إلى المورد … يستحق بتاريخ …'
                    : 'شيك رقم … من العميل … يستحق بتاريخ …'
                }
                disabled={locked}
                {...register('description')}
              />
            </div>
            <div>
              <label className={erpLabelClass}>
                {kind === 'payment' ? 'حساب أوراق الدفع' : 'حساب أوراق القبض'}
              </label>
              <AccountSelect
                value={watch('accountId') || ''}
                onChange={(id) => setValue('accountId', id, { shouldValidate: false })}
                className={erpInputClass}
                leafOnly
                disabled={locked}
                placeholder={
                  kind === 'payment'
                    ? 'الحساب الدائن في قيد التحرير'
                    : 'الحساب المدين في قيد التحرير'
                }
                emptyLabel={
                  kind === 'payment' ? 'الحساب الدائن الافتراضي' : 'الحساب المدين الافتراضي'
                }
              />
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                {kind === 'payment'
                  ? 'المدين المورد، والدائن الحساب المختار. لو سيبتها فاضية بيتستخدم الافتراضي الظاهر هنا.'
                  : 'المدين الحساب المختار، والدائن العميل. لو سيبتها فاضية بيتستخدم الافتراضي الظاهر هنا.'}
              </p>
            </div>
          </>
        }
      />
      </DocumentFormLock>
      </div>

      {securityType === 'check' ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-[#094C6B]">بيانات طباعة الشيك</p>
          <div className="flex flex-wrap gap-6">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#0E78AA]"
                disabled={lifecycleLocked}
                checked={payBeneficiaryFirst}
                onChange={(e) =>
                  setValue('payBeneficiaryFirst', e.target.checked, { shouldDirty: true })
                }
              />
              يصرف للمستفيد أولاً
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#0E78AA]"
                disabled={lifecycleLocked}
                checked={bearerCheque}
                onChange={(e) => setValue('bearerCheque', e.target.checked, { shouldDirty: true })}
              />
              شيك مستعار
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            تظهر الخيارات على نموذج الشيك عند الضغط على «طباعة الشيك» من شريط الأدوات.
          </p>
        </div>
      ) : null}

      {kind === 'receipt' ? (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#094C6B]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#0E78AA]"
            checked={depositInBank}
            disabled={lifecycleLocked}
            onChange={(e) => {
              const on = e.target.checked;
              setValue('depositInBank', on, { shouldValidate: false });
              if (!on) {
                setValue('depositAccountId', '');
                setValue('bankIssueDate', '');
                setValue('bankHijriDate', '');
                if (hasDocument) void persistDeposit(false, '', '');
                return;
              }
              const depositDate = watch('bankIssueDate') || todayIso();
              if (!watch('bankIssueDate')) {
                setValue('bankIssueDate', depositDate);
                setValue('bankHijriDate', toHijri(depositDate));
              }
              const accountId = watch('depositAccountId') || '';
              if (hasDocument && accountId) {
                void persistDeposit(true, accountId, depositDate);
              }
            }}
          />
          إيداع برسم التحصيل
        </label>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">
          يشتغل بعد حفظ الورقة مباشرة، حتى وهي مرحّلة ومن غير تعديل. اختر الحساب فيتحفظ قيد الإيداع. حساب البنك لا يتحرك إلا عند التحصيل.
        </p>
        {depositInBank ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={erpLabelClass}>حساب أوراق القبض برسم التحصيل</label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <AccountSelect
                    value={watch('depositAccountId') || ''}
                    onChange={(id) => {
                      setValue('depositAccountId', id, { shouldValidate: false });
                      if (hasDocument && id) {
                        void persistDeposit(true, id, watch('bankIssueDate') || todayIso());
                      }
                    }}
                    className={`${erpInputClass} !max-w-none`}
                    leafOnly
                    disabled={lifecycleLocked}
                    placeholder="الحساب المدين في قيد الإيداع"
                    emptyLabel="أوراق قبض برسم التحصيل"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className={`${formActionButtonClass} h-8 shrink-0 px-2.5 text-[11px]`}
                  disabled={lifecycleLocked || depositSaving || !hasDocument}
                  onClick={() =>
                    void persistDeposit(
                      true,
                      watch('depositAccountId') || '',
                      watch('bankIssueDate') || todayIso()
                    )
                  }
                >
                  {depositSaving ? '...' : 'حفظ'}
                </Button>
              </div>
            </div>
            <SecuritiesDateHijriField
              label="تاريخ الإيداع"
              gregorian={bankIssueDate || ''}
              hijri={watch('bankHijriDate') || ''}
              onGregorianChange={(v) => {
                setValue('bankIssueDate', v, { shouldValidate: false });
              }}
              disabled={lifecycleLocked}
            />
          </div>
        ) : null}
      </div>
      ) : null}

      <ErpDocumentBottomSplit
        financialRows={[{ label: 'مبلغ الورقة', value: amountNum }]}
        netAmount={amountNum}
        netLabel="إجمالي الورقة"
        journalEntryId={activeJournalId}
        sourceDocumentId={actionId}
        journalOptions={journals.map((row) => ({ id: row.id, label: row.label }))}
        onJournalIdChange={setSelectedJournalId}
        showJournalTab
        journalEmptyTitle="لا يوجد قيد بعد. احفظ الورقة فيظهر قيد التحرير هنا، وبعد التحصيل أو الارتداد تقدر تختار القيد من القائمة."
        auditLog={{ entityType: 'JOURNAL_ENTRY', entityId: activeJournalId }}
        tabs={[]}
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title={`${title} — السجلات السابقة`}>
        <div data-tour={kind === 'receipt' ? 'incoming-cheques-table' : undefined}>
        <GenericRecordsList
          apiPath={apiPath}
          listKey={`${listKey}-browse`}
          selectedId={selectedId}
          resolveStatus={(row) => {
            const s = securitiesPaperStatus(row as SecuritiesPaperRecord);
            return { variant: s.tone, label: s.label };
          }}
          columns={[
            {
              id: 'num',
              header: 'رقم الورقة',
              getValue: (r) =>
                String(r.securityNumber ?? r.paymentNumber ?? r.receiptNumber ?? r.id.slice(0, 8)),
            },
            {
              id: 'amount',
              header: 'المبلغ',
              getValue: (r) =>
                Number(r.amount ?? 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 }),
            },
            {
              id: 'entity',
              header: 'الجهة',
              getValue: (r) =>
                String(
                  r.entityName ??
                    (r.entity as { arabicName?: string } | undefined)?.arabicName ??
                    '—'
                ),
            },
            {
              id: 'name',
              header: paidToLabel,
              getValue: (r) => paperPartyDisplayName(r as SecuritiesPaperRecord, '—'),
            },
            {
              id: 'due',
              header: 'الاستحقاق',
              getValue: (r) =>
                r.dueDate ? new Date(String(r.dueDate)).toLocaleDateString('ar-EG') : '—',
            },
          ]}
          onSelect={(id) => {
            setSelectedId(id);
            syncPaperTab(id);
            setShowList(false);
          }}
        />
        </div>
      </DocumentBrowseDrawer>

      <SecuritiesCollectModal
        open={showCollect}
        kind={kind}
        apiPath={apiPath}
        paperId={actionId}
        amount={amountNum}
        chequeNumber={securityNumber || loaded?.securityNumber || ''}
        partyName={
          partyName ||
          loaded?.payeeName ||
          loaded?.issuerName ||
          loaded?.supplier?.arabicName ||
          loaded?.customer?.arabicName ||
          ''
        }
        dueDate={dueDate || isoDateOnly(loaded?.dueDate)}
        onClose={() => setShowCollect(false)}
        onDone={(record) => {
          applyLoaded(record, record.id);
          lockToView();
          setSuccess('تم تحصيل الورقة — حالتها محصلة');
        }}
      />
      <MultiCollectionModal
        open={showMulti}
        kind={kind}
        paperNumber={securityNumber || loaded?.securityNumber || ''}
        remainingAmount={multiRemaining}
        currencyCode={currencies.find((c) => c.id === currencyId)?.code || loaded?.currencyCode || 'EGP'}
        confirmPending={multiPending}
        cancelPendingId={cancelLineId}
        canCancelLines={paperCase === 'MULTI_COLLECTED'}
        existingLines={loaded?.multiCollectionLines ?? []}
        onClose={() => setShowMulti(false)}
        onConfirm={async (payload) => {
          const id = actionId;
          if (!id) return;
          setMultiPending(true);
          try {
            const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/multi-collect`, payload);
            if (res.data) applyLoaded(res.data, id);
            setSuccess('تم تأكيد التحصيل المتعدد');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'تعذر تسجيل التحصيل المتعدد');
            throw err;
          } finally {
            setMultiPending(false);
          }
        }}
        onCancelLine={async (lineId) => {
          const id = actionId;
          if (!id) return;
          setCancelLineId(lineId);
          try {
            const res = await apiClient.post<SecuritiesPaperRecord>(
              `${apiPath}/${id}/multi-collect/${lineId}/cancel`,
              {}
            );
            if (res.data) applyLoaded(res.data, id);
            lockToView();
            setSuccess('تم إلغاء التحصيل');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'تعذر إلغاء التحصيل');
          } finally {
            setCancelLineId(null);
          }
        }}
      />
      <SecuritiesBounceModal
        open={showReturn}
        apiPath={apiPath}
        paperId={actionId}
        onClose={() => setShowReturn(false)}
        onDone={(record) => {
          applyLoaded(record, record.id);
          lockToView();
          setSuccess('تم ارتداد الورقة — حالتها مرتدة');
        }}
      />
      <PaymentsDistributionModal
        isOpen={showPaymentsModal}
        onClose={() => setShowPaymentsModal(false)}
        side={kind === 'payment' ? 'payable' : 'receivable'}
        partyId={partyType === 'account' ? null : partyId || null}
        accountId={partyType === 'account' ? partyId || null : null}
        receiptTotal={amountNum}
        isPosted={Boolean(loaded?.isPosted)}
        draftMode
        initialAllocations={allocations}
        onApplyDraft={setAllocations}
        onPartyChange={(id) =>
          applyParty(id, undefined, kind === 'payment' ? 'supplier' : 'customer')
        }
        onError={setError}
        onSuccess={setSuccess}
      />
      <SecuritiesEndorseModal
        open={kind === 'receipt' && showEndorse}
        kind={kind}
        apiPath={apiPath}
        paperId={actionId}
        chequeNumber={securityNumber || loaded?.securityNumber || ''}
        partyName={
          partyName ||
          loaded?.payeeName ||
          loaded?.issuerName ||
          loaded?.supplier?.arabicName ||
          loaded?.customer?.arabicName ||
          ''
        }
        dueDate={dueDate || isoDateOnly(loaded?.dueDate)}
        onClose={() => setShowEndorse(false)}
        onDone={(record) => {
          applyLoaded(record, record.id);
          lockToView();
          setSuccess('تم تظهير الورقة — حالتها مظهرة');
        }}
      />
    </ErpDocumentLayout>
  );
}
