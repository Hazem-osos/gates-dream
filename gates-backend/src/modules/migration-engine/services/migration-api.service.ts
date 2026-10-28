import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  migrationMilestones,
  overallImplementationPercent,
} from './migration-progress.service';
import { MigrationJobService } from './migration-job.service';
import { MigrationIssueService } from './migration-issue.service';
import { buildMigrationProgressSnapshot } from './migration-job-progress.service';
import { MigrationOrchestratorService } from './migration-orchestrator.service';
import { MigrationPipelineService } from './migration-pipeline.service';
import {
  assertCustomerExecuteAllowed,
  assertMigrationEngineEnabled,
  assertSafeTargetDatabaseUrl,
  customerExecuteAllowed,
  MigrationTargetSafetyError,
} from '../target-safety';
import {
  runModeRequiresTargetWriteConfirm,
  type MigrationRunMode,
} from '../schemas/migration-engine.schema';
import { getPackage, packagePreflightMessage } from './migration-package.storage';
import {
  abortQueuedMigrationRuns,
  enqueueMigrationRun,
  findQueuedMigrationRun,
} from '../../../workers/queues/migration-run.queue';
import { isActiveRunStatus } from '../state-machine';
import { ConnectorCommandService } from '../legacy-source/connector-command.service';
import { readLifecycle, mergeLifecyclePatch } from './migration-lifecycle.service';
import { reconciliationBundleToCsv } from './migration-reconciliation-bundle.service';
import { assessBakRestore, runBakRestore } from './migration-bak-restore.service';
import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';
import { randomUUID } from 'node:crypto';
import { connectorProvisionalFingerprint, packageProvisionalFingerprint } from '../types';

export class MigrationApiService {
  private jobs: MigrationJobService;
  private issues: MigrationIssueService;
  private orchestrator: MigrationOrchestratorService;
  private pipeline: MigrationPipelineService;

  constructor(private readonly prisma: PrismaClient) {
    this.jobs = new MigrationJobService(prisma);
    this.issues = new MigrationIssueService(prisma);
    this.orchestrator = new MigrationOrchestratorService(prisma);
    this.pipeline = new MigrationPipelineService(prisma);
  }

  private async seedOperatorDefaults(jobId: string) {
    const job = await this.jobs.getJob(jobId);
    if (!job) return;
    const { applyDefaultInventoryCutoverPolicyToProgress } = await import(
      '../policies/migration-inventory-cutover-policy'
    );
    const merged = applyDefaultInventoryCutoverPolicyToProgress(job.progress);
    const current =
      job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
        ? (job.progress as Record<string, unknown>)
        : {};
    if (merged.inventoryCutoverPolicy !== current.inventoryCutoverPolicy) {
      await this.jobs.updateProgress(
        jobId,
        merged as import('@prisma/client').Prisma.InputJsonValue
      );
    }
  }

  private async finalizeNewJob(jobId: string) {
    await this.seedOperatorDefaults(jobId);
    const job = await this.jobs.getJob(jobId);
    if (!job) throw new AppError(500, 'تعذّر إنشاء مهمة الترحيل');
    return job;
  }

  async capabilities(companyId?: string, userId?: string) {
    let engineEnabled = false;
    let targetSafe = false;
    let message: string | undefined;
    try {
      assertMigrationEngineEnabled();
      engineEnabled = true;
      assertSafeTargetDatabaseUrl(process.env.DATABASE_URL ?? '');
      targetSafe = true;
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }

    const milestones = migrationMilestones();
    let legacyForensicConfigured = Boolean(process.env.LEGACY_FORENSIC_URL?.trim());
    let legacyRemoteSqlStatus: string | null = null;
    if (companyId) {
      const readyWizard = await this.prisma.migrationLegacySourceConfig.count({
        where: { companyId, status: 'READY' },
      });
      if (readyWizard > 0) legacyForensicConfigured = true;
      const remoteRow = await this.prisma.migrationLegacySourceConfig.findUnique({
        where: { companyId_mode: { companyId, mode: 'REMOTE_SQL_SERVER' } },
        select: { status: true },
      });
      legacyRemoteSqlStatus = remoteRow?.status ?? null;
      if (remoteRow?.status === 'READY') legacyForensicConfigured = true;
    }
    const packagesDir = process.env.MIGRATION_PACKAGES_DIR?.trim();
    const bakRestoreEnabled = process.env.MIGRATION_BAK_RESTORE_ENABLED === 'true';
    const isolatedHost = process.env.MIGRATION_ISOLATED_MSSQL_HOST?.trim();
    const isolatedHostAllowed = Boolean(
      isolatedHost && !/railway|prod|production/i.test(isolatedHost)
    );
    const { getAgentReleaseInfo, agentPairingApiBase } = await import('./migration-agent-release.service');
    return {
      engineEnabled,
      targetSafe,
      message,
      customerExecuteEnabled: customerExecuteAllowed(userId),
      agentPairingApiBase: agentPairingApiBase(),
      agentRelease: getAgentReleaseInfo(),
      legacyForensicConfigured,
      legacyRemoteSqlStatus,
      packagesDir: packagesDir || null,
      bakRestoreAutoReady: bakRestoreEnabled && isolatedHostAllowed,
      supportedSourceModes: [
        'REMOTE_SQL_SERVER',
        'ON_PREMISE_CONNECTOR',
        'BACKUP_RESTORE',
        'LEGACY_CONNECTION',
        'PACKAGE',
      ] as const,
      restoreSupportedExtensions: ['.bak'] as const,
      storageOnlyExtensions: ['.zip', '.7z'] as const,
      supportedLegacyEngine: 'LEGACY_GATES_SQLSERVER (read-only via LEGACY_FORENSIC_URL)',
      engineImplementationPercent: overallImplementationPercent(milestones),
      milestones,
      blockedModules: [
        'SettlementTrxHeader (non-catalog) — BLOCKER when rows exist',
        'PKTrxDetailSub multi-collect on payment cheques',
        'Legacy modules outside critical path (~500+ tables) — see LEGACY_TO_NEW_MAPPING.md',
        'Inventory valuation / inventory-to-GL — owner policy (FULL_CUTOVER_READINESS)',
        '.bak restore — requires configured SQL Server tooling (assessment API returns steps)',
      ],
    };
  }

  private assertEngineReady() {
    try {
      assertMigrationEngineEnabled();
      assertSafeTargetDatabaseUrl(process.env.DATABASE_URL ?? '');
    } catch (e) {
      if (e instanceof MigrationTargetSafetyError) {
        throw new AppError(503, e.message);
      }
      throw e;
    }
  }

  async listJobs(companyId: string) {
    return this.jobs.listForCompany(companyId);
  }

  async getJobDetail(jobId: string, companyId: string) {
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) {
      throw new AppError(404, 'Migration job not found');
    }
    const [checkpoints, issues, openBlockers] = await Promise.all([
      this.prisma.migrationCheckpoint.findMany({ where: { migrationJobId: jobId } }),
      this.issues.list(jobId),
      this.jobs.countOpenBlockers(jobId),
    ]);
    const progress = buildMigrationProgressSnapshot({
      job,
      checkpoints,
      issues,
      openBlockers,
    });
    const lifecycle = readLifecycle(job.progress);
    const progressObj =
      job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
        ? (job.progress as Record<string, unknown>)
        : null;
    const reconciliation = progressObj ? progressObj.reconciliation : null;
    const preflight = progressObj ? progressObj.preflight ?? null : null;
    return {
      job,
      progress,
      lifecycle,
      reconciliation,
      preflight,
      issues,
      idMapCount: await this.prisma.migrationIdMap.count({ where: { migrationJobId: jobId } }),
    };
  }

  async getCoreCoverage(jobId: string, companyId: string) {
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');
    const progress = job.progress as Record<string, unknown> | null;
    if (progress?.coreCoverage) {
      const cc = { ...(progress.coreCoverage as Record<string, unknown>) };
      const fer = cc.fieldEvidenceReport as { totals?: unknown; remainingGaps?: unknown[] } | undefined;
      if (fer?.totals && !cc.fieldCoverage) {
        cc.fieldCoverage = {
          totals: fer.totals,
          remainingGapCount: Array.isArray(fer.remainingGaps) ? fer.remainingGaps.length : 0,
        };
      }
      return cc;
    }
    const { CORE_AREA_DEFINITIONS } = await import('./migration-core-coverage.service');
    const { resolveInventoryCutoverPolicyForRun } = await import('../policies/migration-inventory-cutover-policy');
    const inv = resolveInventoryCutoverPolicyForRun(progress);
    const { buildSchemaCoverageReport } = await import('./migration-legacy-schema-coverage.service');
    const { buildMachineReadableFieldReport } = await import('./migration-field-evidence.service');
    let schemaCoverage: ReturnType<typeof buildSchemaCoverageReport> | null = null;
    let fieldCoverage: ReturnType<typeof buildMachineReadableFieldReport> | null = null;
    try {
      schemaCoverage = buildSchemaCoverageReport();
      fieldCoverage = buildMachineReadableFieldReport();
    } catch {
      /* erp_schema.txt unavailable in this runtime */
    }
    return {
      areas: CORE_AREA_DEFINITIONS,
      inventoryCutoverPolicy: inv.label,
      inventoryCutoverPolicySelected: Boolean(inv.policy),
      offline: true,
      schemaCoverage,
      fieldCoverage: fieldCoverage
        ? {
            totals: fieldCoverage.totals,
            remainingGapCount: fieldCoverage.remainingGaps.length,
          }
        : null,
    };
  }

  async patchJobSettings(
    jobId: string,
    companyId: string,
    body: { inventoryCutoverPolicy?: string; inventoryOpeningJeApproved?: boolean }
  ) {
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');
    const progress =
      job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
        ? { ...(job.progress as Record<string, unknown>) }
        : {};
    if (body.inventoryCutoverPolicy) progress.inventoryCutoverPolicy = body.inventoryCutoverPolicy;
    if (body.inventoryOpeningJeApproved != null) {
      progress.inventoryOpeningJeApproved = body.inventoryOpeningJeApproved;
    }
    await this.jobs.updateProgress(jobId, progress as import('@prisma/client').Prisma.InputJsonValue);
    return this.jobs.getJob(jobId);
  }

  async getProgressSnapshot(jobId: string, companyId: string) {
    const detail = await this.getJobDetail(jobId, companyId);
    return detail.progress;
  }

  async createJob(
    companyId: string,
    body: {
      legacyCompanyCode: string;
      sourceMode:
        | 'LEGACY_CONNECTION'
        | 'PACKAGE'
        | 'REMOTE_SQL_SERVER'
        | 'ON_PREMISE_CONNECTOR'
        | 'BACKUP_RESTORE';
      packageId?: string;
      restoreRunId?: string;
      legacyConnectionRef?: string;
    }
  ) {
    this.assertEngineReady();

    const active = await this.jobs.findActiveForCompany(companyId);
    if (active) {
      throw new AppError(409, 'يوجد ترحيل قيد التنفيذ لهذه الشركة. انتظر اكتماله أو ألغِه.');
    }

    const normalized =
      body.sourceMode === 'LEGACY_CONNECTION'
        ? 'REMOTE_SQL_SERVER'
        : body.sourceMode === 'PACKAGE'
          ? 'BACKUP_RESTORE'
          : body.sourceMode;

    if (normalized === 'BACKUP_RESTORE') {
      if (!body.packageId) {
        throw new AppError(400, 'اختر حزمة .bak بعد اكتمال الرفع');
      }
      const pkg = await getPackage(companyId, body.packageId);
      if (!pkg) throw new AppError(404, 'حزمة الترحيل غير موجودة');

      const configRow = body.restoreRunId
        ? await this.prisma.migrationLegacySourceConfig.findFirst({
            where: { companyId, mode: 'BACKUP_RESTORE' },
          })
        : null;

      if (configRow?.status === 'READY' && !body.restoreRunId) {
        const job = await this.orchestrator.createPilotJob(companyId, body.legacyCompanyCode, {
          sourceMode: 'BACKUP_RESTORE',
          legacySourceConfigId: configRow.id,
        });
        await this.jobs.mergeProgress(job.id, {
          ui: { sourceMode: 'BACKUP_RESTORE', packageId: pkg.id },
          lifecycle: { phase: 'READY', updatedAt: new Date().toISOString() },
        });
        return this.finalizeNewJob(job.id);
      }

      const job = await this.orchestrator.createPilotJob(companyId, body.legacyCompanyCode, {
        sourceMode: 'BACKUP_RESTORE',
        skipSourceProbe: true,
        provisionalFingerprint: packageProvisionalFingerprint(pkg.sha256),
      });
      await this.jobs.mergeProgress(job.id, {
        ui: {
          sourceMode: 'BACKUP_RESTORE',
          packageId: pkg.id,
          packageFileName: pkg.originalName,
          packageSha256: pkg.sha256,
          packagePreflight: packagePreflightMessage(pkg),
          restoreRunId: body.restoreRunId ?? null,
        },
        lifecycle: { phase: 'UPLOADED', updatedAt: new Date().toISOString() },
      });
      return this.finalizeNewJob(job.id);
    }

    if (normalized === 'ON_PREMISE_CONNECTOR') {
      const config = await this.prisma.migrationLegacySourceConfig.findUnique({
        where: { companyId_mode: { companyId, mode: 'ON_PREMISE_CONNECTOR' } },
      });
      if (!config || config.status !== 'READY') {
        throw new AppError(
          503,
          'شغّل برنامج الترحيل على ويندوز وأكمل الربط حتى تظهر Device ID، واترك النافذة مفتوحة بعد بيانات SQL، ثم أنشئ المهمة.'
        );
      }
      try {
        const job = await this.orchestrator.createPilotJob(companyId, body.legacyCompanyCode, {
          sourceMode: 'ON_PREMISE_CONNECTOR',
          legacySourceConfigId: config.id,
          skipSourceProbe: true,
          provisionalFingerprint: connectorProvisionalFingerprint(config.id),
        });
        await this.jobs.mergeProgress(job.id, {
          ui: { sourceMode: 'ON_PREMISE_CONNECTOR' },
          lifecycle: { phase: 'CONNECTED', updatedAt: new Date().toISOString() },
        });
        return this.finalizeNewJob(job.id);
      } catch (e) {
        if (e instanceof AppError) throw e;
        const msg = e instanceof Error ? e.message : String(e);
        throw new AppError(
          503,
          `تعذّر إنشاء مهمة الموصل. تأكد أن نافذة البرنامج ما زالت مفتوحة: ${msg}`
        );
      }
    }

    const remoteConfig = await this.prisma.migrationLegacySourceConfig.findUnique({
      where: { companyId_mode: { companyId, mode: 'REMOTE_SQL_SERVER' } },
    });
    const envForensic = process.env.LEGACY_FORENSIC_URL?.trim();
    const remoteReady = remoteConfig?.status === 'READY';

    if (!remoteReady && !envForensic) {
      if (remoteConfig?.status === 'DRAFT') {
        throw new AppError(
          400,
          'اتصال SQL محفوظ لكن غير مفعّل — اضغط «اختبار الاتصال» حتى يصبح READY ثم أنشئ المهمة.'
        );
      }
      if (remoteConfig?.status === 'FAILED') {
        throw new AppError(
          400,
          'آخر اختبار اتصال SQL فشل — راجع Host وكلمة المرور ثم «اختبار الاتصال» قبل إنشاء المهمة.'
        );
      }
      throw new AppError(
        400,
        'اضبط مصدر Legacy أولاً: «حفظ الاتصال» و«اختبار الاتصال»، أو موصل/نسخة .bak.'
      );
    }

    let job;
    try {
      job = await this.orchestrator.createPilotJob(companyId, body.legacyCompanyCode, {
        sourceMode: 'REMOTE_SQL_SERVER',
        legacySourceConfigId: remoteReady ? remoteConfig!.id : undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/No legacy SQL source configured/i.test(msg)) {
        throw new AppError(400, 'مصدر Legacy غير جاهز — اختبر اتصال SQL من الخطوة 1.');
      }
      if (/Isolated SQL Server host not configured|Automated \.bak restore is disabled/i.test(msg)) {
        throw new AppError(400, msg);
      }
      if (/getaddrinfo|enotfound|eservfail|eai_again|could not be resolved|looks like host,port/i.test(msg)) {
        throw new AppError(400, msg);
      }
      throw new AppError(
        503,
        `تعذّر الاتصال بقاعدة Legacy أثناء إنشاء المهمة: ${msg}`
      );
    }
    await this.jobs.mergeProgress(job.id, {
      ui: { sourceMode: 'REMOTE_SQL_SERVER' },
      lifecycle: { phase: 'CONNECTED', updatedAt: new Date().toISOString() },
    });
    return this.finalizeNewJob(job.id);
  }

  async enqueueRun(
    jobId: string,
    companyId: string,
    params: {
      mode: MigrationRunMode;
      stages?: string[];
      confirmTargetWrite?: boolean;
      userId?: string;
    }
  ) {
    this.assertEngineReady();
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) {
      throw new AppError(404, 'Migration job not found');
    }

    await this.seedOperatorDefaults(jobId);

    if (isActiveRunStatus(job.status)) {
      throw new AppError(
        409,
        'مهمة الترحيل شغالة الآن. اضغط «إيقاف التشغيل» ثم أعد التحليل أو المعاينة.'
      );
    }

    if (runModeRequiresTargetWriteConfirm(params.mode)) {
      try {
        assertCustomerExecuteAllowed(params.userId);
      } catch (e) {
        if (e instanceof MigrationTargetSafetyError) throw new AppError(403, e.message);
        throw e;
      }
    }

    if (runModeRequiresTargetWriteConfirm(params.mode) && !params.confirmTargetWrite) {
      throw new AppError(400, 'تأكيد الكتابة على الشركة الهدف مطلوب (confirmTargetWrite=true)');
    }

    const active = await this.jobs.findActiveForCompany(companyId);
    if (active && active.id !== jobId) {
      throw new AppError(409, 'ترحيل آخر نشط لهذه الشركة');
    }

    const alreadyQueued = Boolean(await findQueuedMigrationRun(jobId));
    if (alreadyQueued) {
      throw new AppError(
        409,
        'مهمة الترحيل شغالة الآن. اضغط «إيقاف التشغيل» ثم أعد التحليل أو المعاينة.'
      );
    }
    const bullJob = await enqueueMigrationRun({
      migrationJobId: jobId,
      companyId,
      mode: params.mode,
      stages: params.stages,
    });

    await this.recordRunScheduled(jobId, {
      mode: params.mode,
      stages: params.stages,
      inline: false,
      bullJobId: String(bullJob.id),
    });

    return { queued: true, queueJobId: bullJob.id, alreadyQueued };
  }

  async recordRunScheduled(
    jobId: string,
    opts: { mode: MigrationRunMode; stages?: string[]; inline: boolean; bullJobId?: string }
  ) {
    await this.jobs.mergeProgress(jobId, {
      ui: {
        lastEnqueuedAt: new Date().toISOString(),
        pipelineMode: opts.mode,
        pipelineStages: opts.stages ?? null,
        inline: opts.inline,
        lastError: null,
        lastFailedAt: null,
        ...(opts.bullJobId ? { bullJobId: opts.bullJobId } : {}),
      },
      cancelRequestedAt: null,
    });
  }

  /** Inline path: persist «queued» before the API process starts analyze. */
  async scheduleInlineRun(
    jobId: string,
    companyId: string,
    params: { mode: MigrationRunMode; stages?: string[]; confirmTargetWrite?: boolean; userId?: string }
  ) {
    this.assertEngineReady();
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) {
      throw new AppError(404, 'Migration job not found');
    }
    if (runModeRequiresTargetWriteConfirm(params.mode)) {
      try {
        assertCustomerExecuteAllowed(params.userId);
      } catch (e) {
        if (e instanceof MigrationTargetSafetyError) throw new AppError(403, e.message);
        throw e;
      }
    }
    if (runModeRequiresTargetWriteConfirm(params.mode) && !params.confirmTargetWrite) {
      throw new AppError(400, 'تأكيد الكتابة على الشركة الهدف مطلوب (confirmTargetWrite=true)');
    }
    await this.seedOperatorDefaults(jobId);
    await this.recordRunScheduled(jobId, {
      mode: params.mode,
      stages: params.stages,
      inline: true,
    });
    return { queued: true, inline: true };
  }

  async listJobIssuesPaginated(jobId: string, companyId: string, page: number, limit: number) {
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) {
      throw new AppError(404, 'Migration job not found');
    }
    return this.issues.listPaginated(jobId, page, limit);
  }

  async listFieldCoveragePaginated(page: number, limit: number, gapsOnly?: boolean) {
    const { buildMachineReadableFieldReport } = await import('./migration-field-evidence.service');
    const { paginateSlice } = await import('../migration-report-pagination');
    const report = buildMachineReadableFieldReport();
    let rows = report.rows;
    if (gapsOnly) {
      rows = rows.filter(
        (r) =>
          r.preservationMode === 'MISSING_IMPLEMENTATION' || r.preservationMode === 'EVIDENCE_BLOCKED'
      );
    }
    return {
      ...paginateSlice(rows, page, limit),
      totals: report.totals,
      generatedAt: report.generatedAt,
    };
  }

  async listSchemaCoverageTablesPaginated(page: number, limit: number) {
    const { buildSchemaCoverageReport } = await import('./migration-legacy-schema-coverage.service');
    const { paginateSlice } = await import('../migration-report-pagination');
    const report = buildSchemaCoverageReport();
    return {
      ...paginateSlice(report.tables, page, limit),
      totals: report.totals,
      generatedAt: report.generatedAt,
    };
  }

  async listAccountMapping(companyId: string, jobId: string, page = 1, limit = 1000) {
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');

    const overrides = await this.prisma.legacyAccountOverride.findMany({
      where: { targetCompanyId: companyId, sourceCompanyCode: job.legacyCompanyCode },
      orderBy: { legacyAccountCode: 'asc' },
    });

    const mappingWhere = {
      migrationJobId: jobId,
      resolutionState: 'OPEN',
      OR: [{ category: 'COA_MAPPING' }, { category: 'GL_ACCOUNT_AMBIGUOUS' }],
    };
    const skip = (page - 1) * limit;
    const [openMappingIssues, mappingIssuesTotal] = await Promise.all([
      this.prisma.migrationIssue.findMany({
        where: mappingWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.migrationIssue.count({ where: mappingWhere }),
    ]);
    const mappingIssuesTotalPages = Math.max(1, Math.ceil(mappingIssuesTotal / limit));

    return {
      overrides,
      openMappingIssues,
      mappingIssuesPagination: {
        total: mappingIssuesTotal,
        page,
        limit,
        totalPages: mappingIssuesTotalPages,
      },
    };
  }

  async rollback(jobId: string, companyId: string) {
    this.assertEngineReady();
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');

    await this.jobs.requestCancellation(jobId);
    await this.jobs.forceReleaseLock(jobId);
    try {
      await new ConnectorCommandService(this.prisma).abortCommandsForJob(jobId);
    } catch {
      /* connector table may be empty */
    }
    let queueAborted = 0;
    try {
      queueAborted = await abortQueuedMigrationRuns(jobId);
    } catch {
      /* redis down — status+lock still reset */
    }

    const current = await this.jobs.getJob(jobId);
    if (current && current.status !== 'FAILED' && current.status !== 'ROLLED_BACK') {
      try {
        await this.jobs.transition(jobId, 'FAILED');
      } catch {
        await this.prisma.migrationJob.update({
          where: { id: jobId },
          data: { status: 'FAILED', failedAt: new Date(), lockToken: null, lockExpiresAt: null },
        });
      }
    }

    await this.jobs.mergeProgress(jobId, {
      cancelRequestedAt: new Date().toISOString(),
      ui: {
        lastError: 'تم إيقاف المهمة. يمكنك التحليل أو المعاينة من جديد.',
        lastFailedAt: new Date().toISOString(),
        abortedByUser: true,
      },
    });

    // Undoing a real import can take minutes: run it in the background (the HTTP request limit
    // is 30 s) and record the outcome on the job so the wizard can follow it.
    const startedAt = new Date().toISOString();
    await this.jobs.mergeProgress(jobId, { rollback: { status: 'RUNNING', startedAt } });
    void this.orchestrator
      .rollback(jobId)
      .then((result) =>
        this.jobs.mergeProgress(jobId, {
          rollback: { status: 'DONE', startedAt, finishedAt: new Date().toISOString(), result },
        })
      )
      .catch((e: unknown) =>
        this.jobs.mergeProgress(jobId, {
          rollback: {
            status: 'FAILED',
            startedAt,
            finishedAt: new Date().toISOString(),
            error: e instanceof Error ? e.message : String(e),
          },
        })
      );

    return {
      aborted: true,
      queueAborted,
      dataRollback: { status: 'RUNNING', startedAt },
      rollbackError: null,
    };
  }

  async runReconciliation(jobId: string, companyId: string) {
    this.assertEngineReady();
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');
    return this.orchestrator.runFullReconciliation(jobId);
  }

  async activateJob(
    jobId: string,
    companyId: string,
    opts: { confirmMaterialExceptions?: boolean; userId?: string }
  ) {
    this.assertEngineReady();
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');

    const progress = job.progress as Record<string, unknown> | null;
    const reconciliation = progress?.reconciliation as
      | { summary?: { materialPass?: boolean; blockingReasons?: string[] } }
      | undefined;
    if (!reconciliation?.summary?.materialPass && !opts.confirmMaterialExceptions) {
      throw new AppError(
        409,
        `Reconciliation did not pass: ${(reconciliation?.summary?.blockingReasons ?? ['unknown']).join('; ')}`
      );
    }
    const openBlockers = await this.jobs.countOpenBlockers(jobId);
    if (openBlockers > 0) {
      throw new AppError(409, `${openBlockers} open blocker(s) remain`);
    }
    const { inventoryPolicyBlocksActivation } = await import('../policies/migration-inventory-cutover-policy');
    const inventoryBlock = inventoryPolicyBlocksActivation(job.progress);
    if (inventoryBlock) {
      throw new AppError(409, inventoryBlock);
    }

    const merged = mergeLifecyclePatch(job.progress, {
      phase: 'ACTIVATED',
      reconciliationPass: reconciliation?.summary?.materialPass ?? false,
      activatedAt: new Date().toISOString(),
      activatedByUserId: opts.userId,
      notes: opts.confirmMaterialExceptions ? 'Activated with owner-confirmed material exceptions' : undefined,
    });
    await this.jobs.updateProgress(jobId, merged as import('@prisma/client').Prisma.InputJsonValue);
    await this.issues.record({
      jobId,
      severity: 'INFO',
      category: 'MIGRATION_ACTIVATED',
      description: `Migration activated for company ${companyId} by ${opts.userId ?? 'unknown'}`,
    });
    return this.jobs.getJob(jobId);
  }

  async upsertAccountOverride(
    companyId: string,
    jobId: string,
    body: {
      legacyAccountCode: string;
      targetLegacyAccountCode: string;
      reason: string;
      approvedBy: string;
      evidenceReference: string;
      decisionType?: string;
      mappingClassification?: string;
    }
  ) {
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');

    const legacyAccountCode = normalizeLegacyAccountCode(body.legacyAccountCode);
    const targetLegacyAccountCode = normalizeLegacyAccountCode(body.targetLegacyAccountCode);
    const targetAccount = await this.prisma.account.findFirst({
      where: { companyId, code: targetLegacyAccountCode, deletedAt: null },
    });
    if (!targetAccount || targetAccount.accountKind !== 'POSTING') {
      throw new AppError(400, 'Target account must exist in company COA as POSTING');
    }

    const row = await this.prisma.legacyAccountOverride.upsert({
      where: {
        targetCompanyId_sourceCompanyCode_legacyAccountCode: {
          targetCompanyId: companyId,
          sourceCompanyCode: job.legacyCompanyCode,
          legacyAccountCode,
        },
      },
      create: {
        id: randomUUID(),
        targetCompanyId: companyId,
        sourceCompanyCode: job.legacyCompanyCode,
        legacyAccountCode,
        targetLegacyAccountCode,
        targetAccountId: targetAccount.id,
        decisionType: body.decisionType ?? 'OWNER_MANUAL',
        mappingClassification: body.mappingClassification ?? 'EXPLICIT',
        reason: body.reason,
        approvedBy: body.approvedBy,
        approvedAt: new Date(),
        evidenceReference: body.evidenceReference,
      },
      update: {
        targetLegacyAccountCode,
        targetAccountId: targetAccount.id,
        reason: body.reason,
        approvedBy: body.approvedBy,
        approvedAt: new Date(),
        evidenceReference: body.evidenceReference,
      },
    });

    await this.issues.record({
      jobId,
      severity: 'INFO',
      category: 'MAPPING_OVERRIDE_UPSERT',
      sourceEntity: 'Account',
      sourceKey: legacyAccountCode,
      description: `Override ${legacyAccountCode} → ${targetLegacyAccountCode} by ${body.approvedBy}`,
    });

    return row;
  }

  async getReconciliationExport(jobId: string, companyId: string, format: 'json' | 'csv') {
    const detail = await this.getJobDetail(jobId, companyId);
    const reconciliation = detail.reconciliation;
    if (!reconciliation) throw new AppError(404, 'No reconciliation report — run execute or POST reconcile first');
    if (format === 'csv') {
      return {
        contentType: 'text/csv',
        body: reconciliationBundleToCsv(reconciliation as Parameters<typeof reconciliationBundleToCsv>[0]),
      };
    }
    return { contentType: 'application/json', body: JSON.stringify(reconciliation, null, 2) };
  }

  async assessPackageRestore(companyId: string, packageId: string) {
    const pkg = await getPackage(companyId, packageId);
    if (!pkg) throw new AppError(404, 'Package not found');
    return assessBakRestore(pkg);
  }

  async restorePackage(companyId: string, packageId: string) {
    this.assertEngineReady();
    const pkg = await getPackage(companyId, packageId);
    if (!pkg) throw new AppError(404, 'Package not found');
    return runBakRestore(pkg);
  }

  async pauseJob(jobId: string, companyId: string) {
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');
    if (job.status !== 'RUNNING' && job.status !== 'DRY_RUNNING' && job.status !== 'ANALYZING') {
      throw new AppError(409, `Cannot pause job in status ${job.status}`);
    }
    await this.jobs.mergeProgress(jobId, { pauseRequestedAt: new Date().toISOString() });
    return this.jobs.transition(jobId, 'PAUSED');
  }

  async resumeJob(
    jobId: string,
    companyId: string,
    opts?: { mode?: MigrationRunMode; stages?: string[] }
  ) {
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');
    if (job.status !== 'PAUSED') throw new AppError(409, `Cannot resume job in status ${job.status}`);

    const progress =
      job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
        ? (job.progress as Record<string, unknown>)
        : {};
    const ui = (progress.ui as Record<string, unknown> | undefined) ?? {};
    const mode =
      opts?.mode ??
      (ui.pipelineMode as MigrationRunMode | undefined) ??
      (job.dryRun ? 'dry-run' : 'execute');
    const stages = opts?.stages ?? (ui.pipelineStages as string[] | undefined);

    const updated = await this.jobs.transition(jobId, 'RUNNING', {
      dryRun: job.dryRun,
      currentStage: job.currentStage ?? undefined,
    });
    await this.enqueueRun(jobId, companyId, {
      mode,
      stages,
      confirmTargetWrite: runModeRequiresTargetWriteConfirm(mode),
    });
    return updated;
  }

  async cancelJob(jobId: string, companyId: string) {
    const job = await this.jobs.getJob(jobId);
    if (!job || job.targetCompanyId !== companyId) throw new AppError(404, 'Migration job not found');
    if (!['RUNNING', 'DRY_RUNNING', 'PAUSED', 'ANALYZING', 'RECONCILING'].includes(job.status)) {
      throw new AppError(409, `Cannot cancel job in status ${job.status}`);
    }
    await this.jobs.requestCancellation(jobId);
    if (job.status === 'PAUSED') {
      return this.jobs.transition(jobId, 'FAILED');
    }
    return this.jobs.getJob(jobId);
  }
}

export const migrationApiService = (() => {
  // lazy singleton set from routes
  let instance: MigrationApiService | null = null;
  return {
    init(prisma: PrismaClient) {
      instance = new MigrationApiService(prisma);
      return instance;
    },
    get(): MigrationApiService {
      if (!instance) throw new Error('MigrationApiService not initialized');
      return instance;
    },
  };
})();
