'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { formatEgp, toMoney } from '@/lib/real-estate/format';
import type { BankAccountOption, PostDatedCheque, UnitContractListItem, UnitInstallment } from '@/lib/real-estate/types';

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-auto rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-[#0E79AA]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

type ChequeDraft = { chequeNumber: string; bankName: string; drawerName: string; chequeDate: string; amount: string; unitInstallmentId: string };

export function BatchChequeModal({
  open,
  contracts,
  installments,
  onClose,
  onSaved,
}: {
  open: boolean;
  contracts: UnitContractListItem[];
  installments: UnitInstallment[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [contractId, setContractId] = useState('');
  const [bankName, setBankName] = useState('');
  const [drawerName, setDrawerName] = useState('');
  const [startNumber, setStartNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [count, setCount] = useState('3');
  const [amount, setAmount] = useState('');

  const drafts = useMemo(() => {
    const n = Math.max(1, Math.min(24, Number(count) || 1));
    const start = Number(startNumber.replace(/\D/g, '')) || 1;
    const prefix = startNumber.replace(/\d+$/, '');
    const base = startDate ? new Date(startDate) : new Date();
    return Array.from({ length: n }, (_, i) => {
      const due = new Date(base);
      due.setMonth(due.getMonth() + i);
      return {
        chequeNumber: `${prefix}${String(start + i).padStart(String(startNumber).replace(/\D/g, '').length || 3, '0')}`,
        bankName,
        drawerName,
        chequeDate: due.toISOString().slice(0, 10),
        amount,
        unitInstallmentId: installments[i]?.id ?? '',
      } satisfies ChequeDraft;
    });
  }, [amount, bankName, count, drawerName, installments, startDate, startNumber]);

  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/real-estate/contracts/${contractId}/cheques/batch`, {
        cheques: drafts.map((row) => ({
          chequeNumber: row.chequeNumber,
          bankName: row.bankName,
          drawerName: row.drawerName,
          chequeDate: row.chequeDate,
          amount: toMoney(row.amount),
          unitInstallmentId: row.unitInstallmentId || undefined,
        })),
      }),
    onSuccess: () => {
      notifyApiSuccess('تم تسجيل الشيكات');
      onSaved?.();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <Overlay title="تسجيل دفعة شيكات آجلة">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">العقد</span>
        <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3" value={contractId} onChange={(e) => setContractId(e.target.value)}>
          <option value="">اختر العقد</option>
          {contracts.map((row) => (
            <option key={row.id} value={row.id}>
              {row.contractNumber} — {row.customer?.arabicName ?? ''}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="البنك" value={bankName} onChange={(e) => setBankName(e.target.value)} />
        <Input placeholder="الساحب" value={drawerName} onChange={(e) => setDrawerName(e.target.value)} />
        <Input placeholder="أول رقم شيك" value={startNumber} onChange={(e) => setStartNumber(e.target.value)} />
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input type="number" placeholder="عدد الشيكات" value={count} onChange={(e) => setCount(e.target.value)} />
        <Input type="number" placeholder="قيمة الشيك" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <ul className="max-h-40 overflow-auto rounded-lg bg-[#F6FBFD] p-3 text-xs">
        {drafts.map((row) => (
          <li key={row.chequeNumber}>
            {row.chequeNumber} — {row.chequeDate} — {formatEgp(row.amount)}
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button isLoading={mutation.isPending} disabled={!contractId || !bankName || !drawerName || !startNumber} onClick={() => mutation.mutate()}>
          تسجيل
        </Button>
      </div>
    </Overlay>
  );
}

export function DepositChequesModal({
  open,
  chequeIds,
  banks,
  onClose,
  onSaved,
}: {
  open: boolean;
  chequeIds: string[];
  banks: BankAccountOption[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [bankAccountId, setBankAccountId] = useState('');
  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/real-estate/cheques/${chequeIds[0]}/deposit`, { bankAccountId, chequeIds }),
    onSuccess: () => {
      notifyApiSuccess('تم إيداع الشيكات برسم التحصيل');
      onSaved?.();
      onClose();
    },
  });
  if (!open) return null;
  return (
    <Overlay title="إيداع الشيكات في البنك">
      <p className="text-sm text-slate-600">عدد الشيكات المحددة: {chequeIds.length}</p>
      <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
        <option value="">اختر الحساب البنكي</option>
        {banks.map((bank) => (
          <option key={bank.id} value={bank.id}>
            {bank.arabicName || bank.name || bank.bankName || bank.accountNumber}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button isLoading={mutation.isPending} disabled={!bankAccountId || !chequeIds.length} onClick={() => mutation.mutate()}>
          إيداع
        </Button>
      </div>
    </Overlay>
  );
}

export function ClearChequeModal({
  open,
  cheque,
  onClose,
  onSaved,
}: {
  open: boolean;
  cheque: PostDatedCheque | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [clearanceDate, setClearanceDate] = useState(new Date().toISOString().slice(0, 10));
  const mutation = useMutation({
    mutationFn: async () => apiClient.patch(`/real-estate/cheques/${cheque!.id}/clear`, { clearanceDate }),
    onSuccess: () => {
      notifyApiSuccess('تم تحصيل الشيك وترحيل القيد');
      onSaved?.();
      onClose();
    },
  });
  if (!open || !cheque) return null;
  return (
    <Overlay title="تحصيل الشيك وترحيل اليومية">
      <p className="text-sm">
        {cheque.chequeNumber} — {formatEgp(cheque.amount)}. سيتم تسوية القسط المرتبط إن وجد، ثم إنشاء قيد مدين بنك / دائن عميل.
      </p>
      <Input type="date" value={clearanceDate} onChange={(e) => setClearanceDate(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button isLoading={mutation.isPending} onClick={() => mutation.mutate()}>تأكيد التحصيل</Button>
      </div>
    </Overlay>
  );
}

export function BounceChequeModal({
  open,
  cheque,
  onClose,
  onSaved,
}: {
  open: boolean;
  cheque: PostDatedCheque | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: async () => apiClient.patch(`/real-estate/cheques/${cheque!.id}/bounce`, { bounceReason: reason }),
    onSuccess: () => {
      notifyApiSuccess('تم ارتداد الشيك وإعادة احتساب الغرامة');
      setReason('');
      onSaved?.();
      onClose();
    },
  });
  if (!open || !cheque) return null;
  return (
    <Overlay title="ارتداد الشيك">
      <p className="text-sm text-red-700">سيُعلَّم الشيك كمرتد ويُعاد احتساب غرامة التأخير فورًا.</p>
      <textarea className="min-h-20 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الارتداد" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button isLoading={mutation.isPending} disabled={!reason.trim()} onClick={() => mutation.mutate()}>تأكيد الارتداد</Button>
      </div>
    </Overlay>
  );
}

export function ReplaceChequeModal({
  open,
  cheque,
  onClose,
  onSaved,
}: {
  open: boolean;
  cheque: PostDatedCheque | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState({ chequeNumber: '', bankName: '', drawerName: '', chequeDate: '', amount: '' });
  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/real-estate/cheques/${cheque!.id}/replace`, {
        replacement: {
          chequeNumber: form.chequeNumber,
          bankName: form.bankName || cheque!.bankName,
          drawerName: form.drawerName || cheque!.drawerName,
          chequeDate: form.chequeDate,
          amount: toMoney(form.amount || cheque!.amount),
          unitInstallmentId: cheque!.unitInstallmentId || undefined,
        },
      }),
    onSuccess: () => {
      notifyApiSuccess('تم استبدال الشيك');
      onSaved?.();
      onClose();
    },
  });
  if (!open || !cheque) return null;
  return (
    <Overlay title="استبدال الشيك">
      <p className="text-sm text-slate-600">سيتم إلغاء {cheque.chequeNumber} وإصدار شيك بديل.</p>
      <Input placeholder="رقم الشيك الجديد" value={form.chequeNumber} onChange={(e) => setForm((prev) => ({ ...prev, chequeNumber: e.target.value }))} />
      <Input placeholder="البنك" value={form.bankName} onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))} />
      <Input placeholder="الساحب" value={form.drawerName} onChange={(e) => setForm((prev) => ({ ...prev, drawerName: e.target.value }))} />
      <Input type="date" value={form.chequeDate} onChange={(e) => setForm((prev) => ({ ...prev, chequeDate: e.target.value }))} />
      <Input type="number" placeholder={`المبلغ (${formatEgp(cheque.amount)})`} value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>إلغاء</Button>
        <Button isLoading={mutation.isPending} disabled={!form.chequeNumber || !form.chequeDate} onClick={() => mutation.mutate()}>
          إصدار البديل
        </Button>
      </div>
    </Overlay>
  );
}
