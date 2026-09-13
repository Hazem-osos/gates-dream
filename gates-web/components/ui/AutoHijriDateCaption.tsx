'use client';

import { useEffect } from 'react';
import { toHijriDate } from '@/lib/hijri-date';

const CAPTION_CLASS =
  'hijri-auto-caption mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400';

function isSkipped(input: HTMLInputElement): boolean {
  if (input.closest('[data-hijri-unified], [data-no-hijri], table, [role="grid"]')) return true;
  const labeled = [
    input.getAttribute('aria-label') ?? '',
    input.getAttribute('name') ?? '',
    input.getAttribute('placeholder') ?? '',
    ...(input.labels ? Array.from(input.labels).map((label) => label.textContent ?? '') : []),
  ]
    .join(' ')
    .trim();
  return /هجري|الهجري/.test(labeled);
}

function captionFor(input: HTMLInputElement): HTMLElement | null {
  const next = input.nextElementSibling;
  return next instanceof HTMLElement && next.dataset.hijriAuto === '1' ? next : null;
}

function syncCaption(input: HTMLInputElement) {
  const existing = captionFor(input);
  if (isSkipped(input) || !input.value) {
    existing?.remove();
    return;
  }
  const hijri = toHijriDate(input.value);
  if (!hijri) {
    existing?.remove();
    return;
  }
  if (existing) {
    const text = existing.querySelector('[data-hijri-text]');
    if (text) text.textContent = `الموافق: ${hijri}`;
    return;
  }
  const cap = document.createElement('div');
  cap.dataset.hijriAuto = '1';
  cap.className = CAPTION_CLASS;
  cap.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg><span data-hijri-text></span>';
  const text = cap.querySelector('[data-hijri-text]');
  if (text) text.textContent = `الموافق: ${hijri}`;
  input.insertAdjacentElement('afterend', cap);
}

export function AutoHijriDateCaption() {
  useEffect(() => {
    const scan = () => {
      document.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach(syncCaption);
    };
    const onEvt = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'date') syncCaption(target);
    };
    document.addEventListener('input', onEvt, true);
    document.addEventListener('change', onEvt, true);
    const mo = new MutationObserver((records) => {
      if (records.every((record) => record.target instanceof HTMLElement && record.target.dataset.hijriAuto === '1')) {
        return;
      }
      scan();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();
    return () => {
      document.removeEventListener('input', onEvt, true);
      document.removeEventListener('change', onEvt, true);
      mo.disconnect();
    };
  }, []);
  return null;
}
