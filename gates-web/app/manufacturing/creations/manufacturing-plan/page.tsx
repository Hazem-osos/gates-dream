'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import { lazyDefaultModal } from '@/components/ui/lazyModal';
import {
  CommandCenter,
  DataGridDense,
  StatusDotPill,
  DASH_NUM,
  HUD_BTN_GHOST,
  HUD_SEGMENT,
  HUD_SEGMENT_ON,
  HUD_SEGMENT_OFF,
} from '@/components/dashboard-primitives';
import type { StatusDotTone } from '@/components/dashboard-primitives';

const CheckQuantitiesModal = lazyDefaultModal(
  () => import('@/components/CheckQuantitiesModal'),
  'جاري تحميل فحص الكميات…'
);

type ProductionOrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  plannedQuantity: number | string;
  createdAt: string;
  bom?: { name?: string };
  finishedItem?: { arabicName?: string; serial?: string };
  warehouseIdRaw?: string;
};

const STAGE: Record<string, { label: string; tone: StatusDotTone }> = {
  DRAFT: { label: 'مسودة', tone: 'warning' },
  RELEASED: { label: 'صرف خامات', tone: 'warning' },
  IN_PROGRESS: { label: 'تشغيل', tone: 'info' },
  COMPLETED: { label: 'تام', tone: 'success' },
  CANCELLED: { label: 'ملغى', tone: 'danger' },
};

export default function ManufacturingPlanPage() {
  useBackendReachability();
  const router = useRouter();
  const [serial, setSerial] = useState('');
  const [model, setModel] = useState('');
  const [tab, setTab] = useState<'all' | 'check' | 'transfer'>('all');
  const [showCheck, setShowCheck] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const { data, isLoading, isFetching, refetch } = useApiQuery<ProductionOrderRow[]>(
    ['manufacturing-orders', page],
    '/manufacturing/orders',
    { page, limit: pageSize }
  );
  const orders = useMemo(() => data?.data ?? [], [data?.data]);
  const total = data?.pagination?.total ?? data?.meta?.total ?? orders.length;

  useEffect(() => {
    setPage(1);
  }, [serial, model]);

  const rows = useMemo(
    () =>
      orders.filter((row) => {
        if (serial && !row.orderNumber.includes(serial)) return false;
        if (
          model &&
          !(row.bom?.name ?? '').includes(model) &&
          !(row.finishedItem?.arabicName ?? '').includes(model)
        ) {
          return false;
        }
        return true;
      }),
    [orders, serial, model]
  );

  return (
    <CommandCenter
      title="خطة التصنيع"
      module="MFG / PLAN"
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      shortcuts={[
        { key: 'F2', label: 'أمر تشغيل', href: '/manufacturing/operations/operation' },
        { key: 'F8', label: 'التشغيل', href: '/manufacturing' },
      ]}
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="المسلسل"
            className={`${HUD_BTN_GHOST} w-36 px-3 text-right`}
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="النموذج / الصنف"
            className={`${HUD_BTN_GHOST} w-40 px-3 text-right`}
          />
          <div className={HUD_SEGMENT} role="group" aria-label="عرض الخطة">
            <button
              type="button"
              className={tab === 'all' ? HUD_SEGMENT_ON : HUD_SEGMENT_OFF}
              onClick={() => setTab('all')}
            >
              تصنيع
            </button>
            <button
              type="button"
              className={tab === 'check' ? HUD_SEGMENT_ON : HUD_SEGMENT_OFF}
              onClick={() => {
                setTab('check');
                setShowCheck(true);
              }}
            >
              فحص الكميات
            </button>
          </div>
          <button
            type="button"
            className={HUD_BTN_GHOST}
            onClick={() => router.push('/inventory/operations/transfer')}
          >
            نقل مخزني
          </button>
        </div>
      }
    >
      <DataGridDense
        title={`تفاصيل الخطة (${total})`}
        loading={isLoading}
        rows={rows}
        empty="لا توجد أوامر إنتاج"
        emptyActionHref="/manufacturing/operations/operation"
        emptyActionLabel="أمر تشغيل"
        onRowOpen={() => router.push('/manufacturing/operations/operation')}
        columns={[
          {
            id: 'no',
            header: 'الرقم',
            cell: (r) => <span className={DASH_NUM}>{r.orderNumber}</span>,
          },
          {
            id: 'date',
            header: 'التاريخ',
            cell: (r) => new Date(r.createdAt).toLocaleDateString('ar-EG'),
          },
          {
            id: 'model',
            header: 'النموذج',
            cell: (r) => r.finishedItem?.arabicName ?? r.bom?.name ?? '—',
          },
          {
            id: 'st',
            header: 'المرحلة',
            cell: (r) => {
              const stage = STAGE[r.status] ?? { label: r.status, tone: 'neutral' as const };
              return <StatusDotPill label={stage.label} tone={stage.tone} />;
            },
          },
          {
            id: 'qty',
            header: 'الكمية',
            numeric: true,
            cell: (r) => String(r.plannedQuantity ?? '—'),
          },
        ]}
      />
      {showCheck ? <CheckQuantitiesModal isOpen onClose={() => setShowCheck(false)} /> : null}
    </CommandCenter>
  );
}
