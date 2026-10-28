'use client';

import type { ReactNode } from 'react';
import { PageHeader } from '@/app/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { useBranchesQuery, useCostCentersQuery } from '@/lib/hooks/useMasterDataQueries';
import { formatMoney, type FixedAssetCategory, type JournalPreviewLine } from '@/lib/fixed-assets/types';

export function FixedAssetsPage({
  title,
  description,
  crumb,
  actions,
  children,
}: {
  title: string;
  description?: string;
  crumb?: { label: string; href?: string }[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div dir="rtl" className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        breadcrumbs={[{ label: 'الأصول الثابتة', href: '/fixed-assets' }, ...(crumb ?? [{ label: title }])]}
      />
      {children}
    </div>
  );
}

export function useFixedAssetCategories() {
  return useApiQuery<FixedAssetCategory[]>(queryKeys.fixedAssets.categories(), '/fixed-assets/categories', undefined, {
    staleTime: 0,
  });
}

export function CategorySelect({
  value,
  onChange,
  disabled,
  allowEmpty,
  emptyLabel = 'اختر الفئة',
  excludeId,
}: {
  value: string;
  onChange: (id: string, category?: FixedAssetCategory) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  excludeId?: string;
}) {
  const { data, isLoading } = useFixedAssetCategories();
  const rows = (data?.data ?? []).filter((c) => c.id !== excludeId);
  return (
    <select
      className={compactControlClass}
      value={value}
      disabled={disabled || isLoading}
      onChange={(e) => onChange(e.target.value, rows.find((c) => c.id === e.target.value))}
    >
      {allowEmpty !== false ? <option value="">{emptyLabel}</option> : null}
      {rows.map((c) => (
        <option key={c.id} value={c.id}>
          {c.code} - {c.arabicName}
        </option>
      ))}
    </select>
  );
}

export function BranchSelect({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const { data } = useBranchesQuery(100);
  const branches = (data?.data ?? []) as Array<{ id: string; arabicName?: string; name?: string }>;
  return (
    <select className={compactControlClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.arabicName ?? b.name ?? b.id}
        </option>
      ))}
    </select>
  );
}

export function CostCenterSelect({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const { data } = useCostCentersQuery(500, { leafOnly: true });
  return (
    <select className={compactControlClass} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {(data?.data ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.code ? `${c.code} - ` : ''}
          {c.arabicName}
        </option>
      ))}
    </select>
  );
}

/** Read-only preview of the journal a post will create (من / إلى). */
export function JournalPreviewTable({ lines }: { lines: JournalPreviewLine[] }) {
  if (!lines.length) return null;
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-surface-2 text-xs text-foreground-muted">
          <tr>
            <th className="p-2 text-start">الحساب</th>
            <th className="p-2 text-start">البيان</th>
            <th className="p-2 text-end">مدين</th>
            <th className="p-2 text-end">دائن</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={`${l.accountId}-${i}`} className="border-t border-border">
              <td className="p-2">
                {l.accountCode ? `${l.accountCode} - ` : ''}
                {l.accountName || l.accountId}
              </td>
              <td className="p-2 text-foreground-muted">{l.description ?? ''}</td>
              <td className="p-2 text-end tabular-nums">{l.debit ? formatMoney(l.debit) : ''}</td>
              <td className="p-2 text-end tabular-nums">{l.credit ? formatMoney(l.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-surface-2 font-semibold">
          <tr>
            <td className="p-2" colSpan={2}>
              الإجمالي
            </td>
            <td className="p-2 text-end tabular-nums">{formatMoney(totalDebit)}</td>
            <td className="p-2 text-end tabular-nums">{formatMoney(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="text-xs font-semibold text-foreground-muted">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</div>
      {hint ? <div className="mt-1 text-xs text-foreground-muted">{hint}</div> : null}
    </div>
  );
}
