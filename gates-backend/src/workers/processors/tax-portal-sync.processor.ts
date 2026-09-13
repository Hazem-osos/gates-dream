import { Worker, type Job } from 'bullmq';
import { logger } from '../../shared/logger';
import { workerConsumerConnection } from '../redis-connection';
import { ASYNC_QUEUE_NAMES, enqueueJob } from '../queue-manager';
import type { TaxPortalSyncJobData } from '../jobs/async-job.types';
import { storeJobArtifact } from '../lib/job-artifacts';
import { notifyJobComplete } from '../lib/job-notify';
import { eInvoiceSubmissionService } from '../../modules/electronic-invoices/services/e-invoice-submission.service';
import { etaInvoiceService } from '../../modules/electronic-invoices/services/eta-invoice.service';
import { taxForm41ExportService } from '../../modules/subcontracts/services/tax-form-41-export.service';

export async function processTaxPortalSyncJob(job: Job<TaxPortalSyncJobData>) {
  const { companyId, userId, kind } = job.data;
  await job.updateProgress(10);

  switch (kind) {
    case 'eta-submit-invoice': {
      if (!job.data.invoiceId) throw new Error('invoiceId is required');
      const doc = await eInvoiceSubmissionService.submitM5Invoice(companyId, job.data.invoiceId);
      if (doc.documentUuid) {
        await enqueueJob(
          ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC,
          'eta-poll-status',
          {
            companyId,
            userId,
            kind: 'eta-poll-status' as const,
            documentUuid: doc.documentUuid,
          },
          { delay: 15_000 }
        );
      }
      await job.updateProgress(100);
      return { success: true, companyId, kind, document: doc };
    }
    case 'eta-submit-receipt': {
      if (!job.data.posOrderId) throw new Error('posOrderId is required');
      const doc = await eInvoiceSubmissionService.submitPosReceipt(companyId, job.data.posOrderId);
      await job.updateProgress(100);
      return { success: true, companyId, kind, document: doc };
    }
    case 'eta-submit-batch': {
      const invoiceIds = job.data.invoiceIds ?? [];
      const results: Array<{ invoiceId: string; ok: boolean; error?: string }> = [];
      for (const invoiceId of invoiceIds) {
        try {
          const readiness = await etaInvoiceService.validateReadiness(companyId, invoiceId);
          if (!readiness.ready) {
            results.push({
              invoiceId,
              ok: false,
              error: readiness.issues.map((i) => i.message).join('; '),
            });
            continue;
          }
          await eInvoiceSubmissionService.submitM5Invoice(companyId, invoiceId);
          results.push({ invoiceId, ok: true });
        } catch (error) {
          results.push({
            invoiceId,
            ok: false,
            error: error instanceof Error ? error.message : 'Submit failed',
          });
        }
      }
      await notifyJobComplete({
        companyId,
        userId,
        title: 'ETA batch submit finished',
        message: `${results.filter((r) => r.ok).length}/${results.length} invoices submitted.`,
        linkUrl: '/electronic-invoices',
        category: 'ETA',
      });
      await job.updateProgress(100);
      return { success: true, companyId, kind, results };
    }
    case 'eta-poll-status': {
      if (!job.data.documentUuid) throw new Error('documentUuid is required');
      const doc = await eInvoiceSubmissionService.getStatus(companyId, job.data.documentUuid);
      await job.updateProgress(100);
      return { success: true, companyId, kind, document: doc };
    }
    case 'form41-export': {
      if (!job.data.year || !job.data.quarter) throw new Error('year and quarter are required');
      const file = await taxForm41ExportService.exportQuarterlyForm41(companyId, {
        year: job.data.year,
        quarter: job.data.quarter,
        format: job.data.format ?? 'EXCEL',
      });
      const artifact = await storeJobArtifact({
        companyId,
        jobId: String(job.id),
        fileName: file.filename,
        mimeType: file.contentType,
        buffer: Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer),
      });
      await notifyJobComplete({
        companyId,
        userId,
        title: 'Form 41 export ready',
        message: `${artifact.fileName} is ready to download.`,
        linkUrl: artifact.downloadUrl,
        category: 'FORM41',
      });
      await job.updateProgress(100);
      return artifact;
    }
    default:
      throw new Error(`Unknown tax-portal-sync kind: ${String(kind)}`);
  }
}

export function createTaxPortalSyncWorker(): Worker<TaxPortalSyncJobData> {
  const worker = new Worker<TaxPortalSyncJobData>(
    ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC,
    async (job) => processTaxPortalSyncJob(job),
    { connection: workerConsumerConnection, concurrency: 2 }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'tax-portal-sync job failed');
  });
  return worker;
}
