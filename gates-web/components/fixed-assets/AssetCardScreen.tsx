'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { DocumentBrowseDrawer, ErpDocumentBottomSplit, MasterCardShell } from '@/components/erp';
import { AssetCardFields, assetFormFrom, assetPayload, type AssetForm } from '@/components/fixed-assets/FixedAssetForm';
import { AssetBrowseList, FA_CRUMB } from '@/components/fixed-assets/shared';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import {
  STATUS_LABELS,
  formatDay,
  formatMoney,
  toNumber,
  type AssetSchedule,
  type FixedAsset,
  type ScheduleLine,
} from '@/lib/fixed-assets/types';

function ScheduleTable({ schedule }: { schedule?: AssetSchedule }) {
  if (!schedule) return <p className="py-6 text-center text-xs text-slate-500">جارٍ التحميل…</p>;
  const rows: Array<ScheduleLine & { kind: 'actual' | 'projected' }> = [
    ...schedule.actual.map((l) => ({ ...l, kind: 'actual' as const })),
    ...schedule.projected.map((l) => ({ ...l, kind: 'projected' as const })),
  ];
  if (!rows.length) return <p className="py-6 text-center text-xs text-slate-500">لا يوجد إهلاك لهذا الأصل</p>;
  return (
    <div className="space-y-2">
      {schedule.openingAccumulatedDepreciation > 0 ? (
        <p className="text-xs text-slate-500">
          مجمع سابق قبل البرنامج: {formatMoney(schedule.openingAccumulatedDepreciation)} حتى {formatDay(schedule.openingDepreciatedThrough)}
        </p>
      ) : null}
      {schedule.disposal ? (
        <p className="text-xs text-slate-600">
          مستبعد بالمستند {schedule.disposal.disposalNumber} في {formatDay(schedule.disposal.disposalDate)} — إهلاك حتى التاريخ{' '}
          {formatMoney(schedule.disposal.catchUpDepreciation)}، {schedule.disposal.gainLoss >= 0 ? 'ربح' : 'خسارة'}{' '}
          {formatMoney(Math.abs(schedule.disposal.gainLoss))}
        </p>
      ) : null}
      <table className="w-full min-w-[480px] text-xs">
        <thead className="bg-[#F6FBFD] text-[#094C6B]">
          <tr>
            <th className="p-2 text-start font-semibold">الشهر</th>
            <th className="p-2 text-end font-semibold">الإهلاك</th>
            <th className="p-2 text-end font-semibold">المجمع بعده</th>
            <th className="p-2 text-end font-semibold">صافي القيمة</th>
            <th className="p-2 text-start font-semibold">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.periodEnd}`} className={`border-t border-[#E8F1F6] ${r.kind === 'projected' ? 'text-slate-500' : ''}`}>
              <td className="p-2">{formatDay(r.periodEnd)}</td>
              <td className="p-2 text-end tabular-nums">{formatMoney(r.amount)}</td>
              <td className="p-2 text-end tabular-nums">{formatMoney(r.accumulatedAfter)}</td>
              <td className="p-2 text-end tabular-nums">{formatMoney(r.bookValueAfter)}</td>
              <td className="p-2">{r.kind === 'actual' ? `مرحل ${r.runNumber ?? ''}` : 'متوقع'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AssetCardScreen({ assetId }: { assetId?: string }) {
  const router = useRouter();
  const invalidate = useInvalidateQuery();
  const [browseOpen, setBrowseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bottomTab, setBottomTab] = useState<string | undefined>(undefined);

  const { data, isLoading } = useApiQuery<FixedAsset>(
    queryKeys.fixedAssets.asset(assetId ?? 'new'),
    `/fixed-assets/assets/${assetId}`,
    undefined,
    { enabled: Boolean(assetId), staleTime: 0 }
  );
  const asset = assetId ? data?.data ?? null : null;
  const { data: scheduleRes } = useApiQuery<AssetSchedule>(
    queryKeys.fixedAssets.schedule(assetId ?? 'new'),
    `/fixed-assets/assets/${assetId}/schedule`,
    undefined,
    { enabled: Boolean(assetId), staleTime: 0 }
  );

  const [form, setForm] = useState<AssetForm>(() => assetFormFrom(null));
  useEffect(() => {
    setForm(assetFormFrom(asset));
    // Reload the form only when another version of the asset arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, asset?.version]);

  const refresh = () => invalidate(queryKeys.fixedAssets.all);

  const save = async () => {
    setSaving(true);
    try {
      if (asset) {
        await apiClient.put<FixedAsset>(`/fixed-assets/assets/${asset.id}`, assetPayload(form, asset));
        refresh();
      } else {
        const res = await apiClient.post<FixedAsset>('/fixed-assets/assets', assetPayload(form));
        refresh();
        if (res.data?.id) router.replace(`/fixed-assets/assets/${res.data.id}`);
      }
    } catch {
      /* the API client shows the error */
    } finally {
      setSaving(false);
    }
  };

  const act = async (path: 'activate' | 'deactivate', question: string) => {
    if (!asset || !window.confirm(question)) return;
    setBusy(true);
    try {
      await apiClient.post(`/fixed-assets/assets/${asset.id}/${path}`);
      refresh();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!asset || !window.confirm(`حذف الأصل ${asset.code}؟`)) return;
    try {
      await apiClient.delete(`/fixed-assets/assets/${asset.id}`);
      refresh();
      router.replace('/fixed-assets/assets/new');
    } catch {
      /* shown by the API client */
    }
  };

  const status = asset?.status;
  const inService = status === 'ACTIVE' || status === 'FULLY_DEPRECIATED';
  const activateQuestion =
    asset?.acquisitionType === 'PURCHASE'
      ? 'تفعيل الأصل وترحيل قيد الشراء؟'
      : 'تفعيل الأصل بدون قيد (التكلفة مسجلة في الحسابات مسبقًا)؟';

  const menuItems = [
    ...(inService
      ? [
          {
            id: 'dispose',
            label: 'بيع / استبعاد الأصل',
            onClick: () => router.push(`/fixed-assets/disposals?assetId=${asset!.id}`),
          },
          {
            id: 'deactivate',
            label: 'إلغاء التفعيل',
            onClick: () => void act('deactivate', 'إلغاء تفعيل الأصل وإلغاء ترحيل قيد الشراء في مكانه؟'),
            disabled: busy,
          },
        ]
      : []),
    ...(asset ? [{ id: 'register', label: 'سجل الأصول', onClick: () => router.push('/fixed-assets/assets') }] : []),
  ];

  const cost = toNumber(asset?.cost ?? form.cost);
  const accumulated = toNumber(asset?.accumulatedDepreciation ?? form.openingAccumulatedDepreciation);
  const salvage = toNumber(asset?.salvageValue ?? form.salvageValue);

  return (
    <MasterCardShell
      title="بطاقة أصل ثابت"
      breadcrumbs={[FA_CRUMB, { label: 'سجل الأصول', href: '/fixed-assets/assets' }, { label: 'بطاقة أصل' }]}
      docNumber={asset?.code || 'جديد'}
      statusLabel={status ? STATUS_LABELS[status] : 'جديد'}
      onSave={() => void save()}
      savePending={saving}
      canSave={!saving && !(assetId && isLoading)}
      onNew={() => router.push('/fixed-assets/assets/new')}
      onDelete={() => void remove()}
      deleteDisabled={!asset || status !== 'DRAFT'}
      currentId={asset?.id ?? null}
      onBrowseList={() => setBrowseOpen(true)}
      moreMenuItems={menuItems}
      favoriteHref="/fixed-assets/assets/new"
      extraActions={
        status === 'DRAFT' ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={formActionButtonClass}
            disabled={busy}
            onClick={() => void act('activate', activateQuestion)}
          >
            تفعيل الأصل
          </Button>
        ) : null
      }
    >
      {assetId && isLoading ? (
        <p className="p-6 text-sm text-slate-500">جارٍ تحميل الأصل…</p>
      ) : (
        <>
          <AssetCardFields form={form} asset={asset} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
          {asset ? (
            <ErpDocumentBottomSplit
              financialRows={[
                { label: 'التكلفة', value: cost },
                { label: 'مجمع الإهلاك', value: -accumulated },
                { label: 'القيمة التخريدية', value: salvage, show: salvage > 0 },
                { label: 'ضريبة المدخلات', value: toNumber(asset.vatAmount), show: toNumber(asset.vatAmount) > 0 },
              ]}
              netAmount={toNumber(asset.bookValue)}
              netLabel="صافي القيمة الدفترية"
              showTafqeet={false}
              highlightHeader={
                <p className="mb-1 text-xs text-slate-500">
                  مُهلك حتى {formatDay(asset.depreciatedThrough)} — العمر {asset.usefulLifeMonths / 12} سنة
                </p>
              }
              journalEntryId={asset.journalEntryId ?? null}
              showJournalTab={Boolean(asset.journalEntryId)}
              journalEmptyTitle="لا يوجد قيد شراء (أصل مسجل مسبقًا)"
              activeTabId={bottomTab ?? (asset.journalEntryId ? 'gl' : 'schedule')}
              onActiveTabChange={setBottomTab}
              tabs={[{ id: 'schedule', label: 'جدول الإهلاك', content: <ScheduleTable schedule={scheduleRes?.data} /> }]}
            />
          ) : null}
        </>
      )}

      <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="الأصول السابقة">
        <AssetBrowseList
          selectedId={asset?.id}
          onSelect={(row) => {
            setBrowseOpen(false);
            router.push(`/fixed-assets/assets/${row.id}`);
          }}
        />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}
