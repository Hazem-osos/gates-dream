'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bluetooth, Printer, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/feedback/toast';
import { canvasToEscPos } from '@/lib/printer/escpos-encoder';
import { thermalDataFromPrintModel } from '@/lib/printer/from-invoice-print-model';
import {
  readSalesPrintPrefs,
  writeSalesPrintPrefs,
} from '@/lib/printer/print-prefs';
import { printEscPosViaRawBT, printThermalViaBrowser, isLikelyIOS } from '@/lib/printer/rawbt-fallback';
import { renderReceiptToCanvas } from '@/lib/printer/receipt-canvas';
import type { ThermalInvoiceData, ThermalRollWidth } from '@/lib/printer/types';
import {
  bluetoothThermalPrinter,
  isWebBluetoothAvailable,
  readCachedPrinterName,
} from '@/lib/printer/web-bluetooth';
import type { CompanyPrintProfile, InvoicePrintModel } from '@/lib/print/types';

type PrintPhase = 'idle' | 'connecting' | 'sending' | 'done';

type Props = {
  open: boolean;
  onClose: () => void;
  invoice: InvoicePrintModel | null;
  company?: CompanyPrintProfile;
  customerBalance?: number | null;
  autoStartBluetooth?: boolean;
};

const PHASE_LABEL: Record<PrintPhase, string> = {
  idle: '',
  connecting: 'جاري الاتصال بالطابعة...',
  sending: 'جاري إرسال البيانات...',
  done: 'تمت الطباعة بنجاح',
};

export function ThermalPrintModal({
  open,
  onClose,
  invoice,
  company,
  customerBalance,
  autoStartBluetooth = false,
}: Props) {
  const [widthMm, setWidthMm] = useState<ThermalRollWidth>(() => readSalesPrintPrefs().widthMm);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [phase, setPhase] = useState<PrintPhase>('idle');
  const [printerName, setPrinterName] = useState<string | null>(() =>
    bluetoothThermalPrinter.deviceName || readCachedPrinterName()
  );
  const [error, setError] = useState<string | null>(null);

  const data: ThermalInvoiceData | null = useMemo(
    () => (invoice ? thermalDataFromPrintModel(invoice, company, { customerBalance }) : null),
    [invoice, company, customerBalance]
  );

  const bluetoothOk = isWebBluetoothAvailable();
  const ios = isLikelyIOS();
  const busy = phase === 'connecting' || phase === 'sending' || previewing;
  const disabled = !data || data.items.length === 0;

  useEffect(() => {
    if (!open || !data) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    void renderReceiptToCanvas(data, { widthMm })
      .then((canvas) => {
        if (!cancelled) setPreviewUrl(canvas.toDataURL('image/png'));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'تعذّر رسم معاينة الإيصال.');
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data, widthMm]);

  const runBluetooth = useCallback(
    async (allowPicker: boolean) => {
      if (!data) return;
      setError(null);
      setPhase('connecting');
      try {
        const canvas = await renderReceiptToCanvas(data, { widthMm });
        const bytes = canvasToEscPos(canvas);
        if (!bluetoothThermalPrinter.connected) {
          const cached = await bluetoothThermalPrinter.reconnectCached();
          if (!cached && allowPicker) {
            await bluetoothThermalPrinter.requestDevice();
          }
        }
        if (!bluetoothThermalPrinter.deviceName && !bluetoothThermalPrinter.connected) {
          throw new Error('اختر الطابعة من زر «طباعة بلوتوث مباشر».');
        }
        setPrinterName(bluetoothThermalPrinter.deviceName);
        await bluetoothThermalPrinter.connectAndWrite(bytes, (next) => setPhase(next), allowPicker);
        setPhase('done');
        toast.success('تمت الطباعة بنجاح');
      } catch (e) {
        setPhase('idle');
        const message =
          e instanceof Error && e.name === 'NotFoundError'
            ? 'لم يتم اختيار طابعة.'
            : e instanceof Error && e.name === 'SecurityError'
              ? 'الطباعة عبر البلوتوث تحتاج Chrome مع HTTPS.'
              : e instanceof Error
                ? e.message
                : 'تعذّرت الطباعة عبر البلوتوث.';
        setError(message);
        if (allowPicker) toast.error(message);
      }
    },
    [data, widthMm]
  );

  useEffect(() => {
    if (!open || !autoStartBluetooth || disabled || !bluetoothOk) return;
    void runBluetooth(false);
  }, [open, autoStartBluetooth, disabled, bluetoothOk, runBluetooth]);

  const onWidth = (next: ThermalRollWidth) => {
    setWidthMm(next);
    writeSalesPrintPrefs({ widthMm: next });
  };

  const onRawBt = async () => {
    if (!data) return;
    setError(null);
    try {
      const canvas = await renderReceiptToCanvas(data, { widthMm });
      printEscPosViaRawBT(canvasToEscPos(canvas));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'تعذّر تجهيز ملف RawBT.';
      setError(message);
      toast.error(message);
    }
  };

  const onBrowserPrint = () => {
    if (!data) return;
    try {
      printThermalViaBrowser(data, widthMm);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'تعذّرت الطباعة.';
      setError(message);
      toast.error(message);
    }
  };

  if (!open) return null;

  const connectedLabel = printerName
    ? `${printerName} (${bluetoothThermalPrinter.connected ? 'متصل' : 'محفوظ'})`
    : bluetoothOk
      ? 'لا توجد طابعة مقترنة بعد'
      : 'Web Bluetooth غير متاح على هذا المتصفح';

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[12000] bg-black/45"
        aria-label="إغلاق طباعة الإيصال الحراري"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-3 top-[4vh] z-[12010] mx-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-2xl"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="thermal-print-title"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div>
            <h2 id="thermal-print-title" className="text-base font-bold text-[#0A3D5E]">
              طباعة الإيصال الحراري
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">بلوتوث مباشر أو RawBT أو طباعة المتصفح</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-2.5">
          <p className="text-xs font-semibold text-[#0A3D5E]">عرض الرول</p>
          <div className="flex gap-2">
            {([58, 80] as const).map((mm) => (
              <button
                key={mm}
                type="button"
                onClick={() => onWidth(mm)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                  widthMm === mm
                    ? 'border-[#0E79AA] bg-[#0E79AA]/10 text-[#0E79AA]'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {mm} مم
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-600">
          <span className="font-semibold text-[#0A3D5E]">الطابعة: </span>
          {connectedLabel}
        </div>

        <div className="min-h-[240px] flex-1 overflow-auto bg-[#edf1f4] p-4">
          {disabled ? (
            <p className="py-16 text-center text-sm text-slate-500">أضف أصنافاً للفاتورة لتفعيل الإيصال.</p>
          ) : previewing && !previewUrl ? (
            <p className="py-16 text-center text-sm text-slate-500">جاري تجهيز المعاينة…</p>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="معاينة الإيصال الحراري"
              className="mx-auto block bg-white shadow-md"
              style={{ width: widthMm === 58 ? 192 : 288 }}
            />
          ) : null}
        </div>

        {error ? (
          <p className="px-5 pt-2 text-xs text-red-600">{error}</p>
        ) : null}
        {phase !== 'idle' ? (
          <p className="px-5 pt-2 text-xs font-semibold text-[#0E79AA]">{PHASE_LABEL[phase]}</p>
        ) : null}

        <footer className="flex flex-col gap-2 px-5 py-4">
          <Button
            type="button"
            disabled={disabled || busy || !bluetoothOk}
            className="w-full gap-2"
            onClick={() => void runBluetooth(true)}
          >
            <Bluetooth className="h-4 w-4" />
            طباعة بلوتوث مباشر
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || busy || ios}
            className="w-full gap-2"
            onClick={() => void onRawBt()}
          >
            <Smartphone className="h-4 w-4" />
            طباعة عبر تطبيق RawBT
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || busy}
            className="w-full gap-2"
            onClick={onBrowserPrint}
          >
            <Printer className="h-4 w-4" />
            معاينة وطباعة عادية
          </Button>
        </footer>
      </div>
    </>
  );
}
