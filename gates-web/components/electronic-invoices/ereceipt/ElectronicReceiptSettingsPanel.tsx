'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FormSectionCard, CompactFormField, FormStickyFooter } from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import apiClient from '@/lib/api/client';
import {
  GATES_PAYMENT_METHODS,
  ETA_RECEIPT_PAYMENT_CODES,
  RECEIPT_TYPE_LABELS_AR,
  parsePaymentMap,
  parseStringArrayJson,
  deviceRowReady,
} from '@/lib/electronic-invoices/ereceipt-settings';
import type { EreceiptDeviceRow, EreceiptReadinessPayload, EreceiptSettingRow } from './ereceipt-types';
import { EreceiptDeviceInlineForm } from './EreceiptDeviceFormModal';
import { ERECEIPT_FIELD_HELP, WIZARD_STEPS } from '@/lib/electronic-invoices/ereceipt-field-help';
import { listMissingSetupActions, localSetupComplete } from '@/lib/electronic-invoices/ereceipt-setup-missing';
import { FieldHelpHint } from './FieldHelpHint';
import Link from 'next/link';

type PosTerminalOption = { id: string; name?: string; deviceCode?: string | null };

function settingForEnv(settings: EreceiptSettingRow[], environment: string): EreceiptSettingRow | undefined {
  return settings.find((row) => row.environment === environment);
}

function buildExtendedChecklist(
  environment: string,
  settings: EreceiptSettingRow[],
  devices: EreceiptDeviceRow[],
  apiChecks: { code: string; ok: boolean; messageAr: string }[]
) {
  const envRow = settingForEnv(settings, environment);
  const envDevices = devices.filter((d) => d.environment === environment);
  const activeDevices = envDevices.filter((d) => d.active);
  const anyReady = activeDevices.some((d) => deviceRowReady(d));

  const byCode = new Map(apiChecks.map((c) => [c.code, c]));

  return [
    {
      ok: environment === 'PREPRODUCTION' || environment === 'PRODUCTION',
      label: 'بيئة ETA محددة',
    },
    {
      ok: Boolean(envRow),
      label: 'إعدادات الشركة للإيصال محفوظة لهذه البيئة',
    },
    {
      ok: byCode.get('RIN')?.ok ?? false,
      label: byCode.get('RIN')?.messageAr ?? 'رقم التسجيل الضريبي (RIN)',
    },
    {
      ok: activeDevices.length > 0,
      label: 'طرفية Gates مفعّلة ومربوطة',
    },
    {
      ok: activeDevices.some((d) => Boolean(d.deviceSerialNumber?.trim())),
      label: 'مسلسل جهاز ETA (POS Serial) موجود',
    },
    {
      ok: activeDevices.some((d) => Boolean(d.branchCode?.trim())),
      label: 'كود الفرع موجود',
    },
    {
      ok: byCode.get('ACTIVITY')?.ok ?? false,
      label: 'كود النشاط على جهاز مفعّل',
    },
    {
      ok: activeDevices.some((d) => Boolean(d.clientId?.trim())),
      label: 'Client ID موجود',
    },
    {
      ok: activeDevices.some((d) => d.clientSecretConfigured),
      label: 'Client Secret محفوظ',
    },
    {
      ok: activeDevices.some((d) => d.presharedKeyConfigured),
      label: 'Pre-shared Key محفوظ',
    },
    {
      ok: anyReady,
      label: 'جهاز واحد على الأقل جاهز بالكامل',
    },
  ];
}

export function ElectronicReceiptSettingsPanel() {
  const [environment, setEnvironment] = useState<'PREPRODUCTION' | 'PRODUCTION'>('PREPRODUCTION');
  const [enabledTypes, setEnabledTypes] = useState<string[]>(['s', 'r']);
  const [rwrEnabled, setRwrEnabled] = useState(false);
  const [rwrReasons, setRwrReasons] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('');
  const [signingMode, setSigningMode] = useState<'DISABLED' | 'REQUIRED'>('DISABLED');
  const [paymentOverrides, setPaymentOverrides] = useState<Record<string, string>>({});
  const [showAdvancedTypes, setShowAdvancedTypes] = useState(false);
  const [showPaymentDebug, setShowPaymentDebug] = useState(false);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [editingDevice, setEditingDevice] = useState<EreceiptDeviceRow | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [connectionMsg, setConnectionMsg] = useState('');
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionVerified, setConnectionVerified] = useState(false);

  const readinessQuery = useApiQuery<EreceiptReadinessPayload>(
    ['ereceipt-readiness'],
    '/electronic-receipts/readiness',
    undefined,
    { staleTime: 0 }
  );

  const terminalsQuery = useApiQuery<PosTerminalOption[]>(
    ['pos-terminals-ereceipt-settings'],
    '/pos/terminals',
    { includeInactive: 'true' }
  );

  const payload = readinessQuery.data?.data;
  const receiptTypes = payload?.receiptTypes ?? [];
  const devices = payload?.devices ?? [];
  const settings = payload?.settings ?? [];
  const apiChecks = payload?.checks ?? [];

  const retailTypes = useMemo(
    () => receiptTypes.filter((t) => t.audience === 'gates-retail'),
    [receiptTypes]
  );
  const industryTypes = useMemo(
    () => receiptTypes.filter((t) => t.audience === 'industry'),
    [receiptTypes]
  );

  const envDevices = useMemo(
    () => devices.filter((d) => d.environment === environment),
    [devices, environment]
  );

  const hydrateFromSettings = useCallback(
    (env: 'PREPRODUCTION' | 'PRODUCTION') => {
      const row = settingForEnv(settings, env);
      if (!row) {
        setEnabledTypes(['s', 'r']);
        setRwrEnabled(false);
        setRwrReasons('');
        setDeliveryMode('');
        setSigningMode('DISABLED');
        setPaymentOverrides({});
        return;
      }
      const types = parseStringArrayJson(row.enabledReceiptTypes);
      setEnabledTypes(types.length ? types : ['s', 'r']);
      const reasons = parseStringArrayJson(row.rwrReasonCodes);
      setRwrEnabled(reasons.length > 0);
      setRwrReasons(reasons.join(', '));
      setDeliveryMode(row.orderDeliveryMode || '');
      setSigningMode(row.signingMode === 'REQUIRED' ? 'REQUIRED' : 'DISABLED');
      setPaymentOverrides(parsePaymentMap(row.paymentMap));
    },
    [settings]
  );

  useEffect(() => {
    if (!settings.length && !readinessQuery.isSuccess) return;
    hydrateFromSettings(environment);
  }, [environment, settings, readinessQuery.isSuccess, hydrateFromSettings]);

  const extendedChecks = useMemo(
    () => buildExtendedChecklist(environment, settings, devices, apiChecks),
    [environment, settings, devices, apiChecks]
  );

  const rinOk = apiChecks.find((c) => c.code === 'RIN')?.ok ?? false;
  const missingActions = useMemo(
    () => listMissingSetupActions({ environment, settings, devices, rinOk }),
    [environment, settings, devices, rinOk]
  );
  const setupLocallyComplete = localSetupComplete(missingActions);

  const runConnectionTest = async () => {
    setConnectionBusy(true);
    setConnectionMsg('');
    setConnectionVerified(false);
    try {
      const res = await apiClient.post<{ ok: boolean; messageAr: string; tokenVerified: boolean }>(
        '/electronic-receipts/test-connection',
        { environment }
      );
      const data = res.data;
      setConnectionMsg(data?.messageAr ?? '');
      setConnectionVerified(Boolean(data?.ok && data?.tokenVerified));
    } catch (err) {
      setConnectionMsg(err instanceof Error ? err.message : 'فشل اختبار الاتصال');
    } finally {
      setConnectionBusy(false);
    }
  };

  const paymentMapPayload = useMemo(() => {
    const out: Record<string, string> = {};
    for (const row of GATES_PAYMENT_METHODS) {
      const override = paymentOverrides[row.code];
      if (override && override !== row.defaultEta) out[row.code] = override;
    }
    return Object.keys(out).length ? out : null;
  }, [paymentOverrides]);

  const saveGeneralSettings = async () => {
    setMessage('');
    setSaveBusy(true);
    try {
      await apiClient.put('/electronic-receipts/settings', {
        environment,
        enabledReceiptTypes: enabledTypes,
        rwrReasonCodes: rwrEnabled
          ? rwrReasons.split(/[,،]/).map((s) => s.trim()).filter(Boolean)
          : [],
        signingMode,
        orderDeliveryMode: deliveryMode.trim() || null,
        paymentMap: paymentMapPayload,
      });
      setMessage('تم حفظ إعدادات الإيصال الإلكتروني');
      await readinessQuery.refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات');
    } finally {
      setSaveBusy(false);
    }
  };

  const saveDevice = async (terminalId: string, body: Record<string, unknown>) => {
    await apiClient.put(`/electronic-receipts/devices/${terminalId}`, body);
    await readinessQuery.refetch();
  };

  const toggleType = (code: string) => {
    setEnabledTypes((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code]
    );
  };

  const startNewDeviceLink = () => {
    setEditingDevice(null);
    if (typeof document !== 'undefined') {
      document.querySelector('[data-ereceipt-device-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openEditDevice = (row: EreceiptDeviceRow) => {
    setEditingDevice(row);
    if (typeof document !== 'undefined') {
      document.querySelector('[data-ereceipt-device-form]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-4">
      <FormSectionCard
        title="إعداد الإيصال الإلكتروني"
        subtitle="سنساعدك خطوة بخطوة في تجهيز شركتك وربط جهاز نقطة البيع بمصلحة الضرائب."
        bodyClassName="grid-cols-1"
      >
        <ol className="flex flex-wrap gap-2 text-xs sm:text-sm">
          {WIZARD_STEPS.map((s) => (
            <li key={s.id} className="rounded-full border border-brand/25 px-3 py-1 text-brand">
              {s.id}. {s.titleAr}
            </li>
          ))}
        </ol>
      </FormSectionCard>

      <FormSectionCard title="المطلوب منك" bodyClassName="grid-cols-1">
        {setupLocallyComplete ? (
          <p className="text-sm text-emerald-800">
            الإعدادات مكتملة محليًا — يمكنك اختبار الاتصال مع ETA ثم إرسال أول إيصال تجريبي.
            {connectionVerified ? '' : ' (لم يُتحقق من الاتصال بعد)'}
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-brand">باقي {missingActions.length} خطوة:</p>
            <ol className="list-decimal pr-5 text-sm text-foreground-muted">
              {missingActions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </>
        )}
      </FormSectionCard>

      <FormSectionCard title="كيف يعمل الإيصال الإلكتروني؟" bodyClassName="grid-cols-1">
        <ol className="list-decimal space-y-1 pr-5 text-sm text-foreground-muted">
          <li>الكاشير ينفذ عملية البيع من نقطة البيع.</li>
          <li>Gates ينشئ الإيصال الضريبي تلقائيًا بعد الترحيل.</li>
          <li>الإيصال يُرسل إلى مصلحة الضرائب عبر قائمة الانتظار.</li>
          <li>Gates يتابع نتيجة التحقق.</li>
          <li>تراجع الإيصالات من صفحة الإيصالات الإلكترونية.</li>
        </ol>
        <p className="mt-2 text-sm text-brand">لا تحتاج إلى إدخال UUID أو previousUUID أو JSON يدويًا.</p>
      </FormSectionCard>

      <FormSectionCard title="هل أنت جاهز لإرسال أول إيصال؟" bodyClassName="grid-cols-1">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
            onClick={() => {
              setReadinessOpen(true);
              void readinessQuery.refetch();
            }}
          >
            فحص الجاهزية
          </button>
          <button
            type="button"
            disabled={connectionBusy}
            className="rounded-lg border border-brand/40 px-4 py-2 text-sm font-semibold text-brand"
            onClick={() => void runConnectionTest()}
          >
            {connectionBusy ? 'جاري الاختبار…' : 'اختبار الاتصال بمصلحة الضرائب'}
          </button>
          {environment === 'PREPRODUCTION' ? (
            <Link
              href="/electronic-invoices/receipts/test"
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-800"
            >
              إنشاء إيصال تجريبي
            </Link>
          ) : null}
        </div>
        {connectionMsg ? (
          <p className={`mt-2 text-sm ${connectionVerified ? 'text-emerald-800' : 'text-amber-900'}`}>
            {connectionVerified ? '✓ ' : '⚠ '}
            {connectionMsg}
          </p>
        ) : null}
        {readinessOpen ? (
          <div className="mt-3 space-y-2 rounded-lg border border-brand/20 bg-white p-3">
            <p className="text-sm font-semibold">الشركة</p>
            <ul className="space-y-1 text-sm">
              {extendedChecks.slice(0, 3).map((row) => (
                <li key={row.label} className={row.ok ? 'text-emerald-800' : 'text-rose-800'}>
                  {row.ok ? '✓' : '✗'} {row.label}
                </li>
              ))}
            </ul>
            <p className="text-sm font-semibold">جهاز نقطة البيع</p>
            <ul className="space-y-1 text-sm">
              {extendedChecks.slice(3, 7).map((row) => (
                <li key={row.label} className={row.ok ? 'text-emerald-800' : 'text-rose-800'}>
                  {row.ok ? '✓' : '✗'} {row.label}
                </li>
              ))}
            </ul>
            <p className="text-sm font-semibold">الاتصال بمصلحة الضرائب</p>
            <ul className="space-y-1 text-sm">
              {extendedChecks.slice(7, 10).map((row) => (
                <li key={row.label} className={row.ok ? 'text-emerald-800' : 'text-rose-800'}>
                  {row.ok ? '✓' : '✗'} {row.label}
                </li>
              ))}
              <li className={connectionVerified ? 'text-emerald-800' : 'text-slate-600'}>
                {connectionVerified ? '✓' : '○'} اختبار الاتصال (اختياري — لا يثبت صلاحية الإيصال)
              </li>
            </ul>
            <p className="mt-2 text-sm text-amber-800">
              ⚠ يجب التأكد من أن الشركة مفعلة B2C لدى مصلحة الضرائب.
            </p>
            <p className="text-sm text-amber-800">
              ⚠ يجب التأكد من تسجيل وربط جهاز POS بالرقم الضريبي للشركة.
            </p>
          </div>
        ) : null}
      </FormSectionCard>

      <FormSectionCard title="١ — بيانات الشركة والبيئة" bodyClassName="grid-cols-1">
        <label className="text-sm font-semibold text-brand">
          {ERECEIPT_FIELD_HELP.environment.labelAr}
          <select
            className="mt-1 h-10 w-full rounded-lg border px-2"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as 'PREPRODUCTION' | 'PRODUCTION')}
          >
            <option value="PREPRODUCTION">PREPRODUCTION — تجريبي</option>
            <option value="PRODUCTION">PRODUCTION — إنتاج</option>
          </select>
          <FieldHelpHint help={ERECEIPT_FIELD_HELP.environment} />
        </label>
      </FormSectionCard>

      <FormSectionCard title="٤ — إعدادات الإيصال (أساسي)" bodyClassName="grid-cols-1">
        <div className="mt-1">
          <p className="text-sm font-semibold text-brand">{ERECEIPT_FIELD_HELP.receiptTypes.labelAr}</p>
          <FieldHelpHint help={ERECEIPT_FIELD_HELP.receiptTypes} />
          <div className="mt-2 flex flex-wrap gap-3">
            {retailTypes.map((t) => (
              <label key={t.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabledTypes.includes(t.code)}
                  onChange={() => toggleType(t.code)}
                />
                {RECEIPT_TYPE_LABELS_AR[t.code] ?? `${t.label} (${t.code})`}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand"
            onClick={() => setShowAdvancedTypes((v) => !v)}
          >
            {showAdvancedTypes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            أنواع إيصالات متقدمة (قطاعات خاصة)
          </button>
          {showAdvancedTypes ? (
            <div className="mt-2 flex flex-wrap gap-3 rounded-lg border border-dashed p-3">
              {industryTypes.map((t) => (
                <label key={t.code} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabledTypes.includes(t.code)}
                    onChange={() => toggleType(t.code)}
                  />
                  {RECEIPT_TYPE_LABELS_AR[t.code] ?? `${t.label} (${t.code})`}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand"
          onClick={() => setShowAdvancedSettings((v) => !v)}
        >
          {showAdvancedSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          إعدادات متقدمة
        </button>

        {showAdvancedSettings ? (
        <>
        <div className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
          <label className="text-sm font-semibold text-brand">
            {ERECEIPT_FIELD_HELP.signingMode.labelAr}
            <select
              className="mt-1 h-10 w-full rounded-lg border px-2"
              value={signingMode}
              onChange={(e) => setSigningMode(e.target.value as 'DISABLED' | 'REQUIRED')}
            >
              <option value="DISABLED">معطّل</option>
              <option value="REQUIRED">مطلوب</option>
            </select>
            <FieldHelpHint help={ERECEIPT_FIELD_HELP.signingMode} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={rwrEnabled}
              onChange={(e) => setRwrEnabled(e.target.checked)}
            />
            {ERECEIPT_FIELD_HELP.rwr.labelAr}
          </label>
          <FieldHelpHint help={ERECEIPT_FIELD_HELP.rwr} />
          <p className="text-xs text-foreground-muted">
            معطّل افتراضياً. يتطلب أسباباً رسمية من ETA — لا تفعّله إلا بعد تكوين الأسباب المسموحة.
          </p>
          {rwrEnabled ? (
            <CompactFormField
              label="أكواد الأسباب الرسمية (مفصولة بفاصلة)"
              value={rwrReasons}
              onChange={(e) => setRwrReasons(e.target.value)}
              hint="من قائمة الأسباب المعتمدة لدى مصلحة الضرائب"
            />
          ) : null}
        </div>

        <CompactFormField
          className="mt-3"
          label="Order Delivery Mode"
          value={deliveryMode}
          onChange={(e) => setDeliveryMode(e.target.value)}
          hint="لأنواع إيصالات القطاعات التي تتطلبه — اتركه فارغاً لبيع/مرتجع العادي (s/r)"
        />

        <div className="mt-4">
          <p className="text-sm font-semibold text-brand">ربط طرق الدفع (Gates → ETA)</p>
          <p className="text-xs text-foreground-muted">
            القيم الافتراضية من Gates. غيّر فقط عند الحاجة لرمز ETA مختلف.
          </p>
          <div className="mt-2 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-right">
                <tr>
                  <th className="p-2">طريقة Gates</th>
                  <th className="p-2">افتراضي</th>
                  <th className="p-2">رمز ETA</th>
                </tr>
              </thead>
              <tbody>
                {GATES_PAYMENT_METHODS.map((row) => (
                  <tr key={row.code} className="border-t">
                    <td className="p-2">{row.labelAr} ({row.code})</td>
                    <td className="p-2 font-mono">{row.defaultEta}</td>
                    <td className="p-2">
                      <select
                        className="h-9 w-full rounded border px-1"
                        value={paymentOverrides[row.code] ?? row.defaultEta}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaymentOverrides((prev) => {
                            const next = { ...prev };
                            if (val === row.defaultEta) delete next[row.code];
                            else next[row.code] = val;
                            return next;
                          });
                        }}
                      >
                        {ETA_RECEIPT_PAYMENT_CODES.map((eta) => (
                          <option key={eta.code} value={eta.code}>
                            {eta.labelAr}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-brand underline"
            onClick={() => setShowPaymentDebug((v) => !v)}
          >
            {showPaymentDebug ? 'إخفاء' : 'عرض'} JSON للتصحيح (قراءة فقط)
          </button>
          {showPaymentDebug ? (
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-xs">
              {JSON.stringify(paymentMapPayload ?? {}, null, 2)}
            </pre>
          ) : null}
        </div>
        </>
        ) : null}
      </FormSectionCard>

      <FormSectionCard
        title="٢ و ٣ — جهاز نقطة البيع وربط الضرائب"
        bodyClassName="grid-cols-1"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-foreground-muted">
            بيئة العرض: <strong>{environment}</strong> — املأ النموذج تحت ثم «حفظ الربط» (منفصل عن «حفظ إعدادات الإيصال»).
          </p>
          <button
            type="button"
            className="rounded-lg border border-brand/40 px-3 py-2 text-sm font-semibold text-brand"
            onClick={startNewDeviceLink}
          >
            ربط طرفية جديدة
          </button>
        </div>

        <EreceiptDeviceInlineForm
          key={`${environment}:${editingDevice?.terminalId ?? 'new'}`}
          environment={environment}
          terminals={terminalsQuery.data?.data ?? []}
          initial={editingDevice}
          onCancel={() => setEditingDevice(null)}
          onSaved={() => {
            setMessage('تم حفظ ربط الجهاز');
            setEditingDevice(null);
            void readinessQuery.refetch();
          }}
          saveDevice={saveDevice}
        />

        <p className="mt-4 text-sm font-semibold text-brand">الأجهزة المربوطة</p>
        <div className="mt-2 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right">
              <tr>
                <th className="p-2">طرفية Gates</th>
                <th className="p-2">مسلسل ETA</th>
                <th className="p-2">الفرع</th>
                <th className="p-2">النشاط</th>
                <th className="p-2">البيئة</th>
                <th className="p-2">الجاهزية</th>
                <th className="p-2">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {envDevices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-foreground-muted">
                    لا يوجد ربط لهذه البيئة بعد.
                  </td>
                </tr>
              ) : (
                envDevices.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.terminal?.name || row.terminalId}</td>
                    <td className="p-2 font-mono text-xs">{row.deviceSerialNumber || '—'}</td>
                    <td className="p-2">{row.branchCode || '—'}</td>
                    <td className="p-2">{row.activityCode || '—'}</td>
                    <td className="p-2">{row.environment}</td>
                    <td className="p-2">
                      <span
                        className={
                          deviceRowReady(row)
                            ? 'rounded bg-emerald-100 px-2 py-0.5 text-emerald-900'
                            : 'rounded bg-amber-100 px-2 py-0.5 text-amber-900'
                        }
                      >
                        {deviceRowReady(row) ? 'جاهز' : row.active ? 'ناقص' : 'غير مفعّل'}
                      </span>
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="text-brand underline"
                        onClick={() => openEditDevice(row)}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="mr-2 text-brand underline"
                        onClick={() => {
                          setReadinessOpen(true);
                          void readinessQuery.refetch();
                        }}
                      >
                        جاهزية
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </FormSectionCard>

      {message ? (
        <p className={`text-sm ${message.includes('تعذر') || message.includes('فشل') ? 'text-rose-700' : 'text-emerald-800'}`}>
          {message}
        </p>
      ) : null}

      <FormStickyFooter
        onSave={() => void saveGeneralSettings()}
        saveText="حفظ إعدادات الإيصال"
        saveLoading={saveBusy}
        saveDisabled={saveBusy}
      />

    </div>
  );
}
