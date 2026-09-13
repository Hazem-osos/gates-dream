'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DocumentLayoutConfig, PREVIEW_MOCK_LABELS, PreviewMockKind } from '@/lib/documentLayout/types';
import { buildPreviewMock } from '@/lib/documentLayout/mockData';
import { generateDocumentHtml } from '@/lib/documentLayout/templateEngine';
import { PAGE_BOX_PX } from '@/lib/documentLayout/presetStyles';
import { buildQrDataUrl, buildQrPayload } from '@/lib/documentLayout/qr';
import { usePrintDocument } from '@/lib/documentLayout/usePrintDocument';

const MOCK_KINDS: PreviewMockKind[] = ['CONTRACTOR_INVOICE', 'REAL_ESTATE_RECEIPT', 'DEBIT_NOTE'];

const ZOOM_PRESETS = [
  { id: '50' as const, label: '50%', value: 0.5 },
  { id: '75' as const, label: '75%', value: 0.75 },
  { id: '100' as const, label: '100%', value: 1 },
  { id: 'fit' as const, label: 'ملاءمة العرض', value: null },
];

export interface RightPreviewPanelProps {
  config: DocumentLayoutConfig;
  onSave?: () => void;
  saving?: boolean;
}

export function RightPreviewPanel({ config, onSave, saving }: RightPreviewPanelProps) {
  const [mockKind, setMockKind] = useState<PreviewMockKind>('CONTRACTOR_INVOICE');
  const [zoomMode, setZoomMode] = useState<(typeof ZOOM_PRESETS)[number]['id']>('75');
  const [fitZoom, setFitZoom] = useState(0.75);
  const [pageCount, setPageCount] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const { printDocument } = usePrintDocument();

  const mockData = useMemo(() => buildPreviewMock(mockKind), [mockKind]);

  useEffect(() => {
    if (!config.showQrCode) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void buildQrDataUrl(buildQrPayload(mockData)).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [mockData, config.showQrCode]);

  const html = useMemo(
    () => generateDocumentHtml(mockData, config, { qrDataUrl }),
    [mockData, config, qrDataUrl]
  );

  const pageBox = PAGE_BOX_PX[config.paperSize];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const available = Math.max(240, el.clientWidth - 48);
      setFitZoom(Math.min(1.4, Math.max(0.35, available / pageBox.width)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageBox.width]);

  const zoom = zoomMode === 'fit' ? fitZoom : ZOOM_PRESETS.find((z) => z.id === zoomMode)?.value ?? 0.75;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      const body = iframe.contentDocument?.body;
      if (body) {
        const total = Math.max(1, Math.ceil(body.scrollHeight / pageBox.height));
        setPageCount(total);
      }
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [pageBox.height]);

  const runPrint = () => {
    void printDocument(mockData, config);
  };

  const scrollToPage = (page: number) => {
    scrollRef.current?.scrollTo({ top: (page - 1) * pageBox.height * zoom, behavior: 'smooth' });
  };

  return (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {MOCK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMockKind(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                mockKind === k ? 'bg-[#0E78AA] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#0E78AA]/50'
              }`}
            >
              {PREVIEW_MOCK_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
            {ZOOM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setZoomMode(preset.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                  zoomMode === preset.id ? 'bg-[#0E78AA] text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <span className="w-10 text-center text-[11px] text-slate-400">{Math.round(zoom * 100)}%</span>

          {pageCount > 1 ? (
            <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
              <span className="text-xs text-slate-500">{pageCount} صفحة</span>
              <button type="button" onClick={() => scrollToPage(1)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:border-[#0E78AA]/50">
                ⏮
              </button>
              <button type="button" onClick={() => scrollToPage(pageCount)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:border-[#0E78AA]/50">
                ⏭
              </button>
            </div>
          ) : null}

          {onSave ? (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-lg border border-[#0E78AA] px-3 py-1.5 text-xs font-semibold text-[#0E78AA] hover:bg-[#EAF6FB] disabled:opacity-60"
            >
              {saving ? 'جارِ الحفظ…' : 'حفظ القالب'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={runPrint}
            className="rounded-lg bg-[#0E78AA] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#094C6B] transition-colors"
          >
            طباعة المستند
          </button>
          <button
            type="button"
            onClick={runPrint}
            className="rounded-lg border border-[#0E78AA] px-3 py-1.5 text-xs font-semibold text-[#0E78AA] hover:bg-[#EAF6FB] transition-colors"
            title="اختر «حفظ كـ PDF» من نافذة الطباعة"
          >
            تحميل PDF
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto bg-slate-200/70 p-6">
        <div
          className="mx-auto shadow-xl"
          style={{
            width: pageBox.width * zoom,
            transition: 'width 120ms ease',
          }}
        >
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top right', width: pageBox.width }}>
            <iframe
              ref={iframeRef}
              title="document-preview"
              srcDoc={html}
              style={{ width: pageBox.width, height: pageBox.height * pageCount, border: 'none', background: '#fff' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
