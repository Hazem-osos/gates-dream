'use client';

import { useEffect, useMemo, useState } from 'react';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Button, PageHeader } from '@/components/ui';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiMutation, useApiQuery } from '@/lib/hooks/useApi';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { MovementTransferConfirmModal } from './MovementTransferConfirmModal';
import { MovementTransferGrid } from './MovementTransferGrid';
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

  return (
    <div className="p-6" dir="rtl">
      <PageHeader
        title="نقل حركة حساب"
        breadcrumbs={[
          { label: 'المحاسبة', href: '/accounting' },
          { label: 'الأدوات' },
          { label: 'نقل حركة حساب' },
        ]}
      />

      <div className="mb-4 grid grid-cols-1 gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">من حساب (الحساب المصدر)</label>
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
          {sourceAccountId ? (
            <div className="font-mono text-[11px] text-muted-foreground">
              الرصيد الحالي:{' '}
              <span className="font-bold text-foreground">{money(sourceBalance)}</span>
            </div>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">إلى حساب (الحساب البديل / المستلم)</label>
          <AccountSelect
            value={destinationAccountId}
            onChange={setDestinationAccountId}
            placeholder="اختر الحساب المحول إليه..."
            emptyLabel="اختر الحساب المحول إليه..."
            leafOnly
          />
          {destinationAccountId ? (
            <div className="font-mono text-[11px] text-muted-foreground">
              الرصيد الحالي:{' '}
              <span className="font-bold text-foreground">{money(destBalance)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <DatePickerWithHijri label="من تاريخ" value={fromDate} onChange={setFromDate} />
        <DatePickerWithHijri label="إلى تاريخ" value={toDate} onChange={setToDate} />
        <Button type="button" variant="secondary" size="sm" onClick={loadMovements} isLoading={previewQ.isFetching}>
          تحميل حركات الفترة
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
        summary={`سيتم نقل ${selectedIds.length} حركة إلى [${destLabel}]`}
        canExecute={selectedIds.length > 0 && Boolean(sourceAccountId && destinationAccountId)}
        pending={transferMutation.isPending}
        onExecute={() => setConfirmOpen(true)}
        onCancel={() => {
          setSourceAccountId('');
          setDestinationAccountId('');
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
