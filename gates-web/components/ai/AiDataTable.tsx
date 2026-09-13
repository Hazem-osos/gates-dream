'use client';

import type { AiTableBlock } from '@/lib/ai/types';

function cellText(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number') return value.toLocaleString('ar-EG');
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function AiDataTable({ table }: { table: AiTableBlock }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-right text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {table.columns.map((column) => (
              <th key={column} className="h-8 px-2 font-semibold whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 ? 'bg-[#F6FBFD]' : 'bg-white'}>
              {table.columns.map((column) => (
                <td key={column} className="h-8 px-2 tabular-nums text-[#094C6B] whitespace-nowrap">
                  {cellText(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
