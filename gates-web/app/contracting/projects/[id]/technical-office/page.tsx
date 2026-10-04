'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Plus, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lazyNamedModal } from '@/components/ui/lazyModal';
import { OwnerBoqTable } from '@/components/contracting/OwnerBoqTable';
import { ProjectCard } from '@/components/contracting/ContractingProjectPageShell';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { downloadBoqExport } from '@/lib/contracting/excel-transfer';
import type { OwnerBoqItem } from '@/lib/contracting/types';
import type { ClientContractDetail } from '@/lib/contracting/types';
import type { ContractBoqScope } from '@/lib/contracting/variation-types';
import { apiClient } from '@/lib/api/client';

const RateAnalysisDrawer = lazyNamedModal(
  () => import('@/components/contracting/RateAnalysisDrawer'),
  'RateAnalysisDrawer',
  'جاري تحميل تحليل السعر…'
);
const BoqMarkupModal = lazyNamedModal(
  () => import('@/components/contracting/BoqMarkupModal'),
  'BoqMarkupModal',
  'جاري تحميل هيكل التحميل…'
);
const MeasurementSheetsDialog = lazyNamedModal(
  () => import('@/components/contracting/MeasurementSheetsDialog'),
  'MeasurementSheetsDialog',
  'جاري تحميل دفتر الحصر…'
);
const CreateOwnerBoqModal = lazyNamedModal(
  () => import('@/components/contracting/CreateOwnerBoqModal'),
  'CreateOwnerBoqModal',
  'جاري تحميل بند المقايسة…'
);
const ExcelImportModal = lazyNamedModal(
  () => import('@/components/contracting/ExcelImportModal'),
  'ExcelImportModal',
  'جاري تحميل استيراد Excel…'
);

export default function TechnicalOfficePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const invalidate = useInvalidateQuery();
  const [selected, setSelected] = useState<OwnerBoqItem | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [markupOpen, setMarkupOpen] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [importBoqOpen, setImportBoqOpen] = useState(false);
  const [importMeasOpen, setImportMeasOpen] = useState(false);

  const boqQ = useApiQuery<OwnerBoqItem[]>(
    queryKeys.contracting.ownerBoq(projectId),
    `/contracting/technical-office/projects/${projectId}/boq`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );
  const items = boqQ.data?.data ?? [];

  const contractQ = useApiQuery<ClientContractDetail | null>(
    queryKeys.contracting.clientContract(projectId),
    `/contracting/client-billing/projects/${projectId}/contract`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );
  const contractId = contractQ.data?.data?.id;
  const scopeQ = useQuery({
    queryKey: ['contract-boq-scope', contractId],
    enabled: Boolean(contractId),
    queryFn: async () => {
      const res = await apiClient.get<ContractBoqScope>(
        `/contracting/client-billing/contracts/${contractId}/boq-scope`
      );
      return res.data!;
    },
  });
  const scopeByItemId = useMemo(() => {
    if (!scopeQ.data?.items) return undefined;
    return new Map(scopeQ.data.items.map((row) => [row.projectBOQItemId, row]));
  }, [scopeQ.data?.items]);

  const refresh = () => {
    invalidate(queryKeys.contracting.ownerBoq(projectId));
    invalidate(queryKeys.contracting.evm(projectId));
    invalidate(queryKeys.contracting.budgetVsActual(projectId));
  };

  return (
    <ProjectCard
      title="مقايسة المالك التنفيذية"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" iconStart={<Download className="h-4 w-4" />} onClick={() => void downloadBoqExport(projectId)}>
            تصدير المقايسة
          </Button>
          <Button size="sm" variant="secondary" iconStart={<Ruler className="h-4 w-4" />} onClick={() => setImportMeasOpen(true)}>
            استيراد حصر
          </Button>
          <Button size="sm" variant="secondary" iconStart={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setImportBoqOpen(true)}>
            استيراد Excel
          </Button>
          <Button size="sm" iconStart={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            إضافة بند
          </Button>
        </div>
      }
    >
      <OwnerBoqTable
        items={items}
        scopeByItemId={scopeByItemId}
        loading={boqQ.isLoading}
        onAdd={() => setCreateOpen(true)}
        onRateBreakdown={(item) => {
          setSelected(item);
          setRateOpen(true);
        }}
        onMarkup={(item) => {
          setSelected(item);
          setMarkupOpen(true);
        }}
        onMeasurements={(item) => {
          setSelected(item);
          setSheetsOpen(true);
        }}
      />
      {rateOpen ? (
        <RateAnalysisDrawer open item={selected} onClose={() => setRateOpen(false)} onSaved={refresh} />
      ) : null}
      {markupOpen ? (
        <BoqMarkupModal open item={selected} onClose={() => setMarkupOpen(false)} onSaved={refresh} />
      ) : null}
      {sheetsOpen ? (
        <MeasurementSheetsDialog
          open
          item={selected}
          onClose={() => setSheetsOpen(false)}
          onChanged={refresh}
        />
      ) : null}
      {createOpen ? (
        <CreateOwnerBoqModal
          open
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
          onCreated={refresh}
        />
      ) : null}
      {importBoqOpen ? (
        <ExcelImportModal
          open
          mode="OWNER_BOQ"
          projectId={projectId}
          onClose={() => setImportBoqOpen(false)}
          onImported={refresh}
        />
      ) : null}
      {importMeasOpen ? (
        <ExcelImportModal
          open
          mode="MEASUREMENTS"
          projectId={projectId}
          onClose={() => setImportMeasOpen(false)}
          onImported={refresh}
        />
      ) : null}
    </ProjectCard>
  );
}
