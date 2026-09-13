'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { percentInputToRate } from '@/lib/subcontracts/money';
import type { ContractingProjectOption, SubcontractDetail, Subcontractor } from '@/lib/subcontracts/types';

type FormState = {
  subcontractorId: string;
  projectId: string;
  subcontractNumber: string;
  contractDate: string;
  totalContractValue: string;
  advancePaymentTotal: string;
  advancePaymentRecoveryRate: string;
  retentionRate: string;
  taxWithholdingRate: string;
  socialInsuranceRate: string;
  newNameAr: string;
  newTaxId: string;
};

const emptyForm = (): FormState => ({
  subcontractorId: '',
  projectId: '',
  subcontractNumber: '',
  contractDate: new Date().toISOString().slice(0, 10),
  totalContractValue: '',
  advancePaymentTotal: '0',
  advancePaymentRecoveryRate: '10',
  retentionRate: '5',
  taxWithholdingRate: '1',
  socialInsuranceRate: '0',
  newNameAr: '',
  newTaxId: '',
});

export function CreateSubcontractModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showNewVendor, setShowNewVendor] = useState(false);

  const vendorsQ = useApiQuery<Subcontractor[]>(queryKeys.subcontracts.directory(), '/subcontracts/directory/subcontractors');
  const projectsQ = useApiQuery<ContractingProjectOption[]>(queryKeys.subcontracts.projects(), '/contracting/projects');
  const vendors = vendorsQ.data?.data ?? [];
  const projects = projectsQ.data?.data ?? [];

  const createVendor = useMutation({
    mutationFn: async () =>
      apiClient.post<Subcontractor>('/subcontracts/directory/subcontractors', {
        nameAr: form.newNameAr,
        taxRegistrationNumber: form.newTaxId || undefined,
      }),
    onSuccess: (res) => {
      const vendor = res.data;
      if (vendor?.id) {
        setForm((prev) => ({ ...prev, subcontractorId: vendor.id, newNameAr: '', newTaxId: '' }));
        setShowNewVendor(false);
        vendorsQ.refetch();
        notifyApiSuccess('تم تسجيل المقاول');
      }
    },
  });

  const createContract = useMutation({
    mutationFn: async () =>
      apiClient.post<SubcontractDetail>('/subcontracts', {
        subcontractorId: form.subcontractorId,
        projectId: form.projectId,
        subcontractNumber: form.subcontractNumber || undefined,
        contractDate: form.contractDate,
        totalContractValue: Number(form.totalContractValue),
        advancePaymentTotal: Number(form.advancePaymentTotal || 0),
        advancePaymentRecoveryRate: percentInputToRate(form.advancePaymentRecoveryRate),
        retentionRate: percentInputToRate(form.retentionRate),
        taxWithholdingRate: percentInputToRate(form.taxWithholdingRate),
        socialInsuranceRate: percentInputToRate(form.socialInsuranceRate),
      }),
    onSuccess: (res) => {
      notifyApiSuccess('تم إنشاء عقد الباطن');
      const id = res.data?.id;
      setForm(emptyForm());
      onClose();
      if (id) onCreated?.(id);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-auto rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-[#0E79AA]">عقد مقاول باطن جديد</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">المقاول</span>
          <select
            className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-sm"
            value={form.subcontractorId}
            onChange={(e) => setForm((prev) => ({ ...prev, subcontractorId: e.target.value }))}
          >
            <option value="">اختر المقاول</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.nameAr}
                {vendor.taxRegistrationNumber ? ` — ${vendor.taxRegistrationNumber}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="text-sm text-[#0E79AA] underline" onClick={() => setShowNewVendor((v) => !v)}>
          {showNewVendor ? 'إخفاء بطاقة المقاول الجديدة' : 'تسجيل مقاول جديد'}
        </button>
        {showNewVendor ? (
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-[#F6FBFD] p-3 sm:grid-cols-2">
            <Input
              placeholder="اسم المقاول"
              value={form.newNameAr}
              onChange={(e) => setForm((prev) => ({ ...prev, newNameAr: e.target.value }))}
            />
            <Input
              placeholder="الرقم الضريبي"
              value={form.newTaxId}
              onChange={(e) => setForm((prev) => ({ ...prev, newTaxId: e.target.value }))}
            />
            <Button size="sm" isLoading={createVendor.isPending} disabled={!form.newNameAr} onClick={() => createVendor.mutate()}>
              حفظ المقاول
            </Button>
          </div>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">المشروع</span>
          <select
            className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-sm"
            value={form.projectId}
            onChange={(e) => setForm((prev) => ({ ...prev, projectId: e.target.value }))}
          >
            <option value="">اختر المشروع</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectCode} — {project.projectName}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">رقم العقد (اختياري)</span>
            <Input
              value={form.subcontractNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, subcontractNumber: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">تاريخ العقد</span>
            <Input
              type="date"
              value={form.contractDate}
              onChange={(e) => setForm((prev) => ({ ...prev, contractDate: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">قيمة العقد</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.totalContractValue}
              onChange={(e) => setForm((prev) => ({ ...prev, totalContractValue: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">الدفعة المقدمة</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.advancePaymentTotal}
              onChange={(e) => setForm((prev) => ({ ...prev, advancePaymentTotal: e.target.value }))}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['advancePaymentRecoveryRate', 'استرداد المقدمة ٪'],
              ['retentionRate', 'تأمين الأعمال ٪'],
              ['taxWithholdingRate', 'خصم المنبع ٪'],
              ['socialInsuranceRate', 'تأمينات ٪'],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="block text-sm">
              <span className="mb-1 block font-medium">{label}</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form[field]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            isLoading={createContract.isPending}
            disabled={!form.subcontractorId || !form.projectId || !form.totalContractValue}
            onClick={() => createContract.mutate()}
          >
            إنشاء العقد
          </Button>
        </div>
      </div>
    </div>
  );
}
