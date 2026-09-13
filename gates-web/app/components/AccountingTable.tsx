'use client';

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

type Cell = string | number | React.ReactNode;

interface AccountingTableProps {
  columns: { label: string; align?: 'left' | 'center' | 'right'; className?: string }[];
  rows?: Cell[][];
  /** Prefer with `renderRow` so only visible rows are constructed. */
  rowCount?: number;
  renderRow?: (index: number) => Cell[];
  virtualizeThreshold?: number;
  onRowIntent?: (rowIndex: number) => void;
}

const AccountingTable: React.FC<AccountingTableProps> = ({
  columns,
  rows,
  rowCount,
  renderRow,
  virtualizeThreshold = 40,
  onRowIntent,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const count = rowCount ?? rows?.length ?? 0;
  const useVirtual = count >= virtualizeThreshold;

  const getRow = (index: number): Cell[] => renderRow?.(index) ?? rows?.[index] ?? [];

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
    enabled: useVirtual,
  });

  const visibleIndexes = useVirtual
    ? virtualizer.getVirtualItems().map((v) => v.index)
    : Array.from({ length: count }, (_, i) => i);

  const bodyContent = useVirtual ? (
    <tbody className="bg-slate-100 block" style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
      {virtualizer.getVirtualItems().map((vRow) => {
        const row = getRow(vRow.index);
        return (
          <tr
            key={vRow.key}
            tabIndex={0}
            className="table w-full table-fixed absolute left-0"
            style={{ transform: `translateY(${vRow.start}px)` }}
            onMouseEnter={() => onRowIntent?.(vRow.index)}
            onFocus={() => onRowIntent?.(vRow.index)}
          >
            {row.map((cell, j) => (
              <td
                key={j}
                className={`px-4 py-3 border-x border-[#D6EAF3] bg-slate-100 rounded-md text-slate-400 ${columns[j]?.align === 'center' ? 'text-center' : columns[j]?.align === 'left' ? 'text-left' : 'text-right'}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  ) : (
    <tbody className="bg-slate-100">
      {visibleIndexes.map((i) => {
        const row = getRow(i);
        return (
          <tr
            key={i}
            tabIndex={0}
            onMouseEnter={() => onRowIntent?.(i)}
            onFocus={() => onRowIntent?.(i)}
          >
            {row.map((cell, j) => (
              <td
                key={j}
                className={`px-4 py-3 border-x border-[#D6EAF3] bg-slate-100 rounded-md text-slate-400 ${columns[j]?.align === 'center' ? 'text-center' : columns[j]?.align === 'left' ? 'text-left' : 'text-right'}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );

  return (
    <div className={useVirtual ? 'overflow-x-auto max-h-[480px] overflow-y-auto' : 'overflow-x-auto'} ref={useVirtual ? parentRef : undefined}>
      <table className="w-full border-separate border-spacing-y-2">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.label}
                className={`bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white px-4 py-3 shadow-md border-x border-white/20 rounded-md ${col.align === 'center' ? 'text-center' : col.align === 'left' ? 'text-left' : 'text-right'} ${col.className || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        {bodyContent}
      </table>
    </div>
  );
};

export default AccountingTable;
