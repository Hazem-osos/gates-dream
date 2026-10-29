/**
 * Deep company profile for the admin panel: module usage month by month, e-invoice (ETA) health,
 * storage against the license, accounting integrity and integrations.
 *
 * Read-only. Monthly counts use one grouped query per table; table names come from a fixed
 * whitelist (never from input) and every query filters by companyId.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

const MONTHS = 6;

/** Module → tables counted for it (Prisma @@map names). */
const USAGE_TABLES: Array<{ key: string; label: string; tables: string[] }> = [
  { key: 'invoices', label: 'فواتير البيع والشراء', tables: ['invoices'] },
  { key: 'pos', label: 'طلبات نقاط البيع', tables: ['pos_orders'] },
  { key: 'journal', label: 'قيود اليومية', tables: ['journal_entries'] },
  { key: 'treasury', label: 'سندات القبض والصرف', tables: ['treasury_receipts', 'treasury_payments'] },
  { key: 'stock', label: 'أذون الإضافة والصرف المخزني', tables: ['receipts', 'issues'] },
  { key: 'payroll', label: 'مسيرات الرواتب', tables: ['payroll_runs'] },
  { key: 'eInvoices', label: 'مستندات الفاتورة الإلكترونية', tables: ['e_invoice_documents', 'electronic_invoices'] },
];

function monthKeys(now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = MONTHS - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

async function monthlyCounts(companyId: string, table: string, since: Date): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ m: string; c: bigint | number }>>(
    Prisma.sql`SELECT DATE_FORMAT(createdAt, '%Y-%m') AS m, COUNT(*) AS c
               FROM ${Prisma.raw('`' + table + '`')}
               WHERE companyId = ${companyId} AND createdAt >= ${since}
               GROUP BY m`
  );
  return new Map(rows.map((r) => [r.m, Number(r.c)]));
}

function statusMap(rows: Array<{ status: string; _count: { _all: number } }>): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}

export async function getCompanyInsights(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, tenantSubscription: { select: { maxStorageMb: true, maxUsers: true, maxBranches: true } } },
  });
  if (!company) throw new AppError(404, 'الشركة غير موجودة');

  const months = monthKeys();
  const since = new Date(`${months[0]}-01T00:00:00.000Z`);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const usage = await Promise.all(
    USAGE_TABLES.map(async (u) => {
      const maps = await Promise.all(u.tables.map((t) => monthlyCounts(companyId, t, since)));
      const perMonth = months.map((m) => maps.reduce((s, map) => s + (map.get(m) ?? 0), 0));
      return { key: u.key, label: u.label, perMonth, total: perMonth.reduce((a, b) => a + b, 0) };
    })
  );

  const [
    eDocs,
    eInvoices,
    receipts,
    lastRejected,
    devices,
    storage,
    violationsTotal,
    violations30,
    whatsapp,
    email,
    apiKeys,
    automations,
    migrationJobs,
    activeUsers,
    branches,
  ] = await Promise.all([
    prisma.eInvoiceDocument.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
    prisma.electronicInvoice.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
    prisma.etaReceiptSubmission.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
    prisma.eInvoiceDocument.findFirst({
      where: { companyId, status: { in: ['REJECTED', 'INVALID', 'FAILED', 'ERROR'] } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, status: true, documentType: true },
    }),
    prisma.esignPairedDevice.count({ where: { companyId, status: 'ACTIVE' } }),
    prisma.documentAttachment.aggregate({
      where: { companyId, deletedAt: null },
      _sum: { fileSize: true },
      _count: { _all: true },
    }),
    prisma.glPostingViolation.count({ where: { companyId } }),
    prisma.glPostingViolation.count({ where: { companyId, createdAt: { gte: since30 } } }),
    prisma.companyWhatsappConfig.findUnique({ where: { companyId }, select: { isActive: true } }),
    prisma.companyEmailConfig.findUnique({ where: { companyId }, select: { id: true } }),
    prisma.apiKey.count({ where: { companyId } }),
    prisma.automationRule.count({ where: { companyId } }),
    prisma.migrationJob.count({ where: { targetCompanyId: companyId } }),
    prisma.user.count({ where: { companyId, isActive: true } }),
    prisma.branch.count({ where: { companyId, deletedAt: null } }),
  ]);

  const usedBytes = storage._sum.fileSize ?? 0;
  const sub = company.tenantSubscription;

  return {
    months,
    usage,
    eta: {
      documents: statusMap(eDocs),
      legacyInvoices: statusMap(eInvoices),
      receipts: statusMap(receipts),
      lastProblem: lastRejected,
      activeSigningDevices: devices,
    },
    storage: {
      usedBytes,
      files: storage._count._all,
      limitMb: sub?.maxStorageMb ?? null,
    },
    limits: {
      users: { used: activeUsers, max: sub?.maxUsers ?? null },
      branches: { used: branches, max: sub?.maxBranches ?? null },
    },
    integrity: { glViolationsTotal: violationsTotal, glViolationsLast30Days: violations30 },
    integrations: {
      whatsapp: whatsapp ? (whatsapp.isActive ? 'active' : 'configured') : 'none',
      email: email ? 'configured' : 'none',
      apiKeys,
      automationRules: automations,
      migrationJobs,
    },
  };
}
