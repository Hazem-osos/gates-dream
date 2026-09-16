'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  resolveConfirm,
  subscribeConfirm,
  type ConfirmRequest,
  type ConfirmTone,
} from '@/lib/feedback/confirm';

const TONE: Record<
  ConfirmTone,
  { iconWrap: string; icon: string; title: string; confirm: 'danger' | 'primary' | 'secondary' }
> = {
  danger: {
    iconWrap: 'bg-rose-50 ring-1 ring-rose-100',
    icon: 'text-rose-600',
    title: 'text-[#0A3D5E]',
    confirm: 'danger',
  },
  warning: {
    iconWrap: 'bg-amber-50 ring-1 ring-amber-100',
    icon: 'text-amber-600',
    title: 'text-[#0A3D5E]',
    confirm: 'primary',
  },
  info: {
    iconWrap: 'bg-[#E8F4FA] ring-1 ring-[#D6EAF3]',
    icon: 'text-[#0E79AA]',
    title: 'text-[#0A3D5E]',
    confirm: 'primary',
  },
};

function ToneIcon({ tone }: { tone: ConfirmTone }) {
  const className = `h-6 w-6 ${TONE[tone].icon}`;
  if (tone === 'danger') return <Trash2 className={className} strokeWidth={2} />;
  if (tone === 'info') return <Info className={className} strokeWidth={2} />;
  return <AlertTriangle className={className} strokeWidth={2} />;
}

export function ConfirmDialogHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [mounted, setMounted] = useState(false);
  const openedAtRef = useRef(0);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    return subscribeConfirm((next) => {
      setRequest(next);
      if (next) openedAtRef.current = Date.now();
    });
  }, []);

  useEffect(() => {
    if (!request) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 20);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resolveConfirm(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [request]);

  if (!mounted || !request) return null;

  const tone = TONE[request.tone];
  const close = (value: boolean) => {
    if (Date.now() - openedAtRef.current < 200) return;
    resolveConfirm(value);
  };

  return createPortal(
    <div className="fixed inset-0 z-[12000] overflow-y-auto p-4 sm:p-6" dir="rtl" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[#0A3D5E]/45 backdrop-blur-[2px]"
        aria-label="رجوع"
        onClick={() => close(false)}
      />
      <div className="relative flex min-h-full items-center justify-center">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="gates-confirm-title"
          aria-describedby="gates-confirm-message"
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-[0_24px_60px_rgba(10,61,94,0.22)]"
        >
          <div className="h-1.5 bg-gradient-to-l from-[#0E79AA] to-[#094C6B]" />
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.iconWrap}`}
              >
                <ToneIcon tone={request.tone} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="gates-confirm-title" className={`text-lg font-bold ${tone.title}`}>
                  {request.title}
                </h2>
                <p id="gates-confirm-message" className="mt-2 text-sm leading-7 text-slate-600">
                  {request.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-start gap-2">
              <Button
                type="button"
                variant={tone.confirm}
                size="sm"
                onClick={() => close(true)}
              >
                {request.confirmLabel}
              </Button>
              <Button
                ref={cancelRef}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => close(false)}
              >
                {request.cancelLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
