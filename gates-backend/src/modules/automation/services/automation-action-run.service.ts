import { runWithoutTenantScoping } from '../../../shared/database/tenant-context';
import {
  isUniqueConstraintError,
  sanitizeResultMetadata,
  type AutomationActionRunRecord,
  type AutomationActionRunStatus,
  type AutomationActionRunStore,
  type AutomationResultMetadata,
  type ClaimInput,
  type ClaimKey,
  type ClaimResult,
  type RecoverActionFn,
  type RecoveredActionResult,
} from './automation-action-run.types';

export const STALE_PENDING_MS = 30_000;
export const ACTION_RUN_LIST_MAX = 100;
export const ACTION_RUN_LIST_DEFAULT = 20;

export type ListActionRunsQuery = {
  companyId: string;
  eventId?: string;
  eventType?: string;
  ruleId?: string;
  status?: AutomationActionRunStatus;
  page: number;
  limit: number;
};

function uniqueWhere(key: ClaimKey) {
  return {
    companyId_eventId_ruleId_actionType: {
      companyId: key.companyId,
      eventId: key.eventId,
      ruleId: key.ruleId,
      actionType: key.actionType,
    },
  };
}

function sliceError(message: string): string {
  return message.slice(0, 2000);
}

/**
 * Generic claim / recover / succeed / fail ledger.
 * Purchase-order domain recovery stays in the purchase-request adapter.
 */
export class AutomationActionRunService {
  constructor(
    private readonly db: AutomationActionRunStore,
    private readonly now: () => Date = () => new Date()
  ) {}

  async claim(input: ClaimInput, recover?: RecoverActionFn): Promise<ClaimResult> {
    try {
      const startedAt = this.now();
      const run = await runWithoutTenantScoping(() =>
        this.db.automationActionRun.create({
          data: {
            companyId: input.companyId,
            eventId: input.eventId,
            ruleId: input.ruleId,
            actionType: input.actionType,
            correlationId: input.correlationId,
            eventType: input.eventType ?? null,
            attemptCount: 1,
            startedAt,
            status: 'PENDING',
          },
        })
      );
      return { kind: 'claimed', run };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const existing = await this.findByUnique(input);
    if (!existing) {
      throw new Error('Automation action conflict. Retry shortly.');
    }

    if (existing.status === 'SUCCEEDED' && existing.resultEntityId) {
      return { kind: 'existing', run: existing };
    }

    const recovered = recover ? await recover(existing) : null;
    if (recovered) {
      const run = await this.markSucceeded(existing.companyId, existing.id, recovered);
      return { kind: 'existing', run };
    }

    if (existing.status === 'FAILED') {
      const taken = await this.reclaimFailed(existing);
      if (taken) return { kind: 'claimed', run: taken };
      const after = await this.findByUnique(input);
      if (after?.status === 'SUCCEEDED' && after.resultEntityId) {
        return { kind: 'existing', run: after };
      }
      return { kind: 'in_progress', run: after ?? existing };
    }

    if (this.isStalePending(existing)) {
      const taken = await this.reclaimStalePending(existing);
      if (taken) return { kind: 'claimed', run: taken };
    }

    return { kind: 'in_progress', run: existing };
  }

  /**
   * companyId is required (not just runId) so a write can never cross a
   * tenant boundary even if a caller ever passes a run from the wrong
   * company. `id` alone is a UUID and effectively unguessable, but this
   * keeps every mutating query explicitly company-scoped like the rest
   * of this service.
   */
  async markSucceeded(
    companyId: string,
    runId: string,
    result: RecoveredActionResult
  ): Promise<AutomationActionRunRecord> {
    const completedAt = this.now();
    const updated = await runWithoutTenantScoping(() =>
      this.db.automationActionRun.updateMany({
        where: { id: runId, companyId },
        data: {
          status: 'SUCCEEDED',
          resultEntityType: result.resultEntityType,
          resultEntityId: result.resultEntityId,
          resultMetadata: sanitizeResultMetadata(result.resultMetadata ?? null),
          errorMessage: null,
          lastErrorCode: null,
          completedAt,
        },
      })
    );
    if (updated.count !== 1) {
      throw new Error('Automation action run not found for company while marking succeeded.');
    }
    const run = await runWithoutTenantScoping(() =>
      this.db.automationActionRun.findFirst({ where: { id: runId, companyId } })
    );
    if (!run) {
      throw new Error('Automation action run not found for company after marking succeeded.');
    }
    return run;
  }

  async markFailed(
    companyId: string,
    runId: string,
    input: {
      errorMessage: string;
      lastErrorCode?: string | null;
      resultEntityType?: string | null;
      resultEntityId?: string | null;
      resultMetadata?: AutomationResultMetadata | null;
    }
  ): Promise<void> {
    const completedAt = this.now();
    await runWithoutTenantScoping(() =>
      this.db.automationActionRun.updateMany({
        where: { id: runId, companyId, status: 'PENDING' },
        data: {
          status: 'FAILED',
          errorMessage: sliceError(input.errorMessage),
          lastErrorCode: input.lastErrorCode ?? null,
          completedAt,
          ...(input.resultEntityId
            ? {
                resultEntityType: input.resultEntityType ?? null,
                resultEntityId: input.resultEntityId,
                resultMetadata: sanitizeResultMetadata(input.resultMetadata ?? null),
              }
            : {}),
        },
      })
    );
  }

  async findByUnique(key: ClaimKey): Promise<AutomationActionRunRecord | null> {
    return runWithoutTenantScoping(() =>
      this.db.automationActionRun.findUnique({
        where: uniqueWhere(key),
      })
    );
  }

  async getById(companyId: string, id: string): Promise<AutomationActionRunRecord | null> {
    return runWithoutTenantScoping(() =>
      this.db.automationActionRun.findFirst({
        where: { id, companyId },
      })
    );
  }

  async list(query: ListActionRunsQuery): Promise<{
    runs: AutomationActionRunRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page > 0 ? query.page : 1;
    const limit = Math.min(
      query.limit > 0 ? query.limit : ACTION_RUN_LIST_DEFAULT,
      ACTION_RUN_LIST_MAX
    );
    const where: Record<string, unknown> = { companyId: query.companyId };
    if (query.eventId) where.eventId = query.eventId;
    if (query.eventType) where.eventType = query.eventType;
    if (query.ruleId) where.ruleId = query.ruleId;
    if (query.status) where.status = query.status;

    const [runs, total] = await runWithoutTenantScoping(() =>
      Promise.all([
        this.db.automationActionRun.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.db.automationActionRun.count({ where }),
      ])
    );

    return { runs, total, page, limit };
  }

  isStalePending(run: AutomationActionRunRecord): boolean {
    if (run.status !== 'PENDING') return false;
    return this.now().getTime() - run.updatedAt.getTime() >= STALE_PENDING_MS;
  }

  /**
   * First-claim correlationId is the recovery key. Retries must not overwrite it.
   * Last error is kept until SUCCEEDED.
   */
  private async reclaimFailed(
    existing: AutomationActionRunRecord
  ): Promise<AutomationActionRunRecord | null> {
    const startedAt = this.now();
    const taken = await runWithoutTenantScoping(() =>
      this.db.automationActionRun.updateMany({
        where: { id: existing.id, companyId: existing.companyId, status: 'FAILED' },
        data: {
          status: 'PENDING',
          attemptCount: { increment: 1 },
          startedAt,
          completedAt: null,
        },
      })
    );
    if (taken.count !== 1) return null;
    return (
      (await this.findByUnique({
        companyId: existing.companyId,
        eventId: existing.eventId,
        ruleId: existing.ruleId,
        actionType: existing.actionType,
      })) ?? {
        ...existing,
        status: 'PENDING',
        attemptCount: existing.attemptCount + 1,
        startedAt,
        completedAt: null,
      }
    );
  }

  private async reclaimStalePending(
    existing: AutomationActionRunRecord
  ): Promise<AutomationActionRunRecord | null> {
    const startedAt = this.now();
    const taken = await runWithoutTenantScoping(() =>
      this.db.automationActionRun.updateMany({
        where: {
          id: existing.id,
          companyId: existing.companyId,
          status: 'PENDING',
          updatedAt: existing.updatedAt,
        },
        data: {
          status: 'PENDING',
          attemptCount: { increment: 1 },
          startedAt,
        },
      })
    );
    if (taken.count !== 1) return null;
    return (
      (await this.findByUnique({
        companyId: existing.companyId,
        eventId: existing.eventId,
        ruleId: existing.ruleId,
        actionType: existing.actionType,
      })) ?? {
        ...existing,
        attemptCount: existing.attemptCount + 1,
        startedAt,
      }
    );
  }
}
