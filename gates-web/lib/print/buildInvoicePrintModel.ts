import {
  computeInvoiceFinancialSummary,
  developmentFeeFormFromInvoice,
} from '@/lib/invoices/computeInvoiceFinancialSummary';
import { inferDiscountTypeFromApi, inferDiscountValueFromApi } from '@/lib/invoices/discount-type';
import { calculateRowTotals } from '@/lib/invoices/calculateInvoiceRowTotals';
import { buildEtaQrBase64 } from '@/lib/print/etaQr';
import { tafqeetEgp } from '@/lib/print/tafqeet';
import type { CompanyPrintProfile, InvoicePrintLine, InvoicePrintModel } from '@/lib/print/types';
import { extractPaymentTermsMethod } from '@/lib/invoices/payment-terms-method';

type RawLine = {
  item?: { code?: string; serial?: string; arabicName?: string };
  itemId?: string;
  quantity?: number;
  unitPrice?: number;
  price?: number;
  discount?: number;
  discountValue?: number;
  discountType?: string;
  discountPercent?: number;
  discountAmount?: number;
  taxRate?: number;
  taxPercent?: number;
  unit?: { arabicName?: string; code?: string };
};

export function buildInvoicePrintModelFromApi(
  invoice: Record<string, unknown>,
  company: CompanyPrintProfile | undefined,
  itemsById?: Map<string, { code?: string; serial?: string; arabicName: string }>
): InvoicePrintModel {
  const linesRaw = (invoice.lines as RawLine[] | undefined) ?? [];
  const applyTax = invoice.isSalesTaxInvoice !== false;
  const summary = computeInvoiceFinancialSummary(
    linesRaw.map((l) => ({
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice ?? l.price) || 0,
      discount: inferDiscountValueFromApi(l),
      discountValue: inferDiscountValueFromApi(l),
      discountType: l.discountType ?? inferDiscountTypeFromApi(l),
      taxRate: Number(l.taxRate ?? l.taxPercent) || 0,
    })),
    {
      applyTax,
      withholdingTaxAmount: Number(invoice.withholdingTaxAmount) || 0,
      ...developmentFeeFormFromInvoice(invoice),
    }
  );

  const lines: InvoicePrintLine[] = linesRaw.map((l) => {
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice ?? l.price) || 0;
    const taxPct = Number(l.taxRate ?? l.taxPercent) || 0;
    const totals = calculateRowTotals({
      quantity: qty,
      unitPrice: price,
      discount: inferDiscountValueFromApi(l),
      discountValue: inferDiscountValueFromApi(l),
      discountType: l.discountType ?? inferDiscountTypeFromApi(l),
      taxRate: applyTax ? taxPct : 0,
    });
    const discount = totals.lineDiscount;
    const net = totals.lineAfterDiscount;
    const vatAmount = totals.lineTax;
    const item = l.item;
    const fromMap =
      l.itemId && itemsById?.get(l.itemId);
    const code =
      item?.code ||
      item?.serial ||
      fromMap?.code ||
      fromMap?.serial ||
      '';
    const description =
      item?.arabicName || fromMap?.arabicName || '—';
    return {
      code,
      description,
      quantity: qty,
      unit: l.unit?.arabicName || l.unit?.code || '—',
      unitPrice: price,
      discount,
      net,
      vatRate: taxPct,
      vatAmount,
      lineTotal: net + vatAmount,
    };
  });

  const dateStr = invoice.date
    ? new Date(String(invoice.date)).toLocaleDateString('ar-EG')
    : '—';
  const paymentTypeRaw = String(invoice.paymentMethod ?? invoice.paymentType ?? '').toLowerCase();
  const paymentType =
    paymentTypeRaw === 'cash' ? 'نقدي' : paymentTypeRaw === 'split' ? 'دفع متعدد' : 'آجل';
  const customPaymentTerms = extractPaymentTermsMethod(invoice.internalNotes);
  const customer = invoice.customer as { arabicName?: string; taxAuthority?: string; street?: string } | undefined;
  const supplier = invoice.supplier as { arabicName?: string } | undefined;
  const kind = invoice.invoiceKind === 'PURCHASE' ? 'PURCHASE' : 'SALE';

  const rawConditions = invoice.conditions as Array<{ condition?: string }> | undefined;
  const termsFromApi =
    rawConditions?.map((c) => c.condition?.trim()).filter(Boolean) as string[] | undefined;
  const termsInline = invoice.invoiceConditions as string[] | undefined;
  const termsAndConditions = (termsFromApi?.length ? termsFromApi : termsInline)?.filter(Boolean);

  const printTermsOnInvoice = invoice.printTermsOnInvoice === true;
  const allowReturn = invoice.allowReturn === true;
  const returnDays =
    invoice.returnDays != null && invoice.returnDays !== ''
      ? Number(invoice.returnDays)
      : undefined;

  const timestampIso = invoice.date
    ? new Date(String(invoice.date)).toISOString()
    : new Date().toISOString();

  const qrPayloadBase64 =
    company?.nameAr && company.taxRegistrationNumber
      ? buildEtaQrBase64({
          sellerName: company.nameAr,
          taxRegistrationNumber: company.taxRegistrationNumber,
          timestampIso,
          totalWithVat: summary.netAmount,
          vatAmount: summary.taxAmount,
        })
      : undefined;

  return {
    kind,
    invoiceNumber: String(invoice.invoiceNumber ?? '—'),
    date: dateStr,
    paymentMethod: customPaymentTerms || paymentType,
    customerName: customer?.arabicName,
    customerTaxId: customer?.taxAuthority,
    customerAddress: customer?.street,
    supplierName: supplier?.arabicName,
    lines,
    subtotal: summary.subtotalWithoutTax,
    totalVat: summary.taxAmount,
    developmentFee: summary.developmentFeeAmount,
    withholding: summary.withholdingTaxAmount,
    totalPayable: summary.netAmount,
    currencyCode: 'EGP',
    qrPayloadBase64,
    amountInWords: tafqeetEgp(summary.netAmount),
    printTermsOnInvoice,
    allowReturn,
    returnDays: Number.isFinite(returnDays) ? returnDays : undefined,
    termsAndConditions: termsAndConditions?.length ? termsAndConditions : undefined,
  };
}
