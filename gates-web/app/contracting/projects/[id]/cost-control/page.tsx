'use client';

import { useParams } from 'next/navigation';
import { BudgetVsActualTable } from '@/components/contracting/BudgetVsActualTable';
import { MetricTile, ProjectCard, ProjectWorkspaceSkeleton } from '@/components/contracting/ContractingProjectPageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { ProjectBudgetVsActual, ProjectEvmDashboard } from '@/lib/contracting/types';
import { formatEgp, toMoney } from '@/lib/subcontracts/money';

function indexCopy(value: number | null, kind: 'cpi' | 'spi'): { hint: string; tone: 'success' | 'danger' | 'default' } {
  if (value == null || !Number.isFinite(value) || value === 0) {
    return { hint: 'لا تتوفر بيانات كافية', tone: 'default' };
  }
  const delta = Math.round(Math.abs(1 - value) * 100);
  if (kind === 'cpi') {
    if (value >= 1) return { hint: `وفر في التكلفة ${delta}%`, tone: 'success' };
    return { hint: `تجاوز في الميزانية ${delta}%`, tone: 'danger' };
  }
  if (value >= 1) return { hint: 'متقدم عن الجدول', tone: 'success' };
  return { hint: 'متأخر عن الجدول', tone: 'danger' };
}

export default function CostControlPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const evmQ = useApiQuery<ProjectEvmDashboard>(
    queryKeys.contracting.evm(projectId),
    `/contracting/cost-control/projects/${projectId}/evm`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );
  const bvaQ = useApiQuery<ProjectBudgetVsActual>(
    queryKeys.contracting.budgetVsActual(projectId),
    `/contracting/cost-control/projects/${projectId}/budget-vs-actual`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );

  const evm = evmQ.data?.data;
  const cpi = evm?.cpi == null ? null : toMoney(evm.cpi);
  const spi = evm?.spi == null ? null : toMoney(evm.spi);
  const cpiMeta = indexCopy(cpi, 'cpi');
  const spiMeta = indexCopy(spi, 'spi');

  if (evmQ.isLoading) return <ProjectWorkspaceSkeleton tiles={5} />;
  if (evmQ.isError || !evm) {
    return <EmptyState title="تعذر تحميل مؤشرات القيمة المكتسبة" description="تحقق من بيانات المقايسة والتكاليف الفعلية." />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricTile label="القيمة المخططة PV" value={formatEgp(evm.plannedValue)} hint="تكلفة الأعمال المجدولة حتى اليوم" />
        <MetricTile label="القيمة المكتسبة EV" value={formatEgp(evm.earnedValue)} hint="تكلفة الأعمال المنفذة بالتقدير" />
        <MetricTile
          label="التكلفة الفعلية AC"
          value={formatEgp(evm.actualCost)}
          hint="مقاولون + خامات + مصاريف مباشرة"
        />
        <MetricTile
          label="انحراف التكلفة CV"
          value={formatEgp(evm.costVariance)}
          tone={toMoney(evm.costVariance) >= 0 ? 'success' : 'danger'}
        />
        <MetricTile
          label="انحراف الجدول SV"
          value={formatEgp(evm.scheduleVariance)}
          tone={toMoney(evm.scheduleVariance) >= 0 ? 'success' : 'danger'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProjectCard title="مؤشر أداء التكلفة CPI">
          <p className="text-4xl font-black tabular-nums text-[#094C6B]">{cpi == null ? '—' : cpi.toFixed(2)}</p>
          <p className="mt-2 text-sm text-slate-600">{cpiMeta.hint}</p>
          <div className="mt-3">
            <StatusBadge
              label={evm.flags.cpiHealthy ? 'أداء تكلفة صحي (≥ 1.0)' : 'أداء تكلفة ضعيف'}
              tone={evm.flags.cpiHealthy ? 'success' : 'danger'}
            />
          </div>
          {cpi != null ? (
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cpiMeta.tone === 'success' ? 'h-full bg-emerald-500' : 'h-full bg-red-500'}
                style={{ width: `${Math.min(100, Math.max(8, cpi * 50))}%` }}
              />
            </div>
          ) : null}
        </ProjectCard>
        <ProjectCard title="مؤشر أداء الجدول SPI">
          <p className="text-4xl font-black tabular-nums text-[#094C6B]">{spi == null ? '—' : spi.toFixed(2)}</p>
          <p className="mt-2 text-sm text-slate-600">{spiMeta.hint}</p>
          <div className="mt-3">
            <StatusBadge
              label={evm.flags.spiOnTrack ? 'على المسار (≥ 1.0)' : 'متأخر عن الجدول'}
              tone={evm.flags.spiOnTrack ? 'success' : 'danger'}
            />
          </div>
          {spi != null ? (
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={spiMeta.tone === 'success' ? 'h-full bg-emerald-500' : 'h-full bg-red-500'}
                style={{ width: `${Math.min(100, Math.max(8, spi * 50))}%` }}
              />
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-400">
            BAC {formatEgp(evm.budgetAtCompletion)}
            {evm.estimateAtCompletion != null ? ` — EAC ${formatEgp(evm.estimateAtCompletion)}` : ''}
          </p>
        </ProjectCard>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricTile label="تكلفة مقاولي الباطن" value={formatEgp(evm.actuals.subcontractorCosts)} />
        <MetricTile label="خامات مصروفة للموقع" value={formatEgp(evm.actuals.materialCosts)} />
        <MetricTile label="مصاريف موقع مباشرة" value={formatEgp(evm.actuals.directSiteExpenses)} />
      </div>

      <ProjectCard title="مقارنة الميزانية مع الفعلي">
        <BudgetVsActualTable data={bvaQ.data?.data} loading={bvaQ.isLoading} />
      </ProjectCard>
    </div>
  );
}
