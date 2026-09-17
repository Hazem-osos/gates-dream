'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button,
  AppTable,
  FilterToolbar,
  compactControlClass,
} from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { ItemSelect } from '@/components/form/ItemSelect';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type QtyRow = {
  key: string;
  id?: string;
  itemId: string;
  itemName: string;
  policyName: string;
  days: string;
  commissionBefore: string;
  commissionAfter: string;
  cashRate: string;
  creditRate: string;
  percent: string;
  target: string;
  [key: string]: unknown;
};

type ApiLine = {
  id: string;
  itemId?: string | null;
  itemName?: string | null;
  policyName?: string | null;
  days?: number | null;
  commissionBefore?: number | string | null;
  commissionAfter?: number | string | null;
  cashRate?: number | string | null;
  creditRate?: number | string | null;
  percent?: number | string | null;
  target?: number | string | null;
  item?: { arabicName?: string | null } | null;
};

const POLICIES = ['حسب الأيام', 'حسب النقدي'];
const cellCls = '!max-w-none !overflow-visible !h-auto whitespace-normal py-1.5';

function emptyRow(): QtyRow {
  return {
    key: crypto.randomUUID(),
    itemId: '',
    itemName: '',
    policyName: '',
    days: '',
    commissionBefore: '',
    commissionAfter: '',
    cashRate: '',
    creditRate: '',
    percent: '',
    target: '',
  };
}

function num(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toRow(line: ApiLine): QtyRow {
  return {
    key: line.id,
    id: line.id,
    itemId: line.itemId ?? '',
    itemName: line.itemName || line.item?.arabicName || '',
    policyName: line.policyName ?? '',
    days: line.days != null ? String(line.days) : '',
    commissionBefore: line.commissionBefore != null ? String(line.commissionBefore) : '',
    commissionAfter: line.commissionAfter != null ? String(line.commissionAfter) : '',
    cashRate: line.cashRate != null ? String(line.cashRate) : '',
    creditRate: line.creditRate != null ? String(line.creditRate) : '',
    percent: line.percent != null ? String(line.percent) : '',
    target: line.target != null ? String(line.target) : '',
  };
}

export default function RepresentativesCommissionQuantitiesPage() {
  const invalidateQuery = useInvalidateQuery();
  const hydrated = useRef(false);
  const [lines, setLines] = useState<QtyRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useApiQuery<ApiLine[]>(
    queryKeys.representativeCommissionQuantities(),
    '/inventory/representatives-commissions-quantities',
    { limit: 200 },
    { staleTime: 15_000 }
  );

  useEffect(() => {
    if (hydrated.current) return;
    const rows = data?.data;
    if (!rows) return;
    hydrated.current = true;
    setLines(rows.length ? rows.map(toRow) : [emptyRow(), emptyRow(), emptyRow()]);
  }, [data]);

  const patch = (key: string, next: Partial<QtyRow>) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const visible = search.trim()
    ? lines.filter((row) =>
        `${row.itemName} ${row.policyName}`.includes(search.trim())
      )
    : lines;

  const handleSave = async () => {
    setError('');
    setSuccess('');
    const payload = {
      lines: lines
        .filter((row) => row.itemId || row.itemName || row.policyName || row.target)
        .map((row) => ({
          id: row.id,
          itemId: row.itemId || null,
          itemName: row.itemName || null,
          policyName: row.policyName || null,
          days: num(row.days) != null ? Math.round(num(row.days) as number) : null,
          commissionBefore: num(row.commissionBefore),
          commissionAfter: num(row.commissionAfter),
          cashRate: num(row.cashRate),
          creditRate: num(row.creditRate),
          percent: num(row.percent),
          target: num(row.target),
        })),
    };
    setSaving(true);
    try {
      const res = await apiClient.put<ApiLine[]>(
        '/inventory/representatives-commissions-quantities',
        payload
      );
      if (res.data?.length) setLines(res.data.map(toRow));
      setSuccess('تم حفظ سياسة عمولات الكميات');
      invalidateQuery(['representatives-commissions-quantities']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    setLines((prev) => [...prev, emptyRow()]);
  };

  const handleClear = () => {
    hydrated.current = false;
    setLines([emptyRow(), emptyRow(), emptyRow()]);
    setError('');
    setSuccess('');
  };

  return (
    <MasterCardShell
      title="تعريف سياسة عمولات المندوبين كميات"
      breadcrumbs={[
        { label: 'المخازن', href: '/inventory' },
        { label: 'التعريفات' },
        { label: 'عمولات المندوبين كميات' },
      ]}
      docNumber="جدول العمولات"
      statusLabel="تعديل"
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving}
      onNew={handleClear}
      favoriteHref="/inventory/creations/representatives-commission-quantities"
      moreMenuItems={[{ id: 'add-item', label: 'إضافة صنف', onClick: handleNew }]}
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <p className="mb-3 text-sm font-semibold text-[#0A3D5E]">الأصناف الخاضعة للعمولات</p>

      <FilterToolbar
        searchPlaceholder="بحث بالصنف أو سياسة العمولة…"
        onSearchChange={setSearch}
      >
        <Button type="button" variant="secondary" size="sm" onClick={handleNew}>
          <Plus className="h-4 w-4" />
          صنف
        </Button>
      </FilterToolbar>

      <div className="mt-4 overflow-visible">
        <AppTable<QtyRow>
          isLoading={isLoading && !hydrated.current}
          data={visible}
          getRowKey={(r) => r.key}
          emptyTitle="لا توجد أصناف خاضعة للعمولة"
          emptyDescription="اضغط صنف لإضافة سطر، ثم احفظ."
          virtualizeThreshold={10_000}
          columns={[
            {
              id: 'item',
              header: 'الصنف',
              className: `${cellCls} min-w-[220px]`,
              cell: (row) => (
                <ItemSelect
                  value={row.itemId}
                  emptyLabel="اختر الصنف"
                  menuPlacement="bottom"
                  onChange={(itemId) => patch(row.key, { itemId })}
                  onItemResolved={(item) =>
                    patch(row.key, {
                      itemId: item?.id ?? row.itemId,
                      itemName: item?.arabicName ?? row.itemName,
                    })
                  }
                />
              ),
            },
            {
              id: 'policy',
              header: 'سياسة العمولة',
              className: `${cellCls} min-w-[160px]`,
              cell: (row) => (
                <select
                  className={compactControlClass}
                  value={row.policyName}
                  onChange={(e) => patch(row.key, { policyName: e.target.value })}
                >
                  <option value="">—</option>
                  {POLICIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  {row.policyName && !POLICIES.includes(row.policyName) ? (
                    <option value={row.policyName}>{row.policyName}</option>
                  ) : null}
                </select>
              ),
            },
            {
              id: 'days',
              header: 'عدد الأيام',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.days}
                  onChange={(e) => patch(row.key, { days: e.target.value })}
                />
              ),
            },
            {
              id: 'before',
              header: 'عمولة قبل',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.commissionBefore}
                  onChange={(e) => patch(row.key, { commissionBefore: e.target.value })}
                />
              ),
            },
            {
              id: 'after',
              header: 'عمولة بعد',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.commissionAfter}
                  onChange={(e) => patch(row.key, { commissionAfter: e.target.value })}
                />
              ),
            },
            {
              id: 'cash',
              header: 'نقدي',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.cashRate}
                  onChange={(e) => patch(row.key, { cashRate: e.target.value })}
                />
              ),
            },
            {
              id: 'credit',
              header: 'الآجل',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.creditRate}
                  onChange={(e) => patch(row.key, { creditRate: e.target.value })}
                />
              ),
            },
            {
              id: 'percent',
              header: 'النسبة',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.percent}
                  onChange={(e) => patch(row.key, { percent: e.target.value })}
                />
              ),
            },
            {
              id: 'target',
              header: 'التارجت',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.target}
                  onChange={(e) => patch(row.key, { target: e.target.value })}
                />
              ),
            },
            {
              id: 'remove',
              header: '',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-500"
                  onClick={() =>
                    setLines((prev) =>
                      prev.length > 1 ? prev.filter((r) => r.key !== row.key) : [emptyRow()]
                    )
                  }
                  aria-label="حذف السطر"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ),
            },
          ]}
        />
      </div>

    </MasterCardShell>
  );
}
