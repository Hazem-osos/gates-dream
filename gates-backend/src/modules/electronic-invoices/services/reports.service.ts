import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { expandTreeIds } from '../../inventory/services/item-movement-report';
import {
  BUILTIN_SALES_INVOICE_PATTERN_ID,
  buildEtaReadinessWhere,
} from './eta-readiness-filters';

export interface ElectronicInvoiceReportFilters {
  companyId: string;
  customerId?: string;
  delegateId?: string;
  warehouseId?: string;
  branchId?: string;
  itemId?: string;
  itemGroupId?: string;
  costCenterId?: string;
  sentByUserId?: string;
  invoiceNumber?: string;
  patternIds?: string[];
  invoiceType?: 'sales' | 'return' | 'amendment';
  status?: string;
  submission?: 'sent' | 'unsent' | 'all';
  fromDate?: Date;
  toDate?: Date;
  submittedFrom?: Date;
  submittedTo?: Date;
}

export interface ElectronicInvoiceReportOptions {
  page?: number;
  limit?: number;
}

export interface ElectronicInvoiceReportResult {
  data: any[];
  summary?: {
    totalAmount?: number;
    totalTax?: number;
    totalCount?: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const SENT_DOC_STATUSES = ['VALID', 'SUBMITTED'] as const;
const SUBMISSION_WINDOW_DAYS = 7;

const STATUS_AR: Record<string, string> = {
  VALID: 'مقبولة',
  SUBMITTED: 'مرسلة',
  INVALID: 'مرفوضة',
  REJECTED: 'مرفوضة',
  CANCELLED: 'ملغاة',
  DRAFT: 'مسودة',
  PENDING_SIGNATURE: 'بانتظار التوقيع',
  NOT_SUBMITTED: 'غير مرسلة',
};

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function remainingSubmissionDays(invoiceDate: Date, sent: boolean) {
  if (sent) return '—';
  const deadline = utcDay(invoiceDate) + SUBMISSION_WINDOW_DAYS * 86_400_000;
  const days = Math.ceil((deadline - utcDay(new Date())) / 86_400_000);
  return String(Math.max(0, days));
}

function patternName(invoice: {
  invoiceKind: string | null;
  documentProfileId: string | null;
  newModuleId: string | null;
  moduleCode: string | null;
  documentProfile: { nameAr: string } | null;
  newModule: { nameAr: string | null; menuNameAr: string | null } | null;
}) {
  const named =
    invoice.documentProfile?.nameAr ||
    invoice.newModule?.menuNameAr ||
    invoice.newModule?.nameAr;
  if (named) return named;
  if (
    invoice.invoiceKind === 'SALE' &&
    !invoice.documentProfileId &&
    !invoice.newModuleId &&
    (!invoice.moduleCode || invoice.moduleCode === 'SI01')
  ) {
    return 'فاتورة مبيعات';
  }
  if (invoice.invoiceKind === 'SALE_RETURN') return 'مردود مبيعات';
  return '—';
}

export class ElectronicInvoiceReportsService {
  private async listSentInvoices(
    filters: ElectronicInvoiceReportFilters,
    options: ElectronicInvoiceReportOptions,
    invoiceKind: 'SALE' | 'SALE_RETURN',
    amendmentOnly: boolean
  ): Promise<ElectronicInvoiceReportResult> {
    const { companyId, fromDate, toDate } = filters;
    const { page = 1, limit = 100 } = options;
    const patternIds = (filters.patternIds ?? []).map((id) => id.trim()).filter(Boolean);
    const moduleIds = patternIds.filter((id) => id !== BUILTIN_SALES_INVOICE_PATTERN_ID);
    const [categories, modules, sentByDocs] = await Promise.all([
      filters.itemGroupId
        ? prisma.itemCategory.findMany({
            where: { companyId },
            select: { id: true, parentCategoryId: true },
          })
        : Promise.resolve([]),
      moduleIds.length
        ? prisma.newModule.findMany({
            where: { companyId, id: { in: moduleIds } },
            select: { id: true, fullCode: true },
          })
        : Promise.resolve([]),
      filters.sentByUserId
        ? prisma.eInvoiceDocument.findMany({
            where: { companyId, submittedByUserId: filters.sentByUserId },
            select: { invoiceId: true },
            distinct: ['invoiceId'],
          })
        : Promise.resolve(null),
    ]);
    const invoiceIds = sentByDocs
      ? sentByDocs.map((row) => row.invoiceId).filter((id): id is string => Boolean(id))
      : undefined;
    if (invoiceIds && invoiceIds.length === 0) {
      return {
        data: [],
        summary: { totalAmount: 0, totalTax: 0, totalCount: 0 },
        pagination: { page, limit, total: 0, totalPages: 1 },
      };
    }
    const readinessWhere = buildEtaReadinessWhere(companyId, {
      invoiceKind,
      fromDate,
      toDate,
      customerId: filters.customerId,
      delegateId: filters.delegateId,
      warehouseId: filters.warehouseId,
      branchId: filters.branchId,
      itemId: filters.itemId,
      categoryIds: filters.itemGroupId
        ? expandTreeIds(
            filters.itemGroupId,
            categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
          )
        : undefined,
      costCenterId: filters.costCenterId,
      invoiceNumber: filters.invoiceNumber,
      profileIds: patternIds.length ? patternIds : undefined,
      enabledModuleCodes: Object.fromEntries(
        modules.flatMap((row) => (row.fullCode ? [[row.id, row.fullCode] as const] : []))
      ),
      submission: filters.submission ?? 'sent',
      submittedFrom: filters.submittedFrom,
      submittedTo: filters.submittedTo,
      invoiceIds,
    });
    const where: Prisma.InvoiceWhereInput = amendmentOnly
      ? {
          AND: [
            readinessWhere,
            { eInvoiceDocuments: { some: { originalDocumentUuid: { not: null } } } },
          ],
        }
      : readinessWhere;
    const skip = (page - 1) * limit;
    const [invoices, total, sums] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceKind: true,
          date: true,
          netAmount: true,
          taxAmount: true,
          taxSubmitted: true,
          currencyCode: true,
          moduleCode: true,
          documentProfileId: true,
          newModuleId: true,
          branchId: true,
          branch: { select: { arabicName: true } },
          customer: { select: { arabicName: true, code: true, serial: true, taxAuthority: true } },
          documentProfile: { select: { nameAr: true } },
          newModule: { select: { nameAr: true, menuNameAr: true } },
          eInvoiceDocuments: {
            orderBy: { createdAt: 'desc' },
            select: {
              status: true,
              documentUuid: true,
              originalDocumentUuid: true,
              submittedAt: true,
              submittedByName: true,
              documentType: true,
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.aggregate({
        where,
        _sum: { netAmount: true, taxAmount: true },
      }),
    ]);
    const data = invoices.map((invoice) => {
      const sent = invoice.eInvoiceDocuments.find(
        (doc) => doc.documentUuid && SENT_DOC_STATUSES.includes(doc.status as (typeof SENT_DOC_STATUSES)[number])
      );
      const amendment = invoice.eInvoiceDocuments.find((doc) => doc.originalDocumentUuid);
      const display = sent ?? amendment ?? invoice.eInvoiceDocuments[0];
      const isSent = Boolean(sent) || invoice.taxSubmitted;
      const rawStatus = isSent ? sent?.status || 'SUBMITTED' : display?.status || 'NOT_SUBMITTED';
      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.date,
        status: isSent ? 'submitted' : 'draft',
        statusLabel: STATUS_AR[rawStatus] ?? rawStatus,
        submissionDate: display?.submittedAt ?? null,
        totalAmountAfterTax: Number(invoice.netAmount),
        totalTax: Number(invoice.taxAmount),
        branchId: invoice.branchId,
        branchName: invoice.branch?.arabicName ?? null,
        currency: invoice.currencyCode || null,
        patternName: patternName(invoice),
        remainingDays: remainingSubmissionDays(invoice.date, isSent),
        customer: {
          arabicName: invoice.customer?.arabicName ?? '',
          code: invoice.customer?.code || invoice.customer?.serial || '',
          taxNumber: invoice.customer?.taxAuthority ?? '',
        },
        documentUuid: display?.documentUuid ?? null,
        sentBy: display?.submittedByName || null,
        amendmentStatus: amendment?.status ?? null,
        amendmentUuid: amendment?.documentUuid ?? null,
      };
    });
    const totalAmount = Number(sums._sum.netAmount ?? 0);
    const totalTax = Number(sums._sum.taxAmount ?? 0);
    return {
      data,
      summary: { totalAmount, totalTax, totalCount: total },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getSalesInvoicesReport(
    filters: ElectronicInvoiceReportFilters,
    options: ElectronicInvoiceReportOptions = {}
  ): Promise<ElectronicInvoiceReportResult> {
    try {
      return await this.listSentInvoices(filters, options, 'SALE', false);
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales invoices report');
      throw error;
    }
  }

  async getReturnsInvoicesReport(
    filters: ElectronicInvoiceReportFilters,
    options: ElectronicInvoiceReportOptions = {}
  ): Promise<ElectronicInvoiceReportResult> {
    try {
      return await this.listSentInvoices(filters, options, 'SALE_RETURN', false);
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating returns invoices report');
      throw error;
    }
  }

  async getModifiedReturnsReport(
    filters: ElectronicInvoiceReportFilters,
    options: ElectronicInvoiceReportOptions = {}
  ): Promise<ElectronicInvoiceReportResult> {
    try {
      return await this.listSentInvoices(filters, options, 'SALE', true);
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating modified returns report');
      throw error;
    }
  }
}

export const electronicInvoiceReportsService = new ElectronicInvoiceReportsService();
