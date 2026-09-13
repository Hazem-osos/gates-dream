'use client';

import { useEffect, useState } from 'react';
import { subscribeApiErrors } from '@/lib/api/api-error-notify';
import {
  closeVersionConflict,
  isVersionConflictError,
  openVersionConflict,
  subscribeVersionConflict,
  VERSION_CONFLICT_ACTION,
  VERSION_CONFLICT_BODY,
  VERSION_CONFLICT_TITLE,
} from '@/lib/concurrency/version-conflict';

export function VersionConflictDialog() {
  const [open, setOpen] = useState(false);
  const [onReload, setOnReload] = useState<() => void>(() => () => {
    window.location.reload();
  });

  useEffect(() => {
    return subscribeVersionConflict((next) => {
      setOpen(next.open);
      setOnReload(() => next.onReload);
    });
  }, []);

  useEffect(() => {
    return subscribeApiErrors((payload) => {
      if (!isVersionConflictError(payload)) return;
      openVersionConflict();
    });
  }, []);

  if (!open) return null;

  const reload = () => {
    closeVersionConflict();
    onReload();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4" dir="rtl">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="version-conflict-title"
        aria-describedby="version-conflict-body"
        className="w-full max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-lg text-amber-900"
          >
            ⚠
          </span>
          <div>
            <h2 id="version-conflict-title" className="text-base font-bold text-amber-950">
              {VERSION_CONFLICT_TITLE}
            </h2>
            <p id="version-conflict-body" className="mt-2 text-sm leading-7 text-amber-900">
              {VERSION_CONFLICT_BODY}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => closeVersionConflict()}
            className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            إغلاق
          </button>
          <button
            type="button"
            onClick={reload}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            {VERSION_CONFLICT_ACTION}
          </button>
        </div>
      </div>
    </div>
  );
}
