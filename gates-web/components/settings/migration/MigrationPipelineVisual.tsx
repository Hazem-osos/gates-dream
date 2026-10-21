'use client';

import { motion } from 'framer-motion';
import type { MigrationProgressSnapshot } from '@/lib/migration/migration-types';

type Props = {
  progress: MigrationProgressSnapshot | null;
};

export default function MigrationPipelineVisual({ progress }: Props) {
  const pct = progress?.overallPercent ?? 0;
  const stage = progress?.currentStage ?? '—';
  const status = progress?.status ?? 'DRAFT';
  const elapsedSec =
    progress?.elapsedMs != null ? Math.max(0, Math.floor(progress.elapsedMs / 1000)) : null;
  const etaSec =
    progress?.etaMs != null ? Math.max(0, Math.floor(progress.etaMs / 1000)) : null;
  const totalProcessed = progress?.modules?.reduce((s, m) => s + m.processed, 0) ?? 0;
  const totalSuccess = progress?.modules?.reduce((s, m) => s + m.success, 0) ?? 0;
  const totalErrors = progress?.modules?.reduce((s, m) => s + m.errors, 0) ?? 0;
  const totalWarnings = progress?.modules?.reduce((s, m) => s + m.warnings, 0) ?? 0;

  const statusLabel: Record<string, string> = {
    DRAFT: 'مسودة',
    ANALYZING: 'تحليل',
    READY_FOR_DRY_RUN: 'جاهز للمعاينة',
    DRY_RUNNING: 'معاينة جافة',
    READY: 'جاهز للتنفيذ',
    RUNNING: 'ترحيل',
    RECONCILING: 'مطابقة',
    COMPLETED: 'مكتمل',
    FAILED: 'فشل',
    BLOCKED: 'محظور',
    PAUSED: 'متوقف',
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">المرحلة الحالية</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{stage}</p>
        </div>
        <div className="text-left">
          <p className="text-sm text-slate-500 dark:text-slate-400">الحالة</p>
          <p className="text-lg font-semibold text-[#0E78AA]">{statusLabel[status] ?? status}</p>
        </div>
        <div className="min-w-[120px] text-left">
          <p className="text-sm text-slate-500 dark:text-slate-400">التقدم</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{pct}%</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="سجلات معالجة" value={String(totalProcessed)} />
        <Stat label="نجاح" value={String(totalSuccess)} />
        <Stat label="تحذيرات" value={String(totalWarnings)} />
        <Stat label="أخطاء/محظور" value={String(totalErrors)} />
        {elapsedSec != null ? <Stat label="المدة" value={`${elapsedSec}ث`} /> : null}
        {etaSec != null ? <Stat label="متبقٍ (تقدير)" value={`${etaSec}ث`} /> : null}
      </div>

      <div className="relative flex min-h-[140px] items-center justify-between gap-4 px-2">
        <DatabaseNode title="قاعدة المصدر" subtitle="Legacy SQL Server" side="source" />
        <PipelineTrack active={['RUNNING', 'DRY_RUNNING', 'ANALYZING', 'RECONCILING'].includes(status)} />
        <DatabaseNode title="GATES" subtitle="الشركة الهدف" side="target" />
      </div>

      {progress?.modules?.length ? (
        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {progress.modules.map((m) => (
            <div
              key={m.stage}
              className="rounded-lg border border-slate-100 bg-white/80 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{m.label}</span>
                <span className="text-xs text-slate-500">{m.status}</span>
              </div>
              <p className="mt-1 tabular-nums text-xs text-slate-600 dark:text-slate-400">
                {m.success}/{m.processed} سجل
                {m.errors > 0 ? ` · ${m.errors} خطأ` : ''}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {status === 'COMPLETED' && pct >= 100 ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-500/10"
        >
          <span className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            اكتمل الترحيل والمطابقة
          </span>
        </motion.div>
      ) : null}
    </div>
  );
}

function DatabaseNode({
  title,
  subtitle,
  side,
}: {
  title: string;
  subtitle: string;
  side: 'source' | 'target';
}) {
  return (
    <div
      className={`z-10 flex flex-col items-center gap-1 ${side === 'source' ? 'order-1' : 'order-3'}`}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#0E78AA]/30 bg-white shadow-md dark:bg-slate-900">
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#0E78AA]" fill="currentColor" aria-hidden>
          <path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v2H4V5zm0 4h16v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9zm4 2v2h8v-2H8z" />
        </svg>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-slate-900/40">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PipelineTrack({ active }: { active: boolean }) {
  return (
    <div className="relative order-2 flex flex-1 flex-col items-center justify-center py-4">
      <div className="h-1 w-full max-w-md rounded-full bg-slate-200 dark:bg-slate-700" />
      {active
        ? [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute h-3 w-3 rounded-full bg-[#0E78AA] shadow"
              initial={{ left: '10%', opacity: 0 }}
              animate={{ left: ['10%', '90%'], opacity: [0, 1, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: i * 0.55,
                ease: 'easeInOut',
              }}
              style={{ top: '50%', marginTop: -6 }}
            />
          ))
        : null}
      <p className="mt-3 text-xs text-slate-500">خط الترحيل</p>
    </div>
  );
}
