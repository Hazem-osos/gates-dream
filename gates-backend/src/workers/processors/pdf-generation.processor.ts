import { Worker, type Job } from 'bullmq';
import prisma from '../../shared/database/prisma';
import { logger } from '../../shared/logger';
import { workerConsumerConnection } from '../redis-connection';
import { ASYNC_QUEUE_NAMES } from '../queue-manager';
import type { PdfGenerationJobData } from '../jobs/async-job.types';
import { storeJobArtifact } from '../lib/job-artifacts';
import { notifyJobComplete } from '../lib/job-notify';
import { renderDocumentPdf } from '../lib/document-pdf';
import { processReportJob } from './reports.processor';
import type { ReportJobData } from '../queues/reports.queue';

async function renderInvoicePdf(
  companyId: string,
  invoiceId: string,
  kind: 'invoice' | 'receipt' = 'invoice'
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      company: { select: { arabicName: true, englishName: true, taxNumber1: true, address: true } },
      customer: { select: { arabicName: true, englishName: true } },
      supplier: { select: { arabicName: true, englishName: true } },
      lines: {
        orderBy: { lineOrder: 'asc' },
        include: {
          item: { select: { arabicName: true, englishName: true, serial: true } },
        },
      },
    },
  });
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  const party = invoice.customer ?? invoice.supplier;
  const buffer = await renderDocumentPdf({
    kind,
    companyName: invoice.company.arabicName || invoice.company.englishName || 'Company',
    companyTax: invoice.company.taxNumber1,
    companyAddress: invoice.company.address,
    documentNumber: invoice.invoiceNumber ?? invoice.id.slice(0, 8),
    date: invoice.date,
    partyLabel: invoice.customerId ? 'Customer' : 'Supplier',
    partyName: party?.arabicName || party?.englishName || '—',
    currencyCode: invoice.currencyCode,
    lines: invoice.lines.map((line) => ({
      name: line.item.arabicName || line.item.englishName || line.item.serial || line.itemId,
      quantity: line.quantity,
      price: line.price,
      total: line.total,
    })),
    subtotal: invoice.totalAmount,
    discount: invoice.discountAmount,
    tax: invoice.taxAmount,
    net: invoice.netAmount,
  });

  return {
    buffer,
    fileName: `${kind}-${invoice.invoiceNumber ?? invoice.id}.pdf`,
  };
}

async function renderReceiptPdf(companyId: string, posOrderId: string) {
  const order = await prisma.posOrder.findFirst({
    where: { id: posOrderId, companyId },
    include: {
      customer: { select: { arabicName: true, englishName: true } },
      lines: {
        orderBy: { lineOrder: 'asc' },
        include: { item: { select: { arabicName: true, englishName: true, serial: true } } },
      },
    },
  });
  if (!order) throw new Error(`POS order ${posOrderId} not found`);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { arabicName: true, englishName: true, taxNumber1: true, address: true },
  });

  const buffer = await renderDocumentPdf({
    kind: 'receipt',
    companyName: company?.arabicName || company?.englishName || 'Company',
    companyTax: company?.taxNumber1,
    companyAddress: company?.address,
    documentNumber: order.orderNumber,
    date: order.createdAt,
    partyLabel: 'Customer',
    partyName: order.customer?.arabicName || order.customer?.englishName || 'Walk-in',
    currencyCode: order.currencyCode,
    lines: order.lines.map((line) => ({
      name: line.item.arabicName || line.item.englishName || line.item.serial || line.itemId,
      quantity: line.quantity,
      price: line.price,
      total: line.lineTotal,
    })),
    subtotal: order.totalAmount,
    discount: order.discountAmount,
    tax: order.taxAmount,
    net: order.netAmount,
  });

  return { buffer, fileName: `receipt-${order.orderNumber}.pdf` };
}

export async function processPdfGenerationJob(job: Job<PdfGenerationJobData>) {
  const { companyId, userId, kind } = job.data;
  await job.updateProgress(15);

  if (kind === 'report') {
    const reportResult = await processReportJob({
      ...job,
      data: {
        companyId,
        userId,
        reportType: 'pdf',
        reportName: job.data.reportName ?? 'report',
        filters: job.data.filters ?? {},
        email: job.data.email,
      },
    } as Job<ReportJobData>);
    if (userId) {
      await notifyJobComplete({
        companyId,
        userId,
        title: 'PDF report ready',
        message: `${job.data.reportName ?? 'Report'} PDF is ready to download.`,
        linkUrl: reportResult.downloadUrl,
        category: 'PDF',
      });
    }
    return reportResult;
  }

  const rendered = job.data.posOrderId
    ? await renderReceiptPdf(companyId, job.data.posOrderId)
    : await renderInvoicePdf(companyId, job.data.invoiceId ?? '', kind === 'receipt' ? 'receipt' : 'invoice');

  await job.updateProgress(70);
  const artifact = await storeJobArtifact({
    companyId,
    jobId: String(job.id),
    fileName: rendered.fileName,
    mimeType: 'application/pdf',
    buffer: rendered.buffer,
  });
  await job.updateProgress(100);

  await notifyJobComplete({
    companyId,
    userId,
    title: kind === 'receipt' ? 'Receipt PDF ready' : 'Invoice PDF ready',
    message: `${artifact.fileName} is ready to download.`,
    linkUrl: artifact.downloadUrl,
    category: 'PDF',
  });

  return artifact;
}

export function createPdfGenerationWorker(): Worker<PdfGenerationJobData> {
  const worker = new Worker<PdfGenerationJobData>(
    ASYNC_QUEUE_NAMES.PDF_GENERATION,
    async (job) => processPdfGenerationJob(job),
    { connection: workerConsumerConnection, concurrency: 2 }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'pdf-generation job failed');
  });
  return worker;
}
