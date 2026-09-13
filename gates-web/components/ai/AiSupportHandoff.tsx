'use client';

import { useState } from 'react';
import { ExternalLink, MessageCircle, X } from 'lucide-react';

const SUPPORT_EMAIL = 'support@gates-soft.com';

export function openSupportTicketModal(input: { screen?: string } = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gates-ai:support', { detail: input }));
}

export function shouldShowSupportHandoff(input: {
  assistantText?: string;
  userText?: string;
  isError?: boolean;
  toolFailed?: boolean;
}): boolean {
  if (input.isError || input.toolFailed) return true;
  if (/دعم|مشكلة|عطل/i.test(input.userText ?? '')) return true;
  return /permission|صلاحيات|لا صلاحية|غير مصرح|سياسات الأمان|BLOCKED_BY_RBAC|تعذّر/i.test(
    input.assistantText ?? ''
  );
}

export function AiSupportHandoff({ currentPath }: { currentPath?: string }) {
  const [open, setOpen] = useState(false);
  const screen = currentPath || '/';
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `طلب مساعدة فنية — Gates ERP (${screen})`
  )}&body=${encodeURIComponent(`المسار: ${screen}\n\nوصف المشكلة:\n`)}`;

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2.5">
      <p className="text-xs text-slate-500">هل تحتاج لمساعدة مباشرة من فريق العمل؟</p>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          openSupportTicketModal({ screen });
        }}
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E79AA] hover:underline"
      >
        <span>💬 التواصل مع الدعم الفني لـ Gates</span>
        <ExternalLink className="h-3 w-3" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="inline-flex items-center gap-1 text-sm font-semibold text-[#094C6B]">
                <MessageCircle className="h-4 w-4 text-[#0E79AA]" />
                طلب مساعدة فنية
              </p>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400" aria-label="إغلاق">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              سيُفتح بريد الدعم مع مسار الشاشة الحالية مضمّناً:{' '}
              <span className="font-mono text-[11px] text-[#0E79AA]">{screen}</span>
            </p>
            <a
              href={mailto}
              className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-[#0E79AA] px-3 py-2 text-xs font-semibold text-white"
            >
              إرسال إلى {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
