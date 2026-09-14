'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Printer, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { PrintDocumentRenderer } from '@/components/documentLayout/PrintDocumentRenderer';
import { printInvoiceDocument } from '@/lib/print/printOperationalDocument';
import { renderPrintableAndOpen } from '@/app/components/print/PrintDocumentButton';

const A4InvoiceTemplate = dynamic(
  () =>
    import('@/app/components/print/A4InvoiceTemplate').then((m) => ({
      default: m.A4InvoiceTemplate,
    })),
  { ssr: false }
);

const ThermalReceiptTemplate = dynamic(
  () =>
    import('@/app/components/print/ThermalReceiptTemplate').then((m) => ({
      default: m.ThermalReceiptTemplate,
    })),
  { ssr: false }
);
import { invoicePrintModelToTaxPreview } from '@/lib/documentLayout/fromDomain';
import { buildQrDataUrl, buildQrPayload } from '@/lib/documentLayout/qr';
import {
  effectiveLayoutConfig,
  useResolvedDocumentLayout,
} from '@/lib/documentLayout/useResolvedDocumentLayout';
import type { CompanyPrintProfile, InvoicePrintModel } from '@/lib/print/types';
import '@/app/components/print/print-styles.css';

export type PrintHubTemplateId = 'a4-tax' | 'delivery-slip' | 'thermal-pos';

type TemplateDef = {
  id: PrintHubTemplateId;
  label: string;
};

const TEMPLATES: TemplateDef[] = [
  { id: 'a4-tax', label: 'فاتورة حسب تصميم الشركة (شعار، ألوان، QR، توقيعات)' },
  { id: 'delivery-slip', label: 'إيصال استلام بضاعة بدون أسعار (Delivery Slip)' },
  { id: 'thermal-pos', label: 'إيصال حراري لنقاط البيع (80mm POS Thermal Receipt)' },
];

function CompanyLayoutInvoicePreview({
  company,
  invoice,
  skipEmptyLines,
}: {
  company?: CompanyPrintProfile;
  invoice: InvoicePrintModel;
  skipEmptyLines?: boolean;
}) {
  const { data: layoutResponse } = useResolvedDocumentLayout('TAX_INVOICE');
  const config = useMemo(
    () => effectiveLayoutConfig(layoutResponse?.data),
    [layoutResponse?.data]
  );
  const taxData = useMemo(
    () => invoicePrintModelToTaxPreview(invoice, company, { skipEmptyLines }),
    [invoice, company, skipEmptyLines]
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!config.showQrCode) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void buildQrDataUrl(buildQrPayload(taxData), { width: 160, margin: 1 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [config.showQrCode, taxData]);

  return <PrintDocumentRenderer data={taxData} config={config} qrDataUrl={qrDataUrl} />;
}

function renderPreviewElement(
  templateId: PrintHubTemplateId,
  company: CompanyPrintProfile | undefined,
  invoice: InvoicePrintModel,
  skipEmptyLines?: boolean
) {
  switch (templateId) {
    case 'delivery-slip':
      return <A4InvoiceTemplate company={company} invoice={invoice} hidePrices />;
    case 'thermal-pos':
      return <ThermalReceiptTemplate company={company} invoice={invoice} />;
    case 'a4-tax':
    default:
      return (
        <CompanyLayoutInvoicePreview
          company={company}
          invoice={invoice}
          skipEmptyLines={skipEmptyLines}
        />
      );
  }
}

async function runHubPrint(
  templateId: PrintHubTemplateId,
  company: CompanyPrintProfile | undefined,
  invoice: InvoicePrintModel,
  skipEmptyLines?: boolean
) {
  if (templateId === 'thermal-pos') {
    renderPrintableAndOpen(() => <ThermalReceiptTemplate company={company} invoice={invoice} />);
    return;
  }
  await printInvoiceDocument(invoice, company, {
    skipEmptyLines,
    title: templateId === 'delivery-slip' ? 'إذن تسليم' : undefined,
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  company?: CompanyPrintProfile;
  invoice: InvoicePrintModel | null;
  skipEmptyLines?: boolean;
};

export function PrintHubModal({ open, onClose, company, invoice, skipEmptyLines }: Props) {
  const [templateId, setTemplateId] = useState<PrintHubTemplateId>('a4-tax');

  const preview = useMemo(() => {
    if (!invoice) return null;
    return renderPreviewElement(templateId, company, invoice, skipEmptyLines);
  }, [templateId, company, invoice, skipEmptyLines]);

  if (!open) return null;

  const disabled = !invoice || invoice.lines.length === 0;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[12000] bg-black/45"
        aria-label="إغلاق مركز الطباعة"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-4 top-[5vh] z-[12010] mx-auto flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        dir="rtl"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">مركز الطباعة الموحد</h2>
            <p className="text-xs text-slate-500">اختر القالب ثم معاينة أو طباعة فورية</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[280px_1fr]">
          <aside className="border-b lg:border-b-0 lg:border-l border-slate-100 p-4 space-y-2 overflow-y-auto">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => setTemplateId(t.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-right text-xs font-medium transition-colors ${
                  templateId === t.id
                    ? 'border-[#0E78AA] bg-sky-50 text-[#0A5F8A]'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
            <Link
              href="/accounting-settings/company-settings/document-layout"
              className="block pt-2 text-xs font-semibold text-[#0E78AA] hover:underline"
            >
              تخصيص شكل الفاتورة (شعار، ألوان، QR، تذييل)…
            </Link>
            <div className="pt-3 flex flex-col gap-2">
              <Button
                type="button"
                disabled={disabled}
                className="w-full gap-2"
                onClick={() => {
                  if (!invoice) return;
                  void runHubPrint(templateId, company, invoice, skipEmptyLines);
                }}
              >
                <Printer className="h-4 w-4" />
                طباعة فورية
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                className="w-full gap-2"
                onClick={() => {
                  if (!invoice) return;
                  void runHubPrint(templateId, company, invoice, skipEmptyLines);
                }}
              >
                <Download className="h-4 w-4" />
                تحميل PDF (طباعة إلى PDF)
              </Button>
            </div>
          </aside>
          <div className="min-h-[320px] overflow-auto bg-slate-100 p-4">
            {disabled ? (
              <p className="text-sm text-slate-500 text-center py-16">أضف أصنافاً للفاتورة لتفعيل المعاينة.</p>
            ) : (
              <div className="mx-auto max-w-[210mm] scale-[0.85] origin-top bg-white shadow-lg">
                {preview}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}