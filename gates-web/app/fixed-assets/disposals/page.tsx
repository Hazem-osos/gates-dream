'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Eye } from 'lucide-react';
import { AppTable, Button, CompactFormField, StatusBadge, compactControlClass } from '@/components/ui';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import {
  DocumentBrowseDrawer,
  ErpDocumentBottomSplit,
  ErpDocumentLayout,
  ErpDocumentPageHeader,
  ErpFormHeaderCard,
} from '@/components/erp';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { PartySelect } from '@/app/components/form/PartySelect';
import { FA_CRUMB, JournalPreviewTable } from '@/components/fixed-assets/shared';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import {
  formatDay,
  formatMoney,
  todayIso,
  toNumber,
  type DisposalPreview,
  type FixedAsset,
  type FixedAssetDisposal,
} from '@/lib/fixed-assets/types';

type DisposalForm = {
  assetId: string;
  disposalType: 'SALE' | 'SCRAP';
  disposalDate: string;
  proceeds: string;
  vatAmount: string;
  mode: 'CUSTOMER' | 'ACCOUNT';
  customerId: string;
  proceedsAccountId: string;
  notes: string;
};

const emptyForm = (assetId = ''): DisposalForm => ({
  assetId,
  disposalType: 'SALE',
  disposalDate: todayIso(),
  proceeds: '0',
  vatAmount: '0',
  mode: 'ACCOUNT',
  customerId: '',
  proceedsAccountId: '',
  notes: '',
});

function fromDisposal(d: FixedAssetDisposal): DisposalForm {
  return {
    assetId: d.assetId,
    disposalType: d.disposalType,
    disposalDate: formatDay(d.disposalDate),
    proceeds: String(toNumber(d.proceeds)),
    vatAmount: String(toNumber(d.vatAmount)),
    mode: d.customerId ? 'CUSTOMER' : 'ACCOUNT',
    customerId: d.customerId ?? '',
    proceedsAccountId: d.proceedsAccountId ?? '',
    notes: d.notes ?? '',
  };
}

/** Assets in service only, with server-side search. */
function InServiceAssetSelect({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [search, setSearch] = useState('');
  const params = { page: 1, limit: 50, ...(search.trim() ? { search: search.trim() } : {}) };
  const { data } = useApiQuery<FixedAsset[]>(queryKeys.fixedAssets.assets({ picker: true, ...params }), '/fixed-assets/assets', params, {
    staleTime: 0,
  });
  const rows = (data?.data ?? []).filter((a) => a.status === 'ACTIVE' || a.status === 'FULLY_DEPRECIATED' || a.id === value);
  return (
    <div className="flex gap-1.5">
      <input
        type="search"
        className={`${compactControlClass} w-28 shrink-0`}
        placeholder="بحث"
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select className={compactControlClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">اختر الأصل</option>
        {rows.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} - {a.arabicName}
          </option>
        ))}
      </select>
    </div>
  );
}

function DisposalScreen() {
  const searchParams = useSearchParams();
  const invalidate = useInvalidateQuery();
  const [disposalId, setDisposalId] = useState<string | null>(null);
  const [form, setForm] = useState<DisposalForm>(() => emptyForm(searchParams?.get('assetId') ?? ''));
  const [preview, setPreview] = useState<DisposalPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  const { data: listRes, isLoading: listLoading } = useApiQuery<FixedAssetDisposal[]>(
    queryKeys.fixedAssets.disposals(),
    '/fixed-assets/disposals',
    undefined,
    { staleTime: 0 }
  );
  const list = listRes?.data ?? [];
  const disposal = disposalId ? list.find((d) => d.id === disposalId) ?? null : null;

  useEffect(() => {
    const fromUrl = searchParams?.get('assetId');
    if (fromUrl && !disposalId) setForm((f) => (f.assetId ? f : { ...f, assetId: fromUrl }));
  }, [searchParams, disposalId]);

  const set = <K extends keyof DisposalForm>(key: K, value: DisposalForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setPreview(null);
  };

  const isSale = form.disposalType === 'SALE';
  const body = () => ({
    assetId: form.assetId,
    disposalType: form.disposalType,
    disposalDate: form.disposalDate,
    proceeds: isSale ? toNumber(form.proceeds) : 0,
    vatAmount: isSale ? toNumber(form.vatAmount) : 0,
    customerId: isSale && form.mode === 'CUSTOMER' ? form.customerId || null : null,
    proceedsAccountId: isSale && form.mode === 'ACCOUNT' ? form.proceedsAccountId || null : null,
    notes: form.notes.trim() || null,
  });

  const refresh = () => invalidate(queryKeys.fixedAssets.all);

  const startNew = () => {
    setDisposalId(null);
    setPreview(null);
    setForm(emptyForm());
  };

  const runPreview = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post<DisposalPreview>('/fixed-assets/disposals/preview', body(), { skipSuccessNotify: true });
      setPreview(res.data ?? null);
    } catch {
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const post = async () => {
    if (!window.confirm('ترحيل الاستبعاد؟ سيخرج الأصل من الخدمة ويُنشأ القيد.')) return;
    setBusy(true);
    try {
      const res = await apiClient.post<FixedAssetDisposal>('/fixed-assets/disposals', body());
      if (res.data?.id) setDisposalId(res.data.id);
      refresh();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const unpost = async () => {
    if (!disposal || !window.confirm(`إلغاء ترحيل الاستبعاد ${disposal.disposalNumber}؟ يعود الأصل للخدمة ويُلغى ترحيل القيد في مكانه.`)) return;
    setBusy(true);
    try {
      await apiClient.post(`/fixed-assets/disposals/${disposal.id}/unpost`);
      refresh();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!disposal || !window.confirm(`حذف مستند الاستبعاد ${disposal.disposalNumber}؟ سيُلغى قيده.`)) return;
    setBusy(true);
    try {
      await apiClient.delete(`/fixed-assets/disposals/${disposal.id}`);
      refresh();
      startNew();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const isNew = !disposal;
  const statusLabel = isNew ? 'جديد' : disposal.status === 'POSTED' ? 'مرحّل' : 'غير مرحّل';
  const statusTone = isNew ? 'info' : disposal.status === 'POSTED' ? 'success' : 'warning';

  const figures = disposal
    ? {
        cost: toNumber(disposal.costAmount),
        accumulated: toNumber(disposal.accumulatedAmount),
        catchUp: toNumber(disposal.catchUpDepreciation),
        bookValue: toNumber(disposal.bookValue),
        gainLoss: toNumber(disposal.gainLoss),
      }
    : preview
      ? {
          cost: preview.cost,
          accumulated: preview.accumulatedDepreciation,
          catchUp: preview.catchUpDepreciation,
          bookValue: preview.bookValue,
          gainLoss: preview.gainLoss,
        }
      : null;

  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[FA_CRUMB, { label: 'بيع واستبعاد الأصول' }]}
        title="بيع / استبعاد أصل"
        docNumber={disposal?.disposalNumber ?? 'جديد'}
        statusLabel={statusLabel}
        statusTone={statusTone}
        currentId={disposal?.id ?? null}
        hideStandalonePost={false}
        onPost={isNew ? () => void post() : undefined}
        canPost={!busy && isNew && Boolean(preview)}
        postPending={busy}
        onBrowseList={() => setBrowseOpen(true)}
        favoriteHref="/fixed-assets/disposals"
        extraActions={
          isNew ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={`${formActionButtonClass} gap-1.5`}
              disabled={busy || !form.assetId}
              onClick={() => void runPreview()}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden />
              معاينة
            </Button>
          ) : null
        }
        moreMenuItems={[
          { id: 'new', label: 'مستند جديد', onClick: startNew },
          ...(disposal?.status === 'POSTED' ? [{ id: 'unpost', label: 'إلغاء الترحيل', onClick: () => void unpost(), disabled: busy }] : []),
          ...(disposal?.status === 'UNPOSTED'
            ? [{ id: 'delete', label: 'حذف المستند', onClick: () => void remove(), disabled: busy, destructive: true }]
            : []),
        ]}
      />

      <ErpFormHeaderCard
        fieldsDisabled={!isNew}
        row1={
          <>
            <CompactFormField label="الأصل" required>
              <InServiceAssetSelect value={form.assetId} disabled={!isNew} onChange={(id) => set('assetId', id)} />
            </CompactFormField>
            <CompactFormField label="نوع العملية" required>
              <select className={compactControlClass} value={form.disposalType} onChange={(e) => set('disposalType', e.target.value as 'SALE' | 'SCRAP')}>
                <option value="SALE">بيع</option>
                <option value="SCRAP">استبعاد / تكهين بدون بيع</option>
              </select>
            </CompactFormField>
            <CompactFormField
              label="تاريخ الاستبعاد"
              required
              type="date"
              hint="يوم 15 أو قبله: لا يُهلك هذا الشهر — بعده: يُهلك"
              value={form.disposalDate}
              onChange={(e) => set('disposalDate', e.target.value)}
            />
          </>
        }
        row2={
          isSale ? (
            <>
              <CompactFormField
                label="سعر البيع (بدون ضريبة)"
                type="number"
                inputMode="decimal"
                value={form.proceeds}
                onChange={(e) => set('proceeds', e.target.value)}
              />
              <CompactFormField
                label="ضريبة القيمة المضافة (مخرجات)"
                type="number"
                inputMode="decimal"
                value={form.vatAmount}
                onChange={(e) => set('vatAmount', e.target.value)}
              />
              <CompactFormField label="المتحصلات على">
                <select className={compactControlClass} value={form.mode} onChange={(e) => set('mode', e.target.value as DisposalForm['mode'])}>
                  <option value="ACCOUNT">حساب (خزنة / بنك)</option>
                  <option value="CUSTOMER">عميل (آجل)</option>
                </select>
              </CompactFormField>
              {form.mode === 'CUSTOMER' ? (
                <CompactFormField label="العميل" required>
                  <PartySelect kind="CUSTOMER" value={form.customerId} disabled={!isNew} onChange={(id) => set('customerId', id)} />
                </CompactFormField>
              ) : (
                <CompactFormField label="حساب المتحصلات" required>
                  <AccountSelect value={form.proceedsAccountId} disabled={!isNew} onChange={(id) => set('proceedsAccountId', id)} />
                </CompactFormField>
              )}
            </>
          ) : (
            <CompactFormField label="ملاحظات" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          )
        }
        extras={isSale ? <CompactFormField label="ملاحظات" value={form.notes} onChange={(e) => set('notes', e.target.value)} /> : undefined}
        extrasLabel="ملاحظات"
      />

      <ErpDocumentBottomSplit
        financialRows={[
          { label: 'تكلفة الأصل', value: figures?.cost ?? 0 },
          { label: 'إهلاك حتى تاريخ الاستبعاد', value: figures?.catchUp ?? 0, show: (figures?.catchUp ?? 0) > 0 },
          { label: 'مجمع الإهلاك', value: -(figures?.accumulated ?? 0) },
          { label: 'صافي القيمة الدفترية', value: figures?.bookValue ?? 0 },
          { label: 'سعر البيع', value: isSale ? toNumber(form.proceeds) : 0, show: isSale },
        ]}
        netAmount={figures?.gainLoss ?? 0}
        netLabel={(figures?.gainLoss ?? 0) >= 0 ? 'ربح الاستبعاد' : 'خسارة الاستبعاد'}
        showTafqeet={false}
        journalEntryId={disposal?.journalEntryId ?? null}
        showJournalTab={Boolean(disposal?.journalEntryId)}
        tabs={
          disposal?.journalEntryId
            ? []
            : [
                {
                  id: 'preview',
                  label: 'معاينة القيد المحاسبي',
                  content: <JournalPreviewTable lines={preview?.journal ?? []} emptyTitle="اختر الأصل ثم «معاينة» لعرض القيد" />,
                },
              ]
        }
      />

      <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="مستندات البيع والاستبعاد السابقة">
        <AppTable<FixedAssetDisposal>
          isLoading={listLoading}
          data={list}
          getRowKey={(r) => r.id}
          emptyTitle="لا توجد عمليات بيع أو استبعاد"
          onRowClick={(r) => {
            setDisposalId(r.id);
            setForm(fromDisposal(r));
            setPreview(null);
            setBrowseOpen(false);
          }}
          rowClassName={(r) => (disposalId === r.id ? 'bg-sky-50 even:bg-sky-50 hover:bg-sky-100' : undefined)}
          columns={[
            { id: 'number', header: 'الرقم', accessor: 'disposalNumber' },
            { id: 'date', header: 'التاريخ', cell: (r) => formatDay(r.disposalDate) },
            { id: 'asset', header: 'الأصل', cell: (r) => (r.asset ? `${r.asset.code} - ${r.asset.arabicName}` : '—') },
            { id: 'type', header: 'النوع', cell: (r) => (r.disposalType === 'SALE' ? 'بيع' : 'استبعاد') },
            {
              id: 'gl',
              header: 'ربح / (خسارة)',
              numeric: true,
              cell: (r) => {
                const v = toNumber(r.gainLoss);
                return v >= 0 ? formatMoney(v) : `(${formatMoney(-v)})`;
              },
            },
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

export default function FixedAssetDisposalsPage() {
  return (
    <Suspense fallback={null}>
      <DisposalScreen />
    </Suspense>
  );
}
