'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import './global.css';
import { isAbortError, shouldSuppressAbortNoise } from '@/lib/api/isAbortError';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const aborted = shouldSuppressAbortNoise(error) || isAbortError(error);
  const didAutoReset = useRef(false);

  useLayoutEffect(() => {
    if (!aborted || didAutoReset.current) return;
    didAutoReset.current = true;
    reset();
  }, [aborted, reset]);

  useEffect(() => {
    if (aborted) return;
    console.error(error);
  }, [error, aborted]);

  if (aborted) {
    return null;
  }
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen antialiased bg-[#F6FBFD] text-slate-800">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
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
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-[#0E78AA] mb-2">عذراً، حدث خطأ غير متوقع.</h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              تعذر تحميل الواجهة الأساسية للتطبيق. اضغط الزر أدناه لإعادة المحاولة.
            </p>
            {process.env.NODE_ENV === 'development' && error.message && (
              <p className="mb-6 rounded-lg bg-slate-50 p-3 text-right text-xs font-mono text-red-700 break-all">
                {error.message}
              </p>
            )}
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
      </body>
    </html>
  );
}
