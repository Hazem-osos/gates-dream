import { Worker, Job } from 'bullmq';
import { ReportJobData } from '../queues/reports.queue';
import { logger } from '../../shared/logger';
import { workerRedisConnection } from '../redis-connection';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { reportsService } from '../../modules/accounting/services/reports.service';
import { financialReportService } from '../../modules/accounting/services/financial-report.service';
import { inventoryReportsService } from '../../modules/inventory/services/reports.service';
import { hrReportsService } from '../../modules/hr/services/reports.service';
import { startOfDayUtc, endOfDayUtc } from '../../shared/utils/report-date';
import { emailService } from '../../shared/services/email.service';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Send report via email.
 *
 * L4 fix (Item 41): this used to be a stub that only logged the attempt and
 * never actually sent mail — a user emailing themselves a report saw the job
 * succeed while nothing arrived. Now delegates to the shared `emailService`
 * (SMTP via nodemailer); if SMTP isn't configured (`SMTP_HOST` unset, the
 * default for local dev), `emailService` logs a warning and returns instead
 * of throwing, so report generation still succeeds and the file remains on
 * disk for manual retrieval.
 */
async function sendReportEmail(
  email: string,
  filePath: string,
  reportName: string
): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Report file not found: ${filePath}`);
    }

    await emailService.sendEmail({
      to: email,
      subject: `Report: ${reportName}`,
      text: `Please find attached the ${reportName} report, generated on ${new Date().toLocaleString()}.`,
      attachments: [{ filename: path.basename(filePath), path: filePath }],
    });

    if (emailService.isEmailConfigured()) {
      logger.info({ email, reportName, filePath }, 'Report email sent via SMTP');
    } else {
      logger.info(
        { email, reportName, filePath, fileSize: fs.statSync(filePath).size },
        'SMTP not configured — report file ready for manual sending'
      );
    }
  } catch (error) {
    logger.error({ error, email, reportName, filePath }, 'Error in sendReportEmail');
    throw error;
  }
}

/**
 * Reports Processor
 * Processes report generation jobs (PDF, Excel, CSV)
 */

export async function processReportJob(job: Job<ReportJobData>) {
  const { companyId, reportType, reportName, filters, userId, email } = job.data;

  logger.info(
    { jobId: job.id, companyId, reportType, reportName },
    'Processing report generation'
  );

  try {
    await job.updateProgress(10);

    const data = await queryReportData(companyId, reportName, filters);

    await job.updateProgress(40);

    const reportsDir = path.join(process.cwd(), 'reports');
    await mkdir(reportsDir, { recursive: true });

    const fileName = `${reportName}_${Date.now()}.${reportType}`;
    const filePath = path.join(reportsDir, fileName);

    await job.updateProgress(50);

    switch (reportType) {
      case 'pdf':
        await generatePDFReport(data, filePath, reportName);
        break;
      case 'excel':
        await generateExcelReport(data, filePath, reportName);
        break;
      case 'csv':
        await generateCSVReport(data, filePath, reportName);
        break;
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }

    await job.updateProgress(90);

    if (email) {
      try {
        await sendReportEmail(email, filePath, reportName);
        logger.info({ email, reportName, filePath }, 'Report email sent successfully');
      } catch (error) {
        logger.error(
          { error, email, reportName, filePath },
          'Failed to send report email'
        );
      }
    }

    await job.updateProgress(100);

    logger.info(
      { jobId: job.id, companyId, reportType, filePath },
      'Report generation completed'
    );

    return {
      success: true,
      companyId,
      reportType,
      reportName,
      fileName,
      filePath,
      downloadUrl: `/api/v1/jobs/${job.id}/file`,
      mimeType:
        reportType === 'pdf'
          ? 'application/pdf'
          : reportType === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
      userId,
    };
  } catch (error) {
    logger.error({ error, jobId: job.id }, 'Report generation failed');
    throw error;
  }
}

export const createReportsWorker = (): Worker<ReportJobData> => {
  return new Worker<ReportJobData>(
    'reports',
    async (job: Job<ReportJobData>) => processReportJob(job),
    {
      connection: workerRedisConnection,
      concurrency: 3, // Process 3 jobs concurrently
    }
  );
};

export const reportsWorker = createReportsWorker();

// Event handlers
reportsWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Report job completed');
});

reportsWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err }, 'Report job failed');
});

reportsWorker.on('error', (err) => {
  logger.error({ error: err }, 'Reports worker error');
});

/**
 * Query report data based on report name and filters
 */
async function queryReportData(
  companyId: string,
  reportName: string,
  filters: Record<string, any>
): Promise<any> {
  try {
    // Map report names to their respective service methods
    // This is a simplified mapping - can be extended based on actual report names
    const reportNameLower = reportName.toLowerCase();

    // Accounting reports
    if (reportNameLower.includes('general-ledger') || reportNameLower.includes('general ledger')) {
      return await reportsService.getGeneralLedger(
        { companyId, ...filters },
        { includeDetails: true }
      );
    }
    // H18 fix: balance-sheet/income-statement queued exports used to call the
    // legacy `reportsService` (per-account N+1 `findMany`, transaction-currency
    // `debit`/`credit`), while the live preview screen calls the M16
    // `financialReportService` (single SQL aggregate, base-currency
    // `debitBase`/`creditBase`). A user emailing themselves a PDF/Excel got
    // numbers that didn't match what they'd just looked at on screen. Both
    // now go through the same M16 service the UI uses, adapted into the
    // `{ data: [], summary: {} }` shape the PDF/Excel/CSV generators expect.
    if (reportNameLower.includes('balance-sheet') || reportNameLower.includes('balance sheet')) {
      const asOfDate = endOfDayUtc(
        filters.asOfDate ?? filters.toDate ?? filters.endDate ?? new Date(),
        'asOfDate'
      );
      const result = await financialReportService.getBalanceSheet({
        companyId,
        branchId: filters.branchId || undefined,
        fiscalYearId: filters.fiscalYearId || undefined,
        costCenterId: filters.costCenterId || undefined,
        asOfDate,
      });
      return { data: result.lines, summary: result.summary };
    }
    if (reportNameLower.includes('income-statement') || reportNameLower.includes('income statement')) {
      const startDate = startOfDayUtc(filters.startDate ?? filters.fromDate, 'startDate');
      const endDate = endOfDayUtc(filters.endDate ?? filters.toDate ?? new Date(), 'endDate');
      const result = await financialReportService.getIncomeStatement({
        companyId,
        branchId: filters.branchId || undefined,
        fiscalYearId: filters.fiscalYearId || undefined,
        costCenterId: filters.costCenterId || undefined,
        startDate,
        endDate,
      });
      return { data: result.lines, summary: result.summary };
    }
    if (reportNameLower.includes('review-balance') || reportNameLower.includes('review balance')) {
      return await reportsService.getReviewBalance(
        { companyId, ...filters },
        { includeDetails: true }
      );
    }
    // H20/H18 fix: same rationale as balance-sheet/income-statement above —
    // queued exports now go through the real indirect-method cash flow
    // statement (M16) instead of the retired direct-listing report.
    if (reportNameLower.includes('cash-flow') || reportNameLower.includes('cash flow')) {
      const startDate = startOfDayUtc(filters.startDate ?? filters.fromDate, 'startDate');
      const endDate = endOfDayUtc(filters.endDate ?? filters.toDate ?? new Date(), 'endDate');
      const result = await financialReportService.getCashFlowStatement({
        companyId,
        branchId: filters.branchId || undefined,
        fiscalYearId: filters.fiscalYearId || undefined,
        costCenterId: filters.costCenterId || undefined,
        startDate,
        endDate,
        limit: 10000,
      });
      return { data: result.lines, summary: result.summary };
    }

    // Inventory reports
    if (reportNameLower.includes('sales')) {
      return await inventoryReportsService.getSalesReport(
        { companyId, ...filters },
        { includeDetails: true }
      );
    }
    if (reportNameLower.includes('purchase')) {
      return await inventoryReportsService.getPurchaseReport(
        { companyId, ...filters },
        { includeDetails: true }
      );
    }
    if (reportNameLower.includes('inventory')) {
      return await inventoryReportsService.getInventoryReport(
        { companyId, ...filters },
        { includeDetails: true }
      );
    }

    // HR reports
    if (reportNameLower.includes('payroll')) {
      return await hrReportsService.getPayrollReport(
        { companyId, ...filters },
        { includeDetails: true }
      );
    }
    if (reportNameLower.includes('employee-data') || reportNameLower.includes('employee data')) {
      return await hrReportsService.getEmployeeDataReport(
        { companyId, ...filters },
        { includeDetails: true }
      );
    }

    // Wave 6 fix: an unmapped report name used to fall through to an empty
    // `{ data: [], summary: {} }` result — the job reported success and the
    // caller got a report file with nothing in it and no indication that the
    // report type was never wired up. Fail the job instead (BullMQ marks it
    // 'failed', see the event handler below) so this looks like what it is:
    // an unimplemented report, not an empty one.
    logger.error({ reportName, filters }, 'Unknown report name — no query mapping implemented');
    throw new Error(`Report "${reportName}" is not implemented`);
  } catch (error) {
    logger.error({ error, companyId, reportName, filters }, 'Error querying report data');
    throw error;
  }
}

/**
 * Generate PDF report
 */
async function generatePDFReport(data: any, filePath: string, reportName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text(reportName, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Summary section
      if (data.summary) {
        doc.fontSize(14).text('Summary', { underline: true });
        doc.moveDown();
        Object.entries(data.summary).forEach(([key, value]) => {
          doc.fontSize(10).text(`${key}: ${value}`, { indent: 20 });
        });
        doc.moveDown(2);
      }

      // Data section
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        doc.fontSize(14).text('Data', { underline: true });
        doc.moveDown();

        // Simple table representation
        const firstRow = data.data[0];
        const headers = Object.keys(firstRow);

        // Table headers
        doc.fontSize(10).font('Helvetica-Bold');
        headers.forEach((header, index) => {
          doc.text(header, 50 + index * 100, doc.y, { width: 100 });
        });
        doc.moveDown();

        // Table rows
        doc.font('Helvetica');
        data.data.slice(0, 50).forEach((row: any) => {
          headers.forEach((header, index) => {
            const value = row[header];
            doc.text(String(value || ''), 50 + index * 100, doc.y, { width: 100 });
          });
          doc.moveDown();
        });
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate Excel report
 */
async function generateExcelReport(data: any, filePath: string, reportName: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(reportName);

  // Header row
  worksheet.addRow([reportName]);
  worksheet.mergeCells('A1:Z1');
  worksheet.getRow(1).font = { size: 16, bold: true };
  worksheet.getRow(1).alignment = { horizontal: 'center' };

  // Summary section
  if (data.summary) {
    worksheet.addRow([]);
    worksheet.addRow(['Summary']);
    worksheet.getRow(worksheet.rowCount).font = { bold: true };
    Object.entries(data.summary).forEach(([key, value]) => {
      worksheet.addRow([key, value]);
    });
    worksheet.addRow([]);
  }

  // Data section
  if (data.data && Array.isArray(data.data) && data.data.length > 0) {
    const firstRow = data.data[0];
    const headers = Object.keys(firstRow);

    // Table headers
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(worksheet.rowCount);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Table rows
    data.data.forEach((row: any) => {
      const values = headers.map((header) => row[header] || '');
      worksheet.addRow(values);
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });
  }

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Generate CSV report
 */
async function generateCSVReport(data: any, filePath: string, reportName: string): Promise<void> {
  let csvContent = `${reportName}\n`;
  csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;

  // Summary section
  if (data.summary) {
    csvContent += 'Summary\n';
    Object.entries(data.summary).forEach(([key, value]) => {
      csvContent += `${key},${value}\n`;
    });
    csvContent += '\n';
  }

  // Data section
  if (data.data && Array.isArray(data.data) && data.data.length > 0) {
    const firstRow = data.data[0];
    const headers = Object.keys(firstRow);

    // Headers
    csvContent += stringify([headers]);

    // Rows
    const rows = data.data.map((row: any) => headers.map((header) => row[header] || ''));
    csvContent += stringify(rows);
  }

  await writeFile(filePath, csvContent, 'utf8');
}

logger.info('Reports worker started');
