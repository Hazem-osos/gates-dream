'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppTable, Button, StatusBadge } from '@/app/components/ui';
import { FixedAssetForm } from '@/components/fixed-assets/FixedAssetForm';
import { DisposalForm } from '@/components/fixed-assets/DisposalForm';
import { FixedAssetsPage, StatCard } from '@/components/fixed-assets/shared';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import {
  STATUS_LABELS,
  STATUS_VARIANT,
  formatDay,
  formatMoney,
  journalHref,
  type AssetSchedule,
  type FixedAsset,
  type ScheduleLine,
} from '@/lib/fixed-assets/types';

type Tab = 'data' | 'schedule' | 'disposal';

export default function FixedAssetCardPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? '');
  const router = useRouter();
  const invalidate = useInvalidateQuery();
  const [tab, setTab] = useState<Tab>('data');
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useApiQuery<FixedAsset>(queryKeys.fixedAssets.asset(id), `/fixed-assets/assets/${id}`, undefined, {
    enabled: Boolean(id),
    staleTime: 0,
  });
  const { data: scheduleRes } = useApiQuery<AssetSchedule>(
    queryKeys.fixedAssets.schedule(id),
    `/fixed-assets/assets/${id}/schedule`,
    undefined,
    { enabled: Boolean(id) && tab === 'schedule', staleTime: 0 }
  );
  const asset = data?.data;
  const schedule = scheduleRes?.data;

  const refresh = () => invalidate(queryKeys.fixedAssets.all);

  const act = async (path: string, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await apiClient.post(`/fixed-assets/assets/${id}/${path}`);
      refresh();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('حذف هذا الأصل نهائيًا؟')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/fixed-assets/assets/${id}`);
      refresh();
      router.push('/fixed-assets/assets');
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !asset) {
    return (
      <FixedAssetsPage title="بطاقة أصل" crumb={[{ label: 'سجل الأصول', href: '/fixed-assets/assets' }, { label: 'بطاقة أصل' }]}>
        <div className="p-6 text-sm text-foreground-muted">{isLoading ? 'جارٍ التحميل…' : 'الأصل غير موجود'}</div>
      </FixedAssetsPage>
    );
  }

  const inService = asset.status === 'ACTIVE' || asset.status === 'FULLY_DEPRECIATED';
  const actions = (
    <div className="flex flex-wrap gap-2">
      {asset.status === 'DRAFT' ? (
        <>
          <Button
            disabled={busy}
            onClick={() =>
              act(
                'activate',
                asset.acquisitionType === 'PURCHASE'
                  ? 'تفعيل الأصل وترحيل قيد الشراء؟'
                  : 'تفعيل الأصل بدون قيد (التكلفة مسجلة في الحسابات مسبقًا)؟'
              )
            }
          >
            تفعيل الأصل
          </Button>
          <Button variant="danger" disabled={busy} onClick={remove}>
            حذف
          </Button>
        </>
      ) : null}
      {inService ? (
        <Button variant="secondary" disabled={busy} onClick={() => act('deactivate', 'إلغاء تفعيل الأصل وإلغاء ترحيل قيد الشراء؟')}>
          إلغاء التفعيل
        </Button>
      ) : null}
    </div>
  );

  const tabs: Array<{ key: Tab; label: string; show: boolean }> = [
    { key: 'data', label: 'البيانات', show: true },
    { key: 'schedule', label: 'جدول الإهلاك', show: true },
    { key: 'disposal', label: 'بيع / استبعاد', show: inService || asset.status === 'DISPOSED' },
  ];

  return (
    <FixedAssetsPage
      title={`${asset.code} — ${asset.arabicName}`}
      crumb={[{ label: 'سجل الأصول', href: '/fixed-assets/assets' }, { label: asset.code }]}
      actions={actions}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge variant={STATUS_VARIANT[asset.status]} label={STATUS_LABELS[asset.status]} />
        <span className="text-foreground-muted">الفئة: {asset.category?.arabicName ?? '—'}</span>
        {asset.journal ? (
          <Link className="text-brand underline" href={journalHref(asset.journal.id)}>
            قيد الشراء رقم {asset.journal.voucherNumber}
            {asset.journal.isPosted ? '' : ' (غير مرحل)'}
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="التكلفة" value={formatMoney(asset.cost)} />
        <StatCard label="مجمع الإهلاك" value={formatMoney(asset.accumulatedDepreciation)} hint={`حتى ${formatDay(asset.depreciatedThrough)}`} />
        <StatCard label="صافي القيمة الدفترية" value={formatMoney(asset.bookValue)} />
        <StatCard label="القيمة التخريدية" value={formatMoney(asset.salvageValue)} hint={`العمر ${asset.usefulLifeMonths / 12} سنة`} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-semibold ${tab === t.key ? 'border-b-2 border-brand text-brand' : 'text-foreground-muted'}`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === 'data' ? <FixedAssetForm key={`${asset.id}-${asset.version}`} asset={asset} onSaved={refresh} /> : null}

      {tab === 'schedule' ? <ScheduleView schedule={schedule} /> : null}

      {tab === 'disposal' ? (
        asset.status === 'DISPOSED' ? (
          <div className="rounded-xl border border-border bg-surface-1 p-4 text-sm">
            الأصل مستبعد. لإلغاء الاستبعاد افتح{' '}
            <Link className="text-brand underline" href="/fixed-assets/disposals">
              بيع واستبعاد الأصول
            </Link>
            .
          </div>
        ) : (
          <DisposalForm assetId={asset.id} onPosted={refresh} />
        )
      ) : null}
    </FixedAssetsPage>
  );
}

function ScheduleView({ schedule }: { schedule?: AssetSchedule }) {
  if (!schedule) return <div className="p-4 text-sm text-foreground-muted">جارٍ التحميل…</div>;
  const columns = [
    { id: 'period', header: 'الشهر', cell: (r: ScheduleLine) => formatDay(r.periodEnd) },
    { id: 'amount', header: 'الإهلاك', numeric: true, cell: (r: ScheduleLine) => formatMoney(r.amount) },
    { id: 'acc', header: 'المجمع بعده', numeric: true, cell: (r: ScheduleLine) => formatMoney(r.accumulatedAfter) },
    { id: 'nbv', header: 'صافي القيمة', numeric: true, cell: (r: ScheduleLine) => formatMoney(r.bookValueAfter) },
  ];
  return (
    <div className="space-y-4">
      {schedule.openingAccumulatedDepreciation > 0 ? (
        <p className="text-sm text-foreground-muted">
          مجمع إهلاك سابق قبل البرنامج: {formatMoney(schedule.openingAccumulatedDepreciation)} حتى{' '}
          {formatDay(schedule.openingDepreciatedThrough)}
        </p>
      ) : null}
      <section>
        <h3 className="mb-2 text-sm font-bold">الإهلاك المرحل</h3>
        <AppTable<ScheduleLine>
          data={schedule.actual}
          getRowKey={(r) => `a-${r.periodEnd}`}
          emptyTitle="لم يُرحل إهلاك على هذا الأصل بعد"
          columns={[...columns, { id: 'run', header: 'رقم التشغيل', cell: (r: ScheduleLine) => r.runNumber ?? '' }]}
        />
      </section>
      {schedule.disposal ? (
        <p className="text-sm">
          استُبعد بالمستند {schedule.disposal.disposalNumber} بتاريخ {formatDay(schedule.disposal.disposalDate)} — إهلاك حتى تاريخ
          الاستبعاد {formatMoney(schedule.disposal.catchUpDepreciation)} ({schedule.disposal.catchUpMonths} شهر)،{' '}
          {schedule.disposal.gainLoss >= 0 ? 'ربح' : 'خسارة'} {formatMoney(Math.abs(schedule.disposal.gainLoss))}
        </p>
      ) : null}
      {schedule.projected.length ? (
        <section>
          <h3 className="mb-2 text-sm font-bold">الإهلاك المتوقع (تقديري)</h3>
          <AppTable<ScheduleLine>
            data={schedule.projected}
            getRowKey={(r) => `p-${r.periodEnd}`}
            columns={columns}
            exportFileName="fixed-asset-schedule"
          />
        </section>
      ) : null}
    </div>
  );
}
