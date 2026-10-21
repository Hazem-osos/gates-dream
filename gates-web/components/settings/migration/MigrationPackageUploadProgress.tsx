'use client';

import type { MigrationUploadProgress } from '@/lib/migration/chunked-package-upload';
import { formatMigrationUploadMb } from '@/lib/migration/chunked-package-upload';

const PHASE_AR: Record<MigrationUploadProgress['phase'], string> = {
  init: 'جاري تجهيز جلسة الرفع…',
  uploading: 'جاري رفع الملف…',
  finalizing: 'جاري حفظ الحزمة على الخادم…',
  done: 'اكتمل الرفع بنجاح',
};

type Props = {
  progress: MigrationUploadProgress;
};

export default function MigrationPackageUploadProgress({ progress }: Props) {
  const pct = Math.max(0, Math.min(100, progress.percent));
  const indeterminate = progress.phase === 'init' && pct < 2;

  return (
    <div
      className="rounded-xl border border-[#0E78AA]/25 bg-gradient-to-br from-slate-50 to-[#EAF6FB] p-4 shadow-sm dark:from-slate-900 dark:to-slate-950"
      role="status"
      aria-live="polite"
      aria-busy={progress.phase !== 'done'}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#0A3D5E]">
          {PHASE_AR[progress.phase]}
        </p>
        <span className="text-sm tabular-nums text-[#0E78AA]">{pct}%</span>
      </div>
      {progress.fileName ? (
        <p className="mb-3 truncate text-xs text-slate-600" title={progress.fileName}>
          {progress.fileName}
        </p>
      ) : null}
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800">
        {indeterminate ? (
          <div className="migration-upload-indeterminate absolute inset-y-0 w-1/3 rounded-full bg-[#0E78AA]" />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0E78AA] to-[#38bdf8] transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-slate-500">
        <span>
          {formatMigrationUploadMb(progress.uploadedBytes)} / {formatMigrationUploadMb(progress.totalBytes)} MB
        </span>
        {progress.totalChunks != null && progress.chunkIndex != null ? (
          <span>
            جزء {progress.chunkIndex} / {progress.totalChunks}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-amber-800/90">
        لا تغلق الصفحة ولا تنتقل لتبويب آخر حتى يكتمل الشريط.
      </p>
      <style jsx>{`
        @keyframes migration-upload-slide {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }
        .migration-upload-indeterminate {
          animation: migration-upload-slide 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
