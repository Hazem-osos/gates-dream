'use client';

import { useEffect, useState } from 'react';
import { CompactFormField } from '@/components/ui';
import type { EreceiptDeviceRow } from './ereceipt-types';

type PosTerminalOption = { id: string; name?: string; deviceCode?: string | null };

type Props = {
  environment: string;
  terminals: PosTerminalOption[];
  initial?: EreceiptDeviceRow | null;
  onCancel?: () => void;
  onSaved: () => void;
  saveDevice: (terminalId: string, body: Record<string, unknown>) => Promise<void>;
};

const emptyForm = () => ({
  terminalId: '',
  deviceSerialNumber: '',
  branchCode: '',
  posOsVersion: '',
  posModelFramework: '',
  activityCode: '',
  clientId: '',
  clientSecret: '',
  presharedKey: '',
  active: true,
});

/** Inline device link form (same screen — no modal). */
export function EreceiptDeviceInlineForm({
  environment,
  terminals,
  initial,
  onCancel,
  onSaved,
  saveDevice,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secretsWereConfigured, setSecretsWereConfigured] = useState({
    clientSecret: false,
    presharedKey: false,
  });

  useEffect(() => {
    setError('');
    if (initial) {
      setForm({
        terminalId: initial.terminalId,
        deviceSerialNumber: initial.deviceSerialNumber || '',
        branchCode: initial.branchCode || '',
        posOsVersion: initial.posOsVersion || '',
        posModelFramework: initial.posModelFramework || '',
        activityCode: initial.activityCode || '',
        clientId: initial.clientId || '',
        clientSecret: '',
        presharedKey: '',
        active: initial.active,
      });
      setSecretsWereConfigured({
        clientSecret: Boolean(initial.clientSecretConfigured),
        presharedKey: Boolean(initial.presharedKeyConfigured),
      });
      return;
    }
    setForm(emptyForm());
    setSecretsWereConfigured({ clientSecret: false, presharedKey: false });
  }, [initial, environment]);

  const patch = (key: keyof ReturnType<typeof emptyForm>, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setError('');
    if (!form.terminalId) {
      setError('اختر طرفية نقطة البيع داخل Gates');
      return;
    }
    setBusy(true);
    try {
      await saveDevice(form.terminalId, {
        environment,
        deviceSerialNumber: form.deviceSerialNumber,
        branchCode: form.branchCode,
        posOsVersion: form.posOsVersion,
        posModelFramework: form.posModelFramework,
        activityCode: form.activityCode || undefined,
        clientId: form.clientId,
        clientSecret: form.clientSecret,
        presharedKey: form.presharedKey,
        active: form.active,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الجهاز');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mt-3 rounded-xl border border-brand/25 bg-[#F6FBFD] p-4"
      dir="rtl"
      data-ereceipt-device-form
    >
      <h3 className="text-base font-bold text-brand">
        {initial ? 'تعديل ربط جهاز ETA' : 'ربط طرفية Gates بجهاز ETA'}
      </h3>
      <p className="mt-1 text-sm text-foreground-muted">
        املأ البيانات من تسجيل جهاز نقطة البيع لدى مصلحة الضرائب ثم اضغط «حفظ الربط». البيئة الحالية:{' '}
        <strong>{environment}</strong>
      </p>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-brand sm:col-span-2">
          طرفية Gates
          <select
            className="mt-1 h-10 w-full rounded-lg border bg-white px-2 text-sm"
            value={form.terminalId}
            disabled={Boolean(initial)}
            onChange={(e) => patch('terminalId', e.target.value)}
          >
            <option value="">اختر الطرفية…</option>
            {terminals.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.deviceCode || t.id}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-xs font-normal text-foreground-muted">
            طرفية نقطة البيع داخل Gates التي سيتم ربطها بجهاز ETA
          </span>
        </label>
        <CompactFormField
          label="المسلسل التسلسلي لجهاز ETA (POS Serial)"
          maxLength={100}
          value={form.deviceSerialNumber}
          onChange={(e) => patch('deviceSerialNumber', e.target.value)}
          hint="كما مسجل لدى الضرائب — وليس مسلسل نظام التشغيل"
        />
        <CompactFormField
          label="كود الفرع (ETA Branch Code)"
          maxLength={50}
          value={form.branchCode}
          onChange={(e) => patch('branchCode', e.target.value)}
        />
        <CompactFormField
          label="إصدار نظام التشغيل (POS OS Version)"
          maxLength={50}
          value={form.posOsVersion}
          onChange={(e) => patch('posOsVersion', e.target.value)}
        />
        <CompactFormField
          label="POS Model / Framework"
          maxLength={10}
          value={form.posModelFramework}
          onChange={(e) => patch('posModelFramework', e.target.value)}
        />
        <CompactFormField
          label="كود النشاط"
          maxLength={10}
          value={form.activityCode}
          onChange={(e) => patch('activityCode', e.target.value)}
        />
        <CompactFormField
          label="Client ID"
          maxLength={200}
          value={form.clientId}
          onChange={(e) => patch('clientId', e.target.value)}
        />
        <CompactFormField
          label="Client Secret"
          type="password"
          autoComplete="new-password"
          value={form.clientSecret}
          onChange={(e) => patch('clientSecret', e.target.value)}
          placeholder={
            secretsWereConfigured.clientSecret
              ? 'محفوظ — اتركه فارغًا لعدم التغيير'
              : 'مطلوب عند أول ربط'
          }
        />
        <CompactFormField
          label="Pre-shared Key"
          type="password"
          autoComplete="new-password"
          maxLength={200}
          value={form.presharedKey}
          onChange={(e) => patch('presharedKey', e.target.value)}
          placeholder={
            secretsWereConfigured.presharedKey
              ? 'محفوظ — اتركه فارغًا لعدم التغيير'
              : 'مطلوب عند أول ربط'
          }
        />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => patch('active', e.target.checked)}
          />
          تفعيل هذا الربط للإرسال
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => void submit()}
        >
          {busy ? 'جارٍ الحفظ…' : 'حفظ الربط'}
        </button>
        {initial && onCancel ? (
          <button type="button" className="rounded-lg border bg-white px-4 py-2 text-sm" onClick={onCancel}>
            إلغاء التعديل
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Use EreceiptDeviceInlineForm — kept for import stability. */
export const EreceiptDeviceFormModal = EreceiptDeviceInlineForm;
