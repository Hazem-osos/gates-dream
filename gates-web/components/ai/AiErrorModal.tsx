'use client';

import { AlertTriangle, Loader2, MessageCircle, Sparkles, X } from 'lucide-react';
import type { DiagnoseQuickFix } from '@/lib/ai/diagnose-error';

export type AiErrorModalProps = {
  open: boolean;
  problem: string;
  explanation: string;
  steps: string[];
  loading?: boolean;
  quickAction?: DiagnoseQuickFix;
  onClose: () => void;
  onAskChat: () => void;
  onQuickAction?: () => void;
};

export function AiErrorModal({
  open,
  problem,
  explanation,
  steps,
  loading,
  quickAction,
  onClose,
  onAskChat,
  onQuickAction,
}: AiErrorModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="ai-error-title"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E6F0F7] bg-[#F6FBFD] px-5 py-3.5">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0E79AA]">
              <Sparkles className="h-3.5 w-3.5" />
              Gates Assistant Explanation
            </p>
            <h2 id="ai-error-title" className="mt-1 text-base font-bold text-[#0A3D5E]">
              شرح الخطأ
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-600"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <section className="rounded-xl border border-rose-100 bg-rose-50/70 px-3.5 py-3">
            <p className="text-[11px] font-bold text-rose-700">المشكلة</p>
            <p className="mt-1 flex items-start gap-2 text-sm font-semibold leading-6 text-[#7F1D1D]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{problem}</span>
            </p>
          </section>

          <section>
            <p className="text-[11px] font-bold text-[#0E79AA]">السبب والحل</p>
            {loading ? (
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-[#0E79AA]" />
                جاري مراجعة البيانات وتجهيز الرد…
              </p>
            ) : (
              <p className="mt-1.5 text-sm leading-7 text-slate-700">{explanation}</p>
            )}
          </section>

          {!loading && steps.length ? (
            <section>
              <p className="text-[11px] font-bold text-[#0A3D5E]">خطوات الحل السريعة</p>
              <ul className="mt-2 list-disc space-y-1.5 pr-5 text-sm leading-6 text-slate-700">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E6F0F7] bg-[#F8FBFD] px-5 py-3">
          <button
            type="button"
            onClick={onAskChat}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6EAF3] bg-white px-3 py-2 text-xs font-semibold text-[#0A3D5E] hover:bg-[#F6FBFD]"
          >
            <MessageCircle className="h-3.5 w-3.5 text-[#0E79AA]" />
            سؤال مساعد Gates في الشات
          </button>
          {quickAction ? (
            <button
              type="button"
              onClick={onQuickAction}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E79AA] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0c6a96]"
            >
              {quickAction.labelAr}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
