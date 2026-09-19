'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompactFormField, StatusBadge, compactControlClass, type StatusTone } from '@/components/ui';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiQuery } from '@/lib/hooks/useApi';
import { lazyDefaultModal } from '@/components/ui/lazyModal';
import {
  ManufacturingPageChrome,
  MfgEmptyRow,
  MfgField,
  MfgFilterCard,
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgThClass,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
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
};

const STAGE: Record<string, { label: string; tone: StatusTone }> = {
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
  const [tab, setTab] = useState<'all' | 'check'>('all');
  const [showCheck, setShowCheck] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const { data, isLoading } = useApiQuery<ProductionOrderRow[]>(
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
    <ManufacturingPageChrome
      title="خطة التصنيع"
      statusLabel="خطة"
      favoriteHref="/manufacturing/creations/manufacturing-plan"
      hideSave
    >
      <MfgFilterCard className="xl:grid-cols-4">
        <CompactFormField
          label="المسلسل"
          placeholder="رقم الأمر"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <CompactFormField
          label="النموذج / الصنف"
          placeholder="ابحث بالنموذج"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <MfgField label="العرض">
          <select
            className={compactControlClass}
            value={tab}
            onChange={(e) => {
              const next = e.target.value as 'all' | 'check';
              setTab(next);
              if (next === 'check') setShowCheck(true);
            }}
          >
            <option value="all">تصنيع</option>
            <option value="check">فحص الكميات</option>
          </select>
        </MfgField>
        <MfgField label="إجراء سريع">
          <button
            type="button"
            className={compactControlClass}
            onClick={() => router.push('/inventory/operations/transfer')}
          >
            نقل مخزني
          </button>
        </MfgField>
      </MfgFilterCard>

      <MfgTableCard title={`تفاصيل الخطة (${total})`}>
        <table className={mfgTableClass}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThClass}>الرقم</th>
              <th className={mfgThClass}>التاريخ</th>
              <th className={mfgThClass}>النموذج</th>
              <th className={mfgThClass}>المرحلة</th>
              <th className={`${mfgThClass} text-left`}>الكمية</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <MfgEmptyRow colSpan={5}>جاري التحميل…</MfgEmptyRow>
            ) : rows.length === 0 ? (
              <MfgEmptyRow colSpan={5}>لا توجد أوامر إنتاج</MfgEmptyRow>
            ) : (
              rows.map((row) => {
                const stage = STAGE[row.status] ?? { label: row.status, tone: 'neutral' as const };
                return (
                  <tr
                    key={row.id}
                    className={`${mfgTrClass} cursor-pointer`}
                    onClick={() => router.push('/manufacturing/operations/operation')}
                  >
                    <td className={`${mfgTdClass} font-mono font-semibold`}>{row.orderNumber}</td>
                    <td className={mfgTdClass}>{new Date(row.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td className={mfgTdClass}>{row.finishedItem?.arabicName ?? row.bom?.name ?? '—'}</td>
                    <td className={mfgTdClass}>
                      <StatusBadge compact label={stage.label} tone={stage.tone} />
                    </td>
                    <td className={`${mfgTdClass} text-left tabular-nums`}>{String(row.plannedQuantity ?? '—')}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </MfgTableCard>
      {showCheck ? <CheckQuantitiesModal isOpen onClose={() => setShowCheck(false)} /> : null}
    </ManufacturingPageChrome>
  );
}
