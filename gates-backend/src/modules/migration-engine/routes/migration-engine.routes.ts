import { Router, type Response } from 'express';
import fsp from 'node:fs/promises';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import type { AuthRequest } from '../../../shared/auth/types';
import { assertOwnerOnly } from '../../company/services/tenant-backup.service';
import { AppError } from '../../../shared/middleware/error-handler';
import prisma from '../../../shared/database/prisma';
import { migrationApiService } from '../services/migration-api.service';
import {
  activateMigrationJobSchema,
  patchMigrationJobSettingsSchema,
  createMigrationJobSchema,
  migrationJobIdParamSchema,
  migrationReportPageQuerySchema,
  packageIdParamSchema,
  runMigrationJobSchema,
  runModeRequiresTargetWriteConfirm,
  upsertAccountOverrideSchema,
  initChunkUploadSchema,
  completeChunkUploadSchema,
  remoteSqlSourceSchema,
  connectorBindSchema,
} from '../schemas/migration-engine.schema';
import { LegacySourceConfigService } from '../legacy-source/legacy-source-config.service';
import { MigrationConnectorPairingService } from '../legacy-source/migration-connector-pairing.service';
import { ConnectorCommandService, decodeConnectorCompleteBody } from '../legacy-source/connector-command.service';
import { MigrationBakRestoreOrchestrationService } from '../services/migration-bak-restore-orchestration.service';
import {
  appendUploadChunk,
  completeChunkedUpload,
  initChunkedUpload,
} from '../services/migration-chunked-upload.service';
import { migrationPackageUpload } from '../middleware/migration-upload.middleware';
import {
  finalizeUploadedPackage,
  listPackages,
} from '../services/migration-package.storage';
import { logger } from '../../../shared/logger';
import { runMigrationRunInline } from '../../../workers/processors/migration-run.processor';
import { MigrationTargetSafetyError } from '../target-safety';
import {
  isUuid,
  requireNonEmptyConnectorToken,
  secretsEqual,
} from '../migration-service-auth';
import { assertBackupPathUnderRoot } from '../migration-sql-safety';
import {
  connectorPairCodeLimiter,
  connectorPairCompanyLimiter,
  connectorPairIpLimiter,
  logConnectorPairFailure,
} from '../migration-connector-rate-limit.middleware';

const router = Router();

migrationApiService.init(prisma);

/** Connector + restore fetch — no JWT; scoped by device token or restore secret. */
router.post('/connector/v1/poll', async (req, res: Response) => {
  try {
    const token = requireNonEmptyConnectorToken(String(req.headers['x-connector-token'] ?? ''));
    const pairing = new MigrationConnectorPairingService(prisma);
    const device = await pairing.authenticateDevice(token);
    await pairing.heartbeat(device.id, device.companyId);
    const commands = new ConnectorCommandService(prisma);
    const pending = await commands.claimPending(device.companyId, device.id);
    return void res.json({
      status: 'success',
      data: pending.map((c) => ({
        id: c.id,
        operation: c.operation,
        payload: c.payloadJson,
      })),
    });
  } catch (e) {
    return void res.status(401).json({ status: 'error', message: e instanceof Error ? e.message : 'Unauthorized' });
  }
});

router.post('/connector/v1/complete', async (req, res: Response) => {
  try {
    const token = requireNonEmptyConnectorToken(String(req.headers['x-connector-token'] ?? ''));
    const pairing = new MigrationConnectorPairingService(prisma);
    const device = await pairing.authenticateDevice(token);
    const body = (req.body ?? {}) as Record<string, unknown>;
    // Agents >= 0.2.4 send gzip+hex so row data survives the global input filter untouched;
    // older agents send plain JSON.
    const decoded = decodeConnectorCompleteBody(body);
    const commands = new ConnectorCommandService(prisma);
    const done = await commands.complete({
      commandId: String(body.commandId),
      companyId: device.companyId,
      deviceId: device.id,
      ok: Boolean(body.ok),
      result: decoded.result,
      errorMessage: decoded.errorMessage,
    });
    if (!done) return void res.status(404).json({ status: 'error', message: 'Command not found' });
    return void res.json({ status: 'success', data: { ok: true } });
  } catch (e) {
    return void res.status(401).json({ status: 'error', message: e instanceof Error ? e.message : 'Unauthorized' });
  }
});

router.post(
  '/connector/v1/pair',
  connectorPairIpLimiter,
  connectorPairCompanyLimiter,
  connectorPairCodeLimiter,
  async (req, res: Response) => {
    try {
      const { companyId: cid, pairingCode, label, connectorVersion } = req.body ?? {};
      if (!pairingCode || !label) {
        return void res.status(400).json({ status: 'error', message: 'pairingCode and label are required' });
      }
      if (cid && !isUuid(String(cid))) {
        return void res.status(400).json({ status: 'error', message: 'Invalid companyId' });
      }
      const pairing = new MigrationConnectorPairingService(prisma);
      const paired = cid
        ? await pairing.pairDevice({
            companyId: String(cid),
            pairingCode: String(pairingCode),
            label: String(label),
            connectorVersion: connectorVersion ? String(connectorVersion) : undefined,
          })
        : await pairing.pairDeviceByCode({
            pairingCode: String(pairingCode),
            label: String(label),
            connectorVersion: connectorVersion ? String(connectorVersion) : undefined,
          });
      await new LegacySourceConfigService(prisma).bindConnectorDevice(paired.companyId, paired.deviceId);
      return void res.json({
        status: 'success',
        data: { deviceId: paired.deviceId, connectorToken: paired.connectorToken },
      });
    } catch (e) {
      const companyId = String(req.body?.companyId ?? '');
      logConnectorPairFailure(req, companyId, e instanceof Error ? e.name : 'pair_failed');
      const message =
        e instanceof MigrationTargetSafetyError
          ? 'Invalid or expired pairing code'
          : 'Pairing failed';
      return void res.status(400).json({ status: 'error', message });
    }
  }
);

router.get('/internal/packages/:companyId/:packageId/bak', async (req, res: Response) => {
  try {
    const expected = process.env.MIGRATION_RESTORE_FETCH_TOKEN?.trim();
    const token = String(req.headers['x-migration-restore-token'] ?? '');
    if (!expected || !secretsEqual(token, expected)) {
      logger.warn(
        {
          event: 'migration_bak_fetch_denied',
          companyId: req.params.companyId,
          packageId: req.params.packageId,
          ip: req.ip,
        },
        'Internal backup fetch unauthorized'
      );
      return void res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    if (!isUuid(req.params.companyId) || !isUuid(req.params.packageId)) {
      return void res.status(400).json({ status: 'error', message: 'Invalid id' });
    }
    const { getPackage } = await import('../services/migration-package.storage');
    const pkg = await getPackage(req.params.companyId, req.params.packageId);
    if (!pkg) return void res.status(404).json({ status: 'error', message: 'Not found' });
    if (!pkg.originalName.toLowerCase().endsWith('.bak')) {
      return void res.status(400).json({ status: 'error', message: 'Not a .bak package' });
    }
    const packagesRoot =
      process.env.MIGRATION_PACKAGES_DIR?.trim() ||
      (await import('node:path')).join(process.cwd(), 'var', 'migration-packages');
    const safePath = assertBackupPathUnderRoot(pkg.storedPath, packagesRoot);
    const { parseByteRange } = await import('../services/migration-bak-transport');
    const { createReadStream, statSync } = await import('node:fs');
    const size = statSync(safePath).size;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${pkg.id}.bak"`);
    const requested = req.headers.range;
    const range = parseByteRange(typeof requested === 'string' ? requested : undefined, size);
    if (requested && !range) {
      res.setHeader('Content-Range', `bytes */${size}`);
      return void res.status(416).end();
    }
    logger.info(
      {
        event: 'migration_bak_fetch_ok',
        companyId: req.params.companyId,
        packageId: req.params.packageId,
        bytes: pkg.sizeBytes,
        range: range ? `${range.start}-${range.end}` : 'full',
      },
      'Internal backup fetch started'
    );
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
      createReadStream(safePath, { start: range.start, end: range.end }).pipe(res);
      return;
    }
    res.setHeader('Content-Length', String(size));
    createReadStream(safePath).pipe(res);
  } catch (e) {
    return void res.status(500).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
  }
});

router.use(authenticate);
router.use(setTenantContext);

function companyId(req: AuthRequest): string {
  const id = req.companyId || req.tenantId;
  if (!id) throw new AppError(400, 'معرّف الشركة مطلوب');
  return id;
}

router.get(
  '/capabilities',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const data = await migrationApiService.get().capabilities(companyId(req), req.user?.sub);
    return void res.json({ status: 'success', data });
  }
);

router.get(
  '/agent/release',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (_req: AuthRequest, res: Response) => {
    const { getAgentReleaseInfo } = await import('../services/migration-agent-release.service');
    return void res.json({ status: 'success', data: getAgentReleaseInfo() });
  }
);

router.get(
  '/agent/download',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const { openAgentReleaseDownload } = await import('../services/migration-agent-release.service');
      const file = await openAgentReleaseDownload();
      res.setHeader('Content-Type', 'application/vnd.microsoft.portable-executable');
      res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
      res.setHeader('Content-Length', String(file.sizeBytes));
      res.setHeader('X-Agent-SHA256', file.sha256);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      file.stream.pipe(res);
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      if (!res.headersSent) {
        return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
      }
    }
  }
);

router.get(
  '/coverage/schema',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (_req, res: Response) => {
    try {
      const { buildSchemaCoverageReport } = await import('../services/migration-legacy-schema-coverage.service');
      return void res.json({ status: 'success', data: buildSchemaCoverageReport() });
    } catch (e) {
      return void res.status(500).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Schema coverage unavailable',
      });
    }
  }
);

router.get(
  '/coverage/fields',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ query: migrationReportPageQuerySchema }),
  async (req, res: Response) => {
    try {
      const q = migrationReportPageQuerySchema.parse(req.query);
      const data = await migrationApiService
        .get()
        .listFieldCoveragePaginated(q.page, q.limit, q.gapsOnly);
      return void res.json({ status: 'success', data });
    } catch (e) {
      return void res.status(500).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Field coverage unavailable',
      });
    }
  }
);

router.get(
  '/coverage/schema/tables',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ query: migrationReportPageQuerySchema }),
  async (req, res: Response) => {
    try {
      const q = migrationReportPageQuerySchema.parse(req.query);
      const data = await migrationApiService.get().listSchemaCoverageTablesPaginated(q.page, q.limit);
      return void res.json({ status: 'success', data });
    } catch (e) {
      return void res.status(500).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Schema coverage unavailable',
      });
    }
  }
);

router.get(
  '/jobs',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const jobs = await migrationApiService.get().listJobs(companyId(req));
      return void res.json({ status: 'success', data: jobs });
    } catch (e) {
      logger.error({ e }, 'migration list jobs');
      return void res.status(500).json({ status: 'error', message: String(e) });
    }
  }
);

router.post(
  '/jobs',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: createMigrationJobSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const job = await migrationApiService.get().createJob(companyId(req), req.body);
      return void res.status(201).json({ status: 'success', data: job });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to create migration job',
      });
    }
  }
);

router.get(
  '/jobs/:id',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ params: migrationJobIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const detail = await migrationApiService.get().getJobDetail(req.params.id, companyId(req));
      return void res.json({ status: 'success', data: detail });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to load job',
      });
    }
  }
);

router.get(
  '/jobs/:id/issues',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ params: migrationJobIdParamSchema, query: migrationReportPageQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const q = migrationReportPageQuerySchema.parse(req.query);
      const data = await migrationApiService
        .get()
        .listJobIssuesPaginated(req.params.id, companyId(req), q.page, q.limit);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.get(
  '/jobs/:id/coverage',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ params: migrationJobIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await migrationApiService.get().getCoreCoverage(req.params.id, companyId(req));
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.get(
  '/jobs/:id/progress',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ params: migrationJobIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const progress = await migrationApiService.get().getProgressSnapshot(req.params.id, companyId(req));
      return void res.json({ status: 'success', data: progress });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.get(
  '/jobs/:id/events',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ params: migrationJobIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const jobId = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const send = async () => {
      if (closed) return;
      try {
        const progress = await migrationApiService.get().getProgressSnapshot(jobId, cid);
        res.write(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`);
      } catch (e) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ message: e instanceof Error ? e.message : String(e) })}\n\n`
        );
      }
    };

    await send();
    const timer = setInterval(() => void send(), 2000);

    req.on('close', () => clearInterval(timer));
  }
);

router.get(
  '/jobs/:id/mapping/accounts',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ params: migrationJobIdParamSchema, query: migrationReportPageQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const q = migrationReportPageQuerySchema.parse(req.query);
      const data = await migrationApiService
        .get()
        .listAccountMapping(companyId(req), req.params.id, q.page, q.limit);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/jobs/:id/run',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: migrationJobIdParamSchema, body: runMigrationJobSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      if (runModeRequiresTargetWriteConfirm(req.body.mode) && !req.body.confirmTargetWrite) {
        throw new AppError(400, 'تأكيد الكتابة على الشركة الهدف مطلوب (confirmTargetWrite=true)');
      }
      const useInline =
        process.env.MIGRATION_RUN_INLINE === 'true' ||
        process.env.REDIS_ENABLED === 'false' ||
        process.env.REDIS_URL == null;
      if (useInline) {
        await migrationApiService.get().scheduleInlineRun(req.params.id, companyId(req), {
          ...req.body,
          userId: req.user?.sub,
        });
        void runMigrationRunInline({
          companyId: companyId(req),
          migrationJobId: req.params.id,
          mode: req.body.mode,
          stages: req.body.stages,
        }).catch((err) => logger.error({ err }, 'inline migration failed'));
        return void res.status(202).json({ status: 'success', data: { queued: true, inline: true } });
      }
      const data = await migrationApiService.get().enqueueRun(req.params.id, companyId(req), {
        ...req.body,
        userId: req.user?.sub,
      });
      return void res.status(202).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/jobs/:id/mapping/accounts',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: migrationJobIdParamSchema, body: upsertAccountOverrideSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const data = await migrationApiService
        .get()
        .upsertAccountOverride(companyId(req), req.params.id, req.body);
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.patch(
  '/jobs/:id/settings',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: migrationJobIdParamSchema, body: patchMigrationJobSettingsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const data = await migrationApiService.get().patchJobSettings(req.params.id, companyId(req), req.body);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/jobs/:id/activate',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: migrationJobIdParamSchema, body: activateMigrationJobSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const data = await migrationApiService.get().activateJob(req.params.id, companyId(req), {
        confirmMaterialExceptions: req.body.confirmMaterialExceptions,
        userId: req.user?.sub,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.get(
  '/jobs/:id/reports/reconciliation',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ params: migrationJobIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const format = req.query.format === 'csv' ? 'csv' : 'json';
      const report = await migrationApiService
        .get()
        .getReconciliationExport(req.params.id, companyId(req), format);
      res.setHeader('Content-Type', report.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="migration-reconciliation-${req.params.id}.${format}"`
      );
      return void res.send(report.body);
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/jobs/:id/rollback',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: migrationJobIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const data = await migrationApiService.get().rollback(req.params.id, companyId(req));
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.get(
  '/packages',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const packages = await listPackages(companyId(req));
    return void res.json({
      status: 'success',
      data: packages.map((p) => ({
        id: p.id,
        originalName: p.originalName,
        sizeBytes: p.sizeBytes,
        sha256: p.sha256,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
      })),
    });
  }
);

router.get(
  '/packages/:packageId/restore-assessment',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ params: packageIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const assessment = await migrationApiService
        .get()
        .assessPackageRestore(companyId(req), req.params.packageId);
      const data = {
        ...assessment,
        ready: assessment.status === 'READY_TO_RUN',
        steps: assessment.requirements,
      };
      return void res.json({ status: 'success', data });
    } catch (e) {
      if (e instanceof MigrationTargetSafetyError) {
        return void res.status(410).json({ status: 'error', message: e.message });
      }
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/packages/:packageId/restore',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: packageIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const data = await migrationApiService.get().restorePackage(companyId(req), req.params.packageId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/jobs/:id/pause',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: migrationJobIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const job = await migrationApiService.get().pauseJob(req.params.id, companyId(req));
      return void res.json({ status: 'success', data: job });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/jobs/:id/resume',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: migrationJobIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const job = await migrationApiService.get().resumeJob(req.params.id, companyId(req));
      return void res.json({ status: 'success', data: job });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/jobs/:id/cancel',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: migrationJobIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const job = await migrationApiService.get().cancelJob(req.params.id, companyId(req));
      return void res.json({ status: 'success', data: job });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/packages/upload/init',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: initChunkUploadSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const data = await initChunkedUpload({
        companyId: companyId(req),
        originalName: req.body.originalName,
        totalChunks: req.body.totalChunks,
      });
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      return void res.status(400).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/packages/upload/chunk',
  authorize({ resource: 'database-tool', action: 'edit' }),
  migrationPackageUpload,
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const uploadId = String(req.body.uploadId ?? '');
      const index = Number(req.body.index);
      if (!uploadId || !Number.isFinite(index)) {
        return void res.status(400).json({ status: 'error', message: 'uploadId and index required' });
      }
      const file = req.file!;
      const data = await appendUploadChunk({
        companyId: companyId(req),
        uploadId,
        index,
        data: await fsp.readFile(file.path),
      });
      await fsp.unlink(file.path).catch(() => undefined);
      return void res.json({ status: 'success', data });
    } catch (e) {
      return void res.status(400).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/packages/upload/complete',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: completeChunkUploadSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const stored = await completeChunkedUpload({
        companyId: companyId(req),
        uploadId: req.body.uploadId,
      });
      return void res.status(201).json({
        status: 'success',
        data: {
          id: stored.id,
          originalName: stored.originalName,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          createdAt: stored.createdAt,
          expiresAt: stored.expiresAt,
        },
      });
    } catch (e) {
      return void res.status(400).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/packages/upload',
  authorize({ resource: 'database-tool', action: 'edit' }),
  (req: AuthRequest, res: Response, next) => {
    try {
      assertOwnerOnly(req);
      next();
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 403;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Forbidden' });
    }
  },
  migrationPackageUpload,
  async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file!;
      const stored = await finalizeUploadedPackage({
        companyId: companyId(req),
        tempPath: file.path,
        originalName: file.originalname,
      });
      return void res.status(201).json({
        status: 'success',
        data: {
          id: stored.id,
          originalName: stored.originalName,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          createdAt: stored.createdAt,
          expiresAt: stored.expiresAt,
        },
      });
    } catch (e) {
      logger.error({ e }, 'migration package upload');
      return void res.status(400).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Upload failed',
      });
    }
  }
);

router.get(
  '/source/remote',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const svc = new LegacySourceConfigService(prisma);
      const data = await svc.getForCompany(companyId(req), 'REMOTE_SQL_SERVER');
      return void res.json({ status: 'success', data });
    } catch (e) {
      return respondMigrationLegacySourceError(res, e);
    }
  }
);

function respondMigrationLegacySourceError(res: Response, e: unknown) {
  if (e instanceof AppError) {
    return void res.status(e.statusCode).json({ status: 'error', message: e.message });
  }
  if (e instanceof MigrationTargetSafetyError) {
    return void res.status(400).json({ status: 'error', message: e.message });
  }
  const message = e instanceof Error ? e.message : 'Failed';
  if (/decryption failed/i.test(message)) {
    return void res.status(409).json({
      status: 'error',
      message:
        'اتصال SQL المحفوظ مشفّر بمفتاح ENCRYPTION_KEY مختلف عن هذا الخادم — أعد إدخال البيانات واضغط «حفظ الاتصال» ثم «اختبار الاتصال».',
    });
  }
  if (/encryption failed/i.test(message)) {
    return void res.status(500).json({
      status: 'error',
      message: 'تعذّر تشفير إعدادات الاتصال — راجع ENCRYPTION_KEY في gates-backend/.env',
    });
  }
  return void res.status(500).json({ status: 'error', message });
}

router.put(
  '/source/remote',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: remoteSqlSourceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const svc = new LegacySourceConfigService(prisma);
      const data = await svc.upsertRemote(companyId(req), req.body, req.user?.sub);
      return void res.json({ status: 'success', data });
    } catch (e) {
      return respondMigrationLegacySourceError(res, e);
    }
  }
);

router.post(
  '/source/remote/test',
  authorize({ resource: 'database-tool', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const legacyCompanyCode = String(req.body?.legacyCompanyCode ?? '0001');
      const svc = new LegacySourceConfigService(prisma);
      const data = await svc.testRemoteConnection(companyId(req), legacyCompanyCode, req.user?.sub);
      return void res.json({ status: 'success', data });
    } catch (e) {
      return respondMigrationLegacySourceError(res, e);
    }
  }
);

router.post(
  '/source/connector/pairing-code',
  authorize({ resource: 'database-tool', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const svc = new MigrationConnectorPairingService(prisma);
      const data = await svc.createPairingCode(companyId(req), req.user?.sub);
      return void res.json({ status: 'success', data });
    } catch (e) {
      return void res.status(400).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/source/connector/bind',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: connectorBindSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const configSvc = new LegacySourceConfigService(prisma);
      const data = await configSvc.bindConnectorDevice(companyId(req), req.body.deviceId, req.user?.sub);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof MigrationTargetSafetyError ? 400 : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/source/connector/revoke',
  authorize({ resource: 'database-tool', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const deviceId = String(req.body?.deviceId ?? '');
      if (!deviceId) {
        return void res.status(400).json({ status: 'error', message: 'deviceId required' });
      }
      const pairing = new MigrationConnectorPairingService(prisma);
      await pairing.revoke(deviceId, companyId(req), req.user?.sub);
      return void res.json({ status: 'success', data: { revoked: true } });
    } catch (e) {
      return void res.status(400).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.post(
  '/packages/:packageId/restore-run',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ params: packageIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const svc = new MigrationBakRestoreOrchestrationService(prisma);
      const data = await svc.startRestore(companyId(req), req.params.packageId, req.body?.migrationJobId);
      return void res.status(202).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

router.get(
  '/restore-runs/:restoreRunId',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const svc = new MigrationBakRestoreOrchestrationService(prisma);
      const data = await svc.getRun(companyId(req), req.params.restoreRunId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 404;
      return void res.status(status).json({ status: 'error', message: e instanceof Error ? e.message : 'Failed' });
    }
  }
);

export default router;
