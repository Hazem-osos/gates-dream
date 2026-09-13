'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { useApiQuery } from '@/lib/hooks/useApi';
import { LG_TYPE_LABEL } from '@/lib/contracting/labels';
import type { ProjectLetterOfGuarantee, ProjectLgType } from '@/lib/contracting/types';
import type { BankAccountOption } from '@/lib/real-estate/types';
import { formatEgp, percentInputToRate, toMoney } from '@/lib/subcontracts/money';

const TYPES = Object.keys(LG_TYPE_LABEL) as ProjectLgType[];

function Overlay({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div
        className={`max-h-[90vh] w-full overflow-auto rounded-xl bg-white shadow-xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        {children}
      </div>
    </div>
  );
}

export function IssueLgModal({
  open,
  projectId,
  defaultBeneficiary,
  onClose,
  onSaved,
}: {
  open: boolean;
  projectId: string;
  defaultBeneficiary?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const banksQ = useApiQuery<BankAccountOption[]>(['bank-accounts-lg'], '/accounting/bank-accounts', { isActive: true });
  const banks = banksQ.data?.data ?? [];
  const [form, setForm] = useState({
    lgNumber: '',
    bankAccountId: '',
    bankName: '',
    beneficiaryName: defaultBeneficiary ?? '',
    type: 'PERFORMANCE_BOND_FINAL' as ProjectLgType,
    issuanceDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    originalAmount: '',
    cashMarginRate: '10',
    issuanceCommissionAmount: '0',
  });
  const margin = toMoney(form.originalAmount) * percentInputToRate(form.cashMarginRate);

  const save = useMutation({
    mutationFn: async () =>
      apiClient.post('/contracting/letters-of-guarantee', {
        projectId,
        lgNumber: form.lgNumber,
        bankAccountId: form.bankAccountId,
        bankName: form.bankName || banks.find((b) => b.id === form.bankAccountId)?.bankName || banks.find((b) => b.id === form.bankAccountId)?.arabicName,
        beneficiaryName: form.beneficiaryName,
        type: form.type,
        issuanceDate: form.issuanceDate,
        expiryDate: form.expiryDate,
        originalAmount: toMoney(form.originalAmount),
        cashMarginRate: percentInputToRate(form.cashMarginRate),
        issuanceCommissionAmount: toMoney(form.issuanceCommissionAmount),
      }),
    onSuccess: () => {
      notifyApiSuccess('تم إصدار خطاب الضمان وترحيل الغطاء');
      onSaved();
      onClose();
    },
  });

  if (!open) return null;

  const advancedFilledCount = [form.bankName, form.cashMarginRate !== '10' ? form.cashMarginRate : '', form.issuanceCommissionAmount !== '0' ? form.issuanceCommissionAmount : ''].filter(
    (v) => String(v ?? '').trim().length > 0
  ).length;

  return (
    <Overlay wide>
      <div className="p-5 pb-0">
        <h2 className="mb-4 text-lg font-bold text-[#0E79AA]">إصدار خطاب ضمان</h2>
        <FormSectionCard title="البيانات الأساسية" subtitle="رقم الخطاب والبنك والمستفيد والقيمة" icon={Shield}>
          <CompactFormField
            label="رقم الخطاب"
            required
            placeholder="رقم الخطاب"
            value={form.lgNumber}
            onChange={(e) => setForm((p) => ({ ...p, lgNumber: e.target.value }))}
          />
          <CompactFormField label="حساب البنك" required>
            <select
              className={compactControlClass}
              value={form.bankAccountId}
              onChange={(e) => {
                const bank = banks.find((b) => b.id === e.target.value);
                setForm((p) => ({
                  ...p,
                  bankAccountId: e.target.value,
                  bankName: bank?.bankName || bank?.arabicName || bank?.name || p.bankName,
                }));
              }}
            >
              <option value="">حساب البنك</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.arabicName || bank.name || bank.bankName} {bank.accountNumber ? `— ${bank.accountNumber}` : ''}
                </option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField
            label="الجهة المستفيدة / المالك"
            placeholder="الجهة المستفيدة / المالك"
            value={form.beneficiaryName}
            onChange={(e) => setForm((p) => ({ ...p, beneficiaryName: e.target.value }))}
          />
          <CompactFormField label="نوع الخطاب">
            <select
              className={compactControlClass}
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ProjectLgType }))}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {LG_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField
            label="تاريخ الإصدار"
            type="date"
            value={form.issuanceDate}
            onChange={(e) => setForm((p) => ({ ...p, issuanceDate: e.target.value }))}
          />
          <CompactFormField
            label="تاريخ الانتهاء"
            required
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
          />
          <CompactFormField
            label="قيمة الخطاب"
            type="number"
            min="0"
            placeholder="قيمة الخطاب"
            value={form.originalAmount}
            onChange={(e) => setForm((p) => ({ ...p, originalAmount: e.target.value }))}
          />
        </FormSectionCard>

        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="اسم البنك الظاهر على الخطاب"
              placeholder="اسم البنك الظاهر على الخطاب"
              value={form.bankName}
              onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
            />
            <CompactFormField
              label="نسبة الغطاء %"
              type="number"
              min="0"
              placeholder="نسبة الغطاء %"
              value={form.cashMarginRate}
              onChange={(e) => setForm((p) => ({ ...p, cashMarginRate: e.target.value }))}
            />
            <CompactFormField
              label="عمولة الإصدار"
              type="number"
              min="0"
              placeholder="عمولة الإصدار"
              value={form.issuanceCommissionAmount}
              onChange={(e) => setForm((p) => ({ ...p, issuanceCommissionAmount: e.target.value }))}
            />
          </div>
        </AdvancedFieldsSection>

        <p className="mb-3 text-sm">
          الغطاء النقدي المحتجز: <span className="font-bold tabular-nums">{formatEgp(margin)}</span>
        </p>
      </div>
      <FormStickyFooter
        onCancel={onClose}
        onSave={() => save.mutate()}
        saveText="إصدار وترحيل"
        cancelText="إلغاء"
        saveLoading={save.isPending}
        saveDisabled={!form.lgNumber || !form.bankAccountId || !form.expiryDate}
        respectPermissions={false}
        className="mt-0"
      />
    </Overlay>
  );
}

export function ExtendLgModal({
  open,
  lg,
  onClose,
  onSaved,
}: {
  open: boolean;
  lg: ProjectLetterOfGuarantee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ newExpiryDate: '', bankReferenceNo: '', extensionCommission: '0', notes: '' });
  const save = useMutation({
    mutationFn: async () => {
      if (!lg) throw new Error('missing lg');
      return apiClient.post(`/contracting/letters-of-guarantee/${lg.id}/extend`, {
        newExpiryDate: form.newExpiryDate,
        bankReferenceNo: form.bankReferenceNo || undefined,
        extensionCommission: toMoney(form.extensionCommission),
        notes: form.notes || undefined,
      });
    },
    onSuccess: () => {
      notifyApiSuccess('تم مد خطاب الضمان');
      onSaved();
      onClose();
    },
  });
  if (!open || !lg) return null;
  const advancedFilledCount = [form.bankReferenceNo, form.extensionCommission !== '0' ? form.extensionCommission : '', form.notes].filter(
    (v) => String(v ?? '').trim().length > 0
  ).length;
  return (
    <Overlay>
      <div className="p-5 pb-0">
        <h2 className="mb-4 text-lg font-bold text-[#0E79AA]">مد صلاحية {lg.lgNumber}</h2>
        <FormSectionCard title="البيانات الأساسية" subtitle="تاريخ الانتهاء الجديد" icon={Shield} className="mb-3">
          <CompactFormField
            label="تاريخ الانتهاء الجديد"
            required
            type="date"
            value={form.newExpiryDate}
            onChange={(e) => setForm((p) => ({ ...p, newExpiryDate: e.target.value }))}
          />
        </FormSectionCard>
        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField
              label="مرجع البنك"
              placeholder="مرجع البنك"
              value={form.bankReferenceNo}
              onChange={(e) => setForm((p) => ({ ...p, bankReferenceNo: e.target.value }))}
            />
            <CompactFormField
              label="عمولة التجديد"
              type="number"
              min="0"
              placeholder="عمولة التجديد"
              value={form.extensionCommission}
              onChange={(e) => setForm((p) => ({ ...p, extensionCommission: e.target.value }))}
            />
            <CompactFormField
              label="ملاحظات"
              className="sm:col-span-2"
              placeholder="ملاحظات"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </AdvancedFieldsSection>
      </div>
      <FormStickyFooter
        onCancel={onClose}
        onSave={() => save.mutate()}
        saveText="تأكيد المد"
        cancelText="إلغاء"
        saveLoading={save.isPending}
        saveDisabled={!form.newExpiryDate}
        respectPermissions={false}
        className="mt-0"
      />
    </Overlay>
  );
}

export function AmendLgModal({
  open,
  lg,
  onClose,
  onSaved,
}: {
  open: boolean;
  lg: ProjectLetterOfGuarantee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newAmount, setNewAmount] = useState(lg ? String(toMoney(lg.currentAmount)) : '');
  const [bankReferenceNo, setBankReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const diff = useMemo(() => {
    if (!lg) return { amount: 0, margin: 0 };
    const amountDiff = toMoney(newAmount) - toMoney(lg.currentAmount);
    return { amount: amountDiff, margin: amountDiff * toMoney(lg.cashMarginRate) };
  }, [lg, newAmount]);

  const save = useMutation({
    mutationFn: async () => {
      if (!lg) throw new Error('missing lg');
      return apiClient.post(`/contracting/letters-of-guarantee/${lg.id}/amend-amount`, {
        newAmount: toMoney(newAmount),
        bankReferenceNo: bankReferenceNo || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      notifyApiSuccess('تم تعديل قيمة الخطاب');
      onSaved();
      onClose();
    },
  });
  if (!open || !lg) return null;
  const advancedFilledCount = [bankReferenceNo, notes].filter((v) => v.trim().length > 0).length;
  return (
    <Overlay>
      <div className="p-5 pb-0">
        <h2 className="mb-4 text-lg font-bold text-[#0E79AA]">تعديل قيمة {lg.lgNumber}</h2>
        <p className="mb-3 text-sm text-slate-500">القيمة الحالية: {formatEgp(lg.currentAmount)}</p>
        <FormSectionCard title="البيانات الأساسية" subtitle="القيمة الجديدة للخطاب" icon={Shield} className="mb-3">
          <CompactFormField
            label="القيمة الجديدة"
            type="number"
            min="0"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
          />
        </FormSectionCard>
        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField
              label="مرجع البنك"
              placeholder="مرجع البنك"
              value={bankReferenceNo}
              onChange={(e) => setBankReferenceNo(e.target.value)}
            />
            <CompactFormField label="ملاحظات" placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </AdvancedFieldsSection>
        <p className="mb-3 text-sm">
          فرق القيمة: <span className="tabular-nums font-semibold">{formatEgp(diff.amount)}</span> — فرق الغطاء:{' '}
          <span className="tabular-nums font-semibold">{formatEgp(diff.margin)}</span>
        </p>
      </div>
      <FormStickyFooter
        onCancel={onClose}
        onSave={() => save.mutate()}
        saveText="تأكيد التعديل"
        cancelText="إلغاء"
        saveLoading={save.isPending}
        respectPermissions={false}
        className="mt-0"
      />
    </Overlay>
  );
}

export function ReleaseLgModal({
  open,
  lg,
  onClose,
  onSaved,
}: {
  open: boolean;
  lg: ProjectLetterOfGuarantee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ releaseDate: new Date().toISOString().slice(0, 10), bankReferenceNo: '', notes: '' });
  const save = useMutation({
    mutationFn: async () => {
      if (!lg) throw new Error('missing lg');
      return apiClient.post(`/contracting/letters-of-guarantee/${lg.id}/release`, form);
    },
    onSuccess: () => {
      notifyApiSuccess('تم الإفراج عن الخطاب ورد الغطاء');
      onSaved();
      onClose();
    },
  });
  if (!open || !lg) return null;
  const advancedFilledCount = [form.bankReferenceNo, form.notes].filter((v) => v.trim().length > 0).length;
  return (
    <Overlay>
      <div className="p-5 pb-0">
        <h2 className="mb-4 text-lg font-bold text-[#0E79AA]">إفراج ورد {lg.lgNumber}</h2>
        <p className="mb-3 text-sm">سيتم رد الغطاء النقدي {formatEgp(lg.cashMarginAmount)} إلى حساب البنك.</p>
        <FormSectionCard title="البيانات الأساسية" subtitle="تاريخ الإفراج" icon={Shield} className="mb-3">
          <CompactFormField
            label="تاريخ الإفراج"
            type="date"
            value={form.releaseDate}
            onChange={(e) => setForm((p) => ({ ...p, releaseDate: e.target.value }))}
          />
        </FormSectionCard>
        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField
              label="مرجع البنك"
              placeholder="مرجع البنك"
              value={form.bankReferenceNo}
              onChange={(e) => setForm((p) => ({ ...p, bankReferenceNo: e.target.value }))}
            />
            <CompactFormField
              label="ملاحظات"
              placeholder="ملاحظات"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </AdvancedFieldsSection>
      </div>
      <FormStickyFooter
        onCancel={onClose}
        onSave={() => save.mutate()}
        saveText="تأكيد الإفراج"
        cancelText="إلغاء"
        saveLoading={save.isPending}
        respectPermissions={false}
        className="mt-0"
      />
    </Overlay>
  );
}

export function LiquidateLgModal({
  open,
  lg,
  onClose,
  onSaved,
}: {
  open: boolean;
  lg: ProjectLetterOfGuarantee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    liquidationDate: new Date().toISOString().slice(0, 10),
    liquidationReason: '',
    notes: '',
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!lg) throw new Error('missing lg');
      return apiClient.post(`/contracting/letters-of-guarantee/${lg.id}/liquidate`, form);
    },
    onSuccess: () => {
      notifyApiSuccess('تم تسجيل مصادرة خطاب الضمان');
      onSaved();
      onClose();
    },
  });
  if (!open || !lg) return null;
  const advancedFilledCount = [form.notes].filter((v) => v.trim().length > 0).length;
  return (
    <Overlay>
      <div className="p-5 pb-0">
        <h2 className="mb-4 text-lg font-bold text-red-700">مصادرة خطاب الضمان {lg.lgNumber}</h2>
        <p className="mb-3 text-sm text-slate-600">سيُرحَّل الغطاء كخسارة مصادرة. هذا الإجراء نهائي.</p>
        <FormSectionCard title="البيانات الأساسية" subtitle="تاريخ وسبب المصادرة" icon={Shield} className="mb-3">
          <CompactFormField
            label="تاريخ المصادرة"
            type="date"
            value={form.liquidationDate}
            onChange={(e) => setForm((p) => ({ ...p, liquidationDate: e.target.value }))}
          />
          <CompactFormField
            label="سبب المصادرة"
            required
            placeholder="سبب المصادرة"
            value={form.liquidationReason}
            onChange={(e) => setForm((p) => ({ ...p, liquidationReason: e.target.value }))}
          />
        </FormSectionCard>
        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3">
            <CompactFormField
              label="ملاحظات"
              placeholder="ملاحظات"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </AdvancedFieldsSection>
      </div>
      <FormStickyFooter
        onCancel={onClose}
        onSave={() => save.mutate()}
        saveText="تأكيد المصادرة"
        cancelText="إلغاء"
        saveLoading={save.isPending}
        saveDisabled={!form.liquidationReason}
        respectPermissions={false}
        className="mt-0"
      />
    </Overlay>
  );
}
