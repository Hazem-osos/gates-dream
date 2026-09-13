'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FilePlus2, FileSpreadsheet, ShieldAlert, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { AttachmentDropzone } from '@/components/attachments/AttachmentDropzone';
import { SubcontractBoqTable } from '@/components/subcontracts/SubcontractBoqTable';
import {
  InvoiceStatusBadge,
  SubcontractStatusBadge,
} from '@/components/subcontracts/SubcontractStatusBadge';
import { MetricTile, SubcontractCard, SubcontractPageShell, SubcontractSkeleton } from '@/components/subcontracts/SubcontractPageShell';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { dashboardMetrics } from '@/lib/subcontracts/calculate-draft';
import { formatDateAr, formatEgp } from '@/lib/subcontracts/money';
import type { SubcontractDetail } from '@/lib/subcontracts/types';
import { lazyNamedModal } from '@/components/ui/lazyModal';

const BulkBoqModal = lazyNamedModal(
  () => import('@/components/subcontracts/BulkBoqModal'),
  'BulkBoqModal',
  'جاري تحميل بنود المقايسة…'
);
const AddPenaltyModal = lazyNamedModal(
  () => import('@/components/subcontracts/AddPenaltyModal'),
  'AddPenaltyModal',
  'جاري تحميل غرامة المقاول…'
);
const MaterialReconciliationModal = lazyNamedModal(
  () => import('@/components/subcontracts/MaterialReconciliationModal'),
  'MaterialReconciliationModal',
  'جاري تحميل تسوية المواد…'
);
const ExcelImportModal = lazyNamedModal(
  () => import('@/components/contracting/ExcelImportModal'),
  'ExcelImportModal',
  'جاري تحميل استيراد Excel…'
);

export default function SubcontractDashboardPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const invalidate = useInvalidateQuery();
  const [boqOpen, setBoqOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);

  const { data, isLoading, isError } = useApiQuery<SubcontractDetail>(
    queryKeys.subcontracts.detail(id),
    `/subcontracts/${id}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(id) }
  );
  const subcontract = data?.data;
  const metrics = subcontract ? dashboardMetrics(subcontract) : null;

  const refresh = () => {
    invalidate(queryKeys.subcontracts.detail(id));
    invalidate(queryKeys.subcontracts.list());
  };

  return (
    <SubcontractPageShell>
      <PageHeader
        title={subcontract ? `عقد ${subcontract.subcontractNumber}` : 'عقد مقاول باطن'}
        breadcrumbs={[
          { label: 'مقاولو الباطن', href: '/subcontracts' },
          { label: subcontract?.subcontractNumber ?? 'تفاصيل' },
        ]}
        statusBadge={subcontract ? <SubcontractStatusBadge status={subcontract.status} /> : undefined}
        actions={
          subcontract?.status === 'ACTIVE' ? (
            <Link href={`/subcontracts/${id}/invoices/new`}>
              <Button iconStart={<FilePlus2 className="h-4 w-4" />}>مستخلص جديد</Button>
            </Link>
          ) : undefined
        }
      />

      {isLoading ? (
        <SubcontractSkeleton />
      ) : isError || !subcontract ? (
        <EmptyState title="تعذر تحميل العقد" description="قد لا يتوفر العقد على هذا الفرع أو الشركة." />
      ) : (
        <>
          <SubcontractCard>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">المقاول</p>
                <p className="text-lg font-bold text-[#094C6B]">{subcontract.subcontractor.nameAr}</p>
                <p className="text-sm text-slate-500">الرقم الضريبي: {subcontract.subcontractor.taxRegistrationNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">المشروع</p>
                <p className="text-lg font-bold text-[#094C6B]">
                  {subcontract.project.projectCode} — {subcontract.project.projectName}
                </p>
                <p className="text-sm text-slate-500">تاريخ العقد: {formatDateAr(subcontract.contractDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">قيمة العقد</p>
                <p className="text-lg font-bold text-[#0E79AA]">{formatEgp(subcontract.totalContractValue)}</p>
              </div>
            </div>
          </SubcontractCard>

          {metrics ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MetricTile label="إجمالي المستخلص حتى تاريخه" value={formatEgp(metrics.totalInvoiced)} />
              <MetricTile label="إجمالي استرداد المقدمة" value={formatEgp(metrics.advanceRecovered)} />
              <MetricTile label="رصيد تأمين حسن التنفيذ" value={formatEgp(metrics.retentionHeld)} />
              <MetricTile label="إجمالي الغرامات المخصومة" value={formatEgp(metrics.penaltiesDeducted)} />
              <MetricTile
                label="الرصيد المتبقي على العقد"
                value={formatEgp(metrics.remainingBalance)}
                tone={metrics.remainingBalance < 0 ? 'danger' : 'default'}
              />
            </div>
          ) : null}

          <SubcontractCard>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" iconStart={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setExcelOpen(true)}>
                استيراد Excel
              </Button>
              <Button variant="secondary" size="sm" iconStart={<ShieldAlert className="h-4 w-4" />} onClick={() => setPenaltyOpen(true)}>
                غرامة موقع
              </Button>
              <Button variant="secondary" size="sm" iconStart={<Warehouse className="h-4 w-4" />} onClick={() => setMaterialOpen(true)}>
                تسوية هوالك
              </Button>
            </div>
            <SubcontractBoqTable items={subcontract.boqItems} onImport={() => setBoqOpen(true)} />
          </SubcontractCard>

          <SubcontractCard>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0E79AA]">المستخلصات</h2>
            </div>
            {subcontract.invoices.length === 0 ? (
              <EmptyState title="لا توجد مستخلصات" description="أنشئ أول مستخلص بعد إدخال بنود المقايسة." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
                <table className="w-full text-center text-sm">
                  <thead>
                    <tr className="bg-[#F6FBFD] text-[#094C6B]">
                      <th className="px-3 py-2">الرقم</th>
                      <th className="px-3 py-2">الفترة</th>
                      <th className="px-3 py-2">إجمالي الأعمال</th>
                      <th className="px-3 py-2">الصافي</th>
                      <th className="px-3 py-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subcontract.invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <Link href={`/subcontracts/${id}/invoices/${invoice.id}`} className="text-[#0E79AA] underline">
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {formatDateAr(invoice.periodStartDate)} — {formatDateAr(invoice.periodEndDate)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{formatEgp(invoice.grossCurrentAmount)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatEgp(invoice.netPayableAmount)}</td>
                        <td className="px-3 py-2">
                          <InvoiceStatusBadge status={invoice.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SubcontractCard>

          <SubcontractCard>
            <AttachmentDropzone
              title="مستندات العقد القانونية"
              defaultCategory="CONTRACT_LEGAL_DOC"
              links={{
                subcontractId: subcontract.id,
                entityType: 'SUBCONTRACT',
                entityId: subcontract.id,
              }}
            />
          </SubcontractCard>

          {boqOpen ? (
            <BulkBoqModal open subcontractId={id} onClose={() => setBoqOpen(false)} onSaved={refresh} />
          ) : null}
          {excelOpen ? (
            <ExcelImportModal
              open
              mode="SUBCONTRACT_BOQ"
              projectId={subcontract.project.id}
              subcontractId={id}
              onClose={() => setExcelOpen(false)}
              onImported={refresh}
            />
          ) : null}
          {penaltyOpen ? (
            <AddPenaltyModal open subcontractId={id} onClose={() => setPenaltyOpen(false)} onCreated={refresh} />
          ) : null}
          {materialOpen ? (
            <MaterialReconciliationModal
              open
              subcontract={subcontract}
              onClose={() => setMaterialOpen(false)}
              onCreated={refresh}
            />
          ) : null}
        </>
      )}
    </SubcontractPageShell>
  );
}
