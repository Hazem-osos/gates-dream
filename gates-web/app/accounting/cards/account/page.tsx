"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import UserPermissionsBar from "@/components/UserPermissionsBar";
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
  Switch,
} from "@/components/ui";
import { useApiQuery, useApiMutation, useInvalidateQuery } from "@/lib/hooks/useApi";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import type { ApiError } from '@/lib/api/types';
import { accountCardFormSchema } from '@/lib/validation/accounting.schema';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { useSuggestAccountCode } from '@/lib/hooks/useChartOfAccounts';

const EMPTY_ACCOUNT_FORM = {
  code: '',
  accountType: '',
  arabicName: '',
  englishName: '',
  parentId: '',
  accountSide: '' as 'مدين' | 'دائن' | '',
  accountNature: 'DEBIT' as 'DEBIT' | 'CREDIT',
  statementType: 'BALANCE_SHEET' as 'BALANCE_SHEET' | 'INCOME_STATEMENT',
  costCenterRequired: '' as 'إجباري' | 'اختياري' | 'بدون' | '',
  defaultCostCenterId: '',
  requiresCostCenter: false,
  warning: '' as 'مدين' | 'دائن' | 'بدون' | '',
  budget: '',
  currencyCode: '',
};

interface Account {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

function InputDesign() {
  const invalidateQuery = useInvalidateQuery();
  
  const [formData, setFormData] = useState({ ...EMPTY_ACCOUNT_FORM });
  const { data: settingsRes } = useAccountingSettingsQuery();
  const autoNumbering = settingsRes?.data?.general?.coaAutoNumbering !== false;
  const { data: suggestRes } = useSuggestAccountCode(formData.parentId || null, true);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const suggested = suggestRes?.data?.code;
    if (!suggested || !autoNumbering) return;
    setFormData((prev) => (prev.code === suggested ? prev : { ...prev, code: suggested }));
  }, [autoNumbering, suggestRes?.data?.code]);

  // Fetch parent accounts
  const { data: accountsResponse } = useApiQuery<Account[]>(
    ['accounts'],
    '/accounting/accounts',
    { limit: 1000, isActive: true }
  );
  const accounts = accountsResponse?.data || [];

  // Fetch currencies
  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data || [];

  // Account mutation
  const accountMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/accounts',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ الحساب بنجاح');
        invalidateQuery(['accounts']);
        // Reset form
        setFormData({ ...EMPTY_ACCOUNT_FORM });
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

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

    try {
      await accountMutation.mutateAsync({
        code: formData.code || undefined,
        arabicName: formData.arabicName,
        englishName: formData.englishName || undefined,
        accountType: formData.accountType || undefined,
        parentId: formData.parentId || undefined,
        accountSide: formData.accountSide || (formData.accountNature === 'CREDIT' ? 'دائن' : 'مدين'),
        accountNature: formData.accountNature,
        statementType: formData.statementType,
        costCenterRequired:
          formData.costCenterRequired || (formData.requiresCostCenter ? 'إجباري' : undefined),
        defaultCostCenterId: formData.defaultCostCenterId || undefined,
        requiresCostCenter: formData.requiresCostCenter,
        warning: formData.warning || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        currencyCode: formData.currencyCode || undefined,
      });
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleCancel = () => {
    setFormData({ ...EMPTY_ACCOUNT_FORM });
    setError('');
  };

  const advancedFilledCount = [
    formData.englishName,
    formData.costCenterRequired,
    formData.currencyCode,
    formData.warning,
    formData.budget,
    formData.accountNature !== 'DEBIT' ? '1' : '',
    formData.statementType !== 'BALANCE_SHEET' ? '1' : '',
    formData.requiresCostCenter ? '1' : '',
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      <PageHeader
        title="بطاقة حساب"
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'البطاقات' },
          { label: 'حساب' },
        ]}
      />

      <div className="mb-4">
        <UserPermissionsBar resource="account" module="accounting" />
      </div>
      <form className="w-full text-base">
        <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف الحساب" icon={Landmark}>
          <CompactFormField
            label={autoNumbering ? 'رقم الحساب (تلقائي)' : 'رقم الحساب'}
            required={!autoNumbering}
            value={formData.code}
            readOnly={autoNumbering}
            disabled={autoNumbering}
            onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
            placeholder={autoNumbering ? 'يُولَّد تلقائياً' : 'إدخل رقم الحساب'}
            hint={autoNumbering ? 'الترقيم تلقائي من إعدادات شجرة الحسابات' : undefined}
          />
          <CompactFormField
            label="الإسم العربي"
            required
            value={formData.arabicName}
            onChange={(e) => setFormData((prev) => ({ ...prev, arabicName: e.target.value }))}
            placeholder="إدخل الإسم بالعربي"
          />
          <CompactFormField label="ج رئيسي">
            <select
              className={compactControlClass}
              value={formData.parentId}
              onChange={(e) => setFormData((prev) => ({ ...prev, parentId: e.target.value }))}
            >
              <option value="">اختر الحساب الرئيسي</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.arabicName}
                </option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField label="نوع الحساب">
            <select
              className={compactControlClass}
              value={formData.accountType}
              onChange={(e) => setFormData((prev) => ({ ...prev, accountType: e.target.value }))}
            >
              <option value="">اختر النوع</option>
              <option value="توفير">توفير</option>
              <option value="جاري">جاري</option>
              <option value="استثمار">استثمار</option>
            </select>
          </CompactFormField>
          <CompactFormField label="مركز التكلفة (اختياري)" className="sm:col-span-2">
            <CostCenterSelect
              value={formData.defaultCostCenterId}
              onChange={(id) => setFormData((prev) => ({ ...prev, defaultCostCenterId: id }))}
              emptyLabel="غير مربوط"
            />
          </CompactFormField>
          <CompactFormField label="جهة الحساب" className="sm:col-span-2">
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
            <CompactFormField label="طبيعة الحساب" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'DEBIT' as const, label: 'مدين افتراضي' },
                  { value: 'CREDIT' as const, label: 'دائن افتراضي' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`${
                      formData.accountNature === opt.value
                        ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                        : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                    } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                  >
                    <input
                      type="radio"
                      name="accountNature"
                      value={opt.value}
                      checked={formData.accountNature === opt.value}
                      onChange={() =>
                        setFormData((prev) => ({
                          ...prev,
                          accountNature: opt.value,
                          accountSide: opt.value === 'CREDIT' ? 'دائن' : 'مدين',
                        }))
                      }
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </CompactFormField>
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
            <CompactFormField label="إلزام مركز التكلفة" className="sm:col-span-2">
              <Switch
                checked={formData.requiresCostCenter}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    requiresCostCenter: checked,
                    costCenterRequired: checked ? 'إجباري' : prev.costCenterRequired === 'إجباري' ? 'اختياري' : prev.costCenterRequired,
                  }))
                }
                label="إلزام تحديد مركز تكلفة عند الترحيل"
              />
            </CompactFormField>
            <CompactFormField
              label="الإسم الإنجليزي"
              value={formData.englishName}
              onChange={(e) => setFormData((prev) => ({ ...prev, englishName: e.target.value }))}
              placeholder="إدخل الإسم بالإنجليزي"
            />
            <CompactFormField label="مركز التكلفة" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'إجباري', label: 'إجباري' },
                  { value: 'اختياري', label: 'اختياري' },
                  { value: 'بدون', label: 'بدون' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`${
                      formData.costCenterRequired === opt.value
                        ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                        : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                    } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                  >
                    <input
                      type="radio"
                      name="costCenter"
                      value={opt.value}
                      checked={formData.costCenterRequired === opt.value}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          costCenterRequired: e.target.value as 'إجباري' | 'اختياري' | 'بدون',
                          requiresCostCenter: e.target.value === 'إجباري',
                        }))
                      }
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </CompactFormField>
            <CompactFormField label="ج/ ختامي">
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
            <CompactFormField label="تحذير" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'مدين', label: 'مدين' },
                  { value: 'دائن', label: 'دائن' },
                  { value: 'بدون', label: 'بدون' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`${
                      formData.warning === opt.value
                        ? 'bg-[#0E78AA] text-white border-[#0E78AA]'
                        : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
                    } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                  >
                    <input
                      type="radio"
                      name="warning"
                      value={opt.value}
                      checked={formData.warning === opt.value}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          warning: e.target.value as 'مدين' | 'دائن' | 'بدون',
                        }))
                      }
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </CompactFormField>
          </div>
        </AdvancedFieldsSection>

        <FormStickyFooter
          onCancel={handleCancel}
          onSave={handleSave}
          saveLoading={accountMutation.isPending}
          status="مسودة"
        />
      </form>

      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
    </div>
  );
}

export default InputDesign;
