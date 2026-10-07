'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export default function PayrollLocalizationPage() {
  const qc = useQueryClient();
  const [countryCode, setCountryCode] = useState('EG');
  const [configKey, setConfigKey] = useState('DEFAULT');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [insuranceCap, setInsuranceCap] = useState('10000');

  const schema = useQuery({
    queryKey: ['payroll-loc-schema', countryCode],
    queryFn: async () => {
      const res = await apiClient.get<{ fields: Array<{ key: string; label: string }> }>(
        `/hr/payroll/localization/schema/${countryCode}`
      );
      return res.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['hcm-payroll-loc'],
    queryFn: async () => {
      const res = await apiClient.get<
        Array<{ countryCode: string; configKey: string; effectiveFrom: string; effectiveTo?: string | null; isActive: boolean }>
      >('/hr/payroll/localization');
      return res.data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const config =
        countryCode === 'EG'
          ? { insuranceCap: Number(insuranceCap), taxBrackets: [] }
          : { gosiEmployeeRate: 0.09, gosiEmployerRate: 0.11 };
      await apiClient.post('/hr/payroll/localization', {
        countryCode,
        configKey,
        effectiveFrom,
        config,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hcm-payroll-loc'] }),
  });

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">توطين الرواتب (TEST CONFIG)</h1>
      <p className="text-sm text-muted-foreground">بيانات اختبار — لا تمثل القانون الحالي.</p>
      <section className="border rounded p-4 text-sm space-y-3 max-w-lg">
        <select className="border rounded px-2 py-1" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
          <option value="EG">مصر (TEST)</option>
          <option value="SA">السعودية (TEST)</option>
        </select>
        {(schema.data?.fields ?? []).map((f) => (
          <label key={f.key} className="block">
            {f.label}
            {f.key === 'insuranceCap' && (
              <input className="border w-full rounded px-2 py-1 mt-1" value={insuranceCap} onChange={(e) => setInsuranceCap(e.target.value)} />
            )}
          </label>
        ))}
        <input className="border w-full rounded px-2 py-1" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" disabled={save.isPending || !effectiveFrom} onClick={() => save.mutate()}>
          إنشاء إصدار
        </button>
      </section>
      {isLoading ? <p>جاري التحميل…</p> : (
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
              <tr key={`${row.countryCode}-${row.configKey}-${row.effectiveFrom}`} className="border-t">
                <td className="p-2">{row.countryCode}</td>
                <td className="p-2">{row.configKey}</td>
                <td className="p-2">{row.effectiveFrom}</td>
                <td className="p-2">{row.effectiveTo ?? '—'}</td>
                <td className="p-2">{row.isActive ? 'نعم' : 'لا'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
