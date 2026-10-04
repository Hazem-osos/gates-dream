'use client';

import type { AppTableColumn } from '@/app/components/ui/AppTable';
import { printDom, printHtml, wrapPrintHtml } from '@/lib/print/printHtml';

export type ExportColumnDef<T extends object = Record<string, unknown>> = {
  header: string;
  id: string;
  accessor?: keyof T;
  numeric?: boolean;
  getValue?: (row: T) => unknown;
};

export function rowsToExportMatrix<T extends object>(
  columns: ExportColumnDef<T>[],
  data: T[]
): { headers: string[]; rows: (string | number)[][] } {
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      const record = row as Record<string, unknown>;
      let raw: unknown;
      if (col.getValue) raw = col.getValue(row);
      else if (col.accessor) raw = record[String(col.accessor)];
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

export function appTableColumnsToExport<T extends object>(
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
  sheetName = 'Sheet1',
  numericColumnIndexes?: number[]
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
  if (numericColumnIndexes?.length) {
    for (let ri = 1; ri < aoa.length; ri += 1) {
      for (const ci of numericColumnIndexes) {
        const addr = utils.encode_cell({ r: ri, c: ci });
        const cell = ws[addr];
        if (!cell || cell.v === '' || cell.v == null) continue;
        if (typeof cell.v === 'number') {
          cell.t = 'n';
          cell.z = '#,##0.00';
        }
      }
    }
  }
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

export async function exportTableToExcel<T extends object>(
  fileName: string,
  columns: ExportColumnDef<T>[],
  data: T[],
  sheetName?: string
): Promise<void> {
  const { headers, rows } = rowsToExportMatrix(columns, data);
  const numericColumnIndexes = columns
    .map((col, index) => (col.numeric ? index : -1))
    .filter((index) => index >= 0);
  await exportRowsToExcel(
    fileName,
    headers,
    rows,
    sheetName,
    numericColumnIndexes.length ? numericColumnIndexes : undefined
  );
}

export function openPrintWindow(html: string, title = 'طباعة'): void {
  void printHtml(wrapPrintHtml(html, title));
}

export function printElementById(elementId: string, title?: string): void {
  const el = document.getElementById(elementId);
  if (!el) return;
  void printDom(el, title);
}
