import type { MigrationCheckpoint, MigrationJob, MigrationIssue } from '@prisma/client';
import {
  migrationMilestones,
  overallImplementationPercent,
  type MilestoneReadiness,
} from './migration-progress.service';

export type MigrationModuleProgress = {
  stage: string;
  label: string;
  processed: number;
  success: number;
  warnings: number;
  errors: number;
  status: 'pending' | 'active' | 'done' | 'failed' | 'skipped';
};

export type MigrationProgressSnapshot = {
  jobId: string;
  status: string;
  currentStage: string | null;
  dryRun: boolean;
  overallPercent: number;
  engineImplementationPercent: number;
  milestones: MilestoneReadiness[];
  modules: MigrationModuleProgress[];
  openBlockers: number;
  issueCounts: { blocker: number; warning: number; info: number };
  startedAt: string | null;
  completedAt: string | null;
  elapsedMs: number | null;
  etaMs: number | null;
  ui: Record<string, unknown> | null;
  updatedAt: string;
};

const STAGE_ORDER = [
  { id: 'FOUNDATION', label: 'الأساسيات' },
  { id: 'COA', label: 'دليل الحسابات' },
  { id: 'PARTIES', label: 'العملاء والموردين' },
  { id: 'ACCOUNTING', label: 'القيود التاريخية' },
  { id: 'ITEMS', label: 'الأصناف والمخازن' },
  { id: 'INVENTORY', label: 'حركات المخزون' },
  { id: 'COMMERCIAL', label: 'فواتير تاريخية' },
  { id: 'TREASURY_HISTORICAL', label: 'سندات نقد/بنك' },
  { id: 'SETTLEMENT_HISTORICAL', label: 'تسويات فواتير/نقد' },
  { id: 'CHEQUE_HISTORICAL', label: 'أوراق قبض تاريخية' },
] as const;

function bigintToNumber(v: bigint | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'bigint' ? Number(v) : v;
}

function issueCounts(issues: Pick<MigrationIssue, 'severity'>[]) {
  let blocker = 0;
  let warning = 0;
  let info = 0;
  for (const i of issues) {
    if (i.severity === 'BLOCKER') blocker += 1;
    else if (i.severity === 'WARNING') warning += 1;
    else info += 1;
  }
  return { blocker, warning, info };
}

function moduleRows(
  job: MigrationJob,
  checkpoints: MigrationCheckpoint[]
): MigrationModuleProgress[] {
  const byStage = new Map<string, MigrationCheckpoint[]>();
  for (const cp of checkpoints) {
    const list = byStage.get(cp.stage) ?? [];
    list.push(cp);
    byStage.set(cp.stage, list);
  }

  const activeStage = job.currentStage?.toUpperCase() ?? null;
  let passedActive = !activeStage;

  return STAGE_ORDER.map(({ id, label }) => {
    const rows = byStage.get(id) ?? [];
    let processed = 0;
    let success = 0;
    let warnings = 0;
    let errors = 0;
    for (const r of rows) {
      processed += bigintToNumber(r.processedCount);
      success += bigintToNumber(r.successCount);
      warnings += bigintToNumber(r.warningCount);
      errors += bigintToNumber(r.errorCount);
    }

    let status: MigrationModuleProgress['status'] = 'pending';
    if (job.status === 'FAILED' && activeStage === id) status = 'failed';
    else if (activeStage === id && ['RUNNING', 'DRY_RUNNING', 'RECONCILING', 'ANALYZING'].includes(job.status)) {
      status = 'active';
      passedActive = false;
    } else if (passedActive && processed > 0) status = 'done';
    else if (passedActive && job.status === 'COMPLETED') status = 'done';
    else if (!passedActive && activeStage && STAGE_ORDER.findIndex((s) => s.id === id) <
        STAGE_ORDER.findIndex((s) => s.id === activeStage)) {
      status = 'done';
    }

    if (activeStage === id) passedActive = true;

    return { stage: id, label, processed, success, warnings, errors, status };
  });
}

function estimateOverallPercent(modules: MigrationModuleProgress[], job: MigrationJob): number {
  if (job.status === 'COMPLETED') return 100;
  if (job.status === 'DRAFT') return 0;
  const weights = STAGE_ORDER.map((s) => s.id);
  const perStage = 100 / weights.length;
  let sum = 0;
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (m.status === 'done') sum += perStage;
    else if (m.status === 'active') {
      const denom = Math.max(m.processed, 1);
      const frac = Math.min(1, m.success / denom);
      sum += perStage * (0.2 + 0.8 * frac);
    }
  }
  if (job.status === 'ANALYZING') sum = Math.max(sum, 5);
  if (job.status === 'RECONCILING') sum = Math.max(sum, 92);
  return Math.min(99, Math.round(sum));
}

export function buildMigrationProgressSnapshot(params: {
  job: MigrationJob;
  checkpoints: MigrationCheckpoint[];
  issues: Pick<MigrationIssue, 'severity' | 'resolutionState'>[];
  openBlockers: number;
}): MigrationProgressSnapshot {
  const { job, checkpoints, issues, openBlockers } = params;
  const milestones = migrationMilestones();
  const modules = moduleRows(job, checkpoints);
  const overallPercent = estimateOverallPercent(modules, job);

  const started = job.startedAt?.getTime() ?? null;
  const elapsedMs = started ? Date.now() - started : null;
  let etaMs: number | null = null;
  if (elapsedMs != null && overallPercent > 5 && overallPercent < 99) {
    etaMs = Math.round((elapsedMs / overallPercent) * (100 - overallPercent));
  }

  const ui =
    job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
      ? ((job.progress as Record<string, unknown>).ui as Record<string, unknown> | undefined) ?? null
      : null;

  return {
    jobId: job.id,
    status: job.status,
    currentStage: job.currentStage,
    dryRun: job.dryRun,
    overallPercent,
    engineImplementationPercent: overallImplementationPercent(milestones),
    milestones,
    modules,
    openBlockers,
    issueCounts: issueCounts(issues),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    elapsedMs,
    etaMs,
    ui,
    updatedAt: job.updatedAt.toISOString(),
  };
}
