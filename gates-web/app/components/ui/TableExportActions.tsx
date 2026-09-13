'use client';

import { FileSpreadsheet, Printer } from 'lucide-react';
import { Button } from './button';
import {
  exportTableToExcel,
  openPrintWindow,
  type ExportColumnDef,
} from '@/lib/export/export-utils';

export function TableExportActions<T extends Record<string, unknown>>({
  fileName,
  columns,
  data,
  printTitle,
}: {
  fileName: string;
  columns: ExportColumnDef<T>[];
  data: T[];
  printTitle?: string;
}) {
  const disabled = data.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        className="gap-1.5"
        onClick={() => void exportTableToExcel(fileName, columns, data)}
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        تصدير إلى Excel
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        className="gap-1.5"
        onClick={() => {
          const tableHtml = buildPrintTableHtml(columns, data);
          openPrintWindow(tableHtml, printTitle ?? fileName);
        }}
      >
        <Printer className="h-4 w-4" aria-hidden />
        PDF / طباعة
      </Button>
    </div>
  );
}

function buildPrintTableHtml<T extends Record<string, unknown>>(
  columns: ExportColumnDef<T>[],
  data: T[]
): string {
  const headers = columns.map((c) => c.header);
  const bodyRows = data
    .map((row) => {
      const cells = columns
        .map((col) => {
          let raw: unknown = col.accessor ? row[col.accessor] : '';
          if (col.getValue) raw = col.getValue(row);
          const text = raw == null ? '' : String(raw);
          return `<td style="border:1px solid #ccc;padding:6px;text-align:right">${text}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  const head = headers
    .map(
      (h) =>
        `<th style="border:1px solid #ccc;padding:6px;background:#1787B8;color:#fff">${h}</th>`
    )
    .join('');
  return `<div dir="rtl" style="font-family:Tahoma,sans-serif;padding:16px"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}
