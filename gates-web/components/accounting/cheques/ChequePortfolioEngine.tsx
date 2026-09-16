'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CustomerSelect, SupplierSelect } from '@/app/components/form/PartySelect';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList, type GenericRecordColumn, type GenericRecordRow } from '@/components/erp/GenericRecordsList';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { Button, FormCard } from '@/components/ui';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { toHijri } from '@/lib/dates/hijri';
import { apiClient } from '@/lib/api/client';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useCurrenciesQuery } from '@/lib/hooks/useMasterDataQueries';
import { pickCurrencyByCode, rateForCurrency } from '@/lib/accounting/fx-base';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { DocumentCurrencyRateFields } from '@/components/accounting/DocumentCurrencyRateFields';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import type { QueryParams } from '@/lib/api/types';
import type { DocumentActionExtraItem } from '@/components/common/document-shell';
import {
  ChequeBankActionModal,
  ChequeConfirmModal,
  ChequeEndorseModal,
} from './ChequeLifecycleModals';
import {
  CHEQUE_STATUS_LABEL,
  CHEQUE_STATUS_TONE,
  chequePartyName,
  formatChequeAmount,
  isChequeStatus,
  isoDateOnly,
  type ChequeDirection,
  type ChequeRecord,
  type ChequeStatus,
} from './cheque-status';

type Props = { direction: ChequeDirection };

type ChequeStats = {
  underHandCount: number;
  underHandAmount: number;
  dueThisWeekCount: number;
  dueThisWeekAmount: number;
  bouncedCount: number;
  bouncedAmount: number;
};

type BankAccount = { id: string; accountNumber?: string | null; arabicName?: string };

type ModalKind = 'endorse' | 'deposit' | 'collect' | 'bounce' | 'outward-clear' | null;

const STATUS_FILTERS: { id: '' | ChequeStatus; label: string }[] = [
  { id: '', label: 'الكل' },
  { id: 'UNDER_HAND', label: 'في الخزينة' },
  { id: 'SENT_TO_BANK', label: 'برسم التحصيل' },
  { id: 'COLLECTED', label: 'تم التحصيل' },
  { id: 'ENDORSED', label: 'مظهر' },
  { id: 'BOUNCED', label: 'مرتد' },
  { id: 'CANCELLED', label: 'ملغي' },
];

function asCheque(row: GenericRecordRow): ChequeRecord {
  return row as unknown as ChequeRecord;
}

function emptyForm() {
  return {
    chequeNumber: '',
    amount: '',
    bankName: '',
    dueDate: '',
    partyId: '',
    bankAccountId: '',
    description: '',
    currencyId: '',
    exchangeRate: 1,
  };
}

export function ChequePortfolioEngine({ direction }: Props) {
  const inward = direction === 'INWARD';
  const title = inward ? 'أوراق القبض (الشيكات الواردة)' : 'أوراق الدفع (الشيكات الصادرة)';
  const listKey = inward ? 'treasury-cheques-inward' : 'treasury-cheques-outward';
  const favoriteHref = inward ? '/accounting/cheques/incoming' : '/accounting/cheques/outgoing';
  const invalidate = useInvalidateQuery();
  const searchParams = useSearchParams();

  const [browseOpen, setBrowseOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<ChequeRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | ChequeStatus>('');
  const [partyFilter, setPartyFilter] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [modal, setModal] = useState<ModalKind>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editing, setEditing] = useState(true);
  const [form, setForm] = useState(emptyForm);

  const extraParams = useMemo(
    () => ({
      direction,
      status: statusFilter || undefined,
      partyId: partyFilter || undefined,
    }),
    [direction, statusFilter, partyFilter]
  );

  const { data: statsRes } = useApiQuery<ChequeStats>(
    ['treasury-cheques-stats', direction, refreshToken],
    '/treasury/cheques/stats',
    { direction } as unknown as QueryParams
  );
  const stats = statsRes?.data;

  const { data: banksRes } = useApiQuery<BankAccount[]>(
    ['bank-accounts-cheques'],
    '/accounting/bank-accounts',
    { isActive: true }
  );
  const bankAccounts = banksRes?.data ?? [];

  const { data: currenciesResponse } = useCurrenciesQuery();
  const currencies = useMemo(() => currenciesResponse?.data ?? [], [currenciesResponse?.data]);
  const { code: companyBaseCurrency } = useCompanyBaseCurrency();
  const selectedCurrency = currencies.find((c) => c.id === form.currencyId);

  useEffect(() => {
    if (!currencies.length || form.currencyId) return;
    const def = pickCurrencyByCode(currencies, companyBaseCurrency);
    if (!def) return;
    setForm((prev) => ({
      ...prev,
      currencyId: def.id,
      exchangeRate: rateForCurrency(def.code, companyBaseCurrency, def.exchangeRate),
    }));
  }, [companyBaseCurrency, currencies, form.currencyId]);

  const refresh = () => {
    setRefreshToken((n) => n + 1);
    invalidate([listKey]);
    invalidate(['treasury-cheques-stats', direction]);
  };

  const fillFromCheque = (cheque: ChequeRecord, unlock: boolean) => {
    setSelectedId(cheque.id);
    setActive(cheque);
    const currency = pickCurrencyByCode(currencies, cheque.currencyCode || companyBaseCurrency);
    setForm({
      chequeNumber: cheque.chequeNumber || '',
      amount: String(cheque.amount ?? ''),
      bankName: cheque.bankName || '',
      dueDate: isoDateOnly(cheque.dueDate),
      partyId: inward ? cheque.customerId || '' : cheque.supplierId || '',
      bankAccountId: cheque.bankAccountId || '',
      description: cheque.description || '',
      currencyId: currency?.id || form.currencyId,
      exchangeRate: currency
        ? rateForCurrency(currency.code, companyBaseCurrency, currency.exchangeRate)
        : form.exchangeRate,
    });
    setEditing(unlock);
    setBrowseOpen(false);
  };

  const resetNew = () => {
    setSelectedId(null);
    setActive(null);
    setForm(emptyForm());
    setEditing(true);
    setError('');
    setSuccess('');
  };

  const loadCheque = async (id: string, unlock = false) => {
    try {
      const res = await apiClient.get<ChequeRecord>(`/treasury/cheques/${id}`);
      const cheque = (res as { data?: ChequeRecord }).data ?? (res as unknown as ChequeRecord);
      if (!cheque?.id) throw new Error('تعذر تحميل الشيك');
      fillFromCheque(cheque, unlock || cheque.status === 'UNDER_HAND' ? unlock : false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الشيك');
    }
  };

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) void loadCheque(id, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const columns: GenericRecordColumn[] = [
    {
      id: 'chequeNumber',
      header: 'رقم الشيك',
      getValue: (row) => asCheque(row).chequeNumber || '—',
    },
    {
      id: 'dueDate',
      header: 'تاريخ الاستحقاق',
      getValue: (row) => {
        const iso = isoDateOnly(asCheque(row).dueDate);
        if (!iso) return '—';
        const hijri = toHijri(iso);
        return hijri ? `${iso} · ${hijri}` : iso;
      },
    },
    {
      id: 'party',
      header: inward ? 'الساحب / العميل' : 'المورد',
      getValue: (row) => chequePartyName(asCheque(row)),
    },
    {
      id: 'bank',
      header: 'البنك المسحوب عليه',
      getValue: (row) => {
        const c = asCheque(row);
        const branch = c.bankAccount?.arabicName || c.bankAccount?.accountNumber;
        if (c.bankName && branch) return `${c.bankName} — ${branch}`;
        return c.bankName || branch || '—';
      },
    },
    {
      id: 'amount',
      header: 'المبلغ',
      getValue: (row) => formatChequeAmount(asCheque(row).amount, asCheque(row).currencyCode || 'EGP'),
    },
  ];

  const runAction = async (path: string, body?: Record<string, unknown>, ok = 'تم تنفيذ العملية') => {
    setPending(true);
    setModalError('');
    setError('');
    try {
      const res = await apiClient.post<ChequeRecord>(path, body ?? {});
      const cheque = (res as { data?: ChequeRecord }).data;
      setSuccess(ok);
      setModal(null);
      refresh();
      const id = cheque?.id || selectedId;
      if (id) await loadCheque(id, false);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'فشلت العملية');
      setError(e instanceof Error ? e.message : 'فشلت العملية');
    } finally {
      setPending(false);
    }
  };

  const openAction = (kind: ModalKind) => {
    if (!active) {
      setError('افتح شيكاً من السابق أولاً');
      return;
    }
    setModalError('');
    setModal(kind);
  };

  const createMutation = useApiMutation<ChequeRecord, Record<string, unknown>>(
    inward ? '/treasury/cheques/inward' : '/treasury/cheques/outward',
    'POST',
    {
      onSuccess: (res) => {
        const cheque = res.data;
        setSuccess(inward ? 'تم تسجيل شيك وارد' : 'تم إصدار شيك صادر');
        refresh();
        if (cheque?.id) void loadCheque(cheque.id, false);
      },
      onError: (e) => setError(e.message || 'فشل حفظ الشيك'),
    }
  );

  const handleSave = () => {
    const amt = parseFloat(form.amount);
    if (!form.chequeNumber || !form.partyId || !(amt > 0) || (!inward && !form.bankAccountId)) {
      setError('أكمل الحقول المطلوبة');
      return;
    }

    if (selectedId && active?.status === 'UNDER_HAND') {
      setPending(true);
      void apiClient
        .patch(`/treasury/cheques/${selectedId}`, {
          chequeNumber: form.chequeNumber,
          bankName: form.bankName || null,
          dueDate: form.dueDate || null,
          description: form.description || null,
        })
        .then((res) => {
          const cheque = (res as { data?: ChequeRecord }).data;
          setSuccess('تم حفظ تعديلات الشيك');
          refresh();
          if (cheque?.id) fillFromCheque(cheque, false);
          else setEditing(false);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'فشل حفظ التعديل'))
        .finally(() => setPending(false));
      return;
    }

    createMutation.mutate({
      chequeNumber: form.chequeNumber,
      bankName: form.bankName || undefined,
      dueDate: form.dueDate || undefined,
      amount: amt,
      currencyCode: selectedCurrency?.code || companyBaseCurrency,
      description: form.description || undefined,
      ...(inward ? { customerId: form.partyId } : { supplierId: form.partyId, bankAccountId: form.bankAccountId }),
    });
  };

  const handlePrint = () => {
    if (!form.chequeNumber && !active) return;
    void printOperationalDocument({
      title: inward ? 'ورقة قبض / شيك وارد' : 'ورقة دفع / شيك صادر',
      documentNo: form.chequeNumber || 'مسودة',
      documentDate: form.dueDate || new Date().toISOString().slice(0, 10),
      buyerName: active ? chequePartyName(active) : undefined,
      currency: selectedCurrency?.code || companyBaseCurrency,
      lines: [
        {
          description: form.description || form.bankName || title,
          quantity: 1,
          unitPrice: parseFloat(form.amount) || 0,
          total: parseFloat(form.amount) || 0,
        },
      ],
    });
  };

  const handleDuplicate = () => {
    if (!active && !form.chequeNumber) return;
    setSelectedId(null);
    setActive(null);
    setForm((prev) => ({ ...prev, chequeNumber: '' }));
    setEditing(true);
    setSuccess('تم تجهيز نسخة جديدة من الشيك');
  };

  const handleVoid = () => {
    if (!selectedId || !active) return;
    if (active.status !== 'UNDER_HAND') {
      setError('فك دورة الشيك أولاً حتى يعود للخزينة ثم ألغه');
      return;
    }
    const path = inward
      ? `/treasury/cheques/inward/${selectedId}/cancel`
      : `/treasury/cheques/outward/${selectedId}/cancel`;
    void runAction(path, {}, 'تم إلغاء الشيك');
  };

  const handleUnpost = () => {
    if (!selectedId || !active) return;
    if (inward && active.status === 'SENT_TO_BANK') {
      void runAction(`/treasury/cheques/inward/${selectedId}/unsend-to-bank`, {}, 'تم فك إيداع الشيك');
      return;
    }
    if (inward && active.status === 'COLLECTED') {
      void runAction(`/treasury/cheques/inward/${selectedId}/unclear`, {}, 'تم فك تحصيل الشيك');
      return;
    }
    if (inward && active.status === 'ENDORSED') {
      void runAction(`/treasury/cheques/inward/${selectedId}/unendorse`, {}, 'تم فك تظهير الشيك');
      return;
    }
    if (inward && active.status === 'BOUNCED') {
      void runAction(`/treasury/cheques/inward/${selectedId}/unbounce`, {}, 'تم فك ارتداد الشيك');
      return;
    }
    if (!inward && active.status === 'COLLECTED') {
      void runAction(`/treasury/cheques/outward/${selectedId}/unclear`, {}, 'تم فك خصم الشيك');
      return;
    }
    setError('لا يوجد فك ترحيل لهذه الحالة');
  };

  const status = active?.status;
  const isCancelled = status === 'CANCELLED';
  const isUnderHand = !active || status === 'UNDER_HAND';
  const readOnly = Boolean(active) && !editing;

  const extraItems: DocumentActionExtraItem[] = [];
  if (inward && status === 'UNDER_HAND') {
    extraItems.push(
      { id: 'deposit', label: 'إيداع بنكي', onClick: () => openAction('deposit') },
      { id: 'endorse', label: 'تظهير لمورد', onClick: () => openAction('endorse') }
    );
  }
  if (inward && status === 'SENT_TO_BANK') {
    extraItems.push(
      { id: 'collect', label: 'تحصيل', onClick: () => openAction('collect') },
      { id: 'bounce', label: 'ارتداد / رفض', onClick: () => openAction('bounce'), destructive: true },
      { id: 'unsend', label: 'فك الإيداع', onClick: handleUnpost }
    );
  }
  if (inward && status === 'COLLECTED') {
    extraItems.push({ id: 'unclear', label: 'فك التحصيل', onClick: handleUnpost });
  }
  if (inward && status === 'ENDORSED') {
    extraItems.push(
      { id: 'unendorse', label: 'فك التظهير', onClick: handleUnpost },
      {
        id: 'bounce-endorsed',
        label: 'ارتداد / رفض',
        onClick: () => openAction('bounce'),
        destructive: true,
      }
    );
  }
  if (inward && status === 'BOUNCED') {
    extraItems.push({ id: 'unbounce', label: 'فك الارتداد', onClick: handleUnpost });
  }
  if (!inward && status === 'UNDER_HAND') {
    extraItems.push({
      id: 'outward-clear',
      label: 'إشعار خصم بنكي',
      onClick: () => openAction('outward-clear'),
    });
  }
  if (!inward && status === 'COLLECTED') {
    extraItems.push({ id: 'unclear-out', label: 'فك الخصم البنكي', onClick: handleUnpost });
  }

  const browseList = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.filter((f) => inward || (f.id !== 'ENDORSED' && f.id !== 'SENT_TO_BANK')).map((f) => (
            <Button
              key={f.id || 'all'}
              size="sm"
              variant={statusFilter === f.id ? 'primary' : 'outline'}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="w-full max-w-[var(--erp-field-max,32rem)] min-w-0">
          <label className={erpLabelClass}>{inward ? 'العميل' : 'المورد'}</label>
          {inward ? (
            <CustomerSelect value={partyFilter} onChange={setPartyFilter} emptyLabel="كل العملاء" />
          ) : (
            <SupplierSelect value={partyFilter} onChange={setPartyFilter} emptyLabel="كل الموردين" />
          )}
        </div>
      </div>
      <GenericRecordsList
        apiPath="/treasury/cheques"
        listKey={`${listKey}-browse-${refreshToken}`}
        columns={columns}
        extraParams={extraParams}
        selectedId={selectedId}
        onSelect={(id) => {
          void loadCheque(id, false);
        }}
        searchPlaceholder="بحث برقم الشيك أو اسم البنك…"
        printTitle={title}
        allowDeleteDraft={false}
        resolveStatus={(row) => {
          const rowStatus = asCheque(row).status;
          if (!isChequeStatus(rowStatus)) return { variant: 'neutral', label: String(rowStatus || '—') };
          return { variant: CHEQUE_STATUS_TONE[rowStatus], label: CHEQUE_STATUS_LABEL[rowStatus] };
        }}
      />
    </div>
  );

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/accounting', label: 'المحاسبة' },
          { href: '/accounting/operations/treasury', label: 'الخزينة' },
          { label: inward ? 'أوراق القبض' : 'أوراق الدفع' },
        ]}
        title={title}
        docNumber={form.chequeNumber || undefined}
        statusTone={status && isChequeStatus(status) ? CHEQUE_STATUS_TONE[status] : 'info'}
        statusLabel={status && isChequeStatus(status) ? CHEQUE_STATUS_LABEL[status] : 'جديد'}
        onBrowseList={() => setBrowseOpen(true)}
        browseListLabel="السابق"
        onSaveDraft={handleSave}
        saveLabel={selectedId ? 'حفظ' : 'حفظ شيك'}
        canSave={editing && !isCancelled && isUnderHand}
        canPost={false}
        hideStandalonePost
        savePending={pending || createMutation.isPending}
        favoriteHref={favoriteHref}
        favoriteLabel={title}
        standardActions={{
          hasDocument: Boolean(selectedId),
          isPosted: Boolean(active) && !isUnderHand && !isCancelled,
          isCancelled,
          hidePostActions: true,
          onNew: resetNew,
          newLabel: 'جديد',
          onEdit: () => {
            if (!active) return;
            if (active.status !== 'UNDER_HAND') {
              setError('فك دورة الشيك أولاً من قائمة (...) حتى يمكن التعديل');
              return;
            }
            setEditing(true);
          },
          onPrint: handlePrint,
          onDuplicate: handleDuplicate,
          onVoid: handleVoid,
          voidPending: pending,
          voidLabel: 'إلغاء الشيك',
          extraItems,
        }}
      />

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard
          label="إجمالي الشيكات في الخزينة"
          count={stats?.underHandCount ?? 0}
          amount={stats?.underHandAmount ?? 0}
          tone="info"
        />
        <StatCard
          label="شيكات تستحق اليوم / هذا الأسبوع"
          count={stats?.dueThisWeekCount ?? 0}
          amount={stats?.dueThisWeekAmount ?? 0}
          tone="warning"
        />
        <StatCard
          label="شيكات مرتدة"
          count={stats?.bouncedCount ?? 0}
          amount={stats?.bouncedAmount ?? 0}
          tone="danger"
        />
      </div>

      <FormCard title={inward ? 'بيانات ورقة القبض' : 'بيانات ورقة الدفع'} bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label="رقم الشيك"
            value={form.chequeNumber}
            onChange={(chequeNumber) => setForm((p) => ({ ...p, chequeNumber }))}
            disabled={readOnly}
          />
          <Field
            label="المبلغ"
            type="number"
            value={form.amount}
            onChange={(amount) => setForm((p) => ({ ...p, amount }))}
            disabled={readOnly || Boolean(selectedId)}
          />
          <DocumentCurrencyRateFields
            currencies={currencies}
            currencyId={form.currencyId}
            exchangeRate={form.exchangeRate}
            companyBaseCode={companyBaseCurrency}
            amount={parseFloat(form.amount) || 0}
            showEquivalent
            disabled={readOnly || Boolean(selectedId)}
            onCurrencyIdChange={(id, nextRate) =>
              setForm((p) => ({ ...p, currencyId: id, exchangeRate: nextRate }))
            }
            onExchangeRateChange={(exchangeRate) => setForm((p) => ({ ...p, exchangeRate }))}
          />
          <Field
            label="البنك المسحوب عليه"
            value={form.bankName}
            onChange={(bankName) => setForm((p) => ({ ...p, bankName }))}
            disabled={readOnly}
          />
          <Field
            label="تاريخ الاستحقاق"
            type="date"
            value={form.dueDate}
            onChange={(dueDate) => setForm((p) => ({ ...p, dueDate }))}
            disabled={readOnly}
          />
          <div className="md:col-span-2">
            <label className={erpLabelClass}>{inward ? 'العميل' : 'المورد'}</label>
            {inward ? (
              <CustomerSelect
                value={form.partyId}
                onChange={(partyId) => setForm((p) => ({ ...p, partyId }))}
                disabled={readOnly || Boolean(selectedId)}
              />
            ) : (
              <SupplierSelect
                value={form.partyId}
                onChange={(partyId) => setForm((p) => ({ ...p, partyId }))}
                disabled={readOnly || Boolean(selectedId)}
              />
            )}
          </div>
          {!inward ? (
            <div className="md:col-span-2">
              <label className={erpLabelClass}>حساب البنك</label>
              <select
                className={erpInputClass}
                value={form.bankAccountId}
                disabled={readOnly || Boolean(selectedId)}
                onChange={(e) => setForm((p) => ({ ...p, bankAccountId: e.target.value }))}
              >
                <option value="">اختر الحساب</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.arabicName || b.accountNumber || b.id}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <label className={erpLabelClass}>الشرح</label>
            <input
              className={erpInputClass}
              value={form.description}
              disabled={readOnly}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>
      </FormCard>

      <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title={title}>
        {browseList}
      </DocumentBrowseDrawer>

      <ChequeEndorseModal
        open={modal === 'endorse'}
        cheque={active}
        pending={pending}
        error={modalError}
        onClose={() => setModal(null)}
        onConfirm={(supplierId, notes) =>
          void runAction(
            `/treasury/cheques/inward/${active?.id}/endorse`,
            { supplierId, notes: notes || undefined },
            'تم تظهير الشيك للمورد'
          )
        }
      />
      <ChequeBankActionModal
        open={modal === 'deposit'}
        title="إيداع الشيك بالبنك"
        saveLabel="إيداع بنكي"
        cheque={active}
        bankAccounts={bankAccounts}
        pending={pending}
        error={modalError}
        requireBank={false}
        onClose={() => setModal(null)}
        onConfirm={() => void runAction(`/treasury/cheques/inward/${active?.id}/send-to-bank`, {}, 'تم إيداع الشيك برسم التحصيل')}
      />
      <ChequeBankActionModal
        open={modal === 'collect'}
        title="تحصيل الشيك"
        saveLabel="تأكيد التحصيل"
        cheque={active}
        bankAccounts={bankAccounts}
        pending={pending}
        error={modalError}
        onClose={() => setModal(null)}
        onConfirm={(bankAccountId) =>
          void runAction(`/treasury/cheques/inward/${active?.id}/clear`, { bankAccountId }, 'تم تحصيل الشيك')
        }
      />
      <ChequeConfirmModal
        open={modal === 'bounce'}
        title="ارتداد / رفض الشيك"
        saveLabel="تأكيد الارتداد"
        message="سيتم رد قيمة الشيك على العميل وإلغاء مركز الورقة."
        cheque={active}
        pending={pending}
        error={modalError}
        onClose={() => setModal(null)}
        onConfirm={() => void runAction(`/treasury/cheques/inward/${active?.id}/bounce`, {}, 'تم تسجيل ارتداد الشيك')}
      />
      <ChequeConfirmModal
        open={modal === 'outward-clear'}
        title="إشعار خصم بنكي"
        saveLabel="تأكيد الخصم"
        message="سيتم خصم قيمة الشيك من حساب البنك المربوط وإقفال ورقة الدفع."
        cheque={active}
        pending={pending}
        error={modalError}
        onClose={() => setModal(null)}
        onConfirm={() => void runAction(`/treasury/cheques/outward/${active?.id}/clear`, {}, 'تم خصم الشيك من البنك')}
      />
    </ErpDocumentLayout>
  );
}

function StatCard({
  label,
  count,
  amount,
  tone,
}: {
  label: string;
  count: number;
  amount: number;
  tone: 'info' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'info'
      ? 'border-sky-200 bg-sky-50'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : 'border-red-200 bg-red-50';
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#0A3D5E]">{count}</p>
      <p className="font-mono text-sm text-slate-600">{formatChequeAmount(amount)}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className={erpLabelClass}>{label}</label>
      <input
        type={type}
        className={erpInputClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
