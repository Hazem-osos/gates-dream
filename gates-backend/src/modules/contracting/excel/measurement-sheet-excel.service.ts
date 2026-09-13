import ExcelJS from 'exceljs';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { ContractingProjectNotFoundError } from '../technical-office/errors/technical-office-domain.errors';
import { executiveMeasurementSheetService } from '../technical-office/services/executive-measurement-sheet.service';
import { money } from '../utils/money-decimal';
import {
  addInstructionsSheet,
  applyListValidation,
  applyRtlSheet,
  assertRowBudget,
  autosizeColumns,
  cellNumber,
  cellText,
  findHeaderRow,
  loadWorkbook,
  mapColumns,
  pickDataSheet,
  styleHeaderRow,
  workbookToBuffer,
} from './excel-workbook';
import {
  EXCEL_TEMPLATE_ROWS,
  type ExcelValidationReport,
  type MeasurementCommitResult,
  type MeasurementRowDto,
  type ValidatedExcelRow,
} from './types';

const MEASUREMENT_HEADERS = [
  'كود البند (BOQ Item Code)',
  'رقم الشيت (Sheet No)',
  'الموقع / الدور / الزون (Location / Zone)',
  'المحاور (Axis Ref)',
  'بيان الأعمال المنفذة (Statement)',
  'العدد (Count / Multiplier)',
  'الطول (Length)',
  'العرض (Width)',
  'الارتفاع / السمك (Height)',
  'إجمالي الناتج (Gross Qty)',
  'كمية الخصم (Deduction Qty)',
  'صافي الكمية المنجزة (Net Qty)',
];

const MEASUREMENT_ALIASES: Record<string, string[]> = {
  itemCode: ['كود البند', 'boq item code', 'item code'],
  sheetNumber: ['رقم الشيت', 'sheet no', 'sheet number'],
  locationZone: ['الموقع', 'location', 'zone'],
  axisGridRef: ['المحاور', 'axis'],
  statement: ['بيان الأعمال', 'statement'],
  multiplierCount: ['العدد', 'count', 'multiplier'],
  dimensionLength: ['الطول', 'length'],
  dimensionWidth: ['العرض', 'width'],
  dimensionHeight: ['الارتفاع', 'السمك', 'height'],
  deductionQty: ['كمية الخصم', 'deduction'],
};

export class MeasurementSheetExcelService {
  async generateMeasurementTemplate(
    companyId: string,
    projectId: string
  ): Promise<{ filename: string; buffer: Buffer }> {
    await this.assertProject(companyId, projectId);
    const boqItems = await prisma.projectBOQItem.findMany({
      where: { companyId, projectId },
      select: { itemCode: true, descriptionAr: true, unit: true, contractQuantity: true },
      orderBy: { itemCode: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const ref = workbook.addWorksheet('بنود المقايسة');
    applyRtlSheet(ref);
    const refHeaders = ['كود البند', 'الوصف', 'الوحدة', 'الكمية التعاقدية'];
    ref.addRow(refHeaders);
    styleHeaderRow(ref, refHeaders.length);
    autosizeColumns(ref, refHeaders);
    if (boqItems.length === 0) {
      ref.addRow(['—', 'لا توجد بنود مقايسة بعد. أضف المقايسة ثم أعد تنزيل القالب.', '', '']);
    } else {
      for (const item of boqItems) {
        ref.addRow([item.itemCode, item.descriptionAr, item.unit, Number(item.contractQuantity)]);
      }
    }
    const lastBoqRow = Math.max(2, boqItems.length + 1);

    const sheet = workbook.addWorksheet('حصر الأعمال');
    applyRtlSheet(sheet);
    sheet.addRow(MEASUREMENT_HEADERS);
    styleHeaderRow(sheet, MEASUREMENT_HEADERS.length);
    autosizeColumns(sheet, MEASUREMENT_HEADERS);
    sheet.getColumn(6).numFmt = '#,##0.000';
    sheet.getColumn(10).numFmt = '#,##0.000';
    sheet.getColumn(11).numFmt = '#,##0.000';
    sheet.getColumn(12).numFmt = '#,##0.000';

    const codeCells: string[] = [];
    for (let row = 2; row <= EXCEL_TEMPLATE_ROWS + 1; row += 1) {
      for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K'] as const) {
        sheet.getCell(`${col}${row}`).protection = { locked: false };
      }
      sheet.getCell(`F${row}`).value = 1;
      sheet.getCell(`K${row}`).value = 0;
      const gross = sheet.getCell(`J${row}`);
      gross.value = { formula: `F${row}*IF(G${row}>0,G${row},1)*IF(H${row}>0,H${row},1)*IF(I${row}>0,I${row},1)` };
      gross.protection = { locked: true };
      const net = sheet.getCell(`L${row}`);
      net.value = { formula: `J${row}-K${row}` };
      net.protection = { locked: true };
      codeCells.push(`A${row}`);
    }

    applyListValidation(
      sheet,
      codeCells,
      `'بنود المقايسة'!$A$2:$A$${lastBoqRow}`,
      'اختر كود بند من قائمة مقايسة المالك'
    );

    await sheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      insertRows: true,
    });

    addInstructionsSheet(workbook, [
      'ورقة «بنود المقايسة» مرجع للقائمة المنسدلة — لا تعدّل أكوادها.',
      'رقم الشيت يجب أن يكون فريدًا داخل المشروع.',
      'الأبعاد الاختيارية: اترك الخلية فارغة إذا لم تُستخدم. الصفر يُعامل كقيمة غير مدخلة.',
      'إجمالي الناتج وصافي الكمية معادلات مقفولة. لا تكتب فوقهما.',
      'الحد الأقصى 5000 سطر و 15 ميجابايت.',
    ]);

    return {
      filename: `gates-measurement-template-${projectId.slice(0, 8)}.xlsx`,
      buffer: await workbookToBuffer(workbook),
    };
  }

  async parseAndValidateMeasurements(
    companyId: string,
    projectId: string,
    buffer: Buffer,
    filename: string
  ): Promise<ExcelValidationReport<MeasurementRowDto>> {
    await this.assertProject(companyId, projectId);
    const [boqItems, existingSheets] = await Promise.all([
      prisma.projectBOQItem.findMany({
        where: { companyId, projectId },
        select: { id: true, itemCode: true },
      }),
      prisma.executiveMeasurementSheet.findMany({
        where: { companyId, projectId },
        select: { sheetNumber: true },
      }),
    ]);
    const boqByCode = new Map(boqItems.map((item) => [item.itemCode, item.id]));
    const existingSheetNumbers = new Set(existingSheets.map((row) => row.sheetNumber));

    const workbook = await loadWorkbook(buffer, filename);
    const sheet = pickDataSheet(workbook, ['حصر الأعمال']);
    const { rowNumber: headerRow, headers } = findHeaderRow(sheet, ['كود البند', 'رقم الشيت', 'boq item']);
    const columns = mapColumns(headers, MEASUREMENT_ALIASES);
    if (columns.itemCode == null || columns.sheetNumber == null) {
      throw new AppError(400, 'أعمدة قالب الحصر غير مكتملة. نزّل القالب القياسي');
    }

    const seenSheets = new Map<string, number>();
    const rows: ValidatedExcelRow<MeasurementRowDto>[] = [];

    for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const excelRow = sheet.getRow(rowNumber);
      const itemCode = cellText(excelRow.getCell(columns.itemCode + 1).value);
      const sheetNumber = cellText(excelRow.getCell(columns.sheetNumber + 1).value);
      if (!itemCode && !sheetNumber) continue;

      const multiplierRaw = columns.multiplierCount != null ? cellNumber(excelRow.getCell(columns.multiplierCount + 1).value) : 1;
      const length = optionalPositive(columns.dimensionLength != null ? cellNumber(excelRow.getCell(columns.dimensionLength + 1).value) : null);
      const width = optionalPositive(columns.dimensionWidth != null ? cellNumber(excelRow.getCell(columns.dimensionWidth + 1).value) : null);
      const height = optionalPositive(columns.dimensionHeight != null ? cellNumber(excelRow.getCell(columns.dimensionHeight + 1).value) : null);
      const deductionRaw = columns.deductionQty != null ? cellNumber(excelRow.getCell(columns.deductionQty + 1).value) : 0;

      const errors: string[] = [];
      if (!itemCode) errors.push('كود البند مطلوب');
      if (!sheetNumber) errors.push('رقم الشيت مطلوب');
      const projectBOQItemId = boqByCode.get(itemCode);
      if (itemCode && !projectBOQItemId) errors.push(`كود البند غير موجود في مقايسة المشروع: ${itemCode}`);
      if (sheetNumber && seenSheets.has(sheetNumber)) {
        errors.push(`رقم الشيت مكرر في السطر ${seenSheets.get(sheetNumber)}`);
      } else if (sheetNumber) {
        seenSheets.set(sheetNumber, rowNumber);
      }
      if (sheetNumber && existingSheetNumbers.has(sheetNumber)) {
        errors.push('رقم الشيت موجود مسبقًا في دفتر الحصر');
      }
      if (multiplierRaw != null && multiplierRaw < 0) errors.push('العدد لا يجوز أن يكون سالبًا');
      if (deductionRaw != null && deductionRaw < 0) errors.push('كمية الخصم لا يجوز أن تكون سالبة');

      let calculatedGrossQty = 0;
      let netExecutedQty = 0;
      const multiplierCount = multiplierRaw == null ? 1 : multiplierRaw;
      const deductionQty = deductionRaw == null ? 0 : deductionRaw;
      try {
        const qty = executiveMeasurementSheetService.calculateSheetNetQuantity({
          multiplierCount,
          dimensionLength: length,
          dimensionWidth: width,
          dimensionHeight: height,
          deductionQty,
        });
        calculatedGrossQty = Number(qty.calculatedGrossQty.toFixed(4));
        netExecutedQty = Number(qty.netExecutedQty.toFixed(4));
        if (money(deductionQty).gt(qty.calculatedGrossQty)) {
          errors.push('كمية الخصم أكبر من إجمالي الناتج');
        }
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'أبعاد الحصر غير صالحة');
      }

      rows.push({
        rowNumber,
        isValid: errors.length === 0,
        errors,
        data: {
          itemCode,
          projectBOQItemId,
          sheetNumber,
          locationZone: textOrNull(columns.locationZone != null ? cellText(excelRow.getCell(columns.locationZone + 1).value) : ''),
          axisGridRef: textOrNull(columns.axisGridRef != null ? cellText(excelRow.getCell(columns.axisGridRef + 1).value) : ''),
          statement: textOrNull(columns.statement != null ? cellText(excelRow.getCell(columns.statement + 1).value) : ''),
          multiplierCount,
          dimensionLength: length,
          dimensionWidth: width,
          dimensionHeight: height,
          calculatedGrossQty,
          deductionQty,
          netExecutedQty,
          measurementDate: new Date().toISOString().slice(0, 10),
        },
      });
    }

    assertRowBudget(rows.length);
    return {
      totalRows: rows.length,
      validRowsCount: rows.filter((row) => row.isValid).length,
      invalidRowsCount: rows.filter((row) => !row.isValid).length,
      rows,
    };
  }

  async commitMeasurementImport(
    companyId: string,
    projectId: string,
    validRows: MeasurementRowDto[],
    status: 'DRAFT' | 'SITE_ENGINEER_VERIFIED' = 'DRAFT'
  ): Promise<MeasurementCommitResult> {
    if (!validRows.length) throw new AppError(400, 'لا توجد سطور حصر سليمة للاستيراد');
    await this.assertProject(companyId, projectId);

    const boqItems = await prisma.projectBOQItem.findMany({
      where: { companyId, projectId, itemCode: { in: validRows.map((row) => row.itemCode) } },
      select: { id: true, itemCode: true },
    });
    const boqByCode = new Map(boqItems.map((item) => [item.itemCode, item.id]));

    const existing = await prisma.executiveMeasurementSheet.findMany({
      where: { companyId, projectId, sheetNumber: { in: validRows.map((row) => row.sheetNumber) } },
      select: { sheetNumber: true },
    });
    if (existing.length) {
      throw new AppError(409, `أرقام شيتات موجودة مسبقًا: ${existing.map((row) => row.sheetNumber).join(', ')}`);
    }

    const data = validRows.map((row) => {
      const projectBOQItemId = row.projectBOQItemId ?? boqByCode.get(row.itemCode);
      if (!projectBOQItemId) throw new AppError(400, `كود البند غير موجود: ${row.itemCode}`);
      const qty = executiveMeasurementSheetService.calculateSheetNetQuantity(row);
      return {
        companyId,
        projectId,
        projectBOQItemId,
        sheetNumber: row.sheetNumber,
        measurementDate: row.measurementDate ? new Date(row.measurementDate) : new Date(),
        locationZone: row.locationZone ?? null,
        axisGridRef: row.axisGridRef ?? null,
        statement: row.statement ?? null,
        multiplierCount: qty.multiplierCount,
        dimensionLength: qty.dimensionLength,
        dimensionWidth: qty.dimensionWidth,
        dimensionHeight: qty.dimensionHeight,
        calculatedGrossQty: qty.calculatedGrossQty,
        deductionQty: qty.deductionQty,
        netExecutedQty: qty.netExecutedQty,
        status,
      };
    });

    await prisma.$transaction(
      async (tx) => {
        await tx.executiveMeasurementSheet.createMany({ data });
      },
      { timeout: 120_000, maxWait: 10_000 }
    );

    return { created: data.length, total: data.length };
  }

  private async assertProject(companyId: string, projectId: string) {
    const project = await prisma.contractingProject.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);
  }
}

function optionalPositive(value: number | null): number | null {
  if (value == null || value === 0) return null;
  return value;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export const measurementSheetExcelService = new MeasurementSheetExcelService();
