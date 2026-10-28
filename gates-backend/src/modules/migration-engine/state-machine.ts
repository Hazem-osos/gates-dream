import type { MigrationJobStatus } from './types';

export type { MigrationJobStatus };

const TRANSITIONS: Record<MigrationJobStatus, MigrationJobStatus[]> = {
  DRAFT: ['ANALYZING', 'BLOCKED'],
  ANALYZING: ['READY_FOR_DRY_RUN', 'BLOCKED', 'FAILED', 'DRAFT', 'PAUSED'],
  READY_FOR_DRY_RUN: ['DRY_RUNNING', 'BLOCKED', 'FAILED', 'ANALYZING', 'DRAFT'],
  DRY_RUNNING: ['READY', 'BLOCKED', 'FAILED', 'COMPLETED', 'PAUSED'],
  BLOCKED: ['DRAFT', 'ANALYZING', 'READY_FOR_DRY_RUN'],
  READY: ['RUNNING', 'DRY_RUNNING', 'BLOCKED', 'FAILED', 'ANALYZING'],
  // BLOCKED: a stage found rows it cannot carry (owner must resolve, then resume).
  RUNNING: ['PAUSED', 'RECONCILING', 'FAILED', 'COMPLETED', 'BLOCKED'],
  PAUSED: ['RUNNING', 'FAILED', 'BLOCKED', 'DRY_RUNNING', 'ANALYZING', 'DRAFT'],
  // ROLLED_BACK: the rollback endpoint stops the job (→ FAILED) before removing its data.
  FAILED: ['DRAFT', 'ANALYZING', 'DRY_RUNNING', 'READY_FOR_DRY_RUN', 'ROLLED_BACK'],
  RECONCILING: ['COMPLETED', 'FAILED', 'BLOCKED'],
  COMPLETED: ['ROLLED_BACK', 'RUNNING', 'DRY_RUNNING', 'RECONCILING', 'FAILED'],
  ROLLED_BACK: ['DRAFT'],
};

export class MigrationStateMachineError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal migration job transition: ${from} → ${to}`);
    this.name = 'MigrationStateMachineError';
  }
}

export function assertTransition(from: MigrationJobStatus, to: MigrationJobStatus): void {
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new MigrationStateMachineError(from, to);
  }
}

export function canRunExecute(status: MigrationJobStatus, openBlockers: number): boolean {
  if (openBlockers > 0) return false;
  return status === 'READY' || status === 'RUNNING' || status === 'COMPLETED' || status === 'PAUSED';
}

export function canDryRun(status: MigrationJobStatus, openBlockers: number): boolean {
  if (openBlockers > 0) return false;
  return ['READY_FOR_DRY_RUN', 'DRY_RUNNING', 'READY', 'COMPLETED', 'FAILED', 'PAUSED'].includes(status);
}

const ACTIVE_RUN_STATUSES: MigrationJobStatus[] = [
  'ANALYZING',
  'DRY_RUNNING',
  'RUNNING',
  'RECONCILING',
];

export function isActiveRunStatus(status: string): boolean {
  return ACTIVE_RUN_STATUSES.includes(status as MigrationJobStatus);
}

export function canAnalyze(status: MigrationJobStatus): boolean {
  return ['DRAFT', 'FAILED', 'BLOCKED', 'READY_FOR_DRY_RUN', 'READY', 'PAUSED', 'ROLLED_BACK'].includes(
    status
  );
}
