'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, MessageCircle, Printer, Warehouse } from 'lucide-react';
import { ThermalPrintModal } from '@/components/printer/ThermalPrintModal';
import { askGatesAi } from '@/lib/ai/ask-screen-help';
import { VIP_AI_PROMPT, type QuickWinKey, type VipPersona } from '@/lib/onboarding/vip-onboarding-storage';
import type { InvoicePrintModel } from '@/lib/print/types';

const DEMO_RECEIPT: InvoicePrintModel = {
  kind: 'SALE',
  invoiceNumber: 'DEMO-0001',
  date: new Date().toISOString(),
  paymentMethod: 'نقدي',
  cashierOrUser: 'تجربة Gates',
  customerName: 'عميل استعراضي',
  lines: [
    {
      description: 'صنف تجريبي — حديد تسليح',
      quantity: 2,
      unit: 'طن',
      unitPrice: 1250,
      discount: 0,
      net: 2500,
      vatRate: 14,
      vatAmount: 350,
      lineTotal: 2850,
    },
  ],
  subtotal: 2500,
  totalVat: 350,
  withholding: 0,
  totalPayable: 2850,
  currencyCode: 'EGP',
};

function playWinChime() {
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
    osc.onended = () => void ctx.close();
  } catch {
    /* autoplay / unsupported — visual celebration still runs */
  }
}

function fireConfetti() {
  void import('canvas-confetti').then((mod) => {
    const confetti = mod.default;
    void confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.75, x: 0.15 },
      colors: ['#0E78AA', '#34D399', '#FBBF24', '#FFFFFF'],
    });
  });
}

export function QuickWinsDock({
  persona,
  wins,
  completedWins,
  minimized,
  onMinimize,
  onComplete,
}: {
  persona: VipPersona;
  wins: Record<QuickWinKey, boolean>;
  completedWins: number;
  minimized: boolean;
  onMinimize: (value: boolean) => void;
  onComplete: (key: QuickWinKey) => void;
}) {
  const [printOpen, setPrintOpen] = useState(false);
  const [justWon, setJustWon] = useState<QuickWinKey | null>(null);
  const celebrated = useRef(false);

  const markWin = (key: QuickWinKey) => {
    if (!wins[key]) {
      setJustWon(key);
      playWinChime();
      window.setTimeout(() => setJustWon((current) => (current === key ? null : current)), 700);
    }
    onComplete(key);
  };
  const inspectHref =
    persona === 'ACCOUNTANT' ? '/accounting/chart-of-accounts' : '/inventory/creations/item-card';
  const inspectLabel = persona === 'ACCOUNTANT' ? 'شجرة الحسابات' : 'بطاقة الصنف والمخزن';

  useEffect(() => {
    if (completedWins < 3 || celebrated.current) return;
    celebrated.current = true;
    fireConfetti();
    const t = window.setTimeout(() => onMinimize(true), 1400);
    return () => window.clearTimeout(t);
  }, [completedWins, onMinimize]);

  const pct = Math.round((completedWins / 3) * 100);

  return (
    <>
      <aside
        className="fixed bottom-5 left-5 z-[70] w-[min(100vw-2rem,360px)] overflow-hidden rounded-2xl border border-white/30 bg-[#062A3A]/80 text-white shadow-2xl shadow-sky-900/30 backdrop-blur-xl"
        dir="rtl"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3"
          onClick={() => onMinimize(!minimized)}
        >
          <div className="text-right">
            <p className="text-sm font-bold">خطوات انطلاقك الأولى ({completedWins}/3)</p>
            <div className="mt-1.5 h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-sky-400 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {!minimized ? (
          <ul className="space-y-2 border-t border-white/10 px-4 py-3 text-sm">
            <li className="flex items-start justify-between gap-2 rounded-xl bg-white/5 p-2.5">
              <div>
                <p className={`${wins['print-receipt'] ? 'text-emerald-200 line-through' : 'font-semibold'} ${justWon === 'print-receipt' ? 'scale-105 text-emerald-200 transition-transform' : 'transition-transform'}`}>
                  تجربة طباعة أول إيصال
                </p>
                <p className="text-[11px] text-white/55">اختبر الطابعة الحرارية عبر البلوتوث</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25"
                onClick={() => {
                  setPrintOpen(true);
                  markWin('print-receipt');
                }}
              >
                <Printer className="h-3.5 w-3.5" /> طباعة تجريبية
              </button>
            </li>
            <li className="flex items-start justify-between gap-2 rounded-xl bg-white/5 p-2.5">
              <div>
                <p className={`${wins['inspect-masters'] ? 'text-emerald-200 line-through' : 'font-semibold'} ${justWon === 'inspect-masters' ? 'scale-105 text-emerald-200 transition-transform' : 'transition-transform'}`}>
                  فحص {inspectLabel}
                </p>
                <p className="text-[11px] text-white/55">تأكد أن الدليل جاهز للعمل</p>
              </div>
              <Link
                href={inspectHref}
                className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25"
                onClick={() => markWin('inspect-masters')}
              >
                <Warehouse className="h-3.5 w-3.5" /> فتح
              </Link>
            </li>
            <li className="flex items-start justify-between gap-2 rounded-xl bg-white/5 p-2.5">
              <div>
                <p className={`${wins['ask-ai'] ? 'text-emerald-200 line-through' : 'font-semibold'} ${justWon === 'ask-ai' ? 'scale-105 text-emerald-200 transition-transform' : 'transition-transform'}`}>
                  سؤال Gates Intelligence الأول
                </p>
                <p className="text-[11px] text-white/55">{VIP_AI_PROMPT}</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25"
                onClick={() => {
                  askGatesAi(VIP_AI_PROMPT);
                  markWin('ask-ai');
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" /> اسأل المساعد الذكي
              </button>
            </li>
          </ul>
        ) : null}
      </aside>

      <ThermalPrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        invoice={DEMO_RECEIPT}
        company={{ nameAr: 'Gates ERP — إيصال تجريبي' }}
      />
    </>
  );
}
