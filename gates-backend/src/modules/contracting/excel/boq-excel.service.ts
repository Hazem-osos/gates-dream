import type { BOQItemUnit, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { ContractingProjectNotFoundError } from '../technical-office/errors/technical-office-domain.errors';
import { money, rate, toDecimal } from '../utils/money-decimal';
import {
  addInstructionsSheet,
  applyListValidation,
  applyRtlSheet,
  assertRowBudget,
  autosizeColumns,
  BOQ_UNITS,
  cellNumber,
  cellText,
  findHeaderRow,
  loadWorkbook,
  mapColumns,
  pickDataSheet,
  resolveBoqUnit,
  styleHeaderRow,
  workbookToBuffer,
} from './excel-workbook';
import {
  EXCEL_TEMPLATE_ROWS,
  type BoqCommitResult,
  type BoqExcelType,
  type BoqRowDto,
  type ExcelValidationReport,
  type ValidatedExcelRow,
} from './types';

const BOQ_HEADERS = [
  'كود البند (Item Code)',
  'وصف البند بالعربية (Description Ar)',
  'وصف البند بالإنجليزية (Description En)',
  'وحدة القياس (Unit)',
  'الكمية التعاقدية (Quantity)',
  'سعر الوحدة (Unit Price)',
  'إجمالي القيمة (Total Price)',
  'ملاحظات (Notes)',
];

const BOQ_ALIASES: Record<string, string[]> = {
  itemCode: ['كود البند', 'item code', 'itemcode'],
  descriptionAr: ['وصف البند بالعربية', 'description ar', 'الوصف'],
  descriptionEn: ['وصف البند بالإنجليزية', 'description en'],
  unit: ['وحدة القياس', 'unit'],
  quantity: ['الكمية التعاقدية', 'quantity', 'الكمية'],
  unitPrice: ['سعر الوحدة', 'unit price'],
  totalPrice: ['إجمالي القيمة', 'total price'],
  notes: ['ملاحظات', 'notes'],
};

export class BoqExcelService {
  async generateBoqTemplate(format: BoqExcelType): Promise<{ filename: string; buffer: Buffer }> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('مقايسة');
    applyRtlSheet(sheet);
    sheet.addRow(BOQ_HEADERS);
    styleHeaderRow(sheet, BOQ_HEADERS.length);
    autosizeColumns(sheet, BOQ_HEADERS);
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).numFmt = '#,##0.00';
    sheet.getColumn(6).numFmt = '#,##0.00';
    sheet.getColumn(7).numFmt = '#,##0.00';

    const unitCells: string[] = [];
    for (let row = 2; row <= EXCEL_TEMPLATE_ROWS + 1; row += 1) {
      for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'H'] as const) {
        sheet.getCell(`${col}${row}`).protection = { locked: false };
      }
      const total = sheet.getCell(`G${row}`);
      total.value = { formula: `E${row}*F${row}` };
      total.protection = { locked: true };
      total.numFmt = '#,##0.00';
      unitCells.push(`D${row}`);
    }

    applyListValidation(
      sheet,
      unitCells,
      `"${BOQ_UNITS.join(',')}"`,
      'اختر وحدة من القائمة: M2, M3, TON, ITEM, LM, LS'
    );

    await sheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      insertRows: true,
      deleteRows: false,
    });

    addInstructionsSheet(workbook, [
      format === 'OWNER'
        ? 'هذا القالب لمقايسة المالك (Owner BOQ). الكود يجب أن يكون فريدًا داخل المشروع.'
        : 'هذا القالب لمقايسة مقاول الباطن. الكود يجب أن يكون فريدًا داخل عقد الباطن.',
      'عمود إجمالي القيمة محسوب بصيغة =الكمية×سعر الوحدة ولا يُعدَّل.',
      'وحدات القياس المسموحة فقط: M2, M3, TON, ITEM, LM, LS.',
      'الكمية وسعر الوحدة أرقام موجبة. الحد الأقصى 5000 سطر و 15 ميجابايت.',
      'لا تحذف صف العناوين ولا تغيّر ترتيب الأعمدة.',
    ]);

    const suffix = format === 'OWNER' ? 'owner' : 'subcontractor';
    return {
      filename: `gates-boq-template-${suffix}.xlsx`,
      buffer: await workbookToBuffer(workbook),
    };
  }

  async parseAndValidateBoqExcel(
    companyId: string,
    projectId: string,
    buffer: Buffer,
    type: BoqExcelType,
    filename: string,
    subcontractId?: string
  ): Promise<ExcelValidationReport<BoqRowDto>> {
    await this.assertScope(companyId, projectId, type, subcontractId);
    const workbook = await loadWorkbook(buffer, filename);
    const sheet = pickDataSheet(workbook, ['مقايسة']);
    const { rowNumber: headerRow, headers } = findHeaderRow(sheet, ['كود البند', 'item code']);
    const columns = mapColumns(headers, BOQ_ALIASES);
    if (columns.itemCode == null || columns.descriptionAr == null || columns.unit == null || columns.quantity == null || columns.unitPrice == null) {
      throw new AppError(400, 'أعمدة القالب غير مكتملة. نزّل القالب القياسي وأعد المحاولة');
    }

    const seen = new Map<string, number>();
    const rows: ValidatedExcelRow<BoqRowDto>[] = [];

    for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const excelRow = sheet.getRow(rowNumber);
      const raw = {
        itemCode: cellText(excelRow.getCell(columns.itemCode + 1).value),
        descriptionAr: cellText(excelRow.getCell(columns.descriptionAr + 1).value),
        descriptionEn: columns.descriptionEn != null ? cellText(excelRow.getCell(columns.descriptionEn + 1).value) : '',
        unit: cellText(excelRow.getCell(columns.unit + 1).value),
        quantity: cellNumber(excelRow.getCell(columns.quantity + 1).value),
        unitPrice: cellNumber(excelRow.getCell(columns.unitPrice + 1).value),
        notes: columns.notes != null ? cellText(excelRow.getCell(columns.notes + 1).value) : '',
      };
      if (!raw.itemCode && !raw.descriptionAr && raw.quantity == null && raw.unitPrice == null) continue;

      const errors: string[] = [];
      if (!raw.itemCode) errors.push('كود البند مطلوب');
      if (!raw.descriptionAr) errors.push('وصف البند بالعربية مطلوب');
      const unit = resolveBoqUnit(raw.unit);
      if (!unit) errors.push('وحدة القياس غير صالحة');
      if (raw.quantity == null || raw.quantity <= 0) errors.push('الكمية التعاقدية يجب أن تكون رقمًا موجبًا');
      if (raw.unitPrice == null || raw.unitPrice <= 0) errors.push('سعر الوحدة يجب أن يكون رقمًا موجبًا');

      const codeKey = raw.itemCode.trim();
      if (codeKey) {
        const first = seen.get(codeKey);
        if (first != null) errors.push(`كود البند مكرر في السطر ${first}`);
        else seen.set(codeKey, rowNumber);
      }

      const quantity = raw.quantity != null && raw.quantity > 0 ? Number(money(raw.quantity).toFixed(4)) : 0;
      const unitPrice = raw.unitPrice != null && raw.unitPrice > 0 ? Number(money(raw.unitPrice).toFixed(4)) : 0;
      rows.push({
        rowNumber,
        isValid: errors.length === 0,
        errors,
        data: {
          itemCode: codeKey,
          descriptionAr: raw.descriptionAr,
          descriptionEn: raw.descriptionEn || null,
          unit: (unit ?? 'ITEM') as BOQItemUnit,
          quantity,
          unitPrice,
          totalPrice: Number(money(quantity).mul(money(unitPrice)).toFixed(4)),
          notes: raw.notes || null,
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

  async commitBoqImport(
    companyId: string,
    projectId: string,
    validRows: BoqRowDto[],
    type: BoqExcelType,
    subcontractId?: string
  ): Promise<BoqCommitResult> {
    if (!validRows.length) throw new AppError(400, 'لا توجد سطور سليمة للاستيراد');
    if (validRows.length > 5000) throw new AppError(400, 'عدد السطور يتجاوز الحد الأقصى');
    await this.assertScope(companyId, projectId, type, subcontractId);

    if (type === 'OWNER') {
      return this.commitOwner(companyId, projectId, validRows);
    }
    if (!subcontractId) throw new AppError(400, 'معرّف عقد الباطن مطلوب');
    return this.commitSubcontractor(companyId, subcontractId, validRows);
  }

  async exportProjectBoq(
    companyId: string,
    projectId: string,
    subcontractId?: string
  ): Promise<{ filename: string; buffer: Buffer }> {
    if (subcontractId) {
      const subcontract = await prisma.subcontract.findFirst({
        where: { id: subcontractId, companyId, projectId },
        include: { boqItems: { orderBy: { itemCode: 'asc' } } },
      });
      if (!subcontract) throw new AppError(404, 'عقد الباطن غير موجود');
      return this.buildExportWorkbook(
        `gates-subcontract-boq-${subcontract.subcontractNumber}.xlsx`,
        subcontract.boqItems.map((item) => ({
          itemCode: item.itemCode,
          descriptionAr: item.descriptionAr,
          descriptionEn: item.descriptionEn,
          unit: item.unit,
          quantity: Number(item.contractQuantity),
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          executed: Number(item.cumulativeExecutedQty),
        }))
      );
    }

    await this.assertProject(companyId, projectId);
    const items = await prisma.projectBOQItem.findMany({
      where: { companyId, projectId },
      orderBy: { itemCode: 'asc' },
    });
    return this.buildExportWorkbook(
      `gates-owner-boq-${projectId.slice(0, 8)}.xlsx`,
      items.map((item) => ({
        itemCode: item.itemCode,
        descriptionAr: item.descriptionAr,
        descriptionEn: item.descriptionEn,
        unit: item.unit,
        quantity: Number(item.contractQuantity),
        unitPrice: Number(item.unitSellingPrice),
        totalPrice: Number(item.totalSellingPrice),
        executed: Number(item.cumulativeExecutedQty),
      }))
    );
  }

  private async commitOwner(
    companyId: string,
    projectId: string,
    rows: BoqRowDto[]
  ): Promise<BoqCommitResult> {
    const codes = rows.map((row) => row.itemCode);
    const existing = await prisma.projectBOQItem.findMany({
      where: { companyId, projectId, itemCode: { in: codes } },
      select: { id: true, itemCode: true, status: true },
    });
    const byCode = new Map(existing.map((row) => [row.itemCode, row]));

    await prisma.$transaction(
      async (tx) => {
        const creates = rows.filter((row) => !byCode.has(row.itemCode));
        if (creates.length) {
          await tx.projectBOQItem.createMany({
            data: creates.map((row) => ({
              companyId,
              projectId,
              itemCode: row.itemCode,
              descriptionAr: row.descriptionAr,
              descriptionEn: row.descriptionEn ?? null,
              unit: row.unit,
              contractQuantity: money(row.quantity),
              unitSellingPrice: money(row.unitPrice),
              totalSellingPrice: money(row.totalPrice),
              directCostEstimated: money(row.unitPrice),
              status: 'PRICED',
            })),
          });
        }
        for (const row of rows) {
          const current = byCode.get(row.itemCode);
          if (!current) continue;
          await tx.projectBOQItem.update({
            where: { id: current.id },
            data: {
              descriptionAr: row.descriptionAr,
              descriptionEn: row.descriptionEn ?? null,
              unit: row.unit,
              contractQuantity: money(row.quantity),
              unitSellingPrice: money(row.unitPrice),
              totalSellingPrice: money(row.totalPrice),
              status: current.status === 'APPROVED_IN_CONTRACT' ? current.status : 'PRICED',
            },
          });
        }
      },
      { timeout: 120_000, maxWait: 10_000 }
    );

    return { created: rows.length - existing.length, updated: existing.length, total: rows.length };
  }

  private async commitSubcontractor(
    companyId: string,
    subcontractId: string,
    rows: BoqRowDto[]
  ): Promise<BoqCommitResult> {
    const subcontract = await prisma.subcontract.findFirst({
      where: { id: subcontractId, companyId },
      select: { id: true, maxAllowedVariationOrderRate: true },
    });
    if (!subcontract) throw new AppError(404, 'عقد الباطن غير موجود');
    const variation = rate(subcontract.maxAllowedVariationOrderRate);

    const existing = await prisma.subcontractBOQItem.findMany({
      where: { subcontractId, itemCode: { in: rows.map((row) => row.itemCode) } },
      select: { id: true, itemCode: true },
    });
    const byCode = new Map(existing.map((row) => [row.itemCode, row]));

    await prisma.$transaction(
      async (tx) => {
        for (const row of rows) {
          const qty = money(row.quantity);
          const unitPrice = money(row.unitPrice);
          const totalPrice = money(qty.mul(unitPrice));
          const maxAllowedQuantity = money(qty.mul(toDecimal(1).plus(variation)));
          const payload: Prisma.SubcontractBOQItemUncheckedCreateInput = {
            subcontractId,
            itemCode: row.itemCode,
            descriptionAr: row.descriptionAr,
            descriptionEn: row.descriptionEn ?? null,
            unit: row.unit,
            contractQuantity: qty,
            unitPrice,
            totalPrice,
            maxAllowedQuantity,
          };
          const current = byCode.get(row.itemCode);
          if (!current) {
            await tx.subcontractBOQItem.create({ data: payload });
          } else {
            await tx.subcontractBOQItem.update({
              where: { id: current.id },
              data: {
                descriptionAr: payload.descriptionAr,
                descriptionEn: payload.descriptionEn,
                unit: payload.unit,
                contractQuantity: qty,
                unitPrice,
                totalPrice,
                maxAllowedQuantity,
              },
            });
          }
        }
      },
      { timeout: 120_000, maxWait: 10_000 }
    );

    return { created: rows.length - existing.length, updated: existing.length, total: rows.length };
  }

  private async buildExportWorkbook(
    filename: string,
    items: Array<{
      itemCode: string;
      descriptionAr: string;
      descriptionEn: string | null;
      unit: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      executed: number;
    }>
  ) {
    const headers = [
      ...BOQ_HEADERS.slice(0, 7),
      'الكمية المنفذة (Executed Qty)',
      'نسبة الإنجاز % (Progress)',
    ];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('مقايسة');
    applyRtlSheet(sheet);
    sheet.addRow(headers);
    styleHeaderRow(sheet, headers.length);
    autosizeColumns(sheet, headers);
    items.forEach((item, index) => {
      const row = index + 2;
      const progress = item.quantity > 0 ? item.executed / item.quantity : 0;
      sheet.addRow([
        item.itemCode,
        item.descriptionAr,
        item.descriptionEn,
        item.unit,
        item.quantity,
        item.unitPrice,
        { formula: `E${row}*F${row}` },
        item.executed,
        progress,
      ]);
      sheet.getCell(`I${row}`).numFmt = '0.00%';
    });
    return { filename, buffer: await workbookToBuffer(workbook) };
  }

  private async assertScope(
    companyId: string,
    projectId: string,
    type: BoqExcelType,
    subcontractId?: string
  ) {
    await this.assertProject(companyId, projectId);
    if (type === 'SUBCONTRACTOR') {
      if (!subcontractId) throw new AppError(400, 'معرّف عقد الباطن مطلوب');
      const subcontract = await prisma.subcontract.findFirst({
        where: { id: subcontractId, companyId, projectId },
        select: { id: true },
      });
      if (!subcontract) throw new AppError(404, 'عقد الباطن غير موجود على هذا المشروع');
    }
  }

  private async assertProject(companyId: string, projectId: string) {
    const project = await prisma.contractingProject.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);
  }
}

export const boqExcelService = new BoqExcelService();
