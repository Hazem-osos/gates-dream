'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SupplierSelect } from '@/app/components/form/PartySelect';
import { Button } from '@/components/ui/button';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { formatChequeAmount, type ChequeRecord } from './cheque-status';

function Shell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-900/40 p-4" dir="rtl">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="إغلاق" onClick={onClose} />
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
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
  disabled,
}: {
  pending: boolean;
  saveLabel: string;
  onSave: () => void;
  onClose: () => void;
  disabled?: boolean;
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
        disabled={pending || disabled}
        isLoading={pending}
      >
        {saveLabel}
      </Button>
    </>
  );
}

function ChequeSummary({ cheque }: { cheque: ChequeRecord }) {
  return (
    <>
      <div>
        <label className={erpLabelClass}>رقم الشيك</label>
        <p className="font-mono text-base font-semibold text-[#0A3D5E]">{cheque.chequeNumber}</p>
      </div>
      <div>
        <label className={erpLabelClass}>المبلغ</label>
        <p className="font-mono text-base font-semibold text-[#0A3D5E]">
          {formatChequeAmount(cheque.amount, cheque.currencyCode)}
        </p>
      </div>
    </>
  );
}

export function ChequeEndorseModal({
  open,
  cheque,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  cheque: ChequeRecord | null;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (supplierId: string, notes: string) => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setSupplierId('');
      setNotes('');
    }
  }, [open, cheque?.id]);

  if (!open || !cheque) return null;

  return (
    <Shell
      title="تظهير الشيك لمورد"
      onClose={onClose}
      footer={
        <ActionFooter
          pending={pending}
          saveLabel="تأكيد التظهير"
          disabled={!supplierId}
          onSave={() => onConfirm(supplierId, notes)}
          onClose={onClose}
        />
      }
    >
      <ChequeSummary cheque={cheque} />
      <div className="sm:col-span-2">
        <label className={erpLabelClass}>المورد</label>
        <SupplierSelect value={supplierId} onChange={setSupplierId} emptyLabel="اختر المورد" />
      </div>
      <div className="sm:col-span-2">
        <label className={erpLabelClass}>ملاحظات</label>
        <textarea
          className={erpInputClass}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="اختياري — يظهر في القيد والوصف"
        />
      </div>
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
    </Shell>
  );
}

export function ChequeBankActionModal({
  open,
  title,
  saveLabel,
  cheque,
  bankAccounts,
  pending,
  error,
  requireBank = true,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  saveLabel: string;
  cheque: ChequeRecord | null;
  bankAccounts: { id: string; accountNumber?: string | null; arabicName?: string }[];
  pending: boolean;
  error: string;
  requireBank?: boolean;
  onClose: () => void;
  onConfirm: (bankAccountId: string) => void;
}) {
  const [bankAccountId, setBankAccountId] = useState('');

  useEffect(() => {
    if (open) setBankAccountId(cheque?.bankAccountId ?? '');
  }, [open, cheque?.id, cheque?.bankAccountId]);

  if (!open || !cheque) return null;

  return (
    <Shell
      title={title}
      onClose={onClose}
      footer={
        <ActionFooter
          pending={pending}
          saveLabel={saveLabel}
          disabled={requireBank && !bankAccountId}
          onSave={() => onConfirm(bankAccountId)}
          onClose={onClose}
        />
      }
    >
      <ChequeSummary cheque={cheque} />
      {requireBank ? (
        <div className="sm:col-span-2">
          <label className={erpLabelClass}>حساب البنك</label>
          <select className={erpInputClass} value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            <option value="">اختر الحساب البنكي</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.arabicName || b.accountNumber || b.id}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="sm:col-span-2 text-sm text-slate-600">سيتم نقل الشيك إلى حساب أوراق القبض برسم التحصيل دون المساس بحساب البنك.</p>
      )}
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
    </Shell>
  );
}

export function ChequeConfirmModal({
  open,
  title,
  saveLabel,
  message,
  cheque,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  saveLabel: string;
  message: string;
  cheque: ChequeRecord | null;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !cheque) return null;

  return (
    <Shell
      title={title}
      onClose={onClose}
      footer={<ActionFooter pending={pending} saveLabel={saveLabel} onSave={onConfirm} onClose={onClose} />}
    >
      <ChequeSummary cheque={cheque} />
      <p className="sm:col-span-2 text-sm text-slate-600">{message}</p>
      {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
    </Shell>
  );
}
