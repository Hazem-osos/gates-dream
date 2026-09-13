'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lazyNamedModal } from '@/components/ui/lazyModal';
import { MetricTile, ProjectCard } from '@/components/contracting/ContractingProjectPageShell';
import { AttachmentDropzone } from '@/components/attachments/AttachmentDropzone';
import { ProjectLgTable } from '@/components/contracting/ProjectLgTable';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { ContractingProject, ProjectLetterOfGuarantee, ProjectLgList } from '@/lib/contracting/types';
import { formatEgp, toMoney } from '@/lib/subcontracts/money';

const IssueLgModal = lazyNamedModal(() => import('@/components/contracting/LgActionModals'), 'IssueLgModal', 'جاري تحميل إصدار الخطاب…');
const ExtendLgModal = lazyNamedModal(() => import('@/components/contracting/LgActionModals'), 'ExtendLgModal', 'جاري تحميل مد الخطاب…');
const AmendLgModal = lazyNamedModal(() => import('@/components/contracting/LgActionModals'), 'AmendLgModal', 'جاري تحميل تعديل القيمة…');
const ReleaseLgModal = lazyNamedModal(() => import('@/components/contracting/LgActionModals'), 'ReleaseLgModal', 'جاري تحميل الإفراج…');
const LiquidateLgModal = lazyNamedModal(() => import('@/components/contracting/LgActionModals'), 'LiquidateLgModal', 'جاري تحميل المصادرة…');

type Tab = 'ALL' | 'ACTIVE' | 'EXPIRING' | 'RELEASED_RETURNED' | 'LIQUIDATED_CONFISCATED';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'ALL', label: 'الكل' },
  { id: 'ACTIVE', label: 'ساري' },
  { id: 'EXPIRING', label: 'ينتهي قريباً' },
  { id: 'RELEASED_RETURNED', label: 'مفرج عنه' },
  { id: 'LIQUIDATED_CONFISCATED', label: 'مصادر' },
];

const DAY_MS = 86_400_000;

export default function LettersOfGuaranteePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const invalidate = useInvalidateQuery();
  const [tab, setTab] = useState<Tab>('ALL');
  const [issueOpen, setIssueOpen] = useState(false);
  const [active, setActive] = useState<ProjectLetterOfGuarantee | null>(null);
  const [selectedLg, setSelectedLg] = useState<ProjectLetterOfGuarantee | null>(null);
  const [action, setAction] = useState<'extend' | 'amend' | 'release' | 'liquidate' | null>(null);

  const projectQ = useApiQuery<ContractingProject>(
    queryKeys.contracting.project(projectId),
    `/contracting/projects/${projectId}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );
  const lgQ = useApiQuery<ProjectLgList>(
    queryKeys.contracting.lettersOfGuarantee(projectId),
    `/contracting/letters-of-guarantee/projects/${projectId}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );

  const list = lgQ.data?.data;
  const all = list?.tabs.ALL ?? [];
  const activeItems = list?.tabs.ACTIVE ?? [];
  const expiring = all.filter((lg) => {
    const days = (new Date(lg.expiryDate).getTime() - Date.now()) / DAY_MS;
    return days <= 30 && days >= 0 && lg.status !== 'RELEASED_RETURNED' && lg.status !== 'LIQUIDATED_CONFISCATED';
  });
  const kpis = useMemo(() => {
    const activeValue = activeItems.reduce((sum, lg) => sum + toMoney(lg.currentAmount), 0);
    const frozen = activeItems.reduce((sum, lg) => sum + toMoney(lg.cashMarginAmount), 0);
    return { activeValue, frozen, count: activeItems.length, expiring: expiring.length };
  }, [activeItems, expiring.length]);

  const filtered =
    tab === 'ALL'
      ? all
      : tab === 'ACTIVE'
        ? activeItems
        : tab === 'EXPIRING'
          ? expiring
          : tab === 'RELEASED_RETURNED'
            ? (list?.tabs.RELEASED_RETURNED ?? [])
            : (list?.tabs.LIQUIDATED_CONFISCATED ?? []);

  const refresh = () => invalidate(queryKeys.contracting.lettersOfGuarantee(projectId));
  const openAction = (next: typeof action, lg: ProjectLetterOfGuarantee) => {
    setActive(lg);
    setAction(next);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="قيمة الخطابات السارية" value={formatEgp(kpis.activeValue)} />
        <MetricTile label="الغطاء النقدي المحتجز" value={formatEgp(kpis.frozen)} />
        <MetricTile label="عدد الضمانات السارية" value={String(kpis.count)} />
        <MetricTile
          label="تنتهي خلال 30 يوماً"
          value={String(kpis.expiring)}
          tone={kpis.expiring > 0 ? 'warning' : 'success'}
          hint={kpis.expiring > 0 ? 'يتطلب متابعة التجديد' : 'لا يوجد إنذار'}
        />
      </div>

      <ProjectCard
        title="خطابات الضمان البنكية"
        actions={
          <Button size="sm" iconStart={<Plus className="h-4 w-4" />} onClick={() => setIssueOpen(true)}>
            إصدار خطاب جديد
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ${
                tab === item.id ? 'bg-[#0E79AA] text-white' : 'bg-[#F6FBFD] text-[#094C6B]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <ProjectLgTable
          items={filtered}
          loading={lgQ.isLoading}
          selectedId={selectedLg?.id}
          onSelect={setSelectedLg}
          onExtend={(lg) => openAction('extend', lg)}
          onAmend={(lg) => openAction('amend', lg)}
          onRelease={(lg) => openAction('release', lg)}
          onLiquidate={(lg) => openAction('liquidate', lg)}
        />
      </ProjectCard>

      {selectedLg ? (
        <ProjectCard title={`مرفقات الخطاب ${selectedLg.lgNumber}`}>
          <AttachmentDropzone
            title="خطاب الضمان المختوم"
            defaultCategory="BANK_LG_STAMPED_LETTER"
            links={{
              letterOfGuaranteeId: selectedLg.id,
              entityType: 'LETTER_OF_GUARANTEE',
              entityId: selectedLg.id,
            }}
          />
        </ProjectCard>
      ) : null}

      {issueOpen ? (
        <IssueLgModal
          open
          projectId={projectId}
          defaultBeneficiary={projectQ.data?.data?.customer?.arabicName}
          onClose={() => setIssueOpen(false)}
          onSaved={refresh}
        />
      ) : null}
      {action === 'extend' ? (
        <ExtendLgModal open lg={active} onClose={() => setAction(null)} onSaved={refresh} />
      ) : null}
      {action === 'amend' ? (
        <AmendLgModal open lg={active} onClose={() => setAction(null)} onSaved={refresh} />
      ) : null}
      {action === 'release' ? (
        <ReleaseLgModal open lg={active} onClose={() => setAction(null)} onSaved={refresh} />
      ) : null}
      {action === 'liquidate' ? (
        <LiquidateLgModal open lg={active} onClose={() => setAction(null)} onSaved={refresh} />
      ) : null}
    </div>
  );
}
