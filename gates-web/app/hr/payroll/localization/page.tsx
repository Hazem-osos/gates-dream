'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

type LocRow = {
  id: string;
  countryCode: string;
  configKey: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  configJson?: Record<string, unknown>;
};

type Schema = {
  configKeys: string[];
  fields: Array<{ key: string; label: string; type: string }>;
};

function isoDate(d: string) {
  if (!d) return '';
  return d.includes('T') ? d.slice(0, 10) : d;
}

export default function PayrollLocalizationPage() {
  const qc = useQueryClient();
  const [countryCode, setCountryCode] = useState('EG');
  const [configKey, setConfigKey] = useState('INSURANCE_CAP');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [maxBase, setMaxBase] = useState('10000');
  const [bracketsJson, setBracketsJson] = useState('[{"upTo":5000,"rate":0.1},{"rate":0.2}]');
  const [employeeRate, setEmployeeRate] = useState('0.09');
  const [employerRate, setEmployerRate] = useState('0.11');
  const [selectedId, setSelectedId] = useState('');
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');

  const schema = useQuery({
    queryKey: ['payroll-loc-schema', countryCode],
    queryFn: async () => {
      const res = await apiClient.get<Schema>(`/hr/payroll/localization/schema/${countryCode}`);
      return res.data;
    },
  });

  useEffect(() => {
    const keys = schema.data?.configKeys ?? [];
    if (keys.length && !keys.includes(configKey)) {
      setConfigKey(keys[0]);
    }
  }, [schema.data?.configKeys, configKey, countryCode]);

  const configAudit = useQuery({
    queryKey: ['payroll-config-audit-loc'],
    queryFn: async () => {
      const res = await apiClient.get<
        Array<{ at: string; summary: string; action: string; entityCode?: string | null }>
      >('/hr/payroll/config-audit?subjectType=HCM_PAYROLL_LOCALIZATION&limit=20');
      return res.data ?? [];
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hcm-payroll-loc'],
    queryFn: async () => {
      const res = await apiClient.get<LocRow[]>('/hr/payroll/localization');
      return res.data ?? [];
    },
  });

  const versions = useQuery({
    queryKey: ['hcm-payroll-loc-versions', countryCode, configKey],
    enabled: Boolean(countryCode && configKey),
    queryFn: async () => {
      const res = await apiClient.get<LocRow[]>(
        `/hr/payroll/localization/${countryCode}/${configKey}/versions`
      );
      return res.data ?? [];
    },
  });

  const buildConfig = useMemo(() => {
    return (): Record<string, unknown> => {
      if (countryCode === 'EG' && configKey === 'INSURANCE_CAP') {
        return { maxBase: Number(maxBase) };
      }
      if (countryCode === 'EG' && configKey === 'TAX_BRACKETS') {
        return { brackets: JSON.parse(bracketsJson) as unknown };
      }
      if (countryCode === 'SA' && configKey === 'GOSI_RATES') {
        return { employeeRate: Number(employeeRate), employerRate: Number(employerRate) };
      }
      return {};
    };
  }, [countryCode, configKey, maxBase, bracketsJson, employeeRate, employerRate]);

  const validate = useMutation({
    mutationFn: async () => {
      setFieldErrors({});
      setValidation(null);
      setSaveError('');
      let config: Record<string, unknown>;
      try {
        config = buildConfig();
      } catch {
        setFieldErrors({ brackets: 'صيغة JSON غير صالحة للشرائح (TEST)' });
        throw new Error('invalid json');
      }
      const res = await apiClient.post<{ valid: boolean; errors: string[] }>(
        '/hr/payroll/localization/validate',
        { countryCode, configKey, config }
      );
      return res.data;
    },
    onSuccess: (result) => {
      setValidation(result ?? null);
      const errs = result?.errors ?? [];
      const next: Record<string, string> = {};
      for (const e of errs) {
        if (e.includes('maxBase') || e.includes('insurance cap')) next.maxBase = e;
        else if (e.includes('Bracket') || e.includes('bracket')) next.brackets = e;
        else if (e.includes('employee')) next.employeeRate = e;
        else if (e.includes('employer')) next.employerRate = e;
        else next._general = e;
      }
      setFieldErrors(next);
    },
    onError: (err: unknown) => {
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      setSaveError(e.response?.data?.message ?? e.message ?? 'تعذر التحقق');
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      setSaveError('');
      const config = buildConfig();
      await apiClient.post('/hr/payroll/localization', {
        countryCode,
        configKey,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        config,
        isActive: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hcm-payroll-loc'] });
      versions.refetch();
      configAudit.refetch();
      setValidation({ valid: true, errors: [] });
    },
    onError: (err: unknown) => {
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      setSaveError(e.response?.data?.message ?? e.message ?? 'تعذر الحفظ');
    },
  });

  const loadDetail = async (id: string) => {
    setSelectedId(id);
    const res = await apiClient.get<LocRow & { config?: Record<string, unknown> }>(
      `/hr/payroll/localization/detail/${id}`
    );
    const row = res.data;
    if (!row) return;
    setCountryCode(row.countryCode);
    setConfigKey(row.configKey);
    setEffectiveFrom(isoDate(row.effectiveFrom));
    setEffectiveTo(row.effectiveTo ? isoDate(row.effectiveTo) : '');
    const cfg = row.config ?? row.configJson ?? {};
    if (row.configKey === 'INSURANCE_CAP') {
      setMaxBase(String(cfg.maxBase ?? ''));
    }
    if (row.configKey === 'TAX_BRACKETS') {
      setBracketsJson(JSON.stringify(cfg.brackets ?? [], null, 0));
    }
    if (row.configKey === 'GOSI_RATES') {
      setEmployeeRate(String(cfg.employeeRate ?? ''));
      setEmployerRate(String(cfg.employerRate ?? ''));
    }
    setValidation(null);
    setFieldErrors({});
  };

  const designer = (
    <section
      className="relative z-30 border rounded p-4 text-sm space-y-3 max-w-xl bg-background"
      data-testid="loc-designer"
    >
      <h2 className="font-semibold">مصمم التوطين (TEST)</h2>
      <select
        className="border rounded px-2 py-1 w-full"
        value={countryCode}
        onChange={(e) => setCountryCode(e.target.value)}
      >
        <option value="EG">مصر (TEST)</option>
        <option value="SA">السعودية (TEST)</option>
      </select>
      <label className="block">
        نوع الإعداد
        <select
          className="border rounded px-2 py-1 w-full mt-1"
          value={configKey}
          onChange={(e) => setConfigKey(e.target.value)}
        >
          {(schema.data?.configKeys ?? [configKey]).map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>
      {countryCode === 'EG' && configKey === 'INSURANCE_CAP' && (
        <label className="block">
          سقف التأمين maxBase (TEST)
          <input
            className="border w-full rounded px-2 py-1 mt-1"
            value={maxBase}
            onChange={(e) => setMaxBase(e.target.value)}
          />
          {fieldErrors.maxBase ? <p className="text-destructive text-xs mt-1">{fieldErrors.maxBase}</p> : null}
        </label>
      )}
      {countryCode === 'EG' && configKey === 'TAX_BRACKETS' && (
        <label className="block">
          شرائح الضريبة JSON (TEST)
          <textarea
            className="border w-full rounded px-2 py-1 mt-1 font-mono text-xs min-h-[80px]"
            value={bracketsJson}
            onChange={(e) => setBracketsJson(e.target.value)}
          />
          {fieldErrors.brackets ? <p className="text-destructive text-xs mt-1">{fieldErrors.brackets}</p> : null}
        </label>
      )}
      {countryCode === 'SA' && configKey === 'GOSI_RATES' && (
        <>
          <label className="block">
            نسبة الموظف (TEST)
            <input
              className="border w-full rounded px-2 py-1 mt-1"
              value={employeeRate}
              onChange={(e) => setEmployeeRate(e.target.value)}
            />
            {fieldErrors.employeeRate ? (
              <p className="text-destructive text-xs mt-1">{fieldErrors.employeeRate}</p>
            ) : null}
          </label>
          <label className="block">
            نسبة صاحب العمل (TEST)
            <input
              className="border w-full rounded px-2 py-1 mt-1"
              value={employerRate}
              onChange={(e) => setEmployerRate(e.target.value)}
            />
            {fieldErrors.employerRate ? (
              <p className="text-destructive text-xs mt-1">{fieldErrors.employerRate}</p>
            ) : null}
          </label>
        </>
      )}
      <label className="block">
        ساري من
        <input
          className="border w-full rounded px-2 py-1 mt-1"
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
      </label>
      <label className="block">
        ساري إلى (اختياري)
        <input
          className="border w-full rounded px-2 py-1 mt-1"
          type="date"
          value={effectiveTo}
          onChange={(e) => setEffectiveTo(e.target.value)}
        />
      </label>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className="rounded border px-3 py-1"
          disabled={validate.isPending}
          onClick={() => validate.mutate()}
        >
          تحقق
        </button>
        <button
          type="button"
          className="rounded bg-primary px-3 py-1 text-primary-foreground"
          disabled={save.isPending || !effectiveFrom}
          onClick={() => save.mutate()}
        >
          حفظ إصدار
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1"
          onClick={() => {
            setSelectedId('');
            setEffectiveFrom('');
            setEffectiveTo('');
            setValidation(null);
            setFieldErrors({});
            setSaveError('');
          }}
        >
          إصدار جديد
        </button>
      </div>
      {validation?.valid ? <p className="text-green-700 text-xs">الإعداد صالح (TEST)</p> : null}
      {validation && !validation.valid ? (
        <ul className="text-destructive text-xs list-disc pr-4">
          {validation.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {saveError ? <p className="text-destructive text-xs">{saveError}</p> : null}
    </section>
  );

  return (
    <div className="p-6 space-y-6 relative z-20" dir="rtl">
      <h1 className="text-xl font-bold">توطين الرواتب (TEST CONFIG)</h1>
      <p className="text-sm text-muted-foreground">بيانات اختبار — لا تمثل القانون الحالي ولا تُفعَّل تلقائياً للإنتاج.</p>
      {designer}
      <section className="border rounded p-4 text-sm max-w-2xl">
        <h3 className="font-semibold mb-2">
          سجل إصدارات: {countryCode}/{configKey}
        </h3>
        {versions.isLoading ? (
          <p>جاري التحميل…</p>
        ) : (
          <table className="w-full text-xs border">
            <thead>
              <tr className="bg-muted">
                <th className="p-2 text-right">من</th>
                <th className="p-2 text-right">إلى</th>
                <th className="p-2 text-right">نشط</th>
              </tr>
            </thead>
            <tbody>
              {(versions.data ?? []).map((row) => (
                <tr
                  key={row.id}
                  className="border-t cursor-pointer hover:bg-muted/50"
                  onClick={() => loadDetail(row.id)}
                >
                  <td className="p-2">{isoDate(row.effectiveFrom)}</td>
                  <td className="p-2">{row.effectiveTo ? isoDate(row.effectiveTo) : '—'}</td>
                  <td className="p-2">{row.isActive ? 'نعم' : 'لا'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className="border rounded p-4 text-sm">
        <h3 className="font-semibold mb-2">سجل إجراءات التوطين</h3>
        {configAudit.isLoading ? (
          <p>جاري التحميل…</p>
        ) : (
          <ul className="text-xs space-y-1 max-h-32 overflow-auto">
            {(configAudit.data ?? []).map((a) => (
              <li key={`${a.at}-${a.summary}`}>{a.at} · {a.action} · {a.summary}</li>
            ))}
          </ul>
        )}
      </section>
      {isError ? <p className="text-destructive text-sm">تعذر تحميل الإعدادات.</p> : null}
      {isLoading ? (
        <p>جاري التحميل…</p>
      ) : (
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-right">الدولة</th>
              <th className="p-2 text-right">المفتاح</th>
              <th className="p-2 text-right">من</th>
              <th className="p-2 text-right">إلى</th>
              <th className="p-2 text-right">نشط</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr
                key={row.id}
                className={`border-t cursor-pointer hover:bg-muted/50 ${selectedId === row.id ? 'bg-muted/30' : ''}`}
                onClick={() => loadDetail(row.id)}
              >
                <td className="p-2">{row.countryCode}</td>
                <td className="p-2">{row.configKey}</td>
                <td className="p-2">{isoDate(row.effectiveFrom)}</td>
                <td className="p-2">{row.effectiveTo ? isoDate(row.effectiveTo) : '—'}</td>
                <td className="p-2">{row.isActive ? 'نعم' : 'لا'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
