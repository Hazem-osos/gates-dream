'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

type RuleDetail = {
  id: string;
  code: string;
  name: string;
  payComponentId: string;
  phase: number;
  priority: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  conditionExpr?: string | null;
  formulaExpr: string;
  roundingMode: string;
  minAmount?: number | null;
  maxAmount?: number | null;
  localizationKey?: string | null;
  dependsOnCodes?: string[];
  isActive: boolean;
  frozen?: boolean;
};

export default function PayrollRulesPage() {
  const [employeeId, setEmployeeId] = useState('');
  const [formulaExpr, setFormulaExpr] = useState('comp_basic / period_days');
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);
  const [selectedCode, setSelectedCode] = useState('');
  const [draft, setDraft] = useState({
    code: '',
    name: '',
    payComponentId: '',
    phase: 10,
    priority: 100,
    effectiveFrom: '',
    effectiveTo: '',
    conditionExpr: '',
    dependsOn: '',
    roundingMode: 'HALF_UP_2',
    minAmount: '',
    maxAmount: '',
    localizationKey: '',
    isActive: true,
  });
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; dependencies: string[] } | null>(null);
  const [editingRuleId, setEditingRuleId] = useState('');
  const [loadedEffectiveFrom, setLoadedEffectiveFrom] = useState('');
  const [ruleFrozen, setRuleFrozen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const qc = useQueryClient();

  const configAudit = useQuery({
    queryKey: ['payroll-config-audit-rules'],
    queryFn: async () => {
      const res = await apiClient.get<
        Array<{ at: string; actorId: string; action: string; summary: string; entityCode?: string | null }>
      >('/hr/payroll/config-audit?subjectType=HCM_PAYROLL_RULE&limit=20');
      return res.data ?? [];
    },
  });

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

  const versions = useQuery({
    queryKey: ['payroll-rule-versions', selectedCode],
    enabled: Boolean(selectedCode),
    queryFn: async () => {
      const res = await apiClient.get<
        Array<{
          id: string;
          code: string;
          effectiveFrom: string;
          effectiveTo?: string | null;
          isActive: boolean;
          formulaExpr: string;
          updatedAt: string;
        }>
      >(`/hr/payroll/rules/${encodeURIComponent(selectedCode)}/versions`);
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
          dependsOnCodes: draft.dependsOn ? draft.dependsOn.split(',').map((s) => s.trim()).filter(Boolean) : [],
        }
      );
      return res.data;
    },
    onSuccess: (d) => setValidation(d ?? null),
  });

  const loadRuleDetail = async (id: string) => {
    const res = await apiClient.get<RuleDetail>(`/hr/payroll/rules/detail/${id}`);
    const d = res.data;
    if (!d) return;
    setEditingRuleId(d.id);
    setSelectedCode(d.code);
    setRuleFrozen(Boolean(d.frozen));
    setFormulaExpr(d.formulaExpr);
    setLoadedEffectiveFrom(d.effectiveFrom.slice(0, 10));
    setDraft({
      code: d.code,
      name: d.name,
      payComponentId: d.payComponentId,
      phase: d.phase,
      priority: d.priority,
      effectiveFrom: d.effectiveFrom.slice(0, 10),
      effectiveTo: d.effectiveTo ? d.effectiveTo.slice(0, 10) : '',
      conditionExpr: d.conditionExpr ?? '',
      dependsOn: (d.dependsOnCodes ?? []).join(', '),
      roundingMode: d.roundingMode,
      minAmount: d.minAmount != null ? String(d.minAmount) : '',
      maxAmount: d.maxAmount != null ? String(d.maxAmount) : '',
      localizationKey: d.localizationKey ?? '',
      isActive: d.isActive,
    });
    setValidation(null);
  };

  const saveRule = useMutation({
    mutationFn: async () => {
      setSaveError('');
      const payload = {
        code: draft.code,
        name: draft.name,
        payComponentId: draft.payComponentId,
        phase: draft.phase,
        priority: draft.priority,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || null,
        formulaExpr,
        conditionExpr: draft.conditionExpr || null,
        dependsOnCodes: draft.dependsOn ? draft.dependsOn.split(',').map((s) => s.trim()).filter(Boolean) : [],
        roundingMode: draft.roundingMode,
        minAmount: draft.minAmount ? Number(draft.minAmount) : null,
        maxAmount: draft.maxAmount ? Number(draft.maxAmount) : null,
        localizationKey: draft.localizationKey || null,
        isActive: draft.isActive,
      };
      const isNewVersion =
        editingRuleId && loadedEffectiveFrom && draft.effectiveFrom !== loadedEffectiveFrom;
      if (editingRuleId && !isNewVersion) {
        await apiClient.patch(`/hr/payroll/rules/${editingRuleId}`, payload);
      } else {
        await apiClient.post('/hr/payroll/rules', payload);
      }
      setSelectedCode(draft.code);
      setEditingRuleId('');
      setRuleFrozen(false);
      setLoadedEffectiveFrom('');
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['hcm-payroll-rules'] });
      await qc.invalidateQueries({ queryKey: ['payroll-rule-versions', draft.code] });
      configAudit.refetch();
    },
    onError: (err: unknown) => {
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      setSaveError(e.response?.data?.message ?? e.message ?? 'تعذر الحفظ');
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
        {ruleFrozen ? (
          <p className="text-amber-700 text-xs border border-amber-200 rounded p-2 bg-amber-50">
            هذا الإصدار مستخدم في مسيرة رواتب مجمّدة — المعادلة والشرط للقراءة فقط. غيّر «ساري من» لإنشاء إصدار جديد.
          </p>
        ) : null}
        {saveError ? <p className="text-destructive text-xs">{saveError}</p> : null}
        <div className="grid md:grid-cols-3 gap-2">
          <input className="border rounded px-2 py-1" placeholder="كود القاعدة" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="الاسم" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select className="border rounded px-2 py-1" value={draft.payComponentId} onChange={(e) => setDraft({ ...draft, payComponentId: e.target.value })}>
            <option value="">مكون الراتب</option>
            {(components.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </select>
          <input className="border rounded px-2 py-1" type="number" placeholder="المرحلة" value={draft.phase} onChange={(e) => setDraft({ ...draft, phase: Number(e.target.value) })} />
          <input className="border rounded px-2 py-1" type="number" placeholder="الأولوية" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
          <input className="border rounded px-2 py-1" type="date" value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} />
          <input className="border rounded px-2 py-1" type="date" placeholder="ساري حتى" value={draft.effectiveTo} onChange={(e) => setDraft({ ...draft, effectiveTo: e.target.value })} />
          <select className="border rounded px-2 py-1" value={draft.roundingMode} onChange={(e) => setDraft({ ...draft, roundingMode: e.target.value })}>
            <option value="HALF_UP_2">HALF_UP_2</option>
            <option value="HALF_UP_4">HALF_UP_4</option>
            <option value="FLOOR_2">FLOOR_2</option>
          </select>
          <input className="border rounded px-2 py-1" placeholder="حد أدنى" value={draft.minAmount} onChange={(e) => setDraft({ ...draft, minAmount: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="حد أقصى" value={draft.maxAmount} onChange={(e) => setDraft({ ...draft, maxAmount: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="نطاق التوطين" value={draft.localizationKey} onChange={(e) => setDraft({ ...draft, localizationKey: e.target.value })} />
          <input className="border rounded px-2 py-1" placeholder="يعتمد على (أكواد مفصولة بفاصلة)" value={draft.dependsOn} onChange={(e) => setDraft({ ...draft, dependsOn: e.target.value })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
            نشط
          </label>
        </div>
        <textarea className="border w-full rounded px-2 py-1 font-mono text-xs" rows={2} placeholder="condition" value={draft.conditionExpr} readOnly={ruleFrozen} onChange={(e) => setDraft({ ...draft, conditionExpr: e.target.value })} />
        <textarea className="border w-full rounded px-2 py-1 font-mono text-xs" rows={2} value={formulaExpr} readOnly={ruleFrozen} onChange={(e) => setFormulaExpr(e.target.value)} />
        <div className="flex gap-2">
          <button type="button" className="rounded border px-3 py-1" onClick={() => validateRule.mutate()} disabled={validateRule.isPending}>تحقق</button>
          <button type="button" className="rounded bg-primary px-3 py-1 text-primary-foreground" onClick={() => saveRule.mutate()} disabled={!validation?.valid || saveRule.isPending}>
            {editingRuleId ? 'تحديث الإصدار' : 'حفظ'}
          </button>
          {editingRuleId ? (
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={() => {
                setEditingRuleId('');
                setRuleFrozen(false);
                setLoadedEffectiveFrom('');
              }}
            >
              إلغاء التعديل
            </button>
          ) : null}
          <button
            type="button"
            className="rounded border px-3 py-1"
            onClick={() => {
              setEditingRuleId('');
              setRuleFrozen(false);
              setLoadedEffectiveFrom('');
              setDraft({
                code: '',
                name: '',
                payComponentId: '',
                phase: 10,
                priority: 100,
                effectiveFrom: '',
                effectiveTo: '',
                conditionExpr: '',
                dependsOn: '',
                roundingMode: 'HALF_UP_2',
                minAmount: '',
                maxAmount: '',
                localizationKey: '',
                isActive: true,
              });
              setFormulaExpr('comp_basic / period_days');
              setValidation(null);
            }}
          >
            قاعدة جديدة
          </button>
        </div>
        {validation && (
          <div className="text-xs space-y-1">
            <div className={validation.valid ? 'text-emerald-700' : 'text-destructive'}>
              {validation.valid ? 'القاعدة صالحة' : validation.errors.join(' · ')}
            </div>
            {validation.dependencies.length > 0 && (
              <div className="border rounded p-2 bg-muted/50">
                <div className="font-semibold">تبعيات المكونات / المتغيرات</div>
                <ul className="list-disc ps-4">{validation.dependencies.map((d) => <li key={d}>{d}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </section>
      {selectedCode && (
        <section className="border rounded p-4 text-sm">
          <h3 className="font-semibold mb-2">سجل إصدارات القاعدة: {selectedCode}</h3>
          {versions.isLoading ? <p>جاري التحميل…</p> : (
            <table className="w-full border text-xs">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2 text-right">من</th>
                  <th className="p-2 text-right">إلى</th>
                  <th className="p-2 text-right">نشط</th>
                  <th className="p-2 text-right">آخر تحديث</th>
                </tr>
              </thead>
              <tbody>
                {(versions.data ?? []).map((v) => (
                  <tr key={v.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => loadRuleDetail(v.id)}>
                    <td className="p-2">{v.effectiveFrom}</td>
                    <td className="p-2">{v.effectiveTo ?? '—'}</td>
                    <td className="p-2">{v.isActive ? 'نعم' : 'لا'}</td>
                    <td className="p-2">{v.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
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
          {simResult && (
            <div className="mt-2 text-xs border rounded p-2 bg-muted/40 space-y-1">
              <div>المبلغ: {String(simResult.amount ?? '—')}</div>
              <div>تخطي: {simResult.skipped ? 'نعم' : 'لا'}</div>
              {simResult.amountsRedacted ? <div className="text-muted-foreground">المبالغ مخفية (صلاحية)</div> : null}
            </div>
          )}
        </div>
      </section>
      <section className="border rounded p-4 text-sm">
        <h3 className="font-semibold mb-2">سجل إجراءات الإدارة (قواعد)</h3>
        {configAudit.isLoading ? <p>جاري التحميل…</p> : (
          <ul className="text-xs space-y-1 max-h-40 overflow-auto">
            {(configAudit.data ?? []).map((a) => (
              <li key={`${a.at}-${a.summary}`}>{a.at} · {a.summary}</li>
            ))}
          </ul>
        )}
      </section>
      {isLoading ? <p>جاري التحميل…</p> : (
        <div className="space-y-3">
          {(data ?? []).map((r) => (
            <div
              key={`${r.code}-${r.effectiveFrom}`}
              className="border rounded p-3 text-sm cursor-pointer hover:bg-muted/40"
              onClick={() => setSelectedCode(r.code)}
            >
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
