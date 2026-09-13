import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';

export interface VatAggregationResult {
  totalOutputVat: number;
  totalInputVat: number;
  netVatAmount: number;
  totalWithholdingTax: number;
  invoiceCount: number;
}

export class TaxEngineService {
  async aggregateForTaxPeriod(companyId: string, taxPeriodId: string): Promise<VatAggregationResult> {
    const period = await prisma.taxPeriod.findFirst({
      where: { id: taxPeriodId, companyId },
    });
    if (!period) {
      throw new AppError(404, 'Tax period not found');
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        isPosted: true,
        isCancelled: false,
        date: { gte: period.startDate, lte: period.endDate },
      },
      select: {
        invoiceKind: true,
        invoiceType: true,
        taxAmount: true,
        withholdingTaxAmount: true,
      },
    });

    let totalOutputVat = 0;
    let totalInputVat = 0;
    let totalWithholdingTax = 0;

    for (const inv of invoices) {
      const kind =
        inv.invoiceKind ??
        (inv.invoiceType === 'sales'
          ? 'SALE'
          : inv.invoiceType === 'purchase'
            ? 'PURCHASE'
            : 'SALE');
      const tax = Number(inv.taxAmount);
      const wht = Number(inv.withholdingTaxAmount ?? 0);

      switch (kind) {
        case 'SALE':
          totalOutputVat += tax;
          break;
        case 'SALE_RETURN':
          totalOutputVat -= tax;
          break;
        case 'PURCHASE':
          totalInputVat += tax;
          totalWithholdingTax += wht;
          break;
        case 'PURCHASE_RETURN':
          totalInputVat -= tax;
          totalWithholdingTax -= wht;
          break;
        default:
          break;
      }
    }

    totalOutputVat = roundTo4(totalOutputVat);
    totalInputVat = roundTo4(totalInputVat);
    totalWithholdingTax = roundTo4(totalWithholdingTax);
    const netVatAmount = roundTo4(totalOutputVat - totalInputVat);

    return {
      totalOutputVat,
      totalInputVat,
      netVatAmount,
      totalWithholdingTax,
      invoiceCount: invoices.length,
    };
  }

  async buildOrRefreshDeclaration(companyId: string, taxPeriodId: string) {
    const period = await prisma.taxPeriod.findFirst({
      where: { id: taxPeriodId, companyId },
    });
    if (!period) throw new AppError(404, 'Tax period not found');

    const totals = await this.aggregateForTaxPeriod(companyId, taxPeriodId);

    return prisma.taxDeclaration.upsert({
      where: {
        companyId_taxPeriodId: { companyId, taxPeriodId },
      },
      update: {
        totalOutputVat: totals.totalOutputVat,
        totalInputVat: totals.totalInputVat,
        netVatAmount: totals.netVatAmount,
        totalWithholdingTax: totals.totalWithholdingTax,
        status: 'FINAL',
        fiscalYearId: period.fiscalYearId,
      },
      create: {
        companyId,
        taxPeriodId,
        fiscalYearId: period.fiscalYearId,
        totalOutputVat: totals.totalOutputVat,
        totalInputVat: totals.totalInputVat,
        netVatAmount: totals.netVatAmount,
        totalWithholdingTax: totals.totalWithholdingTax,
        status: 'FINAL',
      },
    });
  }
}

export const taxEngineService = new TaxEngineService();
