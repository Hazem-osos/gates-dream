'use client';

import { Search } from 'lucide-react';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TableExportActions } from './TableExportActions';
import type { ExportColumnDef } from '@/lib/export/export-utils';

export interface FilterToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  debounceMs?: number;
  children?: React.ReactNode;
  className?: string;
  /** When set, shows Excel + print export for the current filtered rows */
  exportConfig?: {
    fileName: string;
    columns: ExportColumnDef<Record<string, unknown>>[];
    rows: Record<string, unknown>[];
    printTitle?: string;
  };
}

export function FilterToolbar({
  searchPlaceholder = 'بحث…',
  searchValue: controlledSearch,
  onSearchChange,
  debounceMs = 250,
  children,
  className,
  exportConfig,
}: FilterToolbarProps) {
  const [local, setLocal] = useState(controlledSearch ?? '');
  const debounced = useDebouncedValue(local, debounceMs);

  useEffect(() => {
    onSearchChange?.(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire on debounced value only
  }, [debounced]);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-3',
        className
      )}
      dir="rtl"
    >
      <div className="relative min-w-[200px] flex-1">
        <Search
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0E78AA]"
          aria-hidden
        />
        <input
          type="search"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-white pr-10 pl-3 text-xs font-medium text-[#094C6B] focus:border-[#0E78AA] focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 sm:text-sm"
        />
      </div>
      {children}
      {exportConfig ? (
        <TableExportActions
          fileName={exportConfig.fileName}
          columns={exportConfig.columns}
          data={exportConfig.rows}
          printTitle={exportConfig.printTitle}
        />
      ) : null}
    </div>
  );
}
