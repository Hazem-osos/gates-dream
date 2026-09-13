import ExcelJS from 'exceljs';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { money, rate } from '../utils/money-decimal';

export type Form41Quarter = 1 | 2 | 3 | 4;
export type Form41Format = 'CSV' | 'EXCEL';

const FORM41_HEADERS = [
  'الرقم الضريبي للجهة المخصوم منها',
  'الرقم القومي / السجل التجاري',
  'اسم الممول / الشركة',
  'عنوان الممول',
  'المأمورية الضريبية التابع لها',
  'طبيعة التعامل',
  'القيمة الإجمالية للتعامل',
  'القيمة الصافية بعد الاستقطاع',
  'نسبة الخصم',
  'قيمة الضريبة المخصومة',
  'رقم وتاريخ الفاتورة / المستخلص',
] as const;

const DEAL_NATURE_CODE = '1';

export function quarterBounds(year: number, quarter: Form41Quarter): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999));
  return { start, end };
}

function taxOfficeFromDetails(details: unknown): string {
  if (details && typeof details === 'object' && 'taxOffice' in details) {
    const value = (details as { taxOffice?: unknown }).taxOffice;
    return typeof value === 'string' ? value : '';
  }
  return '';
}

function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export type Form41PreviewRow = {
  taxId: string;
  commercialRegister: string;
  name: string;
  address: string;
  taxOffice: string;
  dealNature: string;
  gross: string;
  net: string;
  ratePercent: string;
  withheld: string;
  invoiceRef: string;
};

export class TaxForm41ExportService {
  async previewQuarterlyForm41(
    companyId: string,
    input: { year: number; quarter: Form41Quarter }
  ): Promise<{ start: string; end: string; rows: Form41PreviewRow[] }> {
    const { start, end } = quarterBounds(input.year, input.quarter);
    const invoices = await prisma.subcontractInvoice.findMany({
      where: {
        companyId,
        status: 'FINANCE_POSTED',
        periodEndDate: { gte: start, lte: end },
      },
      include: {
        subcontract: { include: { subcontractor: true } },
      },
      orderBy: [{ periodEndDate: 'asc' }, { invoiceNumber: 'asc' }],
    });

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      rows: invoices.map((invoice) => {
        const vendor = invoice.subcontract.subcontractor;
        const gross = money(invoice.grossCurrentAmount);
        const withheld = money(invoice.taxWithholdingDeduction);
        const net = money(gross.minus(withheld));
        const whtRate = rate(invoice.subcontract.taxWithholdingRate);
        return {
          taxId: digitsOnly(vendor.taxRegistrationNumber).padStart(9, '0').slice(-9),
          commercialRegister: vendor.commercialRegister ?? '',
          name: vendor.nameAr,
          address: vendor.address ?? '',
          taxOffice: taxOfficeFromDetails(vendor.bankAccountDetails),
          dealNature: DEAL_NATURE_CODE,
          gross: gross.toFixed(4),
          net: net.toFixed(4),
          ratePercent: whtRate.mul(100).toFixed(2),
          withheld: withheld.toFixed(4),
          invoiceRef: `${invoice.invoiceNumber} / ${invoice.periodEndDate.toISOString().slice(0, 10)}`,
        };
      }),
    };
  }

  async exportQuarterlyForm41(
    companyId: string,
    input: { year: number; quarter: Form41Quarter; format: Form41Format }
  ) {
    const preview = await this.previewQuarterlyForm41(companyId, input);
    const rows = preview.rows.map((row) => [
      row.taxId,
      row.commercialRegister,
      row.name,
      row.address,
      row.taxOffice,
      row.dealNature,
      row.gross,
      row.net,
      row.ratePercent,
      row.withheld,
      row.invoiceRef,
    ]);

    if (input.format === 'EXCEL') {
      const buffer = await this.toExcel(rows);
      return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `eta-form-41-Q${input.quarter}-${input.year}.xlsx`,
        rowCount: rows.length,
      };
    }

    const csv = this.toCsv(rows);
    return {
      buffer: Buffer.from(csv, 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      filename: `eta-form-41-Q${input.quarter}-${input.year}.csv`,
      rowCount: rows.length,
    };
  }

  async generateContractorDebitNote(
    companyId: string,
    input: { penaltyId?: string; materialLogId?: string }
  ) {
    if (input.penaltyId) {
      const penalty = await prisma.sitePenaltyAndSnag.findFirst({
        where: { id: input.penaltyId, subcontract: { companyId } },
        include: { subcontract: { include: { subcontractor: true } } },
      });
      if (!penalty) throw new AppError(404, 'Site penalty not found');
      return {
        documentType: 'DEBIT_NOTE',
        documentTypeAr: 'إشعار خصم',
        source: 'SITE_PENALTY',
        companyId,
        subcontractId: penalty.subcontractId,
        subcontractNumber: penalty.subcontract.subcontractNumber,
        contractor: {
          name: penalty.subcontract.subcontractor.nameAr,
          taxId: penalty.subcontract.subcontractor.taxRegistrationNumber,
          commercialRegister: penalty.subcontract.subcontractor.commercialRegister,
        },
        reference: penalty.consultantReportRef,
        incidentDate: penalty.incidentDate,
        description: penalty.description,
        penaltyType: penalty.penaltyType,
        amount: money(penalty.amount).toFixed(4),
        currency: 'EGP',
      };
    }

    const log = await prisma.materialReconciliationLog.findFirst({
      where: { id: input.materialLogId, subcontract: { companyId } },
      include: { subcontract: { include: { subcontractor: true } }, item: true },
    });
    if (!log) throw new AppError(404, 'Material reconciliation log not found');

    return {
      documentType: 'DEBIT_NOTE',
      documentTypeAr: 'إشعار خصم',
      source: 'MATERIAL_OVERUSE',
      companyId,
      subcontractId: log.subcontractId,
      subcontractNumber: log.subcontract.subcontractNumber,
      contractor: {
        name: log.subcontract.subcontractor.nameAr,
        taxId: log.subcontract.subcontractor.taxRegistrationNumber,
        commercialRegister: log.subcontract.subcontractor.commercialRegister,
      },
      reference: log.warehouseIssueSlipNumber,
      incidentDate: log.createdAt,
      description: `هالك خامات ${log.item.arabicName ?? log.itemId}`,
      materialId: log.itemId,
      scrapExcessQty: money(log.scrapExcessQty).toFixed(4),
      amount: money(log.totalPenaltyAmount).toFixed(4),
      currency: 'EGP',
    };
  }

  private toCsv(rows: string[][]): string {
    const bom = '\uFEFF';
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [FORM41_HEADERS.map((h) => escape(h)).join(','), ...rows.map((row) => row.map(escape).join(','))];
    return bom + lines.join('\r\n');
  }

  private async toExcel(rows: string[][]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gates ERP';
    const sheet = workbook.addWorksheet('نموذج 41');
    sheet.addRow([...FORM41_HEADERS]);
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(row);
    sheet.columns.forEach((col) => {
      col.width = 28;
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const taxForm41ExportService = new TaxForm41ExportService();
