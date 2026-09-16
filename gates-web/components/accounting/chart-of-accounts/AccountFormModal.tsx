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
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import {
  useCreateAccountMutation,
  useSuggestAccountCode,
  useUpdateAccountMutation,
  type AccountFormPayload,
} from '@/lib/hooks/useChartOfAccounts';
import {
  collectAccountAndDescendantIds,
  type CoaHierarchyAccount,
} from '@/lib/accounting/mapCoaToTreeNodes';
import {
  GL_ACCOUNT_TYPE_OPTIONS,
  applyAccountTypeDefaults,
  normalizeGlAccountType,
  statementTypeFromAccountType,
} from '@/lib/accounting/account-classification';
import { bumpTrailingCode, isCodeAfter } from '@/lib/masters/nextNumericSerial';

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
  accountKind: 'HEADER',
  statementType: 'BALANCE_SHEET',
};

export function AccountFormModal({
  open,
  mode,
  initial,
  parentAccount,
  createKind = 'HEADER',
  lockAsRoot = false,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  mode: AccountFormModalMode;
  initial?: CoaHierarchyAccount | null;
  parentAccount?: CoaHierarchyAccount | null;
  createKind?: 'HEADER' | 'POSTING';
  lockAsRoot?: boolean;
  onClose: () => void;
  onSaved: (accountId?: string) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState<AccountFormPayload>(emptyForm);
  const [parentTouched, setParentTouched] = useState(false);
  const initialParentId = parentAccount?.id ?? initial?.parentId ?? null;
  const parentIdForSuggest = parentTouched
    ? form.parentId ?? null
    : mode === 'create'
      ? parentAccount?.id ?? null
      : form.parentId ?? parentAccount?.id ?? null;
  const parentChanged =
    mode === 'edit' && parentTouched && (form.parentId ?? null) !== initialParentId;

  const { data: settingsRes } = useAccountingSettingsQuery();
  const autoNumbering = settingsRes?.data?.general?.coaAutoNumbering !== false;
  const { data: suggestRes, refetch: refetchSuggest } = useSuggestAccountCode(
    parentIdForSuggest,
    open && autoNumbering && (mode === 'create' || parentChanged)
  );
  const createMut = useCreateAccountMutation();
  const updateMut = useUpdateAccountMutation();
  const pending = createMut.isPending || updateMut.isPending;

  useEffect(() => {
    if (!open) {
      setParentTouched(false);
      return;
    }
    if (mode === 'edit' && initial) {
      setForm({
        code: initial.code,
        arabicName: initial.arabicName ?? initial.nameAr ?? '',
        englishName: initial.englishName ?? initial.nameEn ?? '',
        accountType: normalizeGlAccountType(initial.accountType),
        parentId: parentAccount?.id ?? initial.parentId ?? null,
        accountSide: initial.nature === 'DEBIT' ? 'مدين' : initial.nature === 'CREDIT' ? 'دائن' : null,
        costCenterRequired: (initial.costCenterRequired as AccountFormPayload['costCenterRequired']) || 'بدون',
        defaultCostCenterId: initial.defaultCostCenterId ?? null,
        warning: (initial as { warning?: AccountFormPayload['warning'] }).warning || 'بدون',
        budget: (initial as { budget?: number | null }).budget ?? null,
        accountKind: initial.accountKind === 'POSTING' ? 'POSTING' : 'HEADER',
        statementType: statementTypeFromAccountType(initial.accountType) ?? 'BALANCE_SHEET',
      });
    } else {
      const inheritedSide =
        parentAccount?.nature === 'CREDIT' ? 'دائن' : parentAccount?.nature === 'DEBIT' ? 'مدين' : null;
      setForm({
        ...emptyForm,
        parentId: lockAsRoot ? null : parentAccount?.id ?? null,
        accountType: normalizeGlAccountType(parentAccount?.accountType),
        accountSide: inheritedSide,
        accountKind: parentAccount && !lockAsRoot ? createKind : 'HEADER',
        statementType: statementTypeFromAccountType(parentAccount?.accountType) ?? 'BALANCE_SHEET',
        code: '',
      });
      if (autoNumbering) void refetchSuggest();
    }
  }, [open, mode, initial?.id, parentAccount?.id, createKind, lockAsRoot, autoNumbering, refetchSuggest]);

  useEffect(() => {
    if (!open || !autoNumbering) return;
    const code = suggestRes?.data?.code;
    if (!code) return;
    if (mode === 'create') {
      setForm((f) => {
        if (f.code && isCodeAfter(f.code, code)) return f;
        return f.code === code ? f : { ...f, code };
      });
      return;
    }
    if (parentChanged) {
      setForm((f) => ({ ...f, code }));
    }
  }, [suggestRes?.data?.code, open, mode, autoNumbering, parentChanged]);

  const handleParentChange = (nextId: string) => {
    setParentTouched(true);
    const next = nextId || null;
    setForm((f) => ({
      ...f,
      parentId: next,
      ...(mode === 'edit' && next === initialParentId && initial ? { code: initial.code } : {}),
    }));
  };

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
    if (!form.parentId && !form.accountSide) {
      onError('جهة الحساب مطلوبة للحساب الرئيسي (مدين أو دائن)');
      return;
    }
    try {
      const payload: AccountFormPayload = {
        ...form,
        englishName: form.englishName || undefined,
        accountType: form.accountType || undefined,
        parentId: lockAsRoot ? null : form.parentId || null,
        accountSide: form.accountSide || undefined,
        statementType: form.statementType ?? statementTypeFromAccountType(form.accountType),
        accountKind: lockAsRoot || !form.parentId ? 'HEADER' : form.accountKind,
      };
      if (mode === 'edit' && initial) {
        await updateMut.mutateAsync({ id: initial.id, ...payload });
        onSaved(initial.id);
        onClose();
        return;
      }
      const created = await createMut.mutateAsync(payload);
      const createdId =
        (created as { data?: { id?: string }; id?: string })?.data?.id ??
        (created as { id?: string })?.id;
      onSaved(createdId);
      setForm({
        ...emptyForm,
        parentId: payload.parentId ?? null,
        accountType: payload.accountType ?? '',
        accountSide: payload.accountSide ?? null,
        accountKind: payload.accountKind ?? createKind,
        statementType: payload.statementType ?? 'BALANCE_SHEET',
        code: '',
      });
      if (autoNumbering) {
        const next = await refetchSuggest();
        const suggested = next.data?.data?.code;
        if (suggested) {
          setForm((f) =>
            f.code === suggested || isCodeAfter(f.code, suggested) ? f : { ...f, code: suggested }
          );
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : 'فشل حفظ الحساب');
    }
  };

  const parentLabel = parentAccount
    ? `${parentAccount.code} — ${parentAccount.arabicName ?? parentAccount.nameAr}`
    : 'حساب رئيسي (بدون أب)';
  const parentCaption = !form.parentId
    ? 'حساب رئيسي (بدون أب)'
    : parentTouched && form.parentId !== initialParentId
      ? 'أب جديد — رقم الحساب سيتحدّث'
      : parentLabel;
  const blockedParentIds = mode === 'edit' ? collectAccountAndDescendantIds(initial) : [];

  const advancedFilledCount = [
    form.englishName,
    form.defaultCostCenterId,
    form.costCenterRequired && form.costCenterRequired !== 'بدون' ? form.costCenterRequired : '',
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <CenteredOverlay open={open} onClose={onClose} width="lg" labelledBy="account-form-title">
      <div className="erp-field-wide flex min-h-0 w-full min-w-0 flex-1 flex-col" dir="rtl">
        <div className="min-w-0 flex-1 overflow-y-auto p-6 pb-2">
          <h2 id="account-form-title" className="mb-1 text-xl font-bold text-[#0E79AA]">
            {mode === 'create'
              ? lockAsRoot || !parentAccount
                ? 'إضافة حساب رئيسي'
                : 'إضافة حساب فرعي'
              : 'تعديل حساب'}
          </h2>
          <p className="mb-1 text-sm text-slate-500">
            {lockAsRoot
              ? 'حساب رئيسي بدون أب — مجموعة في أعلى الشجرة، مش حساب حركة.'
              : `الحساب الأب: ${parentCaption} · ${
                  form.accountKind === 'POSTING'
                    ? 'حساب حركة'
                    : form.parentId || parentAccount
                      ? 'رئيسي فرعي'
                      : 'رئيسي بدون أب'
                }`}
          </p>
          {mode === 'create' ? (
            <p className="mb-4 text-xs text-[#0E79AA]">بعد الحفظ النموذج يفضل مفتوح عشان تضيف التالي تحت نفس الأب. إغلاق من إلغاء.</p>
          ) : (
            <div className="mb-3" />
          )}

          <FormSectionCard
            title="البيانات الأساسية"
            subtitle="الحقول اللازمة لتعريف الحساب"
            icon={Landmark}
            className="mb-3"
            bodyClassName="!grid-cols-2"
          >
            <CompactFormField
              label={autoNumbering ? 'رقم الحساب' : 'رقم الحساب'}
              required={!autoNumbering}
              value={form.code}
              readOnly={autoNumbering}
              disabled={autoNumbering}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              hint={autoNumbering ? 'تلقائي' : 'أدخله بنفسك — مفيش رقم مقترح'}
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
            {lockAsRoot ? (
              <CompactFormField label="الحساب الأب">
                <input className={compactControlClass} value="حساب رئيسي — بدون أب" readOnly />
              </CompactFormField>
            ) : (
            <CompactFormField
              label="الحساب الأب"
              hint={
                parentChanged
                  ? 'تغيير الأب يغيّر رقم هذا الحساب وكل فروعه. القيود تبقى على نفس الحساب وتظهر بالرقم الجديد.'
                  : 'اختَر أي حساب رئيسي أو رئيسي فرعي. حساب الحركة لا يُفرَّع منه.'
              }
            >
              <AccountSelect
                value={form.parentId || ''}
                onChange={handleParentChange}
                headerOnly
                leafOnly={false}
                allowEmpty
                emptyLabel="حساب رئيسي (بدون أب)"
                placeholder="اختر الحساب الأب"
                excludeIds={blockedParentIds}
                enableQuickCreate={false}
                selectedAccount={
                  parentAccount && form.parentId === parentAccount.id
                    ? {
                        id: parentAccount.id,
                        code: parentAccount.code,
                        arabicName: parentAccount.arabicName ?? parentAccount.nameAr ?? '',
                      }
                    : null
                }
              />
            </CompactFormField>
            )}
            <CompactFormField label="جهة الحساب" required={!form.parentId}>
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
                <option value="">{form.parentId ? 'تورث من الحساب الأب' : 'اختر جهة الحساب'}</option>
                <option value="مدين">مدين</option>
                <option value="دائن">دائن</option>
              </select>
            </CompactFormField>
            <CompactFormField label="تصنيف GL">
              <select
                className={compactControlClass}
                value={form.accountType ?? ''}
                onChange={(e) => {
                  const next = applyAccountTypeDefaults(e.target.value, {
                    statementType: form.statementType,
                    accountSide: form.accountSide,
                  });
                  setForm((f) => ({
                    ...f,
                    accountType: next.accountType,
                    statementType: next.statementType,
                    accountSide: next.accountSide || f.accountSide,
                    accountNature: next.accountNature,
                  }));
                }}
              >
                <option value="">—</option>
                {GL_ACCOUNT_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </CompactFormField>
          </FormSectionCard>

          <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
            <div className="grid grid-cols-2 gap-3">
              <CompactFormField
                label="الاسم الإنجليزي"
                value={form.englishName ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, englishName: e.target.value }))}
              />
              <CompactFormField label="إلزام مركز التكلفة">
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
              <CompactFormField label="مركز التكلفة (اختياري)" className="sm:col-span-2 erp-field-wide">
                <CostCenterSelect
                  value={form.defaultCostCenterId || ''}
                  onChange={(id) => setForm((f) => ({ ...f, defaultCostCenterId: id || null }))}
                  emptyLabel="غير مربوط"
                />
              </CompactFormField>
            </div>
          </AdvancedFieldsSection>
        </div>

        <FormStickyFooter
          onCancel={onClose}
          onSave={() => void submit()}
          saveLoading={pending}
          cancelText="إلغاء"
          saveText={mode === 'create' ? 'حفظ وإضافة آخر' : 'حفظ'}
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </CenteredOverlay>
  );
}
