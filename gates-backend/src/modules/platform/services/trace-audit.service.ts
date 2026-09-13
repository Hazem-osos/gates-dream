import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

/**
 * Legacy `Action` literals actually passed to `Save_Trace` across
 * `MainProgram/**.pas` (~677 call sites in 222 units), by observed
 * frequency: Print, Delete, Edit, Add, Browse, Post, UnPost, UnDelete, plus
 * the rarer Tazher/UnTazher (hold/release) and Take/UnTake/Return/UnRetun
 * (custody transfer) and Update.
 */
export type LegacyTraceAction =
  | 'Add'
  | 'Edit'
  | 'Update'
  | 'Delete'
  | 'UnDelete'
  | 'Print'
  | 'Browse'
  | 'Post'
  | 'UnPost'
  | 'Tazher'
  | 'UnTazher'
  | 'Take'
  | 'UnTake'
  | 'Return'
  | 'UnRetun';

export interface TraceRecordParams {
  companyId: string;
  branchId?: string | null;
  userId: string;
  /**
   * Legacy `ScreenName` is almost always the main-menu `TMenuItem.Name`
   * for that screen (e.g. `mnsmCustomer`), not the `.pas` unit name or the
   * `.dfm` form caption — see `docs/parity/menu-tree.json` for the
   * authoritative list. Pass that menu-item name here when known so this
   * lines up with the legacy join key (`HiddenScreen.MenuItem`).
   */
  screenName: string;
  action: LegacyTraceAction;
  /** Legacy `RecordCode` — the affected row's business id/code. */
  recordCode: string;
  /** Legacy `Name` — a short human label, e.g. the record's Arabic name. */
  name?: string | null;
  /** Legacy `ActionDate` — the business date; defaults to now like most call sites (`Now`). */
  actionDate?: Date;
}

/**
 * Maps legacy `Save_Trace` (`MainProgram/untgeneral.pas:127`, insert at
 * 6351-6391) onto `ActivityLog`. Legacy columns: `UserCode`, `ScreenName`,
 * `Action`, `Date` (audit timestamp), `RecordCode`, `ActionDate` (business
 * date), `Name`, `CompanyCode`, `BranchCode`.
 *
 * `kind: 'legacy-trace'` keeps these separate from `document-audit` (invoice/
 * journal lifecycle) and `security` entries, but they still flow through the
 * existing generic readers unfiltered by kind — `auditLogService` (used by
 * `GET /api/v1/audit-logs` and the "تتبع المستخدمين" screen) and
 * `GET /api/v1/activity-logs` — so no new read API or UI was needed.
 *
 * Full 677-call-site parity (every legacy screen/action) is out of
 * foundation-phase scope; see `docs/parity/foundation-trace-audit.md` for
 * what's wired now vs. deferred.
 */
export class TraceAuditService {
  async record(params: TraceRecordParams): Promise<void> {
    // Legacy itself never inserts when `Trim(RecordCode) = ''` (most `Print`
    // calls pass '' and are silently skipped) — mirror that exactly.
    const recordCode = params.recordCode?.trim();
    if (!recordCode) return;

    try {
      await prisma.activityLog.create({
        data: {
          tenantId: params.companyId,
          actorId: params.userId,
          kind: 'legacy-trace',
          subjectType: params.screenName,
          subjectId: recordCode,
          severity: 'info',
          reason: params.name?.trim()?.slice(0, 1000) || null,
          metadata: {
            action: params.action,
            screenName: params.screenName,
            recordCode,
            branchCode: params.branchId ?? null,
            actionDate: (params.actionDate ?? new Date()).toISOString(),
          },
        },
      });
    } catch (error) {
      logger.error({ error, params }, 'Failed to record legacy trace entry');
    }
  }
}

export const traceAuditService = new TraceAuditService();
