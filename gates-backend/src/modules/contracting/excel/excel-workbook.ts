import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { AppError } from '../../../shared/middleware/error-handler';
import { BRAND_ARGB, EXCEL_MAX_ROWS } from './types';

export const BOQ_UNITS = ['M2', 'M3', 'TON', 'ITEM', 'LM', 'LS'] as const;

const UNIT_ALIASES: Record<string, (typeof BOQ_UNITS)[number]> = {
  M2: 'M2',
  'م2': 'M2',
  'متر مربع': 'M2',
  M3: 'M3',
  'م3': 'M3',
  'متر مكعب': 'M3',
  TON: 'TON',
  TONS: 'TON',
  'طن': 'TON',
  ITEM: 'ITEM',
  PCS: 'ITEM',
  'قطعة': 'ITEM',
  'عدد': 'ITEM',
  LM: 'LM',
  'م.ط': 'LM',
  'م ط': 'LM',
  'متر طولي': 'LM',
  LS: 'LS',
  'مقطوعية': 'LS',
  LUMPSUM: 'LS',
};

export function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
    if ('text' in value && value.text != null) return String(value.text).trim();
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('formula' in value && 'result' in value) return cellText((value as { result?: ExcelJS.CellValue }).result);
  }
  return '';
}

export function cellNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = cellText(value).replace(/,/g, '').replace(/٫/g, '.');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\]]/g, ' ')
    .replace(/[_./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveBoqUnit(raw: string): (typeof BOQ_UNITS)[number] | null {
  const key = raw.trim().toUpperCase();
  if ((BOQ_UNITS as readonly string[]).includes(key)) return key as (typeof BOQ_UNITS)[number];
  return UNIT_ALIASES[raw.trim()] ?? UNIT_ALIASES[key] ?? UNIT_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export function styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const row = sheet.getRow(1);
  row.height = 24;
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Cairo', size: 11 };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true, readingOrder: 'rtl' };
  for (let col = 1; col <= columnCount; col += 1) {
    const cell = row.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_ARGB } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0A5F8A' } },
      bottom: { style: 'thin', color: { argb: 'FF0A5F8A' } },
      left: { style: 'thin', color: { argb: 'FF0A5F8A' } },
      right: { style: 'thin', color: { argb: 'FF0A5F8A' } },
    };
  }
}

export function applyListValidation(
  sheet: ExcelJS.Worksheet,
  cells: string[],
  listFormula: string,
  error: string
): void {
  const validation: ExcelJS.DataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: [listFormula],
    showErrorMessage: true,
    errorTitle: 'قيمة غير صالحة',
    error,
  };
  for (const address of cells) {
    sheet.getCell(address).dataValidation = validation;
  }
}

export function applyRtlSheet(sheet: ExcelJS.Worksheet): void {
  sheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];
  sheet.properties.defaultRowHeight = 18;
}

export function autosizeColumns(sheet: ExcelJS.Worksheet, headers: string[]): void {
  headers.forEach((header, index) => {
    const column = sheet.getColumn(index + 1);
    column.width = Math.min(42, Math.max(14, header.length + 4));
    column.alignment = { readingOrder: 'rtl', vertical: 'middle' };
  });
}

export async function loadWorkbook(buffer: Buffer, filename: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const lower = filename.toLowerCase();
  try {
    if (lower.endsWith('.csv')) {
      await workbook.csv.read(Readable.from(Uint8Array.from(buffer)), { sheetName: 'مقايسة' });
    } else {
      await workbook.xlsx.load(buffer as never);
    }
  } catch {
    throw new AppError(400, 'تعذر قراءة ملف Excel. استخدم القالب المعتمد بصيغة .xlsx أو .csv');
  }
  return workbook;
}

export function pickDataSheet(workbook: ExcelJS.Workbook, preferredNames: string[]): ExcelJS.Worksheet {
  for (const name of preferredNames) {
    const match = workbook.worksheets.find((sheet) => sheet.name.trim() === name);
    if (match) return match;
  }
  const first = workbook.worksheets.find((sheet) => !/تعليمات|instructions/i.test(sheet.name));
  if (!first) throw new AppError(400, 'الملف لا يحتوي على ورقة بيانات');
  return first;
}

export function findHeaderRow(
  sheet: ExcelJS.Worksheet,
  tokens: string[]
): { rowNumber: number; headers: string[] } {
  const maxScan = Math.min(6, sheet.rowCount || 6);
  for (let rowNumber = 1; rowNumber <= maxScan; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const headers: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col - 1] = cellText(cell.value);
    });
    const haystack = headers.map(normalizeHeader).join(' | ');
    if (tokens.some((token) => haystack.includes(normalizeHeader(token)))) {
      return { rowNumber, headers };
    }
  }
  throw new AppError(400, 'صف العناوين غير موجود. نزّل القالب القياسي وأعد التعبئة');
}

export function mapColumns(headers: string[], aliases: Record<string, string[]>): Record<string, number> {
  const mapped: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;
    for (const [key, options] of Object.entries(aliases)) {
      if (mapped[key] != null) continue;
      if (options.some((option) => normalized.includes(normalizeHeader(option)))) {
        mapped[key] = index;
      }
    }
  });
  return mapped;
}

export function assertRowBudget(count: number): void {
  if (count > EXCEL_MAX_ROWS) {
    throw new AppError(400, `عدد السطور يتجاوز الحد الأقصى (${EXCEL_MAX_ROWS})`);
  }
}

export function addInstructionsSheet(workbook: ExcelJS.Workbook, lines: string[]): void {
  const sheet = workbook.addWorksheet('تعليمات');
  applyRtlSheet(sheet);
  sheet.getColumn(1).width = 88;
  sheet.getCell('A1').value = 'تعليمات الاستيراد — Gates ERP';
  sheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13, name: 'Cairo' };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_ARGB } };
  lines.forEach((line, index) => {
    sheet.getCell(`A${index + 3}`).value = line;
    sheet.getCell(`A${index + 3}`).alignment = { readingOrder: 'rtl', wrapText: true };
  });
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  workbook.creator = 'Gates ERP';
  workbook.created = new Date();
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function sendXlsx(res: { setHeader: (k: string, v: string) => void; send: (b: Buffer) => void }, filename: string, buffer: Buffer): void {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Length', String(buffer.length));
  res.send(buffer);
}
