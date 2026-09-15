'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActionButtons,
  AdvancedFieldsSection,
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError, ApiResponse } from '@/lib/api/types';
import type { PartyOption } from '@/lib/hooks/useMasterDataQueries';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { toast } from '@/lib/feedback/toast';

type CustomerQuickAddModalProps = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (party: PartyOption) => void;
};

type PriceTier = 'RETAIL' | 'SEMI_WHOLESALE' | 'WHOLESALE' | 'PROJECTS';

const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  RETAIL: 'تجزئة',
  SEMI_WHOLESALE: 'نصف جملة',
  WHOLESALE: 'جملة',
  PROJECTS: 'مشاريع',
};

function prependCustomerListCache(queryClient: ReturnType<typeof useQueryClient>, row: PartyOption) {
  queryClient.setQueriesData<ApiResponse<PartyOption[]>>({ queryKey: ['customers'] }, (old) => {
    if (!old?.data) return old;
    if (old.data.some((p) => p.id === row.id)) return old;
    return { ...old, data: [row, ...old.data] };
  });
}

type FormState = {
  arabicName: string;
  englishName: string;
  customerType: 'company' | 'individual';
  how: 'local' | 'export' | 'exempt';
  mobile: string;
  taxAuthority: string;
  mainAccountId: string;
  creditLimit: string;
  paymentTermsDays: string;
  priceTier: PriceTier | '';
  currencyCode: string;
  country: string;
  city: string;
  area: string;
  street: string;
  postalCode: string;
};

function emptyForm(initialName: string): FormState {
  return {
    arabicName: initialName,
    englishName: '',
    customerType: 'company',
    how: 'local',
    mobile: '',
    taxAuthority: '',
    mainAccountId: '',
    creditLimit: '',
    paymentTermsDays: '',
    priceTier: '',
    currencyCode: '',
    country: '',
    city: '',
    area: '',
    street: '',
    postalCode: '',
  };
}

/**
 * Enterprise-depth customer quick-add for the sales-invoice screen (Sales
 * Invoice Enterprise Redesign, Phase 6). Needs zero backend schema changes —
 * every field below already exists on `Customer` and is already accepted by
 * `createCustomer` — this is a pure frontend expansion of the simpler
 * `QuickCreatePartyModal` used elsewhere (reports, treasury vouchers, which
 * intentionally keep the lighter flow).
 */
export function CustomerQuickAddModal({ open, initialName, onClose, onCreated }: CustomerQuickAddModalProps) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateQuery();
  const [form, setForm] = useState<FormState>(() => emptyForm(initialName));
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(emptyForm(initialName));
      setError('');
    }
  }, [open, initialName]);

  const { data: currenciesResponse } = useApiQuery<{ code: string; arabicName: string }[]>(
    ['currencies'],
    '/accounting/currencies',
    undefined,
    { enabled: open }
  );
  const currencies = currenciesResponse?.data ?? [];

  const mutation = useApiMutation<PartyOption, Record<string, unknown>>('/accounting/customers', 'POST', {
    showSuccessToast: true,
    successMessage: 'تم إنشاء العميل',
    onSuccess: (res) => {
      const row = res.data;
      if (row?.id) {
        const partyRow: PartyOption = {
          id: row.id,
          arabicName: row.arabicName ?? form.arabicName.trim(),
          code: row.code ?? null,
        };
        prependCustomerListCache(queryClient, partyRow);
        invalidate(['customers']);
        invalidate(['accounts']);
        invalidate(['chart-of-accounts']);
        onCreated(partyRow);
        onClose();
      }
    },
    onError: (err: ApiError) => {
      const msg = err.message || 'تعذر الحفظ';
      setError(msg);
      toast.error('تعذر إنشاء العميل', { description: msg });
    },
  });

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    setError('');
    if (!form.arabicName.trim()) {
      const msg = 'اسم العميل مطلوب';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!form.mobile.trim()) {
      const msg = 'رقم الموبايل مطلوب';
      setError(msg);
      toast.error(msg);
      return;
    }
    const body: Record<string, unknown> = {
      arabicName: form.arabicName.trim(),
      englishName: form.englishName.trim() || undefined,
      customerType: form.customerType,
      how: form.how,
      mobile: form.mobile.trim() || undefined,
      taxAuthority: form.taxAuthority.trim() || undefined,
      taxData: Boolean(form.taxAuthority.trim()),
      mainAccountId: form.mainAccountId || undefined,
      priceTier: form.priceTier || undefined,
      currencyCode: form.currencyCode || undefined,
      country: form.country.trim() || undefined,
      city: form.city.trim() || undefined,
      area: form.area.trim() || undefined,
      street: form.street.trim() || undefined,
      postalCode: form.postalCode.trim() || undefined,
    };
    if (form.creditLimit.trim()) {
      const n = Number(form.creditLimit);
      if (Number.isFinite(n) && n >= 0) body.creditLimit = n;
    }
    if (form.paymentTermsDays.trim()) {
      const n = Number(form.paymentTermsDays);
      if (Number.isFinite(n) && n >= 0) body.paymentTermsDays = Math.round(n);
    }
    mutation.mutate(body);
  };

  const addressFilledCount = [form.country, form.city, form.area, form.street, form.postalCode].filter((v) =>
    v.trim()
  ).length;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      style={{ direction: 'rtl' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-quickadd-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E6F0F7] bg-white p-5 shadow-2xl">
        <h2 id="customer-quickadd-title" className="mb-4 text-lg font-bold text-[#0A3D5E]">
          إضافة عميل جديد
        </h2>

        <FormSectionCard title="البيانات الأساسية" bodyClassName="lg:grid-cols-2">
          <CompactFormField
            label="الاسم بالعربية"
            required
            value={form.arabicName}
            onChange={(e) => set('arabicName', e.target.value)}
            autoFocus
          />
          <CompactFormField
            label="الاسم بالإنجليزية"
            value={form.englishName}
            onChange={(e) => set('englishName', e.target.value)}
          />
          <CompactFormField label="نوع العميل">
            <select
              className={compactControlClass}
              value={form.customerType}
              onChange={(e) => set('customerType', e.target.value as FormState['customerType'])}
            >
              <option value="company">شركة</option>
              <option value="individual">فرد</option>
            </select>
          </CompactFormField>
          <CompactFormField label="طبيعة التعامل">
            <select
              className={compactControlClass}
              value={form.how}
              onChange={(e) => set('how', e.target.value as FormState['how'])}
            >
              <option value="local">محلي</option>
              <option value="export">تصدير</option>
              <option value="exempt">معفى</option>
            </select>
          </CompactFormField>
          <CompactFormField
            label="الموبايل"
            required
            value={form.mobile}
            onChange={(e) => set('mobile', e.target.value)}
          />
          <CompactFormField
            label="الجهة الضريبية"
            value={form.taxAuthority}
            onChange={(e) => set('taxAuthority', e.target.value)}
          />
        </FormSectionCard>

        <FormSectionCard title="المحاسبة والحدود الائتمانية" bodyClassName="lg:grid-cols-2">
          <CompactFormField
            label="الحساب المحاسبي (اختياري)"
            hint="اتركه فارغاً ليُنشأ حساب خاص بهذا العميل تحت حساب العملاء."
            className="sm:col-span-2 lg:col-span-2"
          >
            <AccountSelect
              value={form.mainAccountId}
              onChange={(id) => set('mainAccountId', id)}
              className={compactControlClass}
              placeholder="إنشاء حساب تلقائي للعميل"
            />
          </CompactFormField>
          <CompactFormField
            label="حد الائتمان"
            type="number"
            min={0}
            step="0.01"
            value={form.creditLimit}
            onChange={(e) => set('creditLimit', e.target.value)}
          />
          <CompactFormField
            label="مدة السداد (أيام)"
            type="number"
            min={0}
            step="1"
            value={form.paymentTermsDays}
            onChange={(e) => set('paymentTermsDays', e.target.value)}
          />
          <CompactFormField label="فئة السعر">
            <select
              className={compactControlClass}
              value={form.priceTier}
              onChange={(e) => set('priceTier', e.target.value as FormState['priceTier'])}
            >
              <option value="">— افتراضي —</option>
              {(Object.keys(PRICE_TIER_LABELS) as PriceTier[]).map((tier) => (
                <option key={tier} value={tier}>
                  {PRICE_TIER_LABELS[tier]}
                </option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField label="العملة">
            <select
              className={compactControlClass}
              value={form.currencyCode}
              onChange={(e) => set('currencyCode', e.target.value)}
            >
              <option value="">— افتراضي —</option>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.arabicName} ({c.code})
                </option>
              ))}
            </select>
          </CompactFormField>
        </FormSectionCard>

        <AdvancedFieldsSection title="العنوان والخدمات اللوجستية" badgeCount={addressFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField label="الدولة" value={form.country} onChange={(e) => set('country', e.target.value)} />
            <CompactFormField label="المدينة" value={form.city} onChange={(e) => set('city', e.target.value)} />
            <CompactFormField label="المنطقة" value={form.area} onChange={(e) => set('area', e.target.value)} />
            <CompactFormField label="الشارع" value={form.street} onChange={(e) => set('street', e.target.value)} />
            <CompactFormField
              label="الرمز البريدي"
              value={form.postalCode}
              onChange={(e) => set('postalCode', e.target.value)}
            />
          </div>
        </AdvancedFieldsSection>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="mt-4">
          <ActionButtons
            onCancel={onClose}
            onSave={submit}
            saveText={mutation.isPending ? 'جاري الحفظ…' : 'حفظ'}
            cancelText="إلغاء"
            saveDisabled={mutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
