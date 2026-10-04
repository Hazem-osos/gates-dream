import ExcelJS from 'exceljs';
import type { BOQItemUnit } from '@prisma/client';
import { findHeaderRow, loadWorkbook, mapColumns, pickDataSheet, resolveBoqUnit } from '../excel/excel-workbook';
import type { ValidatedExcelRow } from '../excel/types';

const ALIASES: Record<string, string[]> = {
  itemCode: ['كود البند', 'item code', 'itemcode', 'الكود', 'code'],
  descriptionAr: ['البيان', 'description', 'description ar', 'وصف البند', 'الوصف'],
  unit: ['الوحدة', 'unit', 'وحدة القياس'],
  quantity: ['الكمية', 'quantity', 'الكمية التعاقدية'],
  sectionName: ['القسم', 'section'],
  notes: ['ملاحظات', 'notes'],
};

export type TenderBoqImportRow = {
  itemCode: string;
  descriptionAr: string;
  unit: BOQItemUnit;
  quantity: number;
  sectionName?: string;
  notes?: string;
};

export class TenderBoqExcelService {
  async preview(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer, 'tender-boq.xlsx');
    const sheet = pickDataSheet(workbook, ['BOQ', 'مقايسة', 'Sheet1']);
    const { rowNumber: headerRow, headers } = findHeaderRow(sheet, ['الكود', 'code', 'item']);
    const colMap = mapColumns(headers, ALIASES);
    const rows: ValidatedExcelRow<TenderBoqImportRow>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow) return;
      const itemCode = String(row.getCell(colMap.itemCode + 1).text ?? '').trim();
      const descriptionAr = String(row.getCell(colMap.descriptionAr + 1).text ?? '').trim();
      if (!itemCode && !descriptionAr) return;

      const errors: string[] = [];
      const qtyRaw = row.getCell(colMap.quantity + 1).value;
      const qty = Number(qtyRaw);
      if (!itemCode) errors.push('الكود مطلوب');
      if (!descriptionAr) errors.push('البيان مطلوب');
      if (!Number.isFinite(qty) || qty <= 0) errors.push('كمية غير صالحة');

      let unit: BOQItemUnit = 'ITEM';
      try {
        unit = resolveBoqUnit(String(row.getCell(colMap.unit + 1).text ?? 'ITEM'));
      } catch {
        errors.push('وحدة غير معروفة');
      }

      rows.push({
        rowNumber,
        isValid: errors.length === 0,
        errors,
        data:
          errors.length === 0
            ? {
                itemCode,
                descriptionAr,
                unit,
                quantity: qty,
                sectionName: colMap.sectionName != null
                  ? String(row.getCell(colMap.sectionName + 1).text ?? '').trim() || undefined
                  : undefined,
                notes: colMap.notes != null
                  ? String(row.getCell(colMap.notes + 1).text ?? '').trim() || undefined
                  : undefined,
              }
            : undefined,
      });
    });

    return {
      totalRows: rows.length,
      validRowsCount: rows.filter((r) => r.isValid).length,
      invalidRowsCount: rows.filter((r) => !r.isValid).length,
      rows,
    };
  }

  async buildFixtureBuffer(rows: Array<{ code: string; desc: string; unit: string; qty: number }>) {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('BOQ');
    sheet.addRow(['الكود', 'البيان', 'الوحدة', 'الكمية']);
    for (const r of rows) sheet.addRow([r.code, r.desc, r.unit, r.qty]);
    sheet.addRow(['BAD', 'Invalid qty', 'M3', 'not-a-number']);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}

export const tenderBoqExcelService = new TenderBoqExcelService();
