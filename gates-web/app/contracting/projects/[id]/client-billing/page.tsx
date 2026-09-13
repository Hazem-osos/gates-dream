'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { FilePlus2, Warehouse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { lazyNamedModal } from '@/components/ui/lazyModal';
import { ClientInvoiceBuilder } from '@/components/contracting/ClientInvoiceBuilder';
import { AttachmentDropzone } from '@/components/attachments/AttachmentDropzone';
import { ClientInvoiceStepper } from '@/components/contracting/ClientInvoiceStepper';
import { MetricTile, ProjectCard } from '@/components/contracting/ContractingProjectPageShell';
import { ClientInvoiceStatusBadge, SiteStockStatusBadge } from '@/components/contracting/StatusBadges';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import type { DraftLine } from '@/lib/contracting/client-invoice-math';
import type {
  ClientContractDetail,
  ClientInvoice,
  ContractingProject,
  OwnerBoqItem,
  SiteStockMaterial,
} from '@/lib/contracting/types';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp, formatPercent, toMoney } from '@/lib/subcontracts/money';

const RegisterClientContractModal = lazyNamedModal(
  () => import('@/components/contracting/RegisterClientContractModal'),
  'RegisterClientContractModal',
  'جاري تحميل عقد المالك…'
);
const RecordSiteStockModal = lazyNamedModal(
  () => import('@/components/contracting/RecordSiteStockModal'),
  'RecordSiteStockModal',
  'جاري تحميل التشوين…'
);

export default function ClientBillingPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const invalidate = useInvalidateQuery();
  const [contractOpen, setContractOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [claimIds, setClaimIds] = useState<string[]>([]);
  const [installIds, setInstallIds] = useState<string[]>([]);
  const [penalties, setPenalties] = useState('0');
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);

  const projectQ = useApiQuery<ContractingProject>(
    queryKeys.contracting.project(projectId),
    `/contracting/projects/${projectId}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );
  const contractQ = useApiQuery<ClientContractDetail | null>(
    queryKeys.contracting.clientContract(projectId),
    `/contracting/client-billing/projects/${projectId}/contract`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );
  const boqQ = useApiQuery<OwnerBoqItem[]>(
    queryKeys.contracting.ownerBoq(projectId),
    `/contracting/technical-office/projects/${projectId}/boq`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );
  const stockQ = useApiQuery<SiteStockMaterial[]>(
    queryKeys.contracting.siteStock(projectId),
    `/contracting/client-billing/projects/${projectId}/site-stock`,
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(projectId) }
  );

  const project = projectQ.data?.data;
  const contract = contractQ.data?.data ?? null;
  const boqItems = boqQ.data?.data ?? [];
  const siteStock = stockQ.data?.data ?? [];
  const invoices = contract?.invoices ?? [];
  const activeInvoice = invoices.find((row) => row.id === activeInvoiceId) ?? invoices[invoices.length - 1] ?? null;
  const storedStock = useMemo(() => siteStock.filter((row) => row.status === 'STORED_ON_SITE'), [siteStock]);

  const refresh = () => {
    invalidate(queryKeys.contracting.clientContract(projectId));
    invalidate(queryKeys.contracting.siteStock(projectId));
    invalidate(queryKeys.contracting.ownerBoq(projectId));
    invalidate(queryKeys.contracting.evm(projectId));
  };

  const toggle = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((row) => row !== id) : [...list, id]);
  };

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!contract) throw new Error('missing contract');
      return apiClient.post<ClientInvoice>(`/contracting/client-billing/contracts/${contract.id}/invoices/draft`, {
        invoiceId: activeInvoice?.status === 'DRAFT' ? activeInvoice.id : undefined,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        items: boqItems.map((item) => ({
          projectBOQItemId: item.id,
          currentQuantity: lines.find((row) => row.projectBOQItemId === item.id)?.currentQuantity ?? 0,
        })),
        otherClientPenalties: toMoney(penalties),
        claimSiteStockMaterialIds: claimIds.length ? claimIds : storedStock.map((row) => row.id),
        installSiteStockMaterialIds: installIds,
      });
    },
    onSuccess: (res) => {
      notifyApiSuccess('تم حفظ مسودة مستخلص المالك');
      if (res.data?.id) setActiveInvoiceId(res.data.id);
      refresh();
    },
  });

  return (
    <div className="space-y-5">
      {!contract ? (
        <ProjectCard title="عقد المالك">
          <EmptyState
            title="لم يُسجَّل عقد مالك بعد"
            description="سجّل عقد المقاولة مع العميل لفتح مستخلصات المالك والتشوينات."
            action={<Button onClick={() => setContractOpen(true)}>تسجيل عقد المالك</Button>}
          />
        </ProjectCard>
      ) : (
        <>
          <ProjectCard title="ملخص عقد المالك">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricTile label="رقم العقد" value={contract.contractNumber} />
              <MetricTile label="العميل" value={contract.client?.arabicName ?? '—'} />
              <MetricTile label="قيمة العقد" value={formatEgp(contract.totalContractValue)} />
              <MetricTile label="الدفعة المقدمة" value={formatEgp(contract.advancePaymentAmount)} />
              <MetricTile label="استرداد المقدمة" value={formatPercent(toMoney(contract.advanceRecoveryRate) * 100)} />
              <MetricTile label="تأمين حسن التنفيذ" value={formatPercent(toMoney(contract.retentionRate) * 100)} />
              <MetricTile label="دمغات هندسية" value={formatPercent(toMoney(contract.engineeringStampsRate) * 100)} />
              <MetricTile
                label="نسبة الفوترة"
                value={formatPercent(toMoney(contract.billingProgress?.billingProgressRate) * 100)}
              />
            </div>
          </ProjectCard>

          <ProjectCard
            title="تشوينات الموقع"
            actions={
              <Button size="sm" variant="secondary" iconStart={<Warehouse className="h-4 w-4" />} onClick={() => setStockOpen(true)}>
                تسجيل تشوين
              </Button>
            }
          >
            {stockQ.isLoading ? (
              <TableSkeleton rows={3} columns={6} />
            ) : siteStock.length === 0 ? (
              <EmptyState title="لا توجد تشوينات" description="سجّل خامات مسلّمة للموقع لاعتماد نسبة منها في المستخلص." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
                <table className="w-full min-w-[820px] text-center text-sm">
                  <thead>
                    <tr className="bg-[#F6FBFD] text-[#094C6B]">
                      <th className="px-3 py-2">الخامة</th>
                      <th className="px-3 py-2">تاريخ التسليم</th>
                      <th className="px-3 py-2">إذن التسليم</th>
                      <th className="px-3 py-2">الكمية</th>
                      <th className="px-3 py-2">سعر الوحدة</th>
                      <th className="px-3 py-2">نسبة الاعتماد</th>
                      <th className="px-3 py-2">صافي المطالبة</th>
                      <th className="px-3 py-2">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteStock.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-start">{row.materialDescription}</td>
                        <td className="px-3 py-2">{formatDateAr(row.deliveryDate)}</td>
                        <td className="px-3 py-2">{row.warehouseReceiptRef ?? '—'}</td>
                        <td className="px-3 py-2 tabular-nums">{toMoney(row.deliveredQuantity)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatEgp(row.unitPrice)}</td>
                        <td className="px-3 py-2 tabular-nums">{formatPercent(toMoney(row.approvedPercentage) * 100)}</td>
                        <td className="px-3 py-2 tabular-nums font-semibold">{formatEgp(row.netClaimedAmount)}</td>
                        <td className="px-3 py-2">
                          <SiteStockStatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ProjectCard>

          <ProjectCard
            title="مستخلص المالك"
            actions={
              <Button
                size="sm"
                iconStart={<FilePlus2 className="h-4 w-4" />}
                isLoading={saveDraft.isPending}
                onClick={() => saveDraft.mutate()}
              >
                حفظ المسودة
              </Button>
            }
          >
            {boqQ.isLoading ? (
              <TableSkeleton rows={5} columns={7} />
            ) : (
              <ClientInvoiceBuilder
                contract={contract}
                boqItems={boqItems}
                siteStock={siteStock}
                periodStart={periodStart}
                periodEnd={periodEnd}
                lines={lines}
                claimIds={claimIds.length ? claimIds : storedStock.map((row) => row.id)}
                installIds={installIds}
                penalties={penalties}
                onPeriodStart={setPeriodStart}
                onPeriodEnd={setPeriodEnd}
                onLineQty={(id, qty) =>
                  setLines((prev) => {
                    const next = prev.filter((row) => row.projectBOQItemId !== id);
                    next.push({ projectBOQItemId: id, currentQuantity: qty });
                    return next;
                  })
                }
                onToggleClaim={(id) => toggle(id, claimIds.length ? claimIds : storedStock.map((r) => r.id), setClaimIds)}
                onToggleInstall={(id) => toggle(id, installIds, setInstallIds)}
                onPenalties={setPenalties}
              />
            )}
          </ProjectCard>

          <ProjectCard title="سير الاعتماد والترحيل">
            {invoices.length === 0 ? (
              <EmptyState title="لا توجد مستخلصات بعد" description="احفظ مسودة المستخلص لبدء مسار الاعتماد." />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {invoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => setActiveInvoiceId(invoice.id)}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${
                        activeInvoice?.id === invoice.id ? 'border-[#0E79AA] bg-[#F0F7FB]' : 'border-slate-200'
                      }`}
                    >
                      {invoice.invoiceNumber} <ClientInvoiceStatusBadge status={invoice.status} />
                    </button>
                  ))}
                </div>
                {activeInvoice ? (
                  <>
                    <ClientInvoiceStepper
                      contract={contract}
                      invoice={activeInvoice}
                      boqItems={boqItems}
                      onChanged={refresh}
                    />
                    <AttachmentDropzone
                      title="مرفقات مستخلص المالك"
                      defaultCategory="SIGNED_INVOICE_COPY"
                      links={{
                        clientContractId: contract.id,
                        clientInvoiceId: activeInvoice.id,
                        entityType: 'CLIENT_INVOICE',
                        entityId: activeInvoice.id,
                      }}
                    />
                  </>
                ) : null}
              </div>
            )}
          </ProjectCard>
        </>
      )}

      {contractOpen ? (
        <RegisterClientContractModal
          open
          projectId={projectId}
          defaultCustomerId={project?.customerId}
          defaultValue={project?.contractValue}
          onClose={() => setContractOpen(false)}
          onCreated={refresh}
        />
      ) : null}
      {stockOpen ? (
        <RecordSiteStockModal open projectId={projectId} onClose={() => setStockOpen(false)} onCreated={refresh} />
      ) : null}
    </div>
  );
}
