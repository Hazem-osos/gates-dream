"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import UserPermissionsBar from "@/components/UserPermissionsBar";
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
  AppTable,
} from "@/components/ui";
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import { useApiQuery, useInvalidateQuery } from "@/lib/hooks/useApi";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import { accountCardFormSchema } from '@/lib/validation/accounting.schema';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import {
  useCreateAccountMutation,
  useSuggestAccountCode,
  useUpdateAccountMutation,
} from '@/lib/hooks/useChartOfAccounts';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';
import {
  GL_ACCOUNT_TYPE_OPTIONS,
  applyAccountTypeDefaults,
  normalizeGlAccountType,
  statementTypeFromAccountType,
} from '@/lib/accounting/account-classification';
import { isCodeAfter } from '@/lib/masters/nextNumericSerial';

const EMPTY_ACCOUNT_FORM = {
  code: '',
  accountType: '',
  arabicName: '',
  englishName: '',
  parentId: '',
  accountSide: '' as 'مدين' | 'دائن' | '',
  accountNature: 'DEBIT' as 'DEBIT' | 'CREDIT',
  statementType: 'BALANCE_SHEET' as 'BALANCE_SHEET' | 'INCOME_STATEMENT',
  costCenterRequired: 'اختياري' as 'إجباري' | 'اختياري' | 'بدون' | '',
  defaultCostCenterId: '',
  requiresCostCenter: false,
  warning: 'بدون' as 'مدين' | 'دائن' | 'بدون' | '',
  budget: '',
  currencyCode: '',
  accountKind: 'HEADER' as 'HEADER' | 'POSTING',
};

interface Account {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string | null;
  accountSide?: 'مدين' | 'دائن' | null;
  accountNature?: 'DEBIT' | 'CREDIT' | null;
  accountType?: string | null;
  parentId?: string | null;
  statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | null;
  costCenterRequired?: string | null;
  requiresCostCenter?: boolean | null;
  defaultCostCenterId?: string | null;
  warning?: string | null;
  budget?: number | string | null;
  currencyCode?: string | null;
  accountKind?: 'HEADER' | 'POSTING' | null;
}

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

function collectAccountFamilyIds(accounts: Account[], rootId: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    for (const row of accounts) {
      if (row.parentId === id && row.id !== id) stack.push(row.id);
    }
  }
  return ids;
}

function mapAccountToForm(account: Account): typeof EMPTY_ACCOUNT_FORM {
  const side =
    account.accountSide ||
    (account.accountNature === 'CREDIT' ? 'دائن' : account.accountNature === 'DEBIT' ? 'مدين' : '');
  const accountType = normalizeGlAccountType(account.accountType);
  return {
    code: account.code ?? '',
    accountType,
    arabicName: account.arabicName ?? '',
    englishName: account.englishName ?? '',
    parentId: account.parentId ?? '',
    accountSide: side,
    accountNature: side === 'دائن' ? 'CREDIT' : 'DEBIT',
    statementType:
      account.statementType ??
      statementTypeFromAccountType(accountType) ??
      'BALANCE_SHEET',
    costCenterRequired: (account.costCenterRequired as typeof EMPTY_ACCOUNT_FORM.costCenterRequired) || 'اختياري',
    defaultCostCenterId: account.defaultCostCenterId ?? '',
    requiresCostCenter: Boolean(account.requiresCostCenter || account.costCenterRequired === 'إجباري'),
    warning: (account.warning as typeof EMPTY_ACCOUNT_FORM.warning) || 'بدون',
    budget: account.budget != null ? String(account.budget) : '',
    currencyCode: account.currencyCode ?? '',
    accountKind: account.parentId ? (account.accountKind === 'HEADER' ? 'HEADER' : 'POSTING') : 'HEADER',
  };
}

function InputDesign() {
  const invalidateQuery = useInvalidateQuery();
  const quickCreate = useQuickCreateHost('account');

  const [formData, setFormData] = useState({ ...EMPTY_ACCOUNT_FORM });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedParentId, setLoadedParentId] = useState('');
  const [loadedCode, setLoadedCode] = useState('');
  const { data: settingsRes } = useAccountingSettingsQuery();
  const autoNumbering = settingsRes?.data?.general?.coaAutoNumbering !== false;
  const accountRecordCount = settingsRes?.data?.general?.numberingRecordCounts?.accounts ?? 0;
  const parentChanged = Boolean(selectedId) && formData.parentId !== loadedParentId;
  const { data: suggestRes } = useSuggestAccountCode(
    formData.parentId || null,
    autoNumbering && (!selectedId || parentChanged)
  );
  const createMut = useCreateAccountMutation();
  const updateMut = useUpdateAccountMutation();

  useEffect(() => {
    if (!autoNumbering) return;
    const suggested = suggestRes?.data?.code;
    if (!suggested) return;
    if (!selectedId) {
      setFormData((prev) => {
        if (prev.code && isCodeAfter(prev.code, suggested)) return prev;
        return prev.code === suggested ? prev : { ...prev, code: suggested };
      });
      return;
    }
    if (parentChanged) {
      setFormData((prev) => (prev.code === suggested ? prev : { ...prev, code: suggested }));
    }
  }, [autoNumbering, suggestRes?.data?.code, selectedId, parentChanged]);

  useEffect(() => {
    if (!quickCreate.prefillName) return;
    setFormData((prev) => (prev.arabicName ? prev : { ...prev, arabicName: quickCreate.prefillName }));
  }, [quickCreate.prefillName]);

  useEffect(() => {
    if (!quickCreate.isQuickCreate) return;
    setFormData((prev) => ({
      ...prev,
      accountKind: prev.parentId ? 'POSTING' : prev.accountKind,
    }));
  }, [quickCreate.isQuickCreate]);

  const { data: accountsResponse } = useApiQuery<Account[]>(
    ['accounts', 'headers'],
    '/accounting/accounts',
    { limit: 1000, isActive: true, headerOnly: true }
  );
  const { data: browseAccountsResponse } = useApiQuery<Account[]>(
    ['accounts'],
    '/accounting/accounts',
    { limit: 1000, isActive: true }
  );
  const headerAccounts = accountsResponse?.data || [];
  const accounts = browseAccountsResponse?.data || [];
  const blockedParentIds = React.useMemo(
    () => (selectedId ? new Set(collectAccountFamilyIds(accounts, selectedId)) : new Set<string>()),
    [accounts, selectedId]
  );

  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data || [];

  const pending = createMut.isPending || updateMut.isPending;

  const handleSave = async () => {
    const parsed = accountCardFormSchema.safeParse(formData);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'يرجى مراجعة بيانات الحساب');
      return;
    }
    if (!autoNumbering && !formData.code.trim()) {
      setError('رقم الحساب مطلوب — الترقيم يدوي');
      return;
    }
    if (quickCreate.isQuickCreate && !formData.parentId) {
      setError('اختَر الحساب الرئيسي. الإضافة السريعة من السند بتنشئ حساب حركة يظهر في سند الصرف.');
      return;
    }

    const payload = {
      code: formData.code || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      accountType: formData.accountType || undefined,
      parentId: formData.parentId || null,
      ...(formData.accountSide
        ? {
            accountSide: formData.accountSide,
            accountNature: formData.accountNature,
          }
        : {}),
      statementType: formData.statementType || statementTypeFromAccountType(formData.accountType),
      costCenterRequired:
        formData.costCenterRequired || (formData.requiresCostCenter ? 'إجباري' : 'اختياري'),
      defaultCostCenterId: formData.defaultCostCenterId || null,
      accountKind: quickCreate.isQuickCreate
        ? 'POSTING'
        : formData.parentId
          ? formData.accountKind
          : 'HEADER',
      requiresCostCenter: formData.costCenterRequired === 'إجباري',
      warning: formData.warning || undefined,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
      currencyCode: formData.currencyCode || undefined,
    };

    try {
      if (selectedId) {
        await updateMut.mutateAsync({ id: selectedId, ...payload });
        setSuccess('تم تحديث الحساب بنجاح — تقدر تضيف التالي');
        setSelectedId(null);
        setLoadedParentId('');
        setLoadedCode('');
        setFormData({
          ...EMPTY_ACCOUNT_FORM,
          parentId: formData.parentId,
          accountType: formData.accountType,
          accountSide: formData.accountSide,
          accountNature: formData.accountNature,
          statementType: formData.statementType,
          accountKind: formData.accountKind,
        });
      } else {
        const res = await createMut.mutateAsync(payload);
        const created = res?.data as { id?: string; arabicName?: string; code?: string } | undefined;
        if (created?.id) {
          quickCreate.complete({
            id: created.id,
            label: entityLabel(created.code, created.arabicName),
            arabicName: created.arabicName,
            code: created.code,
          });
        }
        setSuccess('تم حفظ الحساب بنجاح — تقدر تضيف التالي');
        setFormData({
          ...EMPTY_ACCOUNT_FORM,
          parentId: formData.parentId,
          accountType: formData.accountType,
          accountSide: formData.accountSide,
          accountNature: formData.accountNature,
          statementType: formData.statementType,
          accountKind: formData.accountKind,
        });
      }
      invalidateQuery(['accounts']);
      invalidateQuery(['accounts', 'headers']);
      invalidateQuery(['coa-tree']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleCancel = () => {
    setSelectedId(null);
    setLoadedParentId('');
    setLoadedCode('');
    setFormData({ ...EMPTY_ACCOUNT_FORM });
    setError('');
  };

  const advancedFilledCount = [
    formData.englishName,
    formData.costCenterRequired === 'إجباري' ? formData.costCenterRequired : '',
    formData.currencyCode,
    formData.warning && formData.warning !== 'بدون' ? formData.warning : '',
    formData.budget,
    formData.statementType !== 'BALANCE_SHEET' ? '1' : '',
    formData.defaultCostCenterId,
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <MasterCardShell
      title="بطاقة حساب"
      breadcrumbs={[
        { label: 'الحسابات', href: '/accounting' },
        { label: 'البطاقات' },
        { label: 'حساب' },
      ]}
      docNumber={formData.code || (selectedId ? 'تعديل' : 'جديد')}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={pending}
      canSave={!pending}
      onNew={handleCancel}
      currentId={selectedId}
      onBrowseList={() => setShowGuide(true)}
      extraActions={
        <NumberingModeControl
          kind="accounts"
          auto={autoNumbering}
          recordCount={accountRecordCount}
          settingKey="coaAutoNumbering"
        />
      }
      favoriteHref="/accounting/cards/account"
    >
      <div className="mb-4">
        <UserPermissionsBar resource="account" module="accounting" />
      </div>
      <form className="w-full text-base">
        {quickCreate.isQuickCreate ? (
          <p className="mb-3 rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-sm text-[#0A3D5E]">
            الإضافة السريعة من السند بتنشئ <b>حساب حركة</b> تحت حساب رئيسي، عشان يظهر فورًا في سند الصرف.
          </p>
        ) : null}
        <FormSectionCard
          title="البيانات الأساسية"
          subtitle="الحقول اللازمة لتعريف الحساب"
          icon={Landmark}
        >
          <CompactFormField
            label="رقم الحساب"
            required={!autoNumbering}
            value={formData.code}
            readOnly={autoNumbering}
            disabled={autoNumbering}
            onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
            placeholder={autoNumbering ? 'تلقائي' : 'أدخل الرقم بنفسك'}
          />
          <CompactFormField
            label="الإسم العربي"
            required
            value={formData.arabicName}
            onChange={(e) => setFormData((prev) => ({ ...prev, arabicName: e.target.value }))}
            placeholder="إدخل الإسم بالعربي"
          />
          <CompactFormField
            label="الحساب الرئيسي"
            hint={
              parentChanged
                ? 'تغيير الأب يغيّر رقم هذا الحساب وكل فروعه. القيود تبقى على نفس الحساب وتظهر بالرقم الجديد.'
                : 'اختَر أي حساب رئيسي أو رئيسي فرعي. حساب الحركة لا يُفرَّع منه.'
            }
          >
            <select
              className={compactControlClass}
              value={formData.parentId}
              onChange={(e) => {
                const parentId = e.target.value;
                const parent = headerAccounts.find((account) => account.id === parentId);
                const inheritedSide =
                  parent?.accountSide ||
                  (parent?.accountNature === 'CREDIT' ? 'دائن' : parent?.accountNature === 'DEBIT' ? 'مدين' : '');
                const inheritedType = normalizeGlAccountType(parent?.accountType);
                setFormData((prev) => {
                  const nextSide = prev.accountSide || inheritedSide;
                  const typed = inheritedType
                    ? applyAccountTypeDefaults(inheritedType, {
                        statementType: prev.statementType,
                        accountSide: nextSide,
                      })
                    : null;
                  return {
                    ...prev,
                    parentId,
                    code: selectedId && parentId === loadedParentId ? loadedCode : prev.code,
                    accountKind: parentId ? (prev.parentId ? prev.accountKind : 'POSTING') : 'HEADER',
                    accountSide: nextSide,
                    accountNature: nextSide === 'دائن' ? 'CREDIT' : 'DEBIT',
                    accountType: prev.accountType || typed?.accountType || '',
                    statementType: prev.accountType
                      ? prev.statementType
                      : typed?.statementType ?? prev.statementType,
                  };
                });
              }}
            >
              <option value="">حساب رئيسي (بدون أب)</option>
              {headerAccounts
                .filter((account) => !blockedParentIds.has(account.id))
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.arabicName}
                  </option>
                ))}
            </select>
          </CompactFormField>
          {formData.parentId && !quickCreate.isQuickCreate ? (
            <CompactFormField label="نوع الحساب الفرعي" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'POSTING' as const, label: 'حساب حركة' },
                  { value: 'HEADER' as const, label: 'رئيسي فرعي' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`${
                      formData.accountKind === opt.value
                        ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                        : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                    } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                  >
                    <input
                      type="radio"
                      name="accountKind"
                      className="sr-only"
                      checked={formData.accountKind === opt.value}
                      onChange={() => setFormData((prev) => ({ ...prev, accountKind: opt.value }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </CompactFormField>
          ) : (
            <CompactFormField label="نوع الحساب">
              <input
                className={compactControlClass}
                value={
                  quickCreate.isQuickCreate || formData.parentId
                    ? 'حساب حركة'
                    : 'رئيسي بدون أب'
                }
                readOnly
              />
            </CompactFormField>
          )}
          <CompactFormField label="تصنيف GL">
            <select
              className={compactControlClass}
              value={formData.accountType}
              onChange={(e) => {
                const next = applyAccountTypeDefaults(e.target.value, {
                  statementType: formData.statementType,
                  accountSide: formData.accountSide,
                });
                setFormData((prev) => ({
                  ...prev,
                  accountType: next.accountType,
                  statementType: next.statementType,
                  accountSide: next.accountSide || prev.accountSide,
                  accountNature: next.accountNature,
                }));
              }}
            >
              <option value="">اختر التصنيف</option>
              {GL_ACCOUNT_TYPE_OPTIONS.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField label="جهة الحساب" required={!formData.parentId} className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'مدين', label: 'مدين' },
                { value: 'دائن', label: 'دائن' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`${
                    formData.accountSide === opt.value
                      ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                      : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                  } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                >
                  <input
                    type="radio"
                    name="accountSide"
                    value={opt.value}
                    checked={formData.accountSide === opt.value}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        accountSide: e.target.value as 'مدين' | 'دائن',
                        accountNature: e.target.value === 'دائن' ? 'CREDIT' : 'DEBIT',
                      }))
                    }
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </CompactFormField>
        </FormSectionCard>

        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="الإسم الإنجليزي"
              value={formData.englishName}
              onChange={(e) => setFormData((prev) => ({ ...prev, englishName: e.target.value }))}
              placeholder="إدخل الإسم بالإنجليزي"
            />
            <CompactFormField label="التقرير الختامي">
              <select
                className={compactControlClass}
                value={formData.statementType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    statementType: e.target.value as 'BALANCE_SHEET' | 'INCOME_STATEMENT',
                  }))
                }
              >
                <option value="BALANCE_SHEET">ميزانية عمومية</option>
                <option value="INCOME_STATEMENT">أرباح وخسائر وقائمة دخل</option>
              </select>
            </CompactFormField>
            <CompactFormField label="إلزام مركز التكلفة">
              <select
                className={compactControlClass}
                value={formData.costCenterRequired || 'اختياري'}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    costCenterRequired: e.target.value as 'إجباري' | 'اختياري' | 'بدون',
                    requiresCostCenter: e.target.value === 'إجباري',
                  }))
                }
              >
                <option value="بدون">بدون</option>
                <option value="اختياري">اختياري</option>
                <option value="إجباري">إجباري</option>
              </select>
            </CompactFormField>
            <CompactFormField label="مركز التكلفة (اختياري)" className="sm:col-span-2">
              <CostCenterSelect
                value={formData.defaultCostCenterId}
                onChange={(id) => setFormData((prev) => ({ ...prev, defaultCostCenterId: id }))}
                emptyLabel="غير مربوط"
              />
            </CompactFormField>
            <CompactFormField label="جهة التحذير">
              <select
                className={compactControlClass}
                value={formData.warning || 'بدون'}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    warning: e.target.value as 'مدين' | 'دائن' | 'بدون',
                  }))
                }
              >
                <option value="بدون">بدون</option>
                <option value="مدين">مدين</option>
                <option value="دائن">دائن</option>
              </select>
            </CompactFormField>
            <CompactFormField label="رمز العملة">
              <select
                className={compactControlClass}
                value={formData.currencyCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, currencyCode: e.target.value }))}
              >
                <option value="">اختر العملة</option>
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.code}>
                    {currency.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField
              label="موازنة تقديرية"
              type="number"
              step="0.01"
              min="0"
              value={formData.budget}
              onChange={(e) => setFormData((prev) => ({ ...prev, budget: e.target.value }))}
              placeholder="إدخل الموازنة التقديرية"
            />
          </div>
        </AdvancedFieldsSection>
      </form>

      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="الحسابات السابقة">
        <AppTable<Account>
          data={accounts}
          getRowKey={(r) => r.id}
          emptyTitle="لا توجد حسابات بعد"
          onRowClick={(account) => {
            setSelectedId(account.id);
            setLoadedParentId(account.parentId ?? '');
            setLoadedCode(account.code ?? '');
            setFormData(mapAccountToForm(account));
            setShowGuide(false);
            setError('');
          }}
          columns={[
            { id: 'code', header: 'الكود', accessor: 'code' },
            { id: 'name', header: 'الاسم', accessor: 'arabicName' },
            { id: 'side', header: 'الجهة', cell: (r) => r.accountSide || '—' },
            {
              id: 'kind',
              header: 'النوع',
              cell: (r) => (r.accountKind === 'HEADER' || !r.parentId ? 'رئيسي' : 'حركة'),
            },
          ]}
        />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}

export default InputDesign;
