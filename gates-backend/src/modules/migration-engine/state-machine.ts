import type { MigrationJobStatus } from './types';

export type { MigrationJobStatus };

const TRANSITIONS: Record<MigrationJobStatus, MigrationJobStatus[]> = {
  DRAFT: ['ANALYZING', 'BLOCKED'],
  ANALYZING: ['READY_FOR_DRY_RUN', 'BLOCKED', 'FAILED'],
  READY_FOR_DRY_RUN: ['DRY_RUNNING', 'BLOCKED', 'FAILED'],
  DRY_RUNNING: ['READY', 'BLOCKED', 'FAILED', 'COMPLETED'],
  BLOCKED: ['DRAFT', 'ANALYZING', 'READY_FOR_DRY_RUN'],
  READY: ['RUNNING', 'BLOCKED', 'FAILED'],
  RUNNING: ['PAUSED', 'RECONCILING', 'FAILED', 'COMPLETED'],
  PAUSED: ['RUNNING', 'FAILED', 'BLOCKED'],
  FAILED: ['DRAFT', 'ANALYZING'],
  RECONCILING: ['COMPLETED', 'FAILED', 'BLOCKED'],
  COMPLETED: ['ROLLED_BACK', 'RUNNING', 'DRY_RUNNING'],
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
  return status === 'READY' || status === 'RUNNING' || status === 'COMPLETED';
}

export function canDryRun(status: MigrationJobStatus, openBlockers: number): boolean {
  if (openBlockers > 0) return false;
  return ['READY_FOR_DRY_RUN', 'DRY_RUNNING', 'READY', 'COMPLETED'].includes(status);
}
