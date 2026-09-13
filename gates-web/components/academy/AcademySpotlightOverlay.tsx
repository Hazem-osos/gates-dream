'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AcademyTourPlan, AcademyTourStep } from '@/lib/academy/types';

type Rect = { top: number; left: number; width: number; height: number };

function readRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return null;
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  const box = el.getBoundingClientRect();
  if (box.width < 2 && box.height < 2) return null;
  const pad = 8;
  return {
    top: Math.max(8, box.top - pad),
    left: Math.max(8, box.left - pad),
    width: Math.min(window.innerWidth - 16, box.width + pad * 2),
    height: Math.min(window.innerHeight - 16, box.height + pad * 2),
  };
}

function playAck() {
  try {
    navigator.vibrate?.(12);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.035;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    /* ignore */
  }
}

export function AcademySpotlightOverlay({
  plan,
  stepIndex,
  paused,
  onPrev,
  onNext,
  onFinish,
}: {
  plan: AcademyTourPlan;
  stepIndex: number;
  paused?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const step: AcademyTourStep | undefined = plan.steps[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!step || paused) return;
    let alive = true;
    const update = () => {
      if (!alive) return;
      setRect(readRect(step.targetSelector));
    };
    update();
    const timer = window.setInterval(update, 400);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step, paused, stepIndex]);

  const tooltip = useMemo(() => {
    const width = 340;
    if (!rect) {
      return { top: 80, left: Math.max(16, window.innerWidth / 2 - width / 2), width };
    }
    let top = rect.top + rect.height + 12;
    if (top + 200 > window.innerHeight) top = Math.max(16, rect.top - 196);
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
    return { top, left, width };
  }, [rect]);

  if (paused || !step) return null;

  const total = plan.steps.length;
  const hole = rect ?? { top: 120, left: 40, width: 220, height: 56 };
  const lastStep = stepIndex >= total - 1;
  const goNext = () => {
    playAck();
    onNext();
  };

  return (
    <div className="fixed inset-0 z-[72]" dir="rtl">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="gates-academy-cutout">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={hole.left}
              y={hole.top}
              width={hole.width}
              height={hole.height}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.65)" mask="url(#gates-academy-cutout)" />
        <rect
          x={hole.left}
          y={hole.top}
          width={hole.width}
          height={hole.height}
          rx="12"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
          className="drop-shadow-[0_0_12px_rgba(14,121,170,0.85)]"
        />
      </svg>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bg-transparent" style={{ top: 0, left: 0, right: 0, height: hole.top, pointerEvents: 'auto' }} />
        <div className="absolute bg-transparent" style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0, pointerEvents: 'auto' }} />
        <div className="absolute bg-transparent" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height, pointerEvents: 'auto' }} />
        <div
          className="absolute bg-transparent"
          style={{
            top: hole.top,
            left: hole.left + hole.width,
            right: 0,
            height: hole.height,
            pointerEvents: 'auto',
          }}
        />
      </div>

      <button
        type="button"
        aria-label={lastStep ? 'إنهاء الخطوة' : 'الخطوة التالية'}
        className="absolute z-[72] rounded-xl bg-transparent"
        style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
        onClick={goNext}
      />

      <div
        className="absolute z-[73] rounded-2xl border border-[#0E79AA]/30 bg-white p-3.5 shadow-2xl"
        style={{ top: tooltip.top, left: tooltip.left, width: tooltip.width }}
      >
        <p className="text-[10px] font-bold tracking-wide text-[#0E79AA]">
          أكاديمية Gates الذكية — خطوة {stepIndex + 1} من {total}
        </p>
        <h3 className="mt-1 text-sm font-bold text-[#094C6B]">{step.titleAr}</h3>
        <p className="mt-1.5 text-[12px] leading-5 text-slate-600">{step.descriptionAr}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onFinish} className="text-[11px] text-slate-400 hover:text-rose-600">
            إنهاء الجولة ✕
          </button>
          <div className="flex items-center gap-1.5">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={onPrev}
                className="rounded-lg px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                ← السابق
              </button>
            ) : null}
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-[#0E79AA] px-2.5 py-1 text-xs font-semibold text-white"
            >
              {lastStep ? 'إنهاء' : 'التالي'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
