'use client';

import React, { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Printer } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { printHtml, wrapPrintHtml } from '@/lib/print/printHtml';
import '@/app/components/print/print-styles.css';

let printHost: HTMLDivElement | null = null;
let printRoot: Root | null = null;

export function renderPrintableAndOpen(
  render: () => React.ReactElement
): void {
  if (typeof document === 'undefined') return;

  if (!printHost) {
    printHost = document.createElement('div');
    printHost.id = 'gates-print-root';
    printHost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(printHost);
    printRoot = createRoot(printHost);
  }

  flushSync(() => {
    printRoot?.render(render());
  });

  const markup = printHost.innerHTML;
  void printHtml(wrapPrintHtml(markup, 'طباعة')).finally(() => {
    printRoot?.render(<div />);
  });
}

export function PrintDocumentButton({
  label = 'طباعة',
  disabled,
  onPrintA4,
  onPrintLayout,
  onPrintThermal,
  variant = 'secondary',
}: {
  label?: string;
  disabled?: boolean;
  onPrintA4?: () => React.ReactElement;
  onPrintLayout?: () => void | Promise<void>;
  onPrintThermal?: () => React.ReactElement;
  variant?: 'primary' | 'secondary';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const run = useCallback((factory: () => React.ReactElement) => {
    setOpen(false);
    renderPrintableAndOpen(factory);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant={variant}
        disabled={disabled}
        className="gap-2"
        data-print-document=""
        onClick={() => {
          if (onPrintThermal && (onPrintLayout || onPrintA4)) {
            setOpen((v) => !v);
            return;
          }
          if (onPrintLayout) {
            void onPrintLayout();
            return;
          }
          if (onPrintA4) run(onPrintA4);
        }}
      >
        <Printer className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      {open && onPrintThermal ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-[#D6EAF3] bg-white py-1 shadow-lg">
          <button
            type="button"
            className="block w-full px-4 py-2 text-right text-sm hover:bg-[#EEF7FB]"
            onClick={() => {
              if (onPrintLayout) {
                setOpen(false);
                void onPrintLayout();
                return;
              }
              if (onPrintA4) run(onPrintA4);
            }}
          >
            A4 — فاتورة ضريبية
          </button>
          <button
            type="button"
            className="block w-full px-4 py-2 text-right text-sm hover:bg-[#EEF7FB]"
            onClick={() => run(onPrintThermal)}
          >
            80mm — إيصال حراري
          </button>
        </div>
      ) : null}
    </div>
  );
}
