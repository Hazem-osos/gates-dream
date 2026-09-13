'use client';

import Link from 'next/link';
import {
  dataEntryGridBodyCellClass,
  dataEntryGridHeadCellClass,
  dataEntryGridHeadRowClass,
  dataEntryGridWrapClass,
} from '@/components/ui/data-entry-grid/tokens';
import { money, movementAmount, type MovementRow } from './types';

type Props = {
  rows: MovementRow[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  emptyMessage?: string;
};

export function MovementTransferGrid({
  rows,
  selectedIds,
  onToggle,
  onToggleAll,
  emptyMessage = 'حمّل حركات الفترة لعرضها هنا',
}: Props) {
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + movementAmount(row), 0);

  return (
    <div className="space-y-2" dir="rtl">
      {rows.length > 0 ? (
        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground">
          تم تحديد {selectedIds.length} حركة بإجمالي مبلغ {money(selectedTotal)}
        </div>
      ) : null}

      <div className={dataEntryGridWrapClass}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className={dataEntryGridHeadRowClass}>
                <th className={`${dataEntryGridHeadCellClass} w-10 text-center`}>#</th>
                <th className={`${dataEntryGridHeadCellClass} w-12 text-center`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label="تحديد الكل"
                  />
                </th>
                <th className={dataEntryGridHeadCellClass}>رقم القيد / المستند</th>
                <th className={`${dataEntryGridHeadCellClass} text-center`}>التاريخ</th>
                <th className={dataEntryGridHeadCellClass}>البيان</th>
                <th className={`${dataEntryGridHeadCellClass} text-left`}>المبلغ (مدين / دائن)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className={`${dataEntryGridBodyCellClass} py-8 text-center text-muted-foreground`}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const checked = selectedIds.includes(row.id);
                  const href = row.journalEntryId
                    ? `/accounting/operations/journal-entry?id=${encodeURIComponent(row.journalEntryId)}`
                    : null;
                  return (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className={`${dataEntryGridBodyCellClass} text-center font-mono text-xs text-muted-foreground`}>
                        {index + 1}
                      </td>
                      <td className={`${dataEntryGridBodyCellClass} text-center`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggle(row.id)}
                          aria-label={`تحديد الحركة ${index + 1}`}
                        />
                      </td>
                      <td className={`${dataEntryGridBodyCellClass} font-mono text-xs`}>
                        {href ? (
                          <Link href={href} className="font-semibold text-primary hover:underline">
                            {row.documentNumber}
                          </Link>
                        ) : (
                          row.documentNumber
                        )}
                      </td>
                      <td className={`${dataEntryGridBodyCellClass} text-center font-mono text-xs`}>
                        {row.date}
                      </td>
                      <td className={dataEntryGridBodyCellClass}>{row.description || '—'}</td>
                      <td className={`${dataEntryGridBodyCellClass} text-left font-mono text-xs`}>
                        {row.debit > 0 ? (
                          <span>مدين {money(row.debit)}</span>
                        ) : (
                          <span>دائن {money(row.credit)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
