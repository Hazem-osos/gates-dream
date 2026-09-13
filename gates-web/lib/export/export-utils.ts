'use client';

import type { AppTableColumn } from '@/app/components/ui/AppTable';

export type ExportColumnDef<T extends Record<string, unknown> = Record<string, unknown>> = {
  header: string;
  id: string;
  accessor?: keyof T;
  numeric?: boolean;
  getValue?: (row: T) => unknown;
};

export function rowsToExportMatrix<T extends Record<string, unknown>>(
  columns: ExportColumnDef<T>[],
  data: T[]
): { headers: string[]; rows: (string | number)[][] } {
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      let raw: unknown;
      if (col.getValue) raw = col.getValue(row);
      else if (col.accessor) raw = row[col.accessor];
      else raw = '';
      if (raw == null || raw === '') return '';
      if (col.numeric && typeof raw === 'number') {
        return Math.round(raw * 100) / 100;
      }
      if (typeof raw === 'boolean') return raw ? 'نعم' : 'لا';
      return String(raw);
    })
  );
  return { headers, rows };
}

export function appTableColumnsToExport<T extends Record<string, unknown>>(
  columns: AppTableColumn<T>[]
): ExportColumnDef<T>[] {
  return columns
    .filter((col) => col.accessor != null)
    .map((col) => ({
      id: col.id,
      header: typeof col.header === 'string' ? col.header : col.id,
      accessor: col.accessor,
      numeric: col.numeric,
    }));
}

export async function exportRowsToExcel(
  fileName: string,
  headers: string[],
  rows: (string | number)[][],
  sheetName = 'Sheet1'
): Promise<void> {
  const { utils, writeFile } = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
  const aoa = [headers, ...rows];
  const ws = utils.aoa_to_sheet(aoa);
  const colWidths = headers.map((h, ci) => {
    let max = h.length;
    for (const row of rows) {
      const cell = row[ci];
      max = Math.max(max, String(cell ?? '').length);
    }
    return { wch: Math.min(48, max + 2) };
  });
  ws['!cols'] = colWidths;
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

export async function exportTableToExcel<T extends Record<string, unknown>>(
  fileName: string,
  columns: ExportColumnDef<T>[],
  data: T[],
  sheetName?: string
): Promise<void> {
  const { headers, rows } = rowsToExportMatrix(columns, data);
  await exportRowsToExcel(fileName, headers, rows, sheetName);
}

export function openPrintWindow(html: string, title = 'طباعة'): void {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    window.alert('يرجى السماح بالنوافذ المنبثقة للطباعة');
    return;
  }
  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>${title}</title></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  window.setTimeout(() => {
    w.print();
  }, 350);
}

export function printElementById(elementId: string, title?: string): void {
  const el = document.getElementById(elementId);
  if (!el) return;
  openPrintWindow(el.outerHTML, title);
}
