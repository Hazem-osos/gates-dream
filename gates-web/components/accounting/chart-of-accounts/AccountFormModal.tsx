'use client';

import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import {
  useCreateAccountMutation,
  useSuggestAccountCode,
  useUpdateAccountMutation,
  type AccountFormPayload,
} from '@/lib/hooks/useChartOfAccounts';
import type { CoaHierarchyAccount } from '@/lib/accounting/mapCoaToTreeNodes';

export type AccountFormModalMode = 'create' | 'edit';

const emptyForm: AccountFormPayload = {
  code: '',
  arabicName: '',
  englishName: '',
  accountType: '',
  parentId: null,
  accountSide: null,
  costCenterRequired: 'بدون',
  defaultCostCenterId: null,
  warning: 'بدون',
  budget: null,
};

export function AccountFormModal({
  open,
  mode,
  initial,
  parentAccount,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  mode: AccountFormModalMode;
  initial?: CoaHierarchyAccount | null;
  parentAccount?: CoaHierarchyAccount | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState<AccountFormPayload>(emptyForm);
  const parentIdForSuggest = mode === 'create' ? parentAccount?.id ?? null : form.parentId ?? null;

  const { data: suggestRes, refetch: refetchSuggest } = useSuggestAccountCode(
    parentIdForSuggest,
    open && mode === 'create'
  );

  const { data: settingsRes } = useAccountingSettingsQuery();
  const autoNumbering = settingsRes?.data?.general?.coaAutoNumbering !== false;
  const createMut = useCreateAccountMutation();
  const updateMut = useUpdateAccountMutation();
  const pending = createMut.isPending || updateMut.isPending;

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setForm({
        code: initial.code,
        arabicName: initial.arabicName ?? initial.nameAr ?? '',
        englishName: initial.englishName ?? initial.nameEn ?? '',
        accountType: initial.accountType ?? '',
        parentId: null,
        accountSide: initial.nature === 'DEBIT' ? 'مدين' : initial.nature === 'CREDIT' ? 'دائن' : null,
        costCenterRequired: (initial.costCenterRequired as AccountFormPayload['costCenterRequired']) || 'بدون',
        defaultCostCenterId: initial.defaultCostCenterId ?? null,
        warning: (initial as { warning?: AccountFormPayload['warning'] }).warning || 'بدون',
        budget: (initial as { budget?: number | null }).budget ?? null,
      });
    } else {
      setForm({
        ...emptyForm,
        parentId: parentAccount?.id ?? null,
        accountType: parentAccount?.accountType ?? '',
      });
      void refetchSuggest();
    }
  }, [open, mode, initial, parentAccount, refetchSuggest]);

  useEffect(() => {
    if (!open || mode !== 'create') return;
    const code = suggestRes?.data?.code;
    if (!code) return;
    setForm((f) => (autoNumbering || !f.code ? { ...f, code } : f));
  }, [suggestRes?.data?.code, open, mode, autoNumbering]);

  if (!open) return null;

  const submit = async () => {
    if (!form.arabicName.trim()) {
      onError('الاسم العربي مطلوب');
      return;
    }
    if (!autoNumbering && !form.code.trim()) {
      onError('رقم الحساب مطلوب — الترقيم يدوي');
      return;
    }
    try {
      const payload: AccountFormPayload = {
        ...form,
        englishName: form.englishName || undefined,
        accountType: form.accountType || undefined,
        parentId: form.parentId || undefined,
      };
      if (mode === 'edit' && initial) {
        await updateMut.mutateAsync({ id: initial.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'فشل حفظ الحساب');
    }
  };

  const parentLabel = parentAccount
    ? `${parentAccount.code} — ${parentAccount.arabicName ?? parentAccount.nameAr}`
    : mode === 'create'
      ? 'حساب رئيسي (بدون أب)'
      : '—';

  const advancedFilledCount = [
    form.englishName,
    form.defaultCostCenterId,
    form.costCenterRequired && form.costCenterRequired !== 'بدون' ? form.costCenterRequired : '',
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" aria-label="إغلاق" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl" dir="rtl">
        <div className="p-6 pb-0">
          <h2 className="mb-1 text-xl font-bold text-[#0E79AA]">
            {mode === 'create' ? (parentAccount ? 'إضافة حساب فرعي' : 'إضافة حساب رئيسي') : 'تعديل حساب'}
          </h2>
          <p className="mb-4 text-sm text-slate-500">الحساب الأب: {parentLabel}</p>

          <FormSectionCard
            title="البيانات الأساسية"
            subtitle="الحقول اللازمة لتعريف الحساب"
            icon={Landmark}
            className="mb-3"
            bodyClassName="!grid-cols-[8rem_minmax(16rem,1.6fr)_minmax(9rem,1fr)_minmax(9rem,1fr)]"
          >
            <CompactFormField
              label={autoNumbering ? 'رقم الحساب' : 'رقم الحساب'}
              value={form.code}
              readOnly={autoNumbering}
              disabled={autoNumbering}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              hint={autoNumbering ? 'تلقائي' : 'أدخل الرقم'}
            />
            <CompactFormField
              label="الاسم العربي"
              required
              value={form.arabicName}
              onChange={(e) => setForm((f) => ({ ...f, arabicName: e.target.value }))}
            />
            <CompactFormField
              label="الحد الائتماني"
              type="number"
              min="0"
              step="0.01"
              value={form.budget != null ? String(form.budget) : ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  budget: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
            <CompactFormField label="جهة التحذير">
              <select
                className={compactControlClass}
                value={form.warning ?? 'بدون'}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    warning: e.target.value as AccountFormPayload['warning'],
                  }))
                }
              >
                <option value="بدون">بدون</option>
                <option value="مدين">مدين</option>
                <option value="دائن">دائن</option>
              </select>
            </CompactFormField>
            <CompactFormField label="الحساب الأب">
              <input className={compactControlClass} value={parentLabel} readOnly />
            </CompactFormField>
            <CompactFormField label="طبيعة الحساب">
              <select
                className={compactControlClass}
                value={form.accountSide ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    accountSide: (e.target.value || null) as AccountFormPayload['accountSide'],
                  }))
                }
              >
                <option value="">افتراضي حسب النوع</option>
                <option value="مدين">مدين</option>
                <option value="دائن">دائن</option>
              </select>
            </CompactFormField>
            <CompactFormField label="تصنيف GL">
              <select
                className={compactControlClass}
                value={form.accountType ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))}
              >
                <option value="">—</option>
                <option value="asset">أصول</option>
                <option value="liability">التزامات</option>
                <option value="revenue">إيرادات</option>
                <option value="expense">مصروفات</option>
              </select>
            </CompactFormField>
            <CompactFormField label="مركز التكلفة (اختياري)" className="lg:col-span-2">
              <CostCenterSelect
                value={form.defaultCostCenterId || ''}
                onChange={(id) => setForm((f) => ({ ...f, defaultCostCenterId: id || null }))}
                emptyLabel="غير مربوط"
              />
            </CompactFormField>
          </FormSectionCard>

          <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CompactFormField
                label="الاسم الإنجليزي"
                value={form.englishName ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, englishName: e.target.value }))}
              />
              <CompactFormField label="مركز التكلفة">
                <select
                  className={compactControlClass}
                  value={form.costCenterRequired ?? 'بدون'}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      costCenterRequired: e.target.value as AccountFormPayload['costCenterRequired'],
                    }))
                  }
                >
                  <option value="بدون">بدون</option>
                  <option value="اختياري">اختياري</option>
                  <option value="إجباري">إجباري</option>
                </select>
              </CompactFormField>
            </div>
          </AdvancedFieldsSection>
        </div>

        <FormStickyFooter
          onCancel={onClose}
          onSave={() => void submit()}
          saveLoading={pending}
          cancelText="إلغاء"
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
