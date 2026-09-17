'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { Button } from '@/components/ui/button';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { apiClient } from '@/lib/api/client';
import {
  buildSecuritiesCollectDescription,
  buildSecuritiesEndorseDescription,
  type SecuritiesPaperRecord,
} from './securities-paper-status';

type PaperKind = 'payment' | 'receipt';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function Shell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-900/40 p-4" dir="rtl">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="إغلاق" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#0A3D5E]">{title}</h2>
          <button type="button" className="text-sm text-slate-500 hover:text-[#094C6B]" onClick={onClose}>
            إغلاق
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
        <div className="mt-5 flex items-center justify-end gap-2">{footer}</div>
      </div>
    </div>,
    document.body
  );
}

function ActionFooter({
  pending,
  saveLabel,
  onSave,
  onClose,
}: {
  pending: boolean;
  saveLabel: string;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <Button type="button" variant="secondary" size="sm" className={formActionButtonClass} onClick={onClose} disabled={pending}>
        إلغاء
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        className={formActionButtonClass}
        onClick={onSave}
        disabled={pending}
        isLoading={pending}
      >
        {saveLabel}
      </Button>
    </>
  );
}

export function SecuritiesCollectModal({
  open,
  kind,
  apiPath,
  paperId,
  amount,
  chequeNumber,
  partyName,
  dueDate,
  onClose,
  onDone,
}: {
  open: boolean;
  kind: PaperKind;
  apiPath: string;
  paperId: string | null;
  amount: number;
  chequeNumber?: string;
  partyName?: string;
  dueDate?: string;
  onClose: () => void;
  onDone: (record: SecuritiesPaperRecord) => void;
}) {
  const [date, setDate] = useState(todayIso);
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setAccountId('');
    setCostCenterId('');
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const next = buildSecuritiesCollectDescription(
      kind,
      chequeNumber || '',
      partyName || '',
      dueDate || ''
    );
    if (next) setDescription(next);
  }, [open, kind, chequeNumber, partyName, dueDate]);

  if (!open) return null;
  if (!paperId) {
    return (
      <Shell
        title={kind === 'payment' ? 'تحصيل ورقة المدفوعات' : 'تحصيل ورقة المقبوضات'}
        onClose={onClose}
        footer={<ActionFooter pending={false} saveLabel="حفظ" onSave={onClose} onClose={onClose} />}
      >
        <p className="sm:col-span-2 text-sm text-amber-700">احفظ الورقة أولاً ثم أعد المحاولة.</p>
      </Shell>
    );
  }

  const save = async () => {
    if (!accountId) {
      setError('اختر حساب البنك');
      return;
    }
    setPending(true);
    setError('');
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${paperId}/collect`, {
        accountId,
        date,
        description: description.trim() || undefined,
        costCenterId: costCenterId || undefined,
      });
      onDone(res.data ?? { id: paperId, isPosted: true, amount });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحصيل الورقة');
    } finally {
      setPending(false);
    }
  };

  return (
    <Shell
      title={kind === 'payment' ? 'تحصيل ورقة المدفوعات' : 'تحصيل ورقة المقبوضات'}
      onClose={onClose}
      footer={<ActionFooter pending={pending} saveLabel="حفظ التحصيل" onSave={() => void save()} onClose={onClose} />}
    >
      <div className="sm:col-span-2">
        <label className={erpLabelClass}>الشرح</label>
        <input
          className={erpInputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            kind === 'payment'
              ? 'تحصيل شيك رقم … إلى المورد … يستحق بتاريخ …'
              : 'تحصيل شيك رقم … من العميل … يستحق بتاريخ …'
          }
        />
      </div>
      <DatePickerWithHijri label="التاريخ" value={date} onChange={setDate} />
      <div className="sm:col-span-2">
        <label className={erpLabelClass}>حساب البنك</label>
        <AccountSelect
          value={accountId}
          onChange={setAccountId}
          className={erpInputClass}
          leafOnly
          bankOnly
          allowEmpty
          emptyLabel="اختر حساب البنك"
          placeholder="اختر حساب البنك"
        />
      </div>
      <div className="sm:col-span-2">
        <label className={erpLabelClass}>مركز التكلفة</label>
        <CostCenterSelect value={costCenterId} onChange={setCostCenterId} className={erpInputClass} />
      </div>
      <div>
        <label className={erpLabelClass}>المبلغ</label>
        <input className={erpInputClass} value={amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} readOnly />
      </div>
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
    </Shell>
  );
}

export function SecuritiesBounceModal({
  open,
  apiPath,
  paperId,
  onClose,
  onDone,
}: {
  open: boolean;
  apiPath: string;
  paperId: string | null;
  onClose: () => void;
  onDone: (record: SecuritiesPaperRecord) => void;
}) {
  const [date, setDate] = useState(todayIso);
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;
  if (!paperId) {
    return (
      <Shell
        title="ارتداد الورقة"
        onClose={onClose}
        footer={<ActionFooter pending={false} saveLabel="إغلاق" onSave={onClose} onClose={onClose} />}
      >
        <p className="sm:col-span-2 text-sm text-amber-700">احفظ الورقة أولاً ثم أعد المحاولة.</p>
      </Shell>
    );
  }

  const save = async () => {
    setPending(true);
    setError('');
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${paperId}/bounce`, {
        description: description.trim() || undefined,
        date,
      });
      onDone(res.data ?? { id: paperId, isCancelled: true });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر ارتداد الورقة');
    } finally {
      setPending(false);
    }
  };

  return (
    <Shell
      title="ارتداد الورقة"
      onClose={onClose}
      footer={<ActionFooter pending={pending} saveLabel="حفظ الارتداد" onSave={() => void save()} onClose={onClose} />}
    >
      <p className="sm:col-span-2 text-sm leading-6 text-slate-600">
        الارتداد بيعكس قيد التحرير: المدين يبقى دائن والدائن يبقى مدين. لو الورقة عليها إيداع، بيتعمل قيدين عكس: قيد الإيداع ثم قيد التحرير.
      </p>
      <div className="sm:col-span-2">
        <label className={erpLabelClass}>الشرح</label>
        <input className={erpInputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="سبب الارتداد" />
      </div>
      <DatePickerWithHijri label="التاريخ" value={date} onChange={setDate} />
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
    </Shell>
  );
}

export function SecuritiesEndorseModal({
  open,
  apiPath,
  paperId,
  chequeNumber,
  partyName,
  dueDate,
  onClose,
  onDone,
}: {
  open: boolean;
  apiPath: string;
  paperId: string | null;
  chequeNumber?: string;
  partyName?: string;
  dueDate?: string;
  onClose: () => void;
  onDone: (record: SecuritiesPaperRecord) => void;
}) {
  const [date, setDate] = useState(todayIso);
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setAccountId('');
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const next = buildSecuritiesEndorseDescription(chequeNumber || '', partyName || '', dueDate || '');
    if (next) setDescription(next);
  }, [open, chequeNumber, partyName, dueDate]);

  if (!open) return null;
  if (!paperId) {
    return (
      <Shell
        title="تظهير ورقة مقبوضات"
        onClose={onClose}
        footer={<ActionFooter pending={false} saveLabel="إغلاق" onSave={onClose} onClose={onClose} />}
      >
        <p className="sm:col-span-2 text-sm text-amber-700">احفظ الورقة أولاً ثم افتح التظهير من جديد.</p>
      </Shell>
    );
  }

  const save = async () => {
    if (!accountId) {
      setError('اختر الحساب');
      return;
    }
    setPending(true);
    setError('');
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${paperId}/endorse`, {
        accountId,
        description: description.trim() || undefined,
        date,
      });
      onDone(res.data ?? { id: paperId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تظهير الورقة');
    } finally {
      setPending(false);
    }
  };

  return (
    <Shell
      title="تظهير ورقة مقبوضات"
      onClose={onClose}
      footer={<ActionFooter pending={pending} saveLabel="حفظ التظهير" onSave={() => void save()} onClose={onClose} />}
    >
      <div className="sm:col-span-2">
        <label className={erpLabelClass}>الشرح</label>
        <input
          className={erpInputClass}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="تظهير شيك رقم … من العميل … يستحق بتاريخ …"
        />
      </div>
      <DatePickerWithHijri label="تاريخ التظهير" value={date} onChange={setDate} />
      <div className="sm:col-span-2">
        <label className={erpLabelClass}>الحساب</label>
        <AccountSelect
          value={accountId}
          onChange={setAccountId}
          className={erpInputClass}
          leafOnly
          allowEmpty
          emptyLabel="اختر الحساب"
          placeholder="اختر الحساب من الدليل"
        />
      </div>
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
    </Shell>
  );
}
