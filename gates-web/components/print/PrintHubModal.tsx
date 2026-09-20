'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Printer, X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { PrintDocumentRenderer } from '@/components/documentLayout/PrintDocumentRenderer';
import { printInvoiceDocument } from '@/lib/print/printOperationalDocument';
import { renderPrintableAndOpen } from '@/app/components/print/PrintDocumentButton';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';

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

  const disabled = !invoice || invoice.lines.length === 0;

  return (
    <CenteredOverlay open={open} onClose={onClose} width="full" zClass="z-[12000]" labelledBy="print-hub-title">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="min-w-0">
          <h2 id="print-hub-title" className="text-base font-bold text-slate-900">
            مركز الطباعة
          </h2>
          <p className="text-xs text-slate-500">اختر القالب ثم عاين أو اطبع</p>
        </div>
        <Button type="button" variant="secondary" size="sm" className="gap-1.5 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
          إغلاق
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[17rem_1fr]">
        <aside className="space-y-2 overflow-y-auto border-b border-slate-100 p-4 lg:border-b-0 lg:border-l">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => setTemplateId(t.id)}
              className={`w-full rounded-xl border px-3 py-2.5 text-right text-xs font-medium transition-colors ${
                templateId === t.id
                  ? 'border-[#0E78AA] bg-sky-50 text-[#0A5F8A]'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300'
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
          <div className="flex flex-col gap-2 pt-3">
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
              تحميل PDF
            </Button>
          </div>
        </aside>
        <div className="min-h-0 overflow-auto bg-slate-100 p-3">
          {disabled ? (
            <p className="py-16 text-center text-sm text-slate-500">أضف أصنافاً للفاتورة لتفعيل المعاينة.</p>
          ) : (
            <div className="mx-auto w-full max-w-[210mm] bg-white shadow-lg">{preview}</div>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 justify-end border-t border-slate-100 px-5 py-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          إغلاق والعودة للفاتورة
        </Button>
      </footer>
      </div>
    </CenteredOverlay>
  );
}
