'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { ElectronicReceiptSettingsPanel } from '@/components/electronic-invoices/ereceipt/ElectronicReceiptSettingsPanel';
import { CompactFormField, FormSectionCard, FormStickyFooter } from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useDocumentProfiles } from '@/lib/hooks/useDocumentProfiles';
import { buildSalesInvoicePatternOptions } from '@/lib/electronic-invoices/salesPatterns';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { EsignAgentStatusCard } from '@/components/electronic-invoices/EsignAgentStatusCard';
import {
  clearLocalTokenPin,
  readLocalTokenPinStatus,
  saveLocalTokenPin,
} from '@/lib/electronic-invoices/esign-local-sign';

type EinvoiceSettings = {
  username?: string;
  clientId?: string;
  password1?: string;
  password2?: string;
  tokenAPI?: string;
  apiBaseUrl?: string;
  invoiceAPI?: string;
  certThumbPrint?: string;
  enabledSalesProfileIds?: string[];
  password1Set?: boolean;
  password2Set?: boolean;
};

type SettingsForm = {
  username: string;
  password1: string;
  password2: string;
  tokenAPI: string;
  invoiceAPI: string;
  certThumbPrint: string;
};

function formFromSettings(data: EinvoiceSettings): SettingsForm {
  return {
    username: data.username || data.clientId || '',
    password1: '',
    password2: '',
    tokenAPI: data.tokenAPI || data.apiBaseUrl || '',
    invoiceAPI: data.invoiceAPI || '',
    certThumbPrint: data.certThumbPrint || '',
  };
}

type SettingsTab = 'einvoice' | 'ereceipt';

export default function ElectronicInvoicingSettingsPage() {
  const searchParams = useSearchParams();
  const initialTab: SettingsTab =
    searchParams.get('tab') === 'ereceipt' ? 'ereceipt' : 'einvoice';
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (searchParams.get('tab') === 'ereceipt') setActiveTab('ereceipt');
  }, [searchParams]);

  const invalidateQuery = useInvalidateQuery();
  const hydratedRef = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settingsData, setSettingsData] = useState<SettingsForm>({
    username: '',
    password1: '',
    password2: '',
    tokenAPI: '',
    invoiceAPI: '',
    certThumbPrint: '',
  });
  const [enabledProfileIds, setEnabledProfileIds] = useState<string[]>([]);
  const [secretSaved, setSecretSaved] = useState({ password1: false, password2: false });
  const [tokenPin, setTokenPin] = useState('');
  const [tokenPinSaved, setTokenPinSaved] = useState(false);
  const [tokenPinBusy, setTokenPinBusy] = useState(false);

  const { data: settingsResponse } = useApiQuery<EinvoiceSettings>(
    ['electronic-invoice-settings'],
    '/electronic-invoices/settings',
    undefined,
    { staleTime: 30_000, refetchOnMount: false }
  );
  const profilesQuery = useDocumentProfiles({ baseType: 'SALES_INVOICE' });
  const modulesQuery = useApiQuery<
    { id: string; fullCode?: string | null; nameAr?: string | null; menuNameAr?: string | null; isActive?: boolean }[]
  >(['new-modules', 'SI', 'einvoice-settings'], '/new-modules', { baseType: 'SI' });
  const salesPatterns = buildSalesInvoicePatternOptions({
    profiles: profilesQuery.data?.data ?? [],
    modules: modulesQuery.data?.data ?? [],
  });
  const patternsLoading = profilesQuery.isLoading || modulesQuery.isLoading;

  const applyServerSettings = (data: EinvoiceSettings, keepTypedSecrets: boolean) => {
    setSettingsData((current) => {
      const next = formFromSettings(data);
      if (!keepTypedSecrets) return next;
      return {
        ...next,
        password1: current.password1,
        password2: current.password2,
      };
    });
    setEnabledProfileIds(data.enabledSalesProfileIds ?? []);
    setSecretSaved({
      password1: Boolean(data.password1Set),
      password2: Boolean(data.password2Set),
    });
  };

  useEffect(() => {
    let cancelled = false;
    void readLocalTokenPinStatus().then((status) => {
      if (!cancelled && status === 'saved') setTokenPinSaved(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveTokenPinOnThisComputer = async () => {
    const pin = tokenPin.trim();
    if (!pin) {
      setError('اكتب الرقم السري للتوكن أولاً');
      return;
    }
    setTokenPinBusy(true);
    setError('');
    const status = await saveLocalTokenPin(pin);
    setTokenPinBusy(false);
    setTokenPin('');
    if (status === 'saved') {
      setTokenPinSaved(true);
      setSuccess('الرقم السري اتحفظ على هذا الجهاز. التوقيع الجاي هيدخل لوحده.');
      return;
    }
    if (status === 'outdated') {
      setError('حدّث برنامج التوقيع إلى 1.1.4 عشان حفظ الرقم السري يشتغل.');
      return;
    }
    setError('برنامج التوقيع مش شغال على هذا الجهاز. شغّله ثم احفظ الرقم تاني.');
  };

  const forgetTokenPin = async () => {
    setTokenPinBusy(true);
    const status = await clearLocalTokenPin();
    setTokenPinBusy(false);
    if (status === 'missing') {
      setTokenPinSaved(false);
      setSuccess('الرقم السري المحفوظ اتمسح من هذا الجهاز.');
      return;
    }
    setError('تعذر مسح الرقم السري. تأكد أن برنامج التوقيع شغال.');
  };

  useEffect(() => {
    if (!settingsResponse?.data || hydratedRef.current) return;
    hydratedRef.current = true;
    applyServerSettings(settingsResponse.data, false);
  }, [settingsResponse]);

  const settingsMutation = useApiMutation<EinvoiceSettings, Record<string, unknown>>(
    '/electronic-invoices/settings',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        if (res.data) applyServerSettings(res.data, false);
        setSuccess('تم حفظ الإعدادات بنجاح');
        invalidateQuery(['electronic-invoice-settings']);
        invalidateQuery(['eta-invoice-readiness']);
      },
      onError: (apiError: ApiError) => {
        setError(apiError.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const handleSave = () => {
    setError('');
    setSuccess('');
    settingsMutation.mutate({
      username: settingsData.username,
      password1: settingsData.password1,
      password2: settingsData.password2,
      tokenAPI: settingsData.tokenAPI,
      invoiceAPI: settingsData.invoiceAPI,
      certThumbPrint: settingsData.certThumbPrint,
      enabledSalesProfileIds: enabledProfileIds,
    });
  };

  const handleCancel = () => {
    if (settingsResponse?.data) applyServerSettings(settingsResponse.data, false);
    setError('');
    setSuccess('');
  };

  const patch = (key: keyof SettingsForm, value: string) =>
    setSettingsData((current) => ({ ...current, [key]: value }));

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/electronic-invoices', label: 'الفواتير الإلكترونية' },
          { label: 'إعدادات الفواتير' },
        ]}
        title="إعدادات الفواتير الإلكترونية"
        statusTone="info"
        statusLabel="إعدادات"
        hideStandalonePost
        hideBrowseList
        hideActionMenu
      />

      <div className="mb-4 flex flex-wrap gap-2 border-b border-brand/15 pb-3">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeTab === 'einvoice'
              ? 'bg-brand text-white'
              : 'border border-brand/25 text-brand'
          }`}
          onClick={() => setActiveTab('einvoice')}
        >
          الفاتورة الإلكترونية (eInvoice)
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            activeTab === 'ereceipt'
              ? 'bg-brand text-white'
              : 'border border-brand/25 text-brand'
          }`}
          onClick={() => setActiveTab('ereceipt')}
        >
          إعدادات الإيصال الإلكتروني
        </button>
      </div>

      {activeTab === 'ereceipt' ? (
        <ElectronicReceiptSettingsPanel />
      ) : (
        <>
      <EsignAgentStatusCard />

      <FormSectionCard title="بيانات الربط" bodyClassName="grid-cols-1">
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <CompactFormField
            label="إسم المستخدم"
            placeholder="إدخل رقم المستخدم"
            value={settingsData.username}
            onChange={(e) => patch('username', e.target.value)}
          />
          <CompactFormField
            label="كلمة السر 1"
            type="password"
            autoComplete="new-password"
            placeholder={
              secretSaved.password1
                ? 'محفوظة — اكتب قيمة جديدة لتغييرها'
                : 'إدخل كلمة السر الأولى'
            }
            value={settingsData.password1}
            onChange={(e) => patch('password1', e.target.value)}
          />
          <CompactFormField
            label="كلمة السر 2"
            type="password"
            autoComplete="new-password"
            placeholder={
              secretSaved.password2
                ? 'محفوظة — اكتب قيمة جديدة لتغييرها'
                : 'إدخل كلمة السر الثانية'
            }
            value={settingsData.password2}
            onChange={(e) => patch('password2', e.target.value)}
          />
          <CompactFormField
            label="TokenAPI"
            placeholder="إدخل TokenAPI"
            value={settingsData.tokenAPI}
            onChange={(e) => patch('tokenAPI', e.target.value)}
          />
          <CompactFormField
            label="InvoiceAPI"
            placeholder="إدخل InvoiceAPI"
            value={settingsData.invoiceAPI}
            onChange={(e) => patch('invoiceAPI', e.target.value)}
          />
          <CompactFormField
            label="CertThumbPrint"
            placeholder="إدخل CertThumbPrint"
            value={settingsData.certThumbPrint}
            onChange={(e) => patch('certThumbPrint', e.target.value)}
          />
        </div>
        <div className="col-span-full mt-1 space-y-3 rounded-lg border border-brand/20 bg-white px-3 py-3">
          <div>
            <p className="text-sm font-semibold text-brand">الرقم السري للتوكن</p>
            <p className="mt-1 text-sm text-foreground-muted">
              اكتبه مرة واحدة. هيتحفظ على هذا الجهاز داخل برنامج التوقيع، ومش هيتبعت لـ Gates. التوقيع الجاي هيدخل بالرقم المحفوظ.
            </p>
          </div>
          <CompactFormField
            label="الرقم السري"
            type="password"
            autoComplete="new-password"
            placeholder={tokenPinSaved ? 'محفوظ على هذا الجهاز — اكتب رقمًا جديدًا لتغييره' : 'أدخل الرقم السري للتوكن'}
            value={tokenPin}
            onChange={(e) => setTokenPin(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={tokenPinBusy}
              onClick={() => void saveTokenPinOnThisComputer()}
            >
              {tokenPinBusy ? 'جارٍ الحفظ…' : 'حفظ على هذا الجهاز'}
            </button>
            {tokenPinSaved ? (
              <button
                type="button"
                className="h-10 rounded-lg border border-brand/30 px-4 text-sm font-semibold text-brand disabled:opacity-60"
                disabled={tokenPinBusy}
                onClick={() => void forgetTokenPin()}
              >
                مسح الرقم المحفوظ
              </button>
            ) : null}
          </div>
        </div>
      </FormSectionCard>

      <FormSectionCard
        title="أنماط فاتورة المبيعات"
        bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1"
      >
        <div className="col-span-full w-full max-w-none space-y-3">
          <p className="text-sm text-foreground-muted">
            علّم الأنماط اللي تظهر في شاشة إرسال الفواتير. لو مفيش نمط متعلم، الشاشة تعرض كل فواتير المبيعات.
          </p>
          {patternsLoading ? (
            <p className="text-sm text-foreground-muted">جاري تحميل الأنماط…</p>
          ) : salesPatterns.length === 0 ? (
            <p className="text-sm text-foreground-muted">مفيش أنماط فاتورة مبيعات.</p>
          ) : (
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {salesPatterns.map((pattern) => {
                const checked = enabledProfileIds.includes(pattern.id);
                return (
                  <label
                    key={pattern.id}
                    className="flex w-full max-w-none items-center gap-2 rounded-lg border border-brand/20 bg-white px-3 py-2 text-sm text-brand"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={checked}
                      onChange={() => {
                        setEnabledProfileIds((current) =>
                          checked ? current.filter((id) => id !== pattern.id) : [...current, pattern.id]
                        );
                      }}
                    />
                    <span className="font-semibold">{pattern.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </FormSectionCard>

      <FormStickyFooter
        onSave={handleSave}
        onCancel={handleCancel}
        saveText="حفظ"
        saveLoading={settingsMutation.isPending}
        saveDisabled={settingsMutation.isPending}
      />
        </>
      )}
    </ErpDocumentLayout>
  );
}
