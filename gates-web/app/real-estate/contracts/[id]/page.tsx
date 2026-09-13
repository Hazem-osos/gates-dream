'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { ContractInstallmentsTable } from '@/components/real-estate/ContractInstallmentsTable';
import { RealEstatePageShell, ReCard, ReMetric, ReSkeleton } from '@/components/real-estate/RealEstatePageShell';
import { ContractStatusBadge, ResaleLockBadge } from '@/components/real-estate/StatusBadges';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatDateAr, formatEgp, toMoney } from '@/lib/real-estate/format';
import type { UnitContract, UnitContractListItem, UnitInstallment, InstallmentType } from '@/lib/real-estate/types';
import { usePrintDocument } from '@/lib/documentLayout/usePrintDocument';
import { resolveDocumentLayout } from '@/lib/documentLayout/useResolvedDocumentLayout';
import { realEstateReceiptToPreview } from '@/lib/documentLayout/fromDomain';
import { lazyNamedModal } from '@/components/ui/lazyModal';

const GenerateScheduleModal = lazyNamedModal(
  () => import('@/components/real-estate/GenerateScheduleModal'),
  'GenerateScheduleModal',
  'جاري تحميل جدول الأقساط…'
);
const SettlePaymentModal = lazyNamedModal(
  () => import('@/components/real-estate/SettlePaymentModal'),
  'SettlePaymentModal',
  'جاري تحميل تسوية القسط…'
);
const CancelContractModal = lazyNamedModal(
  () => import('@/components/real-estate/CancelContractModal'),
  'CancelContractModal',
  'جاري تحميل إلغاء العقد…'
);
const RequestResaleModal = lazyNamedModal(
  () => import('@/components/real-estate/RequestResaleModal'),
  'RequestResaleModal',
  'جاري تحميل طلب إعادة البيع…'
);

export default function ContractWorkspacePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const invalidate = useInvalidateQuery();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resaleOpen, setResaleOpen] = useState(false);
  const [settleRow, setSettleRow] = useState<UnitInstallment | null>(null);
  const { printDocument } = usePrintDocument();

  const { data, isLoading, isError } = useApiQuery<UnitContract>(
    queryKeys.realEstate.contract(id),
    `/real-estate/contracts/${id}`,
    undefined,
    { staleTime: staleTimes.transactionalMs, refetchOnWindowFocus: true, enabled: Boolean(id) }
  );
  const contract = data?.data;
  const listStub: UnitContractListItem[] = contract
    ? [{ id: contract.id, contractNumber: contract.contractNumber, contractDate: contract.contractDate, totalContractAmount: contract.totalContractAmount, status: contract.status, customer: contract.customer, unit: contract.unit }]
    : [];

  const refresh = () => {
    invalidate(queryKeys.realEstate.contract(id));
    invalidate(queryKeys.realEstate.contracts());
  };

  const projectName =
    contract?.propertyUnit?.phase?.project?.nameAr ||
    contract?.unit?.building?.project?.projectName ||
    contract?.propertyUnit?.phase?.nameAr ||
    '—';

  const scheduleBreakdown = useMemo(() => {
    if (!contract) return null;
    const byType = contract.installments.reduce<Partial<Record<InstallmentType, number>>>((acc, row) => {
      acc[row.installmentType] = (acc[row.installmentType] ?? 0) + toMoney(row.originalAmount || row.amount);
      return acc;
    }, {});
    const downFromContract = toMoney(contract.downPayment);
    const maintenanceFromContract = toMoney(contract.maintenanceDeposit || contract.maintenanceAmount);
    const contracting = byType.CONTRACTING_DOWNPAYMENT ?? 0;
    const reservation = byType.RESERVATION_DEPOSIT ?? 0;
    const maintenance = byType.MAINTENANCE_DEPOSIT ?? maintenanceFromContract;
    const delivery = byType.DELIVERY_PAYMENT ?? 0;
    const regular = byType.REGULAR_INSTALLMENT ?? 0;
    const downPayment = downFromContract || contracting + reservation;
    return { downPayment, maintenance, delivery, regular, reservation, contracting };
  }, [contract]);

  return (
    <RealEstatePageShell>
      <PageHeader
        title={contract ? `عقد ${contract.contractNumber}` : 'عقد الوحدة'}
        breadcrumbs={[
          { label: 'العقاري', href: '/real-estate' },
          { label: 'العقود', href: '/real-estate/contracts' },
          { label: contract?.contractNumber ?? 'تفاصيل' },
        ]}
        statusBadge={contract ? <ContractStatusBadge status={contract.status} /> : undefined}
        actions={
          contract && contract.status === 'ACTIVE' ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setScheduleOpen(true)}>توليد جدول الأقساط</Button>
              <Button size="sm" variant="secondary" onClick={() => setResaleOpen(true)}>طلب إعادة بيع</Button>
              <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>فسخ ومصادرة</Button>
            </div>
          ) : undefined
        }
      />

      {isLoading ? (
        <ReSkeleton />
      ) : isError || !contract ? (
        <EmptyState title="تعذر تحميل العقد" />
      ) : (
        <>
          <ReCard>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">كود الوحدة</p>
                <p className="text-lg font-bold">{contract.propertyUnit?.unitCode || contract.unit?.unitCode}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">المشروع / المرحلة</p>
                <p className="text-lg font-bold">{projectName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">المشتري</p>
                <p className="text-lg font-bold">{contract.customer?.arabicName}</p>
                <p className="text-xs text-slate-500">{contract.customer?.code}</p>
              </div>
              <div className="space-y-2">
                <ResaleLockBadge locked={contract.resaleLock} />
                <p className="text-xs text-slate-500">تاريخ العقد {formatDateAr(contract.contractDate)}</p>
              </div>
            </div>
          </ReCard>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ReMetric label="سعر البيع" value={formatEgp(contract.totalSellingPrice || contract.totalContractAmount)} />
            <ReMetric label="وديعة الصيانة" value={formatEgp(contract.maintenanceDeposit || contract.maintenanceAmount)} />
            <ReMetric label="المدفوع" value={formatEgp(contract.installments.reduce((sum, row) => sum + toMoney(row.paidAmount), 0))} />
            <ReMetric
              label="الرصيد المتبقي"
              value={formatEgp(contract.installments.reduce((sum, row) => sum + toMoney(row.balance), 0))}
            />
          </div>

          <ReCard>
            <h2 className="mb-1 text-lg font-bold text-[#0E79AA]">جدول الأقساط</h2>
            {scheduleBreakdown ? (
              <p className="mb-3 rounded-lg border border-[#D6EAF3] bg-[#0E79AA0D] px-3 py-2 text-xs leading-relaxed text-slate-600">
                <span className="font-semibold text-[#094C6B]">تركيب الجدول: </span>
                مقدم {formatEgp(scheduleBreakdown.downPayment)}
                {' · '}
                وديعة صيانة {formatEgp(scheduleBreakdown.maintenance)}
                {' · '}
                دفعة استلام {formatEgp(scheduleBreakdown.delivery)}
                {' · '}
                أقساط دورية {formatEgp(scheduleBreakdown.regular)}
                {scheduleBreakdown.reservation > 0 ? (
                  <> · عربون حجز {formatEgp(scheduleBreakdown.reservation)}</>
                ) : null}
                {scheduleBreakdown.contracting > 0 ? (
                  <> · دفعة تعاقد {formatEgp(scheduleBreakdown.contracting)}</>
                ) : null}
              </p>
            ) : null}
            <ContractInstallmentsTable
              rows={contract.installments}
              onSettle={setSettleRow}
              onPrintReceipt={(row) => {
                void (async () => {
                  const config = await resolveDocumentLayout('REAL_ESTATE_RECEIPT');
                  await printDocument(
                    realEstateReceiptToPreview(contract, row, {
                      amountPaidNow: toMoney(row.paidAmount),
                      paymentMethod: 'تسوية قسط',
                      receiptNo: `RCV-${row.installmentNumber}`,
                      documentDate: new Date().toISOString().slice(0, 10),
                    }),
                    config
                  );
                })();
              }}
            />
          </ReCard>

          {scheduleOpen ? (
            <GenerateScheduleModal open contract={contract} onClose={() => setScheduleOpen(false)} onSaved={refresh} />
          ) : null}
          {settleRow ? (
            <SettlePaymentModal
              open
              installment={settleRow}
              cheques={contract.postDatedCheques ?? []}
              onClose={() => setSettleRow(null)}
              onSettled={refresh}
            />
          ) : null}
          {cancelOpen ? (
            <CancelContractModal open contract={contract} onClose={() => setCancelOpen(false)} onSaved={refresh} />
          ) : null}
          {resaleOpen ? (
            <RequestResaleModal
              open
              contracts={listStub}
              defaultContractId={contract.id}
              onClose={() => setResaleOpen(false)}
              onSaved={refresh}
            />
          ) : null}
        </>
      )}
    </RealEstatePageShell>
  );
}
