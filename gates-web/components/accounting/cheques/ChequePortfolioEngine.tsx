'use client';

import { useMemo, useState } from 'react';
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
import type { QueryParams } from '@/lib/api/types';
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

type ModalKind = 'endorse' | 'deposit' | 'collect' | 'bounce' | 'outward-clear' | 'create' | null;

const STATUS_FILTERS: { id: '' | ChequeStatus; label: string }[] = [
  { id: '', label: 'الكل' },
  { id: 'UNDER_HAND', label: 'في الخزينة' },
  { id: 'SENT_TO_BANK', label: 'برسم التحصيل' },
  { id: 'COLLECTED', label: 'تم التحصيل' },
  { id: 'ENDORSED', label: 'مظهر' },
  { id: 'BOUNCED', label: 'مرتد' },
];

function asCheque(row: GenericRecordRow): ChequeRecord {
  return row as unknown as ChequeRecord;
}

export function ChequePortfolioEngine({ direction }: Props) {
  const inward = direction === 'INWARD';
  const title = inward ? 'محفظة أوراق القبض (الشيكات الواردة)' : 'دفتر أوراق الدفع (الشيكات الصادرة)';
  const listKey = inward ? 'treasury-cheques-inward' : 'treasury-cheques-outward';
  const favoriteHref = inward ? '/accounting/cheques/incoming' : '/accounting/cheques/outgoing';
  const invalidate = useInvalidateQuery();

  const [browseOpen, setBrowseOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | ChequeStatus>('');
  const [partyId, setPartyId] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [modal, setModal] = useState<ModalKind>(null);
  const [active, setActive] = useState<ChequeRecord | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);
  const [modalError, setModalError] = useState('');

  const extraParams = useMemo(
    () => ({
      direction,
      status: statusFilter || undefined,
      partyId: partyId || undefined,
    }),
    [direction, statusFilter, partyId]
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

  const refresh = () => {
    setRefreshToken((n) => n + 1);
    invalidate([listKey]);
    invalidate(['treasury-cheques-stats', direction]);
  };

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
      await apiClient.post(path, body ?? {});
      setSuccess(ok);
      setModal(null);
      setActive(null);
      refresh();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'فشلت العملية');
    } finally {
      setPending(false);
    }
  };

  const openAction = (kind: ModalKind, row: ChequeRecord) => {
    setActive(row);
    setSelectedId(row.id);
    setModalError('');
    setModal(kind);
  };

  const recordsList = (
    <GenericRecordsList
      apiPath="/treasury/cheques"
      listKey={`${listKey}-${refreshToken}`}
      columns={columns}
      extraParams={extraParams}
      selectedId={selectedId}
      onSelect={(id, row) => {
        setSelectedId(id);
        setActive(asCheque(row));
      }}
      searchPlaceholder="بحث برقم الشيك أو اسم البنك…"
      printTitle={title}
      resolveStatus={(row) => {
        const status = asCheque(row).status;
        if (!isChequeStatus(status)) return { variant: 'neutral', label: String(status || '—') };
        return { variant: CHEQUE_STATUS_TONE[status], label: CHEQUE_STATUS_LABEL[status] };
      }}
      rowActions={(row) => {
        const cheque = asCheque(row);
        if (inward && cheque.status === 'UNDER_HAND') {
          return (
            <>
              <Button size="sm" variant="outline" onClick={() => openAction('deposit', cheque)}>
                🏦 إيداع بنكي
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAction('endorse', cheque)}>
                🔄 تظهير لمورد
              </Button>
            </>
          );
        }
        if (inward && cheque.status === 'SENT_TO_BANK') {
          return (
            <>
              <Button size="sm" variant="outline" onClick={() => openAction('collect', cheque)}>
                ✓ تحصيل
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAction('bounce', cheque)}>
                ✕ ارتداد/رفض
              </Button>
            </>
          );
        }
        if (!inward && cheque.status === 'UNDER_HAND') {
          return (
            <Button size="sm" variant="outline" onClick={() => openAction('outward-clear', cheque)}>
              ✓ إشعار خصم بنكي
            </Button>
          );
        }
        return null;
      }}
    />
  );

  const browseList = (
    <GenericRecordsList
      apiPath="/treasury/cheques"
      listKey={`${listKey}-browse-${refreshToken}`}
      columns={columns}
      extraParams={extraParams}
      selectedId={selectedId}
      onSelect={(id, row) => {
        setSelectedId(id);
        setActive(asCheque(row));
        setBrowseOpen(false);
      }}
      searchPlaceholder="بحث برقم الشيك أو اسم البنك…"
      printTitle={title}
      resolveStatus={(row) => {
        const status = asCheque(row).status;
        if (!isChequeStatus(status)) return { variant: 'neutral', label: String(status || '—') };
        return { variant: CHEQUE_STATUS_TONE[status], label: CHEQUE_STATUS_LABEL[status] };
      }}
    />
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
        statusTone={inward ? 'info' : 'warning'}
        statusLabel={inward ? 'وارد' : 'صادر'}
        showDocumentRef={false}
        onBrowseList={() => setBrowseOpen(true)}
        browseListLabel="السابق"
        onSaveDraft={() => {
          setModalError('');
          setModal('create');
        }}
        saveLabel="شيك جديد"
        canSave
        canPost={false}
        favoriteHref={favoriteHref}
        favoriteLabel={title}
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

      <div className="mb-3 flex flex-wrap items-end gap-3">
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
        <div className="min-w-[220px] flex-1">
          <label className={erpLabelClass}>{inward ? 'العميل' : 'المورد'}</label>
          {inward ? (
            <CustomerSelect value={partyId} onChange={setPartyId} emptyLabel="كل العملاء" />
          ) : (
            <SupplierSelect value={partyId} onChange={setPartyId} emptyLabel="كل الموردين" />
          )}
        </div>
      </div>

      <FormCard title="سجل الشيكات" bodyClassName="p-3">
        {recordsList}
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
        message="سيتم رد قيمة الشيك على العميل وإلغاء مركز الورقة. لا يمكن التراجع إلا من شاشة الإجراءات المتقدمة."
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

      {modal === 'create' ? (
        <ChequeCreateForm
          direction={direction}
          bankAccounts={bankAccounts}
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            setSuccess(inward ? 'تم تسجيل شيك وارد' : 'تم إصدار شيك صادر');
            refresh();
          }}
          onError={setError}
        />
      ) : null}
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

function ChequeCreateForm({
  direction,
  bankAccounts,
  onClose,
  onCreated,
  onError,
}: {
  direction: ChequeDirection;
  bankAccounts: BankAccount[];
  onClose: () => void;
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const inward = direction === 'INWARD';
  const [chequeNumber, setChequeNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useApiMutation<unknown, Record<string, unknown>>(
    inward ? '/treasury/cheques/inward' : '/treasury/cheques/outward',
    'POST',
    {
      onSuccess: () => onCreated(),
      onError: (e) => onError(e.message || 'فشل حفظ الشيك'),
    }
  );

  return (
    <div className="fixed inset-0 z-[10040] flex items-center justify-center bg-slate-900/40 p-4" dir="rtl">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="إغلاق" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0A3D5E]">{inward ? 'تسجيل شيك وارد' : 'إصدار شيك صادر'}</h2>
          <button type="button" className="text-sm text-slate-500" onClick={onClose}>
            إغلاق
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="رقم الشيك" value={chequeNumber} onChange={setChequeNumber} />
          <Field label="المبلغ" type="number" value={amount} onChange={setAmount} />
          <Field label="البنك المسحوب عليه" value={bankName} onChange={setBankName} />
          <Field label="تاريخ الاستحقاق" type="date" value={dueDate} onChange={setDueDate} />
          <div className="md:col-span-2">
            <label className={erpLabelClass}>{inward ? 'العميل' : 'المورد'}</label>
            {inward ? (
              <CustomerSelect value={partyId} onChange={setPartyId} />
            ) : (
              <SupplierSelect value={partyId} onChange={setPartyId} />
            )}
          </div>
          {!inward ? (
            <div className="md:col-span-2">
              <label className={erpLabelClass}>حساب البنك</label>
              <select className={erpInputClass} value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
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
            <input className={erpInputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => {
              const amt = parseFloat(amount);
              if (!chequeNumber || !partyId || !(amt > 0) || (!inward && !bankAccountId)) {
                onError('أكمل الحقول المطلوبة');
                return;
              }
              mutation.mutate({
                chequeNumber,
                bankName: bankName || undefined,
                dueDate: dueDate || undefined,
                amount: amt,
                currencyCode: 'EGP',
                description: description || undefined,
                ...(inward ? { customerId: partyId } : { supplierId: partyId, bankAccountId }),
              });
            }}
          >
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className={erpLabelClass}>{label}</label>
      <input type={type} className={erpInputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
