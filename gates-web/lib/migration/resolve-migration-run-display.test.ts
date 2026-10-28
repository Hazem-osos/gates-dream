import { describe, expect, it } from 'vitest';
import { resolveMigrationRunDisplay } from './resolve-migration-run-display';
import type { MigrationProgressSnapshot } from './migration-types';

function snap(partial: Partial<MigrationProgressSnapshot>): MigrationProgressSnapshot {
  return {
    jobId: 'j1',
    status: 'DRAFT',
    currentStage: null,
    dryRun: false,
    overallPercent: 0,
    engineImplementationPercent: 95,
    milestones: [],
    modules: [],
    openBlockers: 0,
    issueCounts: { blocker: 0, warning: 0, info: 0 },
    startedAt: null,
    completedAt: null,
    elapsedMs: null,
    etaMs: null,
    ui: null,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe('resolveMigrationRunDisplay', () => {
  it('shows مسودة when the job was only created', () => {
    const d = resolveMigrationRunDisplay(snap({ status: 'DRAFT' }));
    expect(d.statusKey).toBe('DRAFT');
    expect(d.label).toBe('مسودة');
    expect(d.active).toBe(false);
  });

  it('shows في الانتظار after a successful schedule while still DRAFT', () => {
    const d = resolveMigrationRunDisplay(
      snap({ status: 'DRAFT', ui: { lastEnqueuedAt: '2026-10-25T11:00:00.000Z' } })
    );
    expect(d.statusKey).toBe('QUEUED');
    expect(d.label).toBe('في الانتظار');
    expect(d.active).toBe(true);
  });

  it('surfaces lastError instead of looking idle', () => {
    const d = resolveMigrationRunDisplay(
      snap({
        status: 'DRAFT',
        ui: { lastEnqueuedAt: '2026-10-25T11:00:00.000Z', lastError: 'locked by another runner' },
      })
    );
    expect(d.statusKey).toBe('FAILED');
    expect(d.lastError).toMatch(/ترحيل آخر/);
    expect(d.active).toBe(false);
  });
});
