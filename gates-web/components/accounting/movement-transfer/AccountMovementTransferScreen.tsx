'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarRange } from 'lucide-react';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Button } from '@/components/ui';
import { FormSectionCard } from '@/app/components/ui/forms/FormSectionCard';
import { CompactFormField } from '@/app/components/ui/forms/CompactFormField';
import { ErpDocumentLayout } from '@/components/erp';
import { AccountSelect } from '@/app/components/form/AccountSelect';
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

export function AccountMovementTransferScreen() {
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [fromDate, setFromDate] = useState(todayIso);
  const [toDate, setToDate] = useState(todayIso);
  const [previewKey, setPreviewKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sourceBalanceQ = useApiQuery<MovementPreviewPayload>(
    ['account-movement-balance', sourceAccountId],
    '/accounting/account-movements/summary',
    { accountId: sourceAccountId, fromDate: '2000-01-01', toDate: todayIso() },
    { enabled: Boolean(sourceAccountId), staleTime: 30_000 }
  );
  const destBalanceQ = useApiQuery<MovementPreviewPayload>(
    ['account-movement-balance', destinationAccountId],
    '/accounting/account-movements/summary',
    { accountId: destinationAccountId, fromDate: '2000-01-01', toDate: todayIso() },
    { enabled: Boolean(destinationAccountId), staleTime: 30_000 }
  );
  const previewQ = useApiQuery<MovementPreviewPayload>(
    ['account-movement-preview', sourceAccountId, fromDate, toDate, previewKey],
    '/accounting/account-movements/summary',
    { accountId: sourceAccountId, fromDate, toDate },
    { enabled: previewKey > 0 && Boolean(sourceAccountId), staleTime: 15_000 }
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
  const sourceAccount = sourceBalanceQ.data?.data;
  const destAccount = destBalanceQ.data?.data;
  const sourceLabel = partyLabel(sourceAccount?.account, sourceAccountId ? 'الحساب المصدر' : '—');
  const destLabel = partyLabel(destAccount?.account, destinationAccountId ? 'الحساب المستلم' : '—');
  const sourceBalance = Number(sourceAccount?.currentBalance ?? sourceAccount?.summary?.balance ?? 0);
  const destBalance = Number(destAccount?.currentBalance ?? destAccount?.summary?.balance ?? 0);
  const canExecute = selectedIds.length > 0 && Boolean(sourceAccountId && destinationAccountId);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const { statusLabel, statusTone } = movementTransferStatus(
    false,
    selectedIds.length,
    Boolean(destinationAccountId),
    rows.length > 0
  );

  const transferMutation = useApiMutation<{ matchedLinesCount?: number }, Record<string, unknown>>(
    '/accounting/account-movements/transfer',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        setSuccess(`تم نقل ${res.data?.matchedLinesCount ?? selectedIds.length} حركة بنجاح`);
        setConfirmOpen(false);
        setSelectedIds([]);
        setPreviewKey((n) => n + 1);
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء نقل حركة الحساب'),
    }
  );

  const resetForm = () => {
    setSourceAccountId('');
    setDestinationAccountId('');
    setFromDate(todayIso());
    setToDate(todayIso());
    setSelectedIds([]);
    setPreviewKey(0);
    setError('');
    setSuccess('');
  };

  const loadMovements = () => {
    setError('');
    if (!sourceAccountId) {
      setError('اختر الحساب المصدر أولاً');
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
    if (!sourceAccountId || !destinationAccountId) {
      setError('اختر الحساب المصدر والحساب المستلم');
      return;
    }
    if (sourceAccountId === destinationAccountId) {
      setError('الحساب المصدر والحساب المستلم يجب أن يكونا مختلفين');
      return;
    }
    if (selectedIds.length === 0) {
      setError('حدد حركة واحدة على الأقل للنقل');
      return;
    }
    transferMutation.mutate({
      fromAccountId: sourceAccountId,
      toAccountId: destinationAccountId,
      fromDate: new Date(fromDate).toISOString(),
      toDate: new Date(toDate).toISOString(),
      hijriDate: toHijriDate(toDate),
      description: `نقل حركة حساب من ${sourceLabel} إلى ${destLabel}`,
      lineIds: selectedIds,
    });
  };

  const openConfirm = () => {
    if (!canExecute) {
      setError('حمّل الحركات وحدد الحساب المصدر والمستلم أولاً');
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <MovementTransferPageHeader
        title="نقل حركة حساب"
        favoriteHref="/accounting/tools/transfer-account"
        breadcrumbs={[
          { href: '/accounting', label: 'المحاسبة' },
          { label: 'الأدوات' },
          { label: 'نقل حركة حساب' },
        ]}
        statusLabel={transferMutation.isPending ? 'جاري التنفيذ' : statusLabel}
        statusTone={transferMutation.isPending ? 'warning' : statusTone}
        savePending={transferMutation.isPending}
        canExecute={canExecute}
        hasSource={Boolean(sourceAccountId)}
        hasRows={rows.length > 0}
        allSelected={allSelected}
        loadLabel="تحميل حركات الفترة"
        onNew={resetForm}
        onLoad={loadMovements}
        onToggleAll={toggleAll}
        onExecute={openConfirm}
        onPrint={() =>
          void printMovementPreview({
            title: 'نقل حركة حساب',
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
        title="الحساب المصدر والمستلم"
        subtitle="اختَر الحسابين ثم حمّل حركات الفترة"
        icon={ArrowLeftRight}
        className="mb-3 p-3 sm:p-4"
        bodyClassName="!grid-cols-1 md:!grid-cols-2"
      >
        <CompactFormField label="من حساب (المصدر)" required hint={sourceAccountId ? `الرصيد الحالي: ${money(sourceBalance)}` : undefined}>
          <AccountSelect
            value={sourceAccountId}
            onChange={(id) => {
              setSourceAccountId(id);
              if (id && id === destinationAccountId) setDestinationAccountId('');
            }}
            placeholder="اختر الحساب المصدر..."
            emptyLabel="اختر الحساب المصدر..."
            leafOnly
          />
        </CompactFormField>
        <CompactFormField label="إلى حساب (المستلم)" required hint={destinationAccountId ? `الرصيد الحالي: ${money(destBalance)}` : undefined}>
          <AccountSelect
            value={destinationAccountId}
            onChange={setDestinationAccountId}
            placeholder="اختر الحساب المحول إليه..."
            emptyLabel="اختر الحساب المحول إليه..."
            leafOnly
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
          تحميل حركات الفترة
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
        summary={`سيتم نقل ${selectedIds.length} حركة إلى [${destLabel}]`}
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
