import { roundTo4 } from '../../../shared/utils/decimal-round';
import { itemProfitRatios } from './item-profit-ratios';

export type InvoiceProfitSource = {
  id: string;
  invoiceNumber: string | null;
  date: Date;
  invoiceKind?: string | null;
  customerName: string;
  invoicePattern: string;
  totalAmount: number;
  lineCost: number;
  additionsAmount: number;
  discountsAmount: number;
};

export type InvoiceProfitRow = {
  invoiceId: string;
  invoiceNumber: string;
  invoicePattern: string;
  date: Date;
  customer: string;
  totalSales: number;
  totalCost: number;
  additionsAmount: number;
  discountsAmount: number;
  netAdditionsAndDiscounts: number;
  profit: number;
  profitPercentOnSales: number;
  profitPercentOnCost: number;
  profitPercentOnTotal: number;
};

function money(value: number) {
  return roundTo4(value);
}

function invoiceSign(kind: string | null | undefined) {
  return kind === 'SALE_RETURN' ? -1 : 1;
}

export function mapInvoiceProfitDraft(source: InvoiceProfitSource) {
  const sign = invoiceSign(source.invoiceKind);
  const totalSales = money(sign * source.totalAmount);
  const totalCost = money(sign * source.lineCost);
  const additionsAmount = money(sign * source.additionsAmount);
  const discountsAmount = money(sign * source.discountsAmount);
  const netAdditionsAndDiscounts = money(additionsAmount - discountsAmount);
  const profit = money(totalSales - totalCost + netAdditionsAndDiscounts);
  return {
    invoiceId: source.id,
    invoiceNumber: source.invoiceNumber || '',
    invoicePattern: source.invoicePattern,
    date: source.date,
    customer: source.customerName,
    totalSales,
    totalCost,
    additionsAmount,
    discountsAmount,
    netAdditionsAndDiscounts,
    profit,
  };
}

export function buildInvoiceProfitSheet(sources: InvoiceProfitSource[]) {
  const drafts = sources.map(mapInvoiceProfitDraft);
  const overallProfit = drafts.reduce((sum, row) => sum + row.profit, 0);
  const rows: InvoiceProfitRow[] = drafts
    .map((row) => ({
      ...row,
      ...itemProfitRatios(
        { totalProfit: row.profit, totalSales: row.totalSales, totalCost: row.totalCost },
        overallProfit
      ),
    }))
    .sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (byDate) return byDate;
      return String(a.invoiceNumber).localeCompare(String(b.invoiceNumber), 'ar');
    });

  const totalSales = money(rows.reduce((sum, row) => sum + row.totalSales, 0));
  const totalCost = money(rows.reduce((sum, row) => sum + row.totalCost, 0));
  const totalAdditions = money(rows.reduce((sum, row) => sum + row.additionsAmount, 0));
  const totalDiscounts = money(rows.reduce((sum, row) => sum + row.discountsAmount, 0));
  const totalProfit = money(rows.reduce((sum, row) => sum + row.profit, 0));

  return {
    rows,
    summary: {
      totalSales,
      totalCost,
      additionsAmount: totalAdditions,
      discountsAmount: totalDiscounts,
      netAdditionsAndDiscounts: money(totalAdditions - totalDiscounts),
      totalProfit,
      ...itemProfitRatios(
        { totalProfit, totalSales, totalCost },
        totalProfit
      ),
    },
  };
}
