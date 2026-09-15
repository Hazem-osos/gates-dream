import { toast } from '@/lib/feedback/toast';
import { pickSavedDocumentLayout } from '@/lib/documentLayout/pickSavedDocumentLayout';
import { generateDocumentHtml } from '@/lib/documentLayout/templateEngine';
import { preloadDocumentFonts } from '@/lib/documentLayout/usePrintDocument';
import { buildQrDataUrl, buildQrPayload } from '@/lib/documentLayout/qr';
import { invoicePrintModelToTaxPreview } from '@/lib/documentLayout/fromDomain';
import type { TaxInvoiceMock } from '@/lib/documentLayout/mockData';
import type { DocumentLayoutConfig } from '@/lib/documentLayout/types';
import type { CompanyPrintProfile, InvoicePrintModel } from '@/lib/print/types';
import { printHtml } from '@/lib/print/printHtml';

const HINT_KEY = 'gates.print-layout-hint-v1';

export type OperationalPrintLine = {
  description: string;
  quantity?: number;
  unitPrice?: number;
  taxPercent?: number;
  taxAmount?: number;
  total?: number;
};

export type OperationalPrintInput = {
  title: string;
  documentNo: string;
  documentDate: string;
  buyerName?: string;
  sellerName?: string;
  currency?: string;
  lines: OperationalPrintLine[];
};

function toTaxInvoice(input: OperationalPrintInput, config: DocumentLayoutConfig): TaxInvoiceMock {
  const lines = (input.lines.length ? input.lines : [{ description: '—', quantity: 1, unitPrice: 0 }]).map(
    (line) => {
      const quantity = Number(line.quantity) || 1;
      const unitPrice = Number(line.unitPrice) || 0;
      const taxPercent = Number(line.taxPercent) || 0;
      const total = Number(line.total) || quantity * unitPrice;
      const taxAmount = Number(line.taxAmount) || total * (taxPercent / 100);
      return {
        description: line.description || '—',
        quantity,
        unitPrice,
        taxPercent,
        taxAmount,
        total,
      };
    }
  );
  const subTotal = lines.reduce((sum, line) => sum + line.total - line.taxAmount, 0);
  const totalTax = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  return {
    kind: 'TAX_INVOICE',
    documentKind: 'TAX_INVOICE',
    printTitle: input.title,
    documentNo: input.documentNo || '—',
    documentDate: input.documentDate || new Date().toISOString().slice(0, 10),
    sellerName: input.sellerName || config.companyNameAr || 'الشركة',
    sellerTaxId: config.taxId || '',
    sellerCommercialReg: config.commercialReg || '',
    buyerName: input.buyerName || '—',
    buyerTaxId: '',
    buyerAddress: '',
    lines,
    subTotal,
    totalDiscount: 0,
    totalTax,
    grandTotal: subTotal + totalTax,
    etaUuid: '',
    etaSubmissionDate: '',
    currency: input.currency || 'EGP',
  };
}

function showFirstPrintHint() {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem(HINT_KEY)) return;
    window.localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* ignore */
  }
  toast.message('تم استخدام تخطيط الطباعة الافتراضي', {
    description: 'أول مرة: تقدر تضبط شكل الطباعة من الإعدادات ← تخطيط المستندات.',
    duration: 9000,
  });
}

async function printTaxInvoice(data: TaxInvoiceMock, chosen?: DocumentLayoutConfig): Promise<void> {
  try {
    const config = chosen ?? (await pickSavedDocumentLayout('TAX_INVOICE'));
    if (!config) return;
    showFirstPrintHint();
    const merged: TaxInvoiceMock = {
      ...data,
      sellerName: data.sellerName && data.sellerName !== '—' ? data.sellerName : config.companyNameAr || data.sellerName,
      sellerTaxId: data.sellerTaxId || config.taxId || '',
      sellerCommercialReg: data.sellerCommercialReg || config.commercialReg || '',
    };
    await preloadDocumentFonts(config.fontFamily);
    const qrDataUrl = config.showQrCode ? await buildQrDataUrl(buildQrPayload(merged)) : null;
    const html = generateDocumentHtml(merged, config, { qrDataUrl });
    await printHtml(html);
  } catch (error) {
    toast.error('تعذر الطباعة', {
      description: error instanceof Error ? error.message : 'جرّب تاني أو اضبط التخطيط من الإعدادات.',
    });
  }
}

export async function printOperationalDocument(input: OperationalPrintInput): Promise<void> {
  const config = await pickSavedDocumentLayout('TAX_INVOICE');
  if (!config) return;
  await printTaxInvoice(toTaxInvoice(input, config), config);
}

export async function printInvoiceDocument(
  invoice: InvoicePrintModel,
  company?: CompanyPrintProfile,
  opts?: { skipEmptyLines?: boolean; title?: string }
): Promise<void> {
  const data = invoicePrintModelToTaxPreview(invoice, company, { skipEmptyLines: opts?.skipEmptyLines });
  data.printTitle = opts?.title || (invoice.kind === 'PURCHASE' ? 'فاتورة مشتريات' : 'فاتورة مبيعات');
  await printTaxInvoice(data);
}
