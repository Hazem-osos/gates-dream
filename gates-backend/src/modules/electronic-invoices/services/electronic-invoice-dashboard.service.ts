import type { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';

function n(value: Decimal | number | null | undefined): number {
  return Number(Number(value ?? 0).toFixed(2));
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('ar-EG', { month: 'short', year: '2-digit' }).format(
    new Date(year, month - 1, 1)
  );
}

function normalizeEtaStatus(status: string | null | undefined, taxSubmitted?: boolean): string {
  if (status === 'VALID') return 'VALID';
  if (status === 'INVALID') return 'INVALID';
  if (status && ['SUBMITTED', 'PENDING_SIGNATURE', 'DRAFT', 'PROCESSING'].includes(status)) {
    return 'PROCESSING';
  }
  if (taxSubmitted) return 'VALID';
  if (status) return status;
  return 'NOT_SUBMITTED';
}

export class ElectronicInvoiceDashboardService {
  async getSummary(companyId: string) {
    const asOf = new Date();
    const sixMonthsAgo = new Date(asOf.getFullYear(), asOf.getMonth() - 5, 1);

    const [
      settings,
      itemCards,
      customerCards,
      documentGroups,
      documentValue,
      legacyGroups,
      postedSales,
      recentDocuments,
      recentLegacy,
      monthlyDocuments,
      invalidDocs,
      unsubmittedInvoices,
    ] = await Promise.all([
      prisma.eInvoiceSetting.findUnique({
        where: { companyId },
        select: { clientId: true, issuerTaxId: true, issuerName: true, environment: true },
      }),
      prisma.electronicInvoiceItem.count({ where: { companyId, isActive: true } }),
      prisma.electronicInvoiceCustomer.count({ where: { companyId, isActive: true } }),
      prisma.eInvoiceDocument.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
      }),
      prisma.eInvoiceDocument.findMany({
        where: { companyId },
        select: { status: true, invoice: { select: { netAmount: true } } },
        take: 500,
      }),
      prisma.electronicInvoice.groupBy({
        by: ['status', 'invoiceType'],
        where: { companyId },
        _count: true,
        _sum: { totalAmountAfterTax: true, totalTax: true },
      }),
      prisma.invoice.count({
        where: { companyId, invoiceKind: 'SALE', isPosted: true, isCancelled: false },
      }),
      prisma.eInvoiceDocument.findMany({
        where: { companyId },
        select: {
          id: true,
          status: true,
          documentType: true,
          submittedAt: true,
          updatedAt: true,
          invoice: { select: { id: true, invoiceNumber: true, netAmount: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.electronicInvoice.findMany({
        where: { companyId },
        select: {
          id: true,
          status: true,
          invoiceType: true,
          invoiceNumber: true,
          totalAmountAfterTax: true,
          updatedAt: true,
          customer: { select: { arabicName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      prisma.eInvoiceDocument.findMany({
        where: { companyId, submittedAt: { gte: sixMonthsAgo } },
        select: { submittedAt: true, status: true, invoice: { select: { netAmount: true } } },
      }),
      prisma.eInvoiceDocument.findMany({
        where: { companyId, status: 'INVALID' },
        select: {
          id: true,
          updatedAt: true,
          invoice: { select: { id: true, invoiceNumber: true, netAmount: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      prisma.invoice.findMany({
        where: {
          companyId,
          invoiceKind: 'SALE',
          isPosted: true,
          isCancelled: false,
          taxSubmitted: false,
          eInvoiceDocuments: { none: { status: { in: ['VALID', 'SUBMITTED', 'PROCESSING'] } } },
        },
        select: {
          id: true,
          invoiceNumber: true,
          netAmount: true,
          date: true,
          updatedAt: true,
          customer: { select: { arabicName: true } },
        },
        orderBy: { date: 'desc' },
        take: 8,
      }),
    ]);

    const docCounts = Object.fromEntries(documentGroups.map((row) => [row.status, row._count]));
    const validDocs = docCounts.VALID ?? 0;
    const invalidDocsCount = docCounts.INVALID ?? 0;
    const processingDocs =
      (docCounts.SUBMITTED ?? 0) +
      (docCounts.PENDING_SIGNATURE ?? 0) +
      (docCounts.DRAFT ?? 0) +
      (docCounts.PROCESSING ?? 0);

    let validValue = 0;
    let invalidValue = 0;
    for (const row of documentValue) {
      const amount = n(row.invoice?.netAmount);
      const status = normalizeEtaStatus(row.status);
      if (status === 'VALID') validValue += amount;
      if (status === 'INVALID') invalidValue += amount;
    }

    let salesCount = 0;
    let returnsCount = 0;
    let amendmentsCount = 0;
    let legacyDraft = 0;
    let legacySubmitted = 0;
    let legacyApproved = 0;
    let legacyRejected = 0;
    let salesValue = 0;
    for (const row of legacyGroups) {
      if (row.invoiceType === 'return') returnsCount += row._count;
      else if (row.invoiceType === 'amendment') amendmentsCount += row._count;
      else salesCount += row._count;
      if (row.status === 'draft') legacyDraft += row._count;
      else if (row.status === 'submitted') legacySubmitted += row._count;
      else if (row.status === 'approved') legacyApproved += row._count;
      else if (row.status === 'rejected') legacyRejected += row._count;
      if (row.invoiceType === 'sales') salesValue += n(row._sum.totalAmountAfterTax);
    }

    const monthKeys: string[] = [];
    for (let i = 0; i < 6; i++) {
      monthKeys.push(monthKey(new Date(asOf.getFullYear(), asOf.getMonth() - 5 + i, 1)));
    }
    const submittedMap = new Map<string, number>();
    const acceptedMap = new Map<string, number>();
    for (const key of monthKeys) {
      submittedMap.set(key, 0);
      acceptedMap.set(key, 0);
    }
    for (const row of monthlyDocuments) {
      if (!row.submittedAt) continue;
      const key = monthKey(row.submittedAt);
      if (!submittedMap.has(key)) continue;
      const amount = n(row.invoice?.netAmount);
      submittedMap.set(key, (submittedMap.get(key) ?? 0) + amount);
      if (row.status === 'VALID') acceptedMap.set(key, (acceptedMap.get(key) ?? 0) + amount);
    }

    const settingsReady = Boolean(settings?.clientId && settings?.issuerTaxId);
    const notSubmitted = unsubmittedInvoices.length;

    const inbox = [
      ...invalidDocs.map((doc) => ({
        id: doc.id,
        tone: 'red' as const,
        title: `فاتورة مرفوضة من ETA — ${doc.invoice?.invoiceNumber ?? 'بدون رقم'}`,
        detail: 'راجع أخطاء التحقق وأعد الإرسال',
        href: '/electronic-invoices/creations/send-invoice',
        amount: n(doc.invoice?.netAmount),
        at: doc.updatedAt.toISOString(),
      })),
      ...unsubmittedInvoices.map((inv) => ({
        id: inv.id,
        tone: 'amber' as const,
        title: `فاتورة غير مرسلة — ${inv.invoiceNumber ?? inv.id.slice(0, 8)}`,
        detail: inv.customer?.arabicName ? `عميل: ${inv.customer.arabicName}` : 'مرحّلة وبانتظار الإرسال لـ ETA',
        href: '/electronic-invoices/creations/send-invoice',
        amount: n(inv.netAmount),
        at: inv.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);

    const activity = [
      ...recentDocuments.map((doc) => ({
        id: doc.id,
        title: `مستند ETA ${doc.invoice?.invoiceNumber ?? doc.documentType}`,
        detail: doc.status,
        status: normalizeEtaStatus(doc.status),
        href: '/electronic-invoices/creations/send-invoice',
        at: (doc.submittedAt ?? doc.updatedAt).toISOString(),
      })),
      ...recentLegacy.map((inv) => ({
        id: inv.id,
        title: `فاتورة ${inv.invoiceNumber ?? inv.invoiceType}`,
        detail: inv.customer?.arabicName ?? inv.invoiceType,
        status: inv.status,
        href: '/electronic-invoices/reports/sales-invoices',
        at: inv.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);

    return {
      asOfDate: asOf.toISOString(),
      settings: {
        ready: settingsReady,
        environment: settings?.environment ?? 'PRE_PRODUCTION',
        issuerName: settings?.issuerName ?? null,
      },
      kpis: {
        postedSales,
        notSubmitted,
        processing: processingDocs,
        valid: validDocs + legacyApproved,
        invalid: invalidDocsCount + legacyRejected,
        validValue,
        invalidValue,
        salesInvoices: salesCount,
        returnsInvoices: returnsCount,
        amendments: amendmentsCount,
        salesValue,
        itemCards,
        customerCards,
        legacyDraft,
        legacySubmitted,
      },
      pipeline: [
        { id: 'draft', label: 'غير مرسلة', count: notSubmitted + legacyDraft },
        { id: 'processing', label: 'قيد المعالجة', count: processingDocs + legacySubmitted },
        { id: 'valid', label: 'مقبولة', count: validDocs + legacyApproved },
        { id: 'invalid', label: 'مرفوضة', count: invalidDocsCount + legacyRejected },
      ],
      statusFunnel: [
        { key: 'NOT_SUBMITTED', label: 'غير مرسلة', value: notSubmitted + legacyDraft },
        { key: 'PROCESSING', label: 'قيد المعالجة', value: processingDocs + legacySubmitted },
        { key: 'VALID', label: 'مقبولة', value: validDocs + legacyApproved },
        { key: 'INVALID', label: 'مرفوضة', value: invalidDocsCount + legacyRejected },
      ].filter((row) => row.value > 0),
      charts: {
        monthlySubmissions: monthKeys.map((key) => ({
          name: monthLabel(key),
          submitted: submittedMap.get(key) ?? 0,
          accepted: acceptedMap.get(key) ?? 0,
        })),
      },
      inbox,
      activity,
    };
  }
}

export const electronicInvoiceDashboardService = new ElectronicInvoiceDashboardService();
