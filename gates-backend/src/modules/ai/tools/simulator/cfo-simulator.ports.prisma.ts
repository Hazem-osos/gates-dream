import prisma from '../../../../shared/database/prisma';
import { financialReportService } from '../../../accounting/services/financial-report.service';
import type { CfoSimulatorPorts } from './cfo-simulator.types';

const SALES_TYPES = ['sales', 'SALE'];
const SALES_KINDS = ['SALE', 'sales'];

function isCashMethod(method?: string | null): boolean {
  const value = (method ?? '').trim().toLowerCase();
  return value === 'cash' || value === 'نقد' || value === 'نقدي' || value === 'نقدية';
}

function postedSalesWhere(companyId: string, branchId?: string, start?: Date, end?: Date) {
  return {
    companyId,
    isPosted: true,
    isCancelled: false,
    OR: [{ invoiceType: { in: SALES_TYPES } }, { invoiceKind: { in: SALES_KINDS } }],
    ...(branchId ? { branchId } : {}),
    ...(start && end ? { date: { gte: start, lte: end } } : {}),
  };
}

export const prismaCfoSimulatorPorts: CfoSimulatorPorts = {
  getIncomeStatement: (params) => financialReportService.getIncomeStatement(params),
  async salesMix(input) {
    const rows = await prisma.invoice.groupBy({
      by: ['paymentMethod'],
      where: postedSalesWhere(input.companyId, input.branchId, input.startDate, input.endDate),
      _sum: { netAmount: true },
    });
    let cash = 0;
    let credit = 0;
    for (const row of rows) {
      const amount = Number(row._sum.netAmount ?? 0);
      if (isCashMethod(row.paymentMethod)) cash += amount;
      else credit += amount;
    }
    return { cash, credit };
  },
  async receivablesOutstanding(input) {
    const agg = await prisma.invoice.aggregate({
      where: {
        ...postedSalesWhere(input.companyId, input.branchId),
        remainingAmount: { gt: 0 },
      },
      _sum: { remainingAmount: true },
    });
    return Number(agg._sum.remainingAmount ?? 0);
  },
};
