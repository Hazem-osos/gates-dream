import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { env } from '../../../shared/config/env';
import { extractRequestRoles } from '../../notifications/services/notification.service';
import { normalizeCallerRoles } from '../../ai/sentinel/notification-rbac';
import type { AuthRequest } from '../../../shared/auth/types';

const SENSITIVE_KEY =
  /^(password|passwordhash|hashedpassword|secret|token|accesstoken|refreshtoken|clientsecret|apikey|pin|tokenpin|jwt|encryptionkey|taxsignature|taxhash)$/i;

export function sanitizeBackupValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value)) return value.map(sanitizeBackupValue);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) continue;
      out[key] = sanitizeBackupValue(child);
    }
    return out;
  }
  return value;
}

export function assertOwnerOnly(req: AuthRequest) {
  const roles = normalizeCallerRoles(extractRequestRoles(req.user));
  if (!roles.includes('OWNER') && !roles.includes('SUPER_ADMIN')) {
    throw new AppError(403, 'النسخ الاحتياطي لبيانات الشركة متاح لمالك المنظومة فقط');
  }
}

function deriveKey(companyId: string): Buffer {
  const secret = env.ENCRYPTION_KEY || env.JWT_DEV_SECRET || 'gates-tenant-backup-key';
  return scryptSync(secret, `gates-backup:${companyId}`, 32);
}

export class TenantBackupService {
  async exportEncrypted(companyId: string) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        id: true,
        arabicName: true,
        englishName: true,
        taxNumber1: true,
        phone1: true,
        address: true,
        createdAt: true,
      },
    });
    if (!company) throw new AppError(404, 'الشركة غير موجودة');

    const [
      customers,
      suppliers,
      items,
      accounts,
      invoices,
      journals,
      cash,
    ] = await Promise.all([
      prisma.customer.findMany({
        where: { companyId },
        select: { id: true, arabicName: true, mobile: true, phone1: true },
        take: 5000,
      }),
      prisma.supplier.findMany({
        where: { companyId },
        select: { id: true, arabicName: true, phone1: true },
        take: 5000,
      }),
      prisma.item.findMany({
        where: { companyId },
        select: { id: true, arabicName: true, barcode: true, serial: true },
        take: 8000,
      }),
      prisma.account.findMany({
        where: { companyId },
        select: { id: true, code: true, arabicName: true, accountType: true },
        take: 4000,
      }),
      prisma.invoice.findMany({
        where: { companyId },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceKind: true,
          date: true,
          netAmount: true,
          remainingAmount: true,
          isPosted: true,
          customerId: true,
          supplierId: true,
        },
        orderBy: { date: 'desc' },
        take: 8000,
      }),
      prisma.journalEntry.findMany({
        where: { companyId },
        select: {
          id: true,
          voucherNumber: true,
          date: true,
          isPosted: true,
          description: true,
        },
        orderBy: { date: 'desc' },
        take: 4000,
      }),
      prisma.cashTransaction.findMany({
        where: { companyId },
        select: {
          id: true,
          voucherNumber: true,
          transactionKind: true,
          date: true,
          amount: true,
          isPosted: true,
        },
        orderBy: { date: 'desc' },
        take: 4000,
      }),
    ]);

    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      company,
      counts: {
        customers: customers.length,
        suppliers: suppliers.length,
        items: items.length,
        accounts: accounts.length,
        invoices: invoices.length,
        journals: journals.length,
        cash: cash.length,
      },
      customers,
      suppliers,
      items,
      accounts,
      invoices,
      journals,
      cash,
    });

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', deriveKey(companyId), iv);
    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const envelope = {
      v: 1,
      alg: 'aes-256-gcm',
      companyId,
      createdAt: new Date().toISOString(),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    };

    return {
      filename: `gates-backup-${company.arabicName.replace(/\s+/g, '-')}-${new Date()
        .toISOString()
        .slice(0, 10)}.json.enc`,
      buffer: Buffer.from(JSON.stringify(envelope), 'utf8'),
    };
  }

  /**
   * Owner self-service JSON manifest — no secrets, no encryption envelope.
   */
  async exportPlainJson(companyId: string, exportedBy: string) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true, arabicName: true, englishName: true },
    });
    if (!company) throw new AppError(404, 'الشركة غير موجودة');

    const [
      accounts,
      invoices,
      invoiceLines,
      vouchers,
      customers,
      suppliers,
      items,
      itemQuantities,
      transfers,
      issues,
      receipts,
      adjustments,
      costCenters,
    ] = await Promise.all([
      prisma.account.findMany({
        where: { companyId },
        select: {
          id: true,
          code: true,
          arabicName: true,
          englishName: true,
          accountType: true,
          parentId: true,
          isActive: true,
        },
      }),
      prisma.invoice.findMany({
        where: { companyId },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceKind: true,
          invoiceType: true,
          date: true,
          customerId: true,
          supplierId: true,
          warehouseId: true,
          totalAmount: true,
          discountAmount: true,
          taxAmount: true,
          netAmount: true,
          paidAmount: true,
          remainingAmount: true,
          isPosted: true,
          isCancelled: true,
          version: true,
        },
        orderBy: { date: 'desc' },
      }),
      prisma.invoiceLine.findMany({
        where: { invoice: { companyId } },
        select: {
          id: true,
          invoiceId: true,
          itemId: true,
          unitId: true,
          quantity: true,
          price: true,
          total: true,
          discountAmount: true,
          taxAmount: true,
          lineOrder: true,
        },
      }),
      prisma.cashTransaction.findMany({
        where: { companyId },
        select: {
          id: true,
          voucherNumber: true,
          transactionKind: true,
          documentRole: true,
          date: true,
          amount: true,
          currencyCode: true,
          customerId: true,
          supplierId: true,
          isPosted: true,
          isCancelled: true,
          executionStatus: true,
          version: true,
        },
        orderBy: { date: 'desc' },
      }),
      prisma.customer.findMany({
        where: { companyId },
        select: {
          id: true,
          code: true,
          arabicName: true,
          mobile: true,
          phone1: true,
          email: true,
          taxData: true,
          isActive: true,
        },
      }),
      prisma.supplier.findMany({
        where: { companyId },
        select: {
          id: true,
          code: true,
          arabicName: true,
          phone1: true,
          email: true,
          isActive: true,
        },
      }),
      prisma.item.findMany({
        where: { companyId },
        select: {
          id: true,
          serial: true,
          barcode: true,
          arabicName: true,
          englishName: true,
          isActive: true,
        },
      }),
      prisma.itemQuantity.findMany({
        where: { item: { companyId } },
        select: {
          id: true,
          itemId: true,
          warehouseId: true,
          locationId: true,
          quantity: true,
        },
      }),
      prisma.transfer.findMany({
        where: { companyId },
        select: {
          id: true,
          serial: true,
          date: true,
          fromWarehouseId: true,
          toWarehouseId: true,
          totalAmount: true,
          isPosted: true,
          isCancelled: true,
          version: true,
        },
      }),
      prisma.issue.findMany({
        where: { companyId },
        select: {
          id: true,
          serial: true,
          date: true,
          warehouseId: true,
          totalAmount: true,
          isPosted: true,
          isCancelled: true,
          version: true,
        },
      }),
      prisma.receipt.findMany({
        where: { companyId },
        select: {
          id: true,
          serial: true,
          date: true,
          warehouseId: true,
          totalAmount: true,
          isPosted: true,
          isCancelled: true,
          version: true,
        },
      }),
      prisma.adjustment.findMany({
        where: { companyId },
        select: {
          id: true,
          serial: true,
          date: true,
          warehouseId: true,
          totalAmount: true,
          isPosted: true,
          isCancelled: true,
          version: true,
        },
      }),
      prisma.costCenter.findMany({
        where: { companyId },
        select: { id: true, code: true, arabicName: true, parentId: true, isActive: true },
      }),
    ]);

    const date = new Date().toISOString().slice(0, 10);
    const manifest = sanitizeBackupValue({
      metadata: {
        companyName: company.arabicName,
        exportedAt: new Date().toISOString(),
        exportedBy,
        schemaVersion: '1.0',
      },
      records: {
        accounts,
        invoices,
        invoiceLines,
        vouchers,
        customers,
        suppliers,
        items,
        itemQuantities,
        stockTransactions: { transfers, issues, receipts, adjustments },
        costCenters,
      },
    });

    return {
      filename: `GatesERP_Backup_${companyId}_${date}.json`,
      json: JSON.stringify(manifest),
    };
  }
}

export const tenantBackupService = new TenantBackupService();
