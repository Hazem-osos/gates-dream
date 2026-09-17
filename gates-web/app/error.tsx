'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { isAbortError, shouldSuppressAbortNoise } from '@/lib/api/isAbortError';
import { captureFatalError } from '@/lib/debug/gates-crash-probe';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Capture before abort classification — a recursive walker there can hide the original.
  captureFatalError(error, (error as Error & { componentStack?: string }).componentStack);
  const aborted = shouldSuppressAbortNoise(error) || isAbortError(error);
  const didAutoReset = useRef(false);

  useLayoutEffect(() => {
    if (!aborted || didAutoReset.current) return;
    didAutoReset.current = true;
    reset();
  }, [aborted, reset]);

  useEffect(() => {
    if (aborted) return;
    captureFatalError(error, (error as Error & { componentStack?: string }).componentStack);
  }, [error, aborted]);

  if (aborted) {
    return null;
  }
  return (
    <div
      className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6 py-16"
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#D6EAF3] bg-white p-8 shadow-lg shadow-sky-900/5 text-center">
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF7FB] text-[#0E78AA]"
          aria-hidden
        >
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-[#0E78AA] mb-2">عذراً، حدث خطأ غير متوقع.</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          لم نتمكن من عرض هذا الجزء من التطبيق. يمكنك المحاولة مرة أخرى، أو العودة لاحقاً إذا استمرت المشكلة.
        </p>
        {error.message ? (
          <p className="mb-6 rounded-lg bg-slate-50 p-3 text-right text-xs font-mono text-red-700 break-all">
            {error.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          className="w-full rounded-xl bg-[#0E78AA] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0B5F8A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E78AA] focus-visible:ring-offset-2"
        >
          حاول مرة أخرى
        </button>
        {error.digest && (
          <p className="mt-4 text-xs text-slate-400">رمز المرجع: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
