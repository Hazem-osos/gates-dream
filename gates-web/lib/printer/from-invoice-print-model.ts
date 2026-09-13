import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import type { CompanyPrintProfile, InvoicePrintModel } from '@/lib/print/types';
import type { ThermalInvoiceData } from '@/lib/printer/types';

function salesTitle(invoice: InvoicePrintModel): string {
  if (invoice.kind === 'PURCHASE') return 'فاتورة مشتريات';
  const method = (invoice.paymentMethod ?? '').trim();
  if (method === 'نقدي' || method.toLowerCase() === 'cash') {
    return 'فاتورة مبيعات نقدية';
  }
  if (method === 'آجل' || method.toLowerCase() === 'credit') {
    return 'فاتورة مبيعات آجلة';
  }
  return method ? `فاتورة مبيعات — ${method}` : 'فاتورة مبيعات';
}

export function thermalDataFromPrintModel(
  invoice: InvoicePrintModel,
  company?: CompanyPrintProfile,
  extras?: { customerBalance?: number | null; dateTime?: string }
): ThermalInvoiceData {
  const discount = invoice.lines.reduce((sum, line) => sum + (Number(line.discount) || 0), 0);
  return {
    companyName: company?.nameAr?.trim() || 'Gates ERP',
    branch: company?.branchName,
    phone: company?.phone,
    taxRegistrationNumber: company?.taxRegistrationNumber,
    title: salesTitle(invoice),
    invoiceNumber: invoice.invoiceNumber,
    dateTime: extras?.dateTime?.trim() || invoice.date,
    customerName: invoice.customerName || invoice.supplierName,
    customerBalance: extras?.customerBalance ?? null,
    items: invoice.lines.map((line) => ({
      name: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.lineTotal,
    })),
    subtotal: invoice.subtotal,
    vatAmount: invoice.totalVat,
    vatRateLabel: '14%',
    discount,
    developmentFee: invoice.developmentFee,
    withholding: invoice.withholding,
    net: invoice.totalPayable,
    notes: invoice.termsAndConditions?.filter(Boolean).join(' · ') || null,
    footer: 'شكراً لتعاملكم معنا - Gates ERP',
    qrPayload: invoice.qrPayloadBase64,
  };
}

export function formatThermalMoney(value: number): string {
  return formatInvoiceMoney(value);
}
