'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarRange } from 'lucide-react';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Button } from '@/components/ui';
import { FormSectionCard } from '@/app/components/ui/forms/FormSectionCard';
import { CompactFormField } from '@/app/components/ui/forms/CompactFormField';
import { ErpDocumentLayout } from '@/components/erp';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { MovementTransferConfirmModal } from './MovementTransferConfirmModal';
import { MovementTransferGrid } from './MovementTransferGrid';
import {
  MovementTransferPageHeader,
  movementTransferStatus,
  printMovementPreview,
} from './MovementTransferPageHeader';
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
  const canExecute = selectedIds.length > 0 && Boolean(sourceId && destinationId);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const { statusLabel, statusTone } = movementTransferStatus(
    false,
    selectedIds.length,
    Boolean(destinationId),
    rows.length > 0
  );

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

  const resetForm = () => {
    setSourceId('');
    setDestinationId('');
    setFromDate(todayIso());
    setToDate(todayIso());
    setSelectedIds([]);
    setPreviewKey(0);
    setError('');
    setSuccess('');
  };

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

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((row) => row.id)));
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

  const openConfirm = () => {
    if (!canExecute) {
      setError('حمّل الحركات وحدد مركز التكلفة المصدر والمستلم أولاً');
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <MovementTransferPageHeader
        title="نقل حركة مركز التكلفة"
        favoriteHref="/accounting/tools/transfer-cost-center"
        breadcrumbs={[
          { href: '/accounting', label: 'المحاسبة' },
          { label: 'الأدوات' },
          { label: 'نقل حركة مركز التكلفة' },
        ]}
        statusLabel={transferMutation.isPending ? 'جاري التنفيذ' : statusLabel}
        statusTone={transferMutation.isPending ? 'warning' : statusTone}
        savePending={transferMutation.isPending}
        canExecute={canExecute}
        hasSource={Boolean(sourceId)}
        hasRows={rows.length > 0}
        allSelected={allSelected}
        loadLabel="تحميل حركات مركز التكلفة"
        onNew={resetForm}
        onLoad={loadMovements}
        onToggleAll={toggleAll}
        onExecute={openConfirm}
        onPrint={() =>
          void printMovementPreview({
            title: 'نقل حركة مركز التكلفة',
            sourceLabel,
            destLabel,
            date: toDate,
            rows: rows.filter((row) => selectedIds.includes(row.id)).length
              ? rows.filter((row) => selectedIds.includes(row.id))
              : rows,
          })
        }
      />

      <FormSectionCard
        title="مركز التكلفة المصدر والمستلم"
        subtitle="اختَر المركزين ثم حمّل حركات الفترة"
        icon={ArrowLeftRight}
        className="mb-3 p-3 sm:p-4"
        bodyClassName="!grid-cols-1 md:!grid-cols-2"
      >
        <CompactFormField label="من مركز تكلفة (المصدر)" required hint={sourceId ? `الرصيد الحالي: ${money(sourceBalance)}` : undefined}>
          <CostCenterSelect
            value={sourceId}
            onChange={(id) => {
              setSourceId(id);
              if (id && id === destinationId) setDestinationId('');
            }}
            allowEmpty
            leafOnly={false}
            emptyLabel="اختر مركز التكلفة المصدر..."
          />
        </CompactFormField>
        <CompactFormField label="إلى مركز تكلفة (المستلم)" required hint={destinationId ? `الرصيد الحالي: ${money(destBalance)}` : undefined}>
          <CostCenterSelect
            value={destinationId}
            onChange={setDestinationId}
            allowEmpty
            emptyLabel="اختر مركز التكلفة المحول إليه..."
          />
        </CompactFormField>
      </FormSectionCard>

      <FormSectionCard
        title="فترة الحركات"
        subtitle="حدد المدى ثم حمّل الحركات من الثلاث نقاط أو من هنا"
        icon={CalendarRange}
        className="mb-3 p-3 sm:p-4"
        bodyClassName="!grid-cols-1 items-end sm:!grid-cols-[1fr_1fr_auto]"
      >
        <DatePickerWithHijri label="من تاريخ" value={fromDate} onChange={setFromDate} />
        <DatePickerWithHijri label="إلى تاريخ" value={toDate} onChange={setToDate} />
        <Button type="button" variant="secondary" size="sm" onClick={loadMovements} isLoading={previewQ.isFetching}>
          تحميل حركات مركز التكلفة
        </Button>
      </FormSectionCard>

      <FormSectionCard title="حركات الفترة" subtitle="حدّد الحركات المطلوب نقلها" className="mb-3 p-3 sm:p-4">
        <MovementTransferGrid
          rows={rows}
          selectedIds={selectedIds}
          onToggle={(id) =>
            setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
          onToggleAll={toggleAll}
        />
      </FormSectionCard>

      <MovementTransferStickyFooter
        summary={`سيتم نقل ${selectedIds.length} حركة إلى ${destLabel}`}
        canExecute={canExecute}
        pending={transferMutation.isPending}
        onExecute={openConfirm}
        onCancel={resetForm}
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
    </ErpDocumentLayout>
  );
}
