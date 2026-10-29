'use client';

import { useMemo, useState } from 'react';
import { Calculator, ListChecks } from 'lucide-react';
import { AppTable, Button, CompactFormField, FormSectionCard, StatusBadge, compactControlClass } from '@/components/ui';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import {
  DocumentBrowseDrawer,
  ErpDocumentBottomSplit,
  ErpDocumentLayout,
  ErpDocumentPageHeader,
  ErpFormHeaderCard,
} from '@/components/erp';
import { FA_CRUMB, JournalPreviewTable } from '@/components/fixed-assets/shared';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import {
  formatDay,
  formatMoney,
  lastMonthEndIso,
  toNumber,
  type DepreciationRun,
  type RunPreview,
} from '@/lib/fixed-assets/types';

type AssetRow = { assetId: string; code: string; name: string; months: number; amount: number; accumulatedAfter: number };

export default function DepreciationRunPage() {
  const invalidate = useInvalidateQuery();
  const [runId, setRunId] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState(lastMonthEndIso());
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<RunPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  const { data: runsRes, isLoading: runsLoading } = useApiQuery<DepreciationRun[]>(
    queryKeys.fixedAssets.runs(),
    '/fixed-assets/depreciation-runs',
    undefined,
    { staleTime: 0 }
  );
  const { data: runRes } = useApiQuery<DepreciationRun>(
    queryKeys.fixedAssets.run(runId ?? 'new'),
    `/fixed-assets/depreciation-runs/${runId}`,
    undefined,
    { enabled: Boolean(runId), staleTime: 0 }
  );
  const run = runId ? runRes?.data ?? null : null;
  const runs = runsRes?.data ?? [];

  const assetRows: AssetRow[] = useMemo(() => {
    if (!run) return preview?.assets ?? [];
    const byAsset = new Map<string, AssetRow>();
    for (const line of run.lines ?? []) {
      const row = byAsset.get(line.asset.id) ?? {
        assetId: line.asset.id,
        code: line.asset.code,
        name: line.asset.arabicName,
        months: 0,
        amount: 0,
        accumulatedAfter: 0,
      };
      row.months += 1;
      row.amount = Math.round((row.amount + toNumber(line.amount)) * 10000) / 10000;
      row.accumulatedAfter = toNumber(line.accumulatedAfter);
      byAsset.set(line.asset.id, row);
    }
    return [...byAsset.values()];
  }, [run, preview]);

  const total = run ? toNumber(run.totalAmount) : preview?.totalAmount ?? 0;
  const monthCount = assetRows.reduce((s, r) => s + r.months, 0);

  const refresh = () => invalidate(queryKeys.fixedAssets.all);

  const startNew = () => {
    setRunId(null);
    setPreview(null);
    setNotes('');
    setPeriodEnd(lastMonthEndIso());
  };

  const calculate = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post<RunPreview>('/fixed-assets/depreciation-runs/preview', { periodEnd }, { skipSuccessNotify: true });
      setPreview(res.data ?? null);
    } catch {
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const post = async () => {
    setBusy(true);
    try {
      if (run && run.status === 'UNPOSTED') {
        await apiClient.post(`/fixed-assets/depreciation-runs/${run.id}/repost`);
      } else {
        if (!window.confirm(`ترحيل إهلاك الأصول حتى ${formatDay(preview?.periodEnd)} بمبلغ ${formatMoney(total)}؟`)) return;
        const res = await apiClient.post<DepreciationRun>('/fixed-assets/depreciation-runs', {
          periodEnd,
          notes: notes.trim() || null,
        });
        if (res.data?.id) setRunId(res.data.id);
        setPreview(null);
      }
      refresh();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const unpost = async () => {
    if (!run || !window.confirm(`إلغاء ترحيل التشغيل ${run.runNumber}؟ يُلغى ترحيل القيد في مكانه ويعود الإهلاك على الأصول.`)) return;
    setBusy(true);
    try {
      await apiClient.post(`/fixed-assets/depreciation-runs/${run.id}/unpost`);
      refresh();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!run || !window.confirm(`حذف التشغيل ${run.runNumber}؟ سيُلغى قيده.`)) return;
    setBusy(true);
    try {
      await apiClient.delete(`/fixed-assets/depreciation-runs/${run.id}`);
      refresh();
      startNew();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const isNew = !run;
  const statusLabel = isNew ? 'جديد' : run.status === 'POSTED' ? 'مرحّل' : 'غير مرحّل';
  const statusTone = isNew ? 'info' : run.status === 'POSTED' ? 'success' : 'warning';

  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[FA_CRUMB, { label: 'الإهلاك الشهري' }]}
        title="تشغيل إهلاك الأصول"
        docNumber={run?.runNumber ?? 'جديد'}
        statusLabel={statusLabel}
        statusTone={statusTone}
        currentId={run?.id ?? null}
        hideStandalonePost={false}
        postLabel={run?.status === 'UNPOSTED' ? 'إعادة الترحيل' : 'ترحيل'}
        onPost={run?.status === 'POSTED' ? undefined : () => void post()}
        canPost={!busy && (run?.status === 'UNPOSTED' || (isNew && Boolean(preview) && total > 0))}
        postPending={busy}
        onBrowseList={() => setBrowseOpen(true)}
        favoriteHref="/fixed-assets/depreciation"
        extraActions={
          isNew ? (
            <Button type="button" variant="secondary" size="sm" className={`${formActionButtonClass} gap-1.5`} disabled={busy} onClick={() => void calculate()}>
              <Calculator className="h-3.5 w-3.5" aria-hidden />
              احسب ومعاينة
            </Button>
          ) : null
        }
        moreMenuItems={[
          { id: 'new', label: 'تشغيل جديد', onClick: startNew },
          ...(run?.status === 'POSTED' ? [{ id: 'unpost', label: 'إلغاء الترحيل', onClick: () => void unpost(), disabled: busy }] : []),
          ...(run?.status === 'UNPOSTED'
            ? [{ id: 'delete', label: 'حذف التشغيل', onClick: () => void remove(), disabled: busy, destructive: true }]
            : []),
        ]}
      />

      <ErpFormHeaderCard
        fieldsDisabled={!isNew}
        row1={
          <>
            <CompactFormField
              label="حتى نهاية شهر"
              required
              type="date"
              hint="يُحسب كل شهر لم يُهلك حتى نهاية هذا الشهر"
              value={run ? formatDay(run.periodEnd) : periodEnd}
              onChange={(e) => {
                setPeriodEnd(e.target.value);
                setPreview(null);
              }}
            />
            <CompactFormField
              label="البيان / ملاحظات"
              value={run ? run.notes ?? '' : notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="إهلاك شهر …"
            />
          </>
        }
        row2={
          <>
            <CompactFormField label="عدد الأصول">
              <input className={compactControlClass} readOnly value={String(assetRows.length)} />
            </CompactFormField>
            <CompactFormField label="عدد الأشهر المحسوبة">
              <input className={compactControlClass} readOnly value={String(monthCount)} />
            </CompactFormField>
          </>
        }
      />

      <FormSectionCard
        title="الأصول المحسوبة"
        subtitle={
          isNew
            ? 'الإهلاك يُرحل بالتتابع لشهر بعد آخر شهر مرحل — للتعديل ألغِ ترحيل آخر تشغيل ثم أعد ترحيله'
            : `حتى ${formatDay(run.periodEnd)}`
        }
        icon={ListChecks}
        bodyClassName="block"
        className="mt-3"
      >
        <AppTable<AssetRow>
          data={assetRows}
          getRowKey={(r) => r.assetId}
          emptyTitle={isNew ? 'اختر الشهر ثم «احسب ومعاينة»' : 'لا توجد سطور'}
          exportFileName="depreciation-run"
          columns={[
            { id: 'code', header: 'الكود', accessor: 'code' },
            { id: 'name', header: 'الأصل', accessor: 'name' },
            { id: 'months', header: 'الأشهر', numeric: true, cell: (r) => String(r.months) },
            { id: 'amount', header: 'الإهلاك', numeric: true, cell: (r) => formatMoney(r.amount) },
            { id: 'acc', header: 'المجمع بعده', numeric: true, cell: (r) => formatMoney(r.accumulatedAfter) },
          ]}
        />
      </FormSectionCard>

      <ErpDocumentBottomSplit
        financialRows={[
          { label: 'عدد الأصول', value: assetRows.length, show: false },
          { label: 'إجمالي مصروف الإهلاك', value: total },
        ]}
        netAmount={total}
        netLabel="إجمالي إهلاك الفترة"
        journalEntryId={run?.journalEntryId ?? null}
        showJournalTab={Boolean(run?.journalEntryId)}
        tabs={
          run?.journalEntryId
            ? []
            : [{ id: 'preview', label: 'معاينة القيد المحاسبي', content: <JournalPreviewTable lines={preview?.journal ?? []} /> }]
        }
      />

      <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="تشغيلات الإهلاك السابقة">
        <AppTable<DepreciationRun>
          isLoading={runsLoading}
          data={runs}
          getRowKey={(r) => r.id}
          emptyTitle="لم يُرحل إهلاك بعد"
          onRowClick={(r) => {
            setRunId(r.id);
            setPreview(null);
            setBrowseOpen(false);
          }}
          rowClassName={(r) => (runId === r.id ? 'bg-sky-50 even:bg-sky-50 hover:bg-sky-100' : undefined)}
          columns={[
            { id: 'number', header: 'الرقم', accessor: 'runNumber' },
            { id: 'period', header: 'حتى', cell: (r) => formatDay(r.periodEnd) },
            { id: 'total', header: 'الإجمالي', numeric: true, cell: (r) => formatMoney(r.totalAmount) },
            {
              id: 'status',
              header: 'الحالة',
              cell: (r) => (
                <StatusBadge compact variant={r.status === 'POSTED' ? 'success' : 'warning'} label={r.status === 'POSTED' ? 'مرحّل' : 'غير مرحّل'} />
              ),
            },
          ]}
        />
      </DocumentBrowseDrawer>
    </ErpDocumentLayout>
  );
}
