import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { money, moneyZero } from '../utils/money-decimal';
import { HISTORICAL_CLIENT_INVOICE_STATUSES } from '../client-billing/types/client-invoice.types';
import { resolveEffectiveOwnerBoqQuantityInTx } from '../variation/contract-variation-effective.service';

type Db = Prisma.TransactionClient | typeof prisma;

const PRELIM_BASELINE_STATUSES = ['APPROVED', 'CONVERTED'] as const;

/** @deprecated Use resolveEffectiveOwnerBoqQuantityInTx for certified limits. */
export function effectiveContractQuantity(contractQuantity: ReturnType<typeof money>) {
  return contractQuantity;
}

export async function effectiveOwnerBoqQuantityInTx(
  db: Db,
  companyId: string,
  clientContractId: string,
  projectBOQItemId: string
) {
  return resolveEffectiveOwnerBoqQuantityInTx(db, companyId, clientContractId, projectBOQItemId);
}

/**
 * Previous certified qty for owner BOQ: legacy financial invoices without prelim link
 * plus operational preliminary certificates (APPROVED/CONVERTED).
 */
export async function sumPreviousOwnerCertifiedQuantityInTx(
  db: Db,
  companyId: string,
  clientContractId: string,
  projectBOQItemId: string,
  excludePreliminaryCertificateId?: string,
  excludeInvoiceId?: string
) {
  let total = moneyZero();

  const legacyInvoices = await db.clientInvoice.findMany({
    where: {
      companyId,
      clientContractId,
      status: { in: [...HISTORICAL_CLIENT_INVOICE_STATUSES] },
      ownerPreliminaryCertificate: null,
      ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
    },
    include: { items: true },
  });
  for (const inv of legacyInvoices) {
    for (const item of inv.items) {
      if (item.projectBOQItemId === projectBOQItemId) {
        total = money(total.plus(item.currentQuantity));
      }
    }
  }

  const prelims = await db.ownerPreliminaryCertificate.findMany({
    where: {
      companyId,
      clientContractId,
      status: { in: [...PRELIM_BASELINE_STATUSES] },
      ...(excludePreliminaryCertificateId ? { id: { not: excludePreliminaryCertificateId } } : {}),
    },
    include: { lines: true },
  });
  for (const cert of prelims) {
    for (const line of cert.lines) {
      if (line.projectBOQItemId !== projectBOQItemId) continue;
      const approved = line.approvedCurrentQuantity ?? line.requestedCurrentQuantity;
      total = money(total.plus(approved));
    }
  }

  return total;
}

export async function sumPreviousSubCertifiedQuantityInTx(
  db: Db,
  companyId: string,
  subcontractId: string,
  subcontractBOQItemId: string,
  excludePreliminaryCertificateId?: string,
  excludeInvoiceId?: string
) {
  let total = moneyZero();

  const legacyInvoices = await db.subcontractInvoice.findMany({
    where: {
      companyId,
      subcontractId,
      status: { in: ['CONSULTANT_APPROVED', 'TECH_OFFICE_APPROVED', 'FINANCE_POSTED', 'PAID'] },
      subcontractPreliminaryCertificate: null,
      ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
    },
    include: { items: true },
  });
  for (const inv of legacyInvoices) {
    for (const item of inv.items) {
      if (item.subcontractBOQItemId === subcontractBOQItemId) {
        total = money(total.plus(item.currentQuantity));
      }
    }
  }

  const prelims = await db.subcontractPreliminaryCertificate.findMany({
    where: {
      companyId,
      subcontractId,
      status: { in: [...PRELIM_BASELINE_STATUSES] },
      ...(excludePreliminaryCertificateId ? { id: { not: excludePreliminaryCertificateId } } : {}),
    },
    include: { lines: true },
  });
  for (const cert of prelims) {
    for (const line of cert.lines) {
      if (line.subcontractBOQItemId !== subcontractBOQItemId) continue;
      const approved = line.approvedCurrentQuantity ?? line.requestedCurrentQuantity;
      total = money(total.plus(approved));
    }
  }

  return total;
}
