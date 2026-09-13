'use client';

import { useEffect, useMemo, useState } from 'react';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Button, PageHeader } from '@/components/ui';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import { useCostCentersQuery } from '@/lib/hooks/useMasterDataQueries';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { MovementTransferConfirmModal } from './MovementTransferConfirmModal';
import { MovementTransferGrid } from './MovementTransferGrid';
import { MovementTransferStickyFooter } from './MovementTransferStickyFooter';
import { mapPreviewMovements, money, partyLabel, type MovementPreviewPayload } from './types';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export function CostCenterMovementTransferScreen() {
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(todayIso);
  const [previewKey, setPreviewKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: centersResponse } = useCostCentersQuery(1000);
  const centers = centersResponse?.data ?? [];
  const sourceOptions = centers.map((cc) => ({
    value: cc.id,
    label: cc.code ? `${cc.code} - ${cc.arabicName}` : cc.arabicName,
    searchText: `${cc.code ?? ''} ${cc.arabicName} ${cc.englishName ?? ''}`,
  }));
  const destOptions = sourceOptions.filter((opt) => opt.value !== sourceId);

  const sourceBalanceQ = useApiQuery<MovementPreviewPayload>(
    ['cost-center-movement-balance', sourceId],
    '/accounting/cost-center-movements/summary',
    { costCenterId: sourceId, fromDate: '2000-01-01', toDate: todayIso() },
    { enabled: Boolean(sourceId), staleTime: 30_000 }
  );
  const destBalanceQ = useApiQuery<MovementPreviewPayload>(
    ['cost-center-movement-balance', destinationId],
    '/accounting/cost-center-movements/summary',
    { costCenterId: destinationId, fromDate: '2000-01-01', toDate: todayIso() },
    { enabled: Boolean(destinationId), staleTime: 30_000 }
  );
  const previewQ = useApiQuery<MovementPreviewPayload>(
    ['cost-center-movement-preview', sourceId, fromDate, toDate, previewKey],
    '/accounting/cost-center-movements/summary',
    { costCenterId: sourceId, fromDate, toDate },
    { enabled: previewKey > 0 && Boolean(sourceId), staleTime: 15_000 }
  );

  const rows = useMemo(
    () => (previewKey > 0 ? mapPreviewMovements(previewQ.data?.data) : []),
    [previewKey, previewQ.data?.data]
  );

  useEffect(() => {
    if (previewKey > 0 && rows.length) {
      setSelectedIds(rows.map((row) => row.id));
    }
  }, [previewKey, rows]);
  const source = sourceBalanceQ.data?.data;
  const dest = destBalanceQ.data?.data;
  const sourceLabel = partyLabel(source?.costCenter, sourceId ? 'مركز التكلفة المصدر' : '—');
  const destLabel = partyLabel(dest?.costCenter, destinationId ? 'مركز التكلفة المستلم' : '—');
  const sourceBalance = Number(source?.currentBalance ?? source?.summary?.balance ?? 0);
  const destBalance = Number(dest?.currentBalance ?? dest?.summary?.balance ?? 0);

  const transferMutation = useApiMutation<{ movementsTransferredCount?: number }, Record<string, unknown>>(
    '/accounting/cost-center-movements/transfer',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        setSuccess(`تم نقل ${res.data?.movementsTransferredCount ?? selectedIds.length} حركة بنجاح`);
        setConfirmOpen(false);
        setSelectedIds([]);
        setPreviewKey((n) => n + 1);
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء نقل حركة مركز التكلفة'),
    }
  );

  const loadMovements = () => {
    setError('');
    if (!sourceId) {
      setError('اختر مركز التكلفة المصدر أولاً');
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      setError('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية');
      return;
    }
    setSelectedIds([]);
    setPreviewKey((n) => n + 1);
  };

  const execute = () => {
    if (!sourceId || !destinationId) {
      setError('اختر مركز التكلفة المصدر والمستلم');
      return;
    }
    if (sourceId === destinationId) {
      setError('مركز التكلفة المصدر والمستلم يجب أن يكونا مختلفين');
      return;
    }
    if (selectedIds.length === 0) {
      setError('حدد حركة واحدة على الأقل للنقل');
      return;
    }
    transferMutation.mutate({
      fromCostCenterId: sourceId,
      toCostCenterId: destinationId,
      fromDate: new Date(fromDate).toISOString(),
      toDate: new Date(toDate).toISOString(),
      hijriDate: toHijriDate(toDate),
      description: `نقل حركة مركز تكلفة من ${sourceLabel} إلى ${destLabel}`,
      movementIds: selectedIds,
    });
  };

  return (
    <div className="p-6" dir="rtl">
      <PageHeader
        title="نقل حركة مركز التكلفة"
        breadcrumbs={[
          { label: 'المحاسبة', href: '/accounting' },
          { label: 'الأدوات' },
          { label: 'نقل حركة مركز التكلفة' },
        ]}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">من مركز تكلفة (المصدر)</label>
          <SearchableCombobox
            value={sourceId}
            onChange={(id) => {
              setSourceId(id);
              if (id && id === destinationId) setDestinationId('');
            }}
            options={sourceOptions}
            placeholder="اختر مركز التكلفة المصدر..."
            emptyMessage="لا توجد مراكز تكلفة"
          />
          {sourceId ? (
            <div className="font-mono text-[11px] text-muted-foreground">
              الرصيد الحالي: <span className="font-bold text-foreground">{money(sourceBalance)}</span>
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">إلى مركز تكلفة (المستلم)</label>
          <SearchableCombobox
            value={destinationId}
            onChange={setDestinationId}
            options={destOptions}
            placeholder="اختر مركز التكلفة المحول إليه..."
            emptyMessage="لا توجد مراكز تكلفة"
          />
          {destinationId ? (
            <div className="font-mono text-[11px] text-muted-foreground">
              الرصيد الحالي: <span className="font-bold text-foreground">{money(destBalance)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <DatePickerWithHijri label="من تاريخ" value={fromDate} onChange={setFromDate} />
        <DatePickerWithHijri label="إلى تاريخ" value={toDate} onChange={setToDate} />
        <Button type="button" variant="secondary" size="sm" onClick={loadMovements} isLoading={previewQ.isFetching}>
          تحميل حركات مركز التكلفة
        </Button>
      </div>

      <MovementTransferGrid
        rows={rows}
        selectedIds={selectedIds}
        onToggle={(id) =>
          setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        onToggleAll={() =>
          setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((row) => row.id)))
        }
      />

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <MovementTransferStickyFooter
        summary={`سيتم نقل ${selectedIds.length} حركة إلى ${destLabel}`}
        canExecute={selectedIds.length > 0 && Boolean(sourceId && destinationId)}
        pending={transferMutation.isPending}
        onExecute={() => setConfirmOpen(true)}
        onCancel={() => {
          setSourceId('');
          setDestinationId('');
          setSelectedIds([]);
          setPreviewKey(0);
        }}
      />

      <MovementTransferConfirmModal
        open={confirmOpen}
        count={selectedIds.length}
        sourceLabel={sourceLabel}
        destinationLabel={destLabel}
        pending={transferMutation.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={execute}
      />
    </div>
  );
}
