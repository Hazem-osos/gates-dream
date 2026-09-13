import { getAsyncQueue, ASYNC_QUEUE_NAMES } from '../queue-manager';
import type {
  PdfGenerationJobData,
  ReportExportJobData,
  TaxPortalSyncJobData,
} from '../jobs/async-job.types';

export const pdfGenerationQueue = getAsyncQueue<PdfGenerationJobData>(
  ASYNC_QUEUE_NAMES.PDF_GENERATION
);
export const taxPortalSyncQueue = getAsyncQueue<TaxPortalSyncJobData>(
  ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC
);
export const reportExportQueue = getAsyncQueue<ReportExportJobData>(
  ASYNC_QUEUE_NAMES.REPORT_EXPORT
);
