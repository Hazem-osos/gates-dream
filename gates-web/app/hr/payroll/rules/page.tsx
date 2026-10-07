'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export default function PayrollRulesPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [formulaExpr, setFormulaExpr] = useState('comp_basic / period_days');
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState({
    code: '',
    name: '',
    payComponentId: '',
    phase: 10,
    priority: 100,
    effectiveFrom: '',
    conditionExpr: '',
    dependsOn: '',
  });
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; dependencies: string[] } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hcm-payroll-rules'],
    queryFn: async () => {
      const res = await apiClient.get<
        Array<{ code: string; name: string; phase: number; formulaExpr: string; effectiveFrom: string; payComponent?: { code: string } }>
      >('/hr/payroll/rules');
      return res.data ?? [];
    },
  });

  const catalog = useQuery({
    queryKey: ['payroll-var-catalog'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ group: string; variables: string[] }>>(
        '/hr/payroll/rules/variable-catalog'
      );
      return res.data ?? [];
    },
  });

  const components = useQuery({
    queryKey: ['hcm-pay-components'],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; code: string }>>('/hr/payroll/components');
      return res.data ?? [];
    },
  });

  const validateRule = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ valid: boolean; errors: string[]; dependencies: string[] }>(
        '/hr/payroll/rules/validate',
        {
          ...draft,
          formulaExpr,
          conditionExpr: draft.conditionExpr || null,
          dependsOnCodes: draft.dependsOn ? draft.dependsOn.split(',').map((s) => s.trim()) : [],
        }
      );
      return res.data;
    },
    onSuccess: (d) => setValidation(d ?? null),
  });

  const saveRule = useMutation({
    mutationFn: async () => {
      await apiClient.post('/hr/payroll/rules', {
        ...draft,
        formulaExpr,
        conditionExpr: draft.conditionExpr || null,
        dependsOnCodes: draft.dependsOn ? draft.dependsOn.split(',').map((s) => s.trim()) : [],
      });
    },
  });

  const simulate = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<Record<string, unknown>>('/hr/payroll/rules/simulate', {
        employeeId,
        periodYear: 2026,
        periodMonth: 1,
        formulaExpr,
      });
      return res.data;
    },
    onSuccess: (d) => setSimResult(d ?? null),
  });

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">قواعد الرواتب</h2>
      <section className="border rounded p-4 text-sm space-y-2">
        <h3 className="font-semibold">مصمم القاعدة</h3>
        <div className="grid md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" placeholder="code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select className="border rounded px-2 py-1" value={draft.payComponentId} onChange={(e) => setDraft({ ...draft, payComponentId: e.target.value })}>
            <option value="">مكون</option>
            {(components.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </select>
          <input className="border rounded px-2 py-1" type="date" value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="dependsOn (codes, comma)" value={draft.dependsOn} onChange={(e) => setDraft({ ...draft, dependsOn: e.target.value })} />
        </div>
        <textarea className="border w-full rounded px-2 py-1 font-mono text-xs" rows={2} placeholder="condition" value={draft.conditionExpr} onChange={(e) => setDraft({ ...draft, conditionExpr: e.target.value })} />
        <textarea className="border w-full rounded px-2 py-1 font-mono text-xs" rows={2} value={formulaExpr} onChange={(e) => setFormulaExpr(e.target.value)} />
        <div className="flex gap-2">
          <button type="button" className="rounded border px-3 py-1" onClick={() => validateRule.mutate()} disabled={validateRule.isPending}>تحقق</button>
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => saveRule.mutate()} disabled={!validation?.valid || saveRule.isPending}>حفظ</button>
        </div>
        {validation && (
          <div className="text-xs">
            {validation.valid ? 'صالح' : validation.errors.join(' · ')}
            {validation.dependencies.length > 0 && <div>يعتمد على: {validation.dependencies.join(', ')}</div>}
          </div>
        )}
      </section>
      <section className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="font-semibold mb-2">متغيرات مسموحة</h3>
          {(catalog.data ?? []).map((g) => (
            <div key={g.group} className="mb-2">
              <div className="text-muted-foreground">{g.group}</div>
              <div className="text-xs">{g.variables.join(', ')}</div>
            </div>
          ))}
        </div>
        <div className="border rounded p-3">
          <h3 className="font-semibold mb-2">محاكي القاعدة</h3>
          <input className="border w-full rounded px-2 py-1 mb-2" placeholder="معرّف الموظف" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
          <textarea className="border w-full rounded px-2 py-1 mb-2 font-mono text-xs" rows={3} value={formulaExpr} onChange={(e) => setFormulaExpr(e.target.value)} />
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => simulate.mutate()} disabled={!employeeId || simulate.isPending}>
            محاكاة
          </button>
          {simResult && <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(simResult, null, 2)}</pre>}
        </div>
      </section>
      {isLoading ? <p>جاري التحميل…</p> : (
        <div className="space-y-3">
          {(data ?? []).map((r) => (
            <div key={`${r.code}-${r.effectiveFrom}`} className="border rounded p-3 text-sm">
              <div className="font-medium">{r.code} — {r.name} (مرحلة {r.phase})</div>
              <div className="text-muted-foreground">مكون: {r.payComponent?.code} · من {r.effectiveFrom}</div>
              <code className="block mt-1 text-xs bg-muted p-2 rounded">{r.formulaExpr}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
