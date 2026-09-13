import { Worker, type Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import PDFDocument from 'pdfkit';
import prisma from '../../../shared/database/prisma';
import { env } from '../../../shared/config/env';
import { logger } from '../../../shared/logger';
import { workerRedisConnection } from '../../../workers/redis-connection';
import { AUTOMATION_SYSTEM_ACTOR_ID } from '../constants';
import { emitAutomationEvent } from '../events/notification-bus';
import { AUTOMATION_JOB_NAMES, AUTOMATION_QUEUE_NAMES } from '../types/automation-jobs.types';
import type { SubcontractInvoiceWorkflowJobData } from '../types/automation-jobs.types';

const mkdir = promisify(fs.mkdir);

const NEXT_ROLE: Record<SubcontractInvoiceWorkflowJobData['toStatus'], { action: string; resource: string; title: string }> =
  {
    SITE_SUBMITTED: {
      action: 'approve',
      resource: 'extract',
      title: 'مستخلص مقاول بانتظار اعتماد الاستشاري',
    },
    CONSULTANT_APPROVED: {
      action: 'approve',
      resource: 'extract',
      title: 'مستخلص مقاول بانتظار اعتماد المكتب الفني',
    },
    TECH_OFFICE_APPROVED: {
      action: 'post',
      resource: 'extract',
      title: 'مستخلص مقاول جاهز للترحيل المالي',
    },
    FINANCE_POSTED: {
      action: 'view',
      resource: 'extract',
      title: 'تم ترحيل مستخلص مقاول',
    },
  };

async function notifyAssignedRole(
  companyId: string,
  role: { action: string; resource: string; title: string },
  invoice: { id: string; invoiceNumber: string; netPayableAmount: unknown }
) {
  const users = await prisma.user.findMany({
    where: {
      companyId,
      isActive: true,
      permissions: {
        some: {
          OR: [
            { resource: role.resource, action: role.action },
            { resource: '*', action: role.action },
            { resource: '*', action: '*' },
          ],
        },
      },
    },
    select: { id: true },
  });

  const message = `Invoice ${invoice.invoiceNumber} is now ${role.title}. Net payable: ${String(invoice.netPayableAmount)}`;

  if (users.length === 0) {
    await emitAutomationEvent({
      companyId,
      event: 'SUBCONTRACT_INVOICE_WORKFLOW',
      type: 'WF_INVOICE',
      title: role.title,
      message,
      linkUrl: `/contracting/extracts/${invoice.id}`,
      subjectType: 'SubcontractInvoice',
      subjectId: invoice.id,
    });
    return;
  }

  for (const user of users) {
    await prisma.systemNotification.create({
      data: {
        companyId,
        userId: user.id,
        title: role.title,
        message,
        type: 'WF_INVOICE',
        category: 'SUBCONTRACT_INVOICE_WORKFLOW'.slice(0, 40),
        linkUrl: `/contracting/extracts/${invoice.id}`,
        isRead: false,
      },
    });
  }
}

async function writeInvoicePdfSnapshot(input: {
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  subcontractNumber: string;
  netPayable: string;
}): Promise<string> {
  const dir = path.join(env.EXPORT_PATH, 'subcontract-invoices', input.companyId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${input.invoiceId}-${input.status}.pdf`);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(18).text('Subcontractor Invoice Snapshot');
    doc.moveDown();
    doc.fontSize(12).text(`Invoice: ${input.invoiceNumber}`);
    doc.text(`Status: ${input.status}`);
    doc.text(`Subcontract: ${input.subcontractNumber}`);
    doc.text(`Net payable: ${input.netPayable}`);
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return filePath;
}

export async function processSubcontractInvoiceWorkflowJob(job: Job<SubcontractInvoiceWorkflowJobData>) {
  const invoice = await prisma.subcontractInvoice.findFirst({
    where: { id: job.data.invoiceId, companyId: job.data.companyId },
    include: { subcontract: { select: { subcontractNumber: true } } },
  });
  if (!invoice) {
    throw new Error(`Subcontract invoice ${job.data.invoiceId} not found`);
  }

  const role = NEXT_ROLE[job.data.toStatus];
  await notifyAssignedRole(job.data.companyId, role, invoice);

  const pdfPath = await writeInvoicePdfSnapshot({
    companyId: job.data.companyId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    subcontractNumber: invoice.subcontract.subcontractNumber,
    netPayable: invoice.netPayableAmount.toString(),
  });

  await prisma.activityLog.create({
    data: {
      tenantId: job.data.companyId,
      actorId: AUTOMATION_SYSTEM_ACTOR_ID,
      kind: 'SUBCONTRACT_INVOICE_WORKFLOW',
      subjectType: 'SubcontractInvoice',
      subjectId: invoice.id,
      severity: 'info',
      reason: `${job.data.fromStatus ?? 'DRAFT'} → ${job.data.toStatus}`,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        fromStatus: job.data.fromStatus,
        toStatus: job.data.toStatus,
        netPayableAmount: invoice.netPayableAmount.toString(),
        pdfPath,
      },
    },
  });

  logger.info(
    { jobId: job.id, invoiceId: invoice.id, toStatus: job.data.toStatus, pdfPath },
    'Subcontractor invoice workflow handled'
  );

  return { invoiceId: invoice.id, toStatus: job.data.toStatus, pdfPath };
}

export function createSubcontractInvoiceWorkflowWorker(): Worker<SubcontractInvoiceWorkflowJobData> {
  const worker = new Worker<SubcontractInvoiceWorkflowJobData>(
    AUTOMATION_QUEUE_NAMES.subcontractWorkflows,
    async (job) => {
      if (job.name !== AUTOMATION_JOB_NAMES.subcontractWorkflow) return;
      return processSubcontractInvoiceWorkflowJob(job);
    },
    { connection: workerRedisConnection }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'SubcontractorInvoiceWorkflowWorker failed');
  });
  return worker;
}
