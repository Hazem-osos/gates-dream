import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  journalPostingService,
  type JournalPostingContext,
} from '../../accounting/services/journal-posting.service';
import {
  buildContractingSettlementFingerprint,
  claimContractingSettlementIdempotencyInTx,
  completeContractingSettlementIdempotencyInTx,
} from '../settlement/contracting-settlement-idempotency.service';
import {
  lockClientInvoiceForSettlementInTx,
  lockSubcontractInvoiceForSettlementInTx,
  refreshClientInvoiceSettlementInTx,
  refreshSubcontractInvoiceSettlementInTx,
} from '../settlement/contracting-certificate-balance.service';
import {
  assertClientInvoiceHasNoActiveSettlements,
  assertSubcontractInvoiceHasNoActiveSettlements,
} from '../settlement/contracting-certificate-settlement.service';
import {
  ACTIVE_SETTLEMENT_BLOCKS_REVERSAL,
  LATER_CERTIFICATE_BLOCKS_REVERSAL,
} from '../settlement/contracting-settlement-status';

export { ACTIVE_SETTLEMENT_BLOCKS_REVERSAL, LATER_CERTIFICATE_BLOCKS_REVERSAL } from '../settlement/contracting-settlement-status';

const REVERSIBLE_STATUSES = new Set(['FINANCE_POSTED', 'PAID']);
const LATER_CLIENT_INVOICE_BLOCKING_STATUSES = [
  'SUBMITTED_TO_CLIENT',
  'CLIENT_APPROVED',
  'FINANCE_POSTED',
  'PAID',
] as const;
const LATER_SUB_INVOICE_BLOCKING_STATUSES = [
  'SITE_SUBMITTED',
  'CONSULTANT_APPROVED',
  'TECH_OFFICE_APPROVED',
  'FINANCE_POSTED',
  'PAID',
] as const;

export type ReverseCertificateInput = {
  idempotencyKey: string;
  reversalDate?: Date;
  reason: string;
};

export type ReverseCertificateResult = {
  certificateId: string;
  originalJournalEntryId: string;
  reversalJournalEntryId: string;
  status: 'REVERSED';
  replay: boolean;
};

function reversalFingerprint(certificateId: string, input: ReverseCertificateInput) {
  return buildContractingSettlementFingerprint({
    certificateId,
    reason: input.reason.trim(),
    reversalDate: (input.reversalDate ?? new Date()).toISOString().slice(0, 10),
  });
}

async function assertNoLaterClientInvoicesInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientContractId: string,
  sequenceNumber: number,
  excludeId: string
) {
  const later = await tx.clientInvoice.findFirst({
    where: {
      companyId,
      clientContractId,
      id: { not: excludeId },
      sequenceNumber: { gt: sequenceNumber },
      status: { in: [...LATER_CLIENT_INVOICE_BLOCKING_STATUSES] },
    },
    select: { id: true, invoiceNumber: true, sequenceNumber: true },
  });
  if (later) {
    throw new AppError(
      422,
      `${LATER_CERTIFICATE_BLOCKS_REVERSAL}: later owner certificate ${later.invoiceNumber} must be reversed or removed first`
    );
  }
}

async function assertNoLaterSubInvoicesInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  subcontractId: string,
  sequenceNumber: number,
  excludeId: string
) {
  const later = await tx.subcontractInvoice.findFirst({
    where: {
      companyId,
      subcontractId,
      id: { not: excludeId },
      sequenceNumber: { gt: sequenceNumber },
      status: { in: [...LATER_SUB_INVOICE_BLOCKING_STATUSES] },
    },
    select: { id: true, invoiceNumber: true },
  });
  if (later) {
    throw new AppError(
      422,
      `${LATER_CERTIFICATE_BLOCKS_REVERSAL}: later subcontract certificate ${later.invoiceNumber} must be reversed or removed first`
    );
  }
}

async function reverseOwnerOperationalEffectsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientInvoiceId: string
) {
  const invoice = await tx.clientInvoice.findFirst({
    where: { id: clientInvoiceId, companyId },
    include: { items: true },
  });
  if (!invoice) return;

  for (const item of invoice.items) {
    const boq = await tx.projectBOQItem.findFirst({
      where: { id: item.projectBOQItemId, companyId },
      select: { cumulativeExecutedQty: true },
    });
    if (!boq) continue;
    const next = Math.max(0, roundTo4(Number(boq.cumulativeExecutedQty) - Number(item.currentQuantity)));
    await tx.projectBOQItem.update({
      where: { id: item.projectBOQItemId },
      data: { cumulativeExecutedQty: next },
    });
  }

  await tx.siteStockMaterial.updateMany({
    where: { companyId, clientInvoiceId, status: 'INSTALLED_AND_DEDUCTED' },
    data: { status: 'STORED_ON_SITE' },
  });
  await tx.siteStockMaterial.updateMany({
    where: { companyId, clientInvoiceId, status: 'STORED_ON_SITE' },
    data: { clientInvoiceId: null },
  });
}

async function reverseSubOperationalEffectsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  subcontractInvoiceId: string
) {
  const invoice = await tx.subcontractInvoice.findFirst({
    where: { id: subcontractInvoiceId, companyId },
    include: { items: true },
  });
  if (!invoice) return;

  for (const item of invoice.items) {
    const boq = await tx.subcontractBOQItem.findFirst({
      where: { id: item.subcontractBOQItemId },
      select: { cumulativeExecutedQty: true },
    });
    if (!boq) continue;
    const next = Math.max(
      0,
      roundTo4(Number(boq.cumulativeExecutedQty) - Number(item.currentQuantity))
    );
    await tx.subcontractBOQItem.update({
      where: { id: item.subcontractBOQItemId },
      data: { cumulativeExecutedQty: next },
    });
  }

  await tx.materialReconciliationLog.updateMany({
    where: { subcontractInvoiceId: invoice.id, status: 'DEDUCTED' },
    data: { status: 'PENDING_DEDUCTION', subcontractInvoiceId: null },
  });
  await tx.sitePenaltyAndSnag.updateMany({
    where: { subcontractInvoiceId: invoice.id, status: 'APPLIED_TO_INVOICE' },
    data: { status: 'APPROVED_FOR_DEDUCTION', subcontractInvoiceId: null },
  });
  await tx.directExecutionCharge.updateMany({
    where: { subcontractInvoiceId: invoice.id, status: 'APPLIED' },
    data: { status: 'PENDING', subcontractInvoiceId: null },
  });
}

export class ContractingCertificateReversalService {
  async reverseClientInvoice(
    ctx: JournalPostingContext,
    clientInvoiceId: string,
    input: ReverseCertificateInput
  ): Promise<ReverseCertificateResult> {
    if (!input.reason?.trim()) {
      throw new AppError(422, 'سبب العكس مطلوب');
    }

    return prisma.$transaction(async (tx) => {
      await lockClientInvoiceForSettlementInTx(tx, ctx.companyId, clientInvoiceId);

      const claim = await claimContractingSettlementIdempotencyInTx(tx, {
        companyId: ctx.companyId,
        operation: 'CLIENT_INVOICE_REVERSE',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: reversalFingerprint(clientInvoiceId, input),
      });

      const invoice = await tx.clientInvoice.findFirstOrThrow({
        where: { id: clientInvoiceId, companyId: ctx.companyId },
      });

      if (claim.mode === 'REPLAY') {
        const replay = claim.result as { reversalJournalEntryId?: string };
        return {
          certificateId: clientInvoiceId,
          originalJournalEntryId: invoice.journalEntryId!,
          reversalJournalEntryId:
            replay.reversalJournalEntryId ?? invoice.reversalJournalEntryId!,
          status: 'REVERSED',
          replay: true,
        };
      }

      if (invoice.status === 'REVERSED' && invoice.reversalJournalEntryId) {
        const payload = {
          reversalJournalEntryId: invoice.reversalJournalEntryId,
        };
        await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, {
          cashTransactionId: invoice.reversalJournalEntryId,
          ...payload,
        });
        return {
          certificateId: clientInvoiceId,
          originalJournalEntryId: invoice.journalEntryId!,
          reversalJournalEntryId: invoice.reversalJournalEntryId,
          status: 'REVERSED',
          replay: true,
        };
      }

      if (!REVERSIBLE_STATUSES.has(invoice.status)) {
        throw new AppError(422, 'لا يمكن عكس مستخلص غير مرحّل مالياً');
      }
      if (!invoice.journalEntryId) {
        throw new AppError(422, 'المستخلص بلا قيد مالي');
      }

      await assertClientInvoiceHasNoActiveSettlements(tx, ctx.companyId, clientInvoiceId);
      await assertNoLaterClientInvoicesInTx(
        tx,
        ctx.companyId,
        invoice.clientContractId,
        invoice.sequenceNumber,
        invoice.id
      );

      const reversalDate = input.reversalDate ?? new Date();
      const { reversal, replay } = await journalPostingService.createDatedContraReversalJournalInTx(
        tx,
        ctx,
        {
          originalJournalEntryId: invoice.journalEntryId,
          reversalDate,
          reason: input.reason.trim(),
          sourceType: 'CLIENT_INVOICE',
          sourceNumber: invoice.invoiceNumber,
          description: `عكس مستخلص مالك ${invoice.invoiceNumber}`,
        }
      );

      if (!replay) {
        await reverseOwnerOperationalEffectsInTx(tx, ctx.companyId, clientInvoiceId);
      }

      await tx.clientInvoice.update({
        where: { id: clientInvoiceId },
        data: {
          status: 'REVERSED',
          reversalJournalEntryId: reversal.id,
          reversedAt: new Date(),
          reversedBy: ctx.userId,
          reversalReason: input.reason.trim(),
          collectedAmount: 0,
          remainingSettlementAmount: 0,
          settlementStatus: 'UNPAID',
        },
      });

      await refreshClientInvoiceSettlementInTx(tx, ctx.companyId, clientInvoiceId);

      const idemPayload = {
        reversalJournalEntryId: reversal.id,
        cashTransactionId: reversal.id,
      };
      await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, idemPayload);

      return {
        certificateId: clientInvoiceId,
        originalJournalEntryId: invoice.journalEntryId,
        reversalJournalEntryId: reversal.id,
        status: 'REVERSED',
        replay,
      };
    });
  }

  async reverseSubcontractInvoice(
    ctx: JournalPostingContext,
    subcontractInvoiceId: string,
    input: ReverseCertificateInput
  ): Promise<ReverseCertificateResult> {
    if (!input.reason?.trim()) {
      throw new AppError(422, 'سبب العكس مطلوب');
    }

    return prisma.$transaction(async (tx) => {
      await lockSubcontractInvoiceForSettlementInTx(tx, ctx.companyId, subcontractInvoiceId);

      const claim = await claimContractingSettlementIdempotencyInTx(tx, {
        companyId: ctx.companyId,
        operation: 'SUBCONTRACT_INVOICE_REVERSE',
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: reversalFingerprint(subcontractInvoiceId, input),
      });

      const invoice = await tx.subcontractInvoice.findFirstOrThrow({
        where: { id: subcontractInvoiceId, companyId: ctx.companyId },
      });

      if (claim.mode === 'REPLAY') {
        const replay = claim.result as { reversalJournalEntryId?: string };
        return {
          certificateId: subcontractInvoiceId,
          originalJournalEntryId: invoice.journalEntryId!,
          reversalJournalEntryId:
            replay.reversalJournalEntryId ?? invoice.reversalJournalEntryId!,
          status: 'REVERSED',
          replay: true,
        };
      }

      if (invoice.status === 'REVERSED' && invoice.reversalJournalEntryId) {
        await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, {
          cashTransactionId: invoice.reversalJournalEntryId,
          reversalJournalEntryId: invoice.reversalJournalEntryId,
        });
        return {
          certificateId: subcontractInvoiceId,
          originalJournalEntryId: invoice.journalEntryId!,
          reversalJournalEntryId: invoice.reversalJournalEntryId,
          status: 'REVERSED',
          replay: true,
        };
      }

      if (!REVERSIBLE_STATUSES.has(invoice.status)) {
        throw new AppError(422, 'لا يمكن عكس مستخلص غير مرحّل مالياً');
      }
      if (!invoice.journalEntryId) {
        throw new AppError(422, 'المستخلص بلا قيد مالي');
      }

      await assertSubcontractInvoiceHasNoActiveSettlements(tx, ctx.companyId, subcontractInvoiceId);
      await assertNoLaterSubInvoicesInTx(
        tx,
        ctx.companyId,
        invoice.subcontractId,
        invoice.sequenceNumber,
        invoice.id
      );

      const reversalDate = input.reversalDate ?? new Date();
      const { reversal, replay } = await journalPostingService.createDatedContraReversalJournalInTx(
        tx,
        ctx,
        {
          originalJournalEntryId: invoice.journalEntryId,
          reversalDate,
          reason: input.reason.trim(),
          sourceType: 'SUBCONTRACT_INVOICE',
          sourceNumber: invoice.invoiceNumber,
          description: `عكس مستخلص مقاول ${invoice.invoiceNumber}`,
        }
      );

      if (!replay) {
        await reverseSubOperationalEffectsInTx(tx, ctx.companyId, subcontractInvoiceId);
      }

      await tx.subcontractInvoice.update({
        where: { id: subcontractInvoiceId },
        data: {
          status: 'REVERSED',
          reversalJournalEntryId: reversal.id,
          reversedAt: new Date(),
          reversedBy: ctx.userId,
          reversalReason: input.reason.trim(),
          paidSettlementAmount: 0,
          remainingSettlementAmount: 0,
          settlementStatus: 'UNPAID',
        },
      });

      await refreshSubcontractInvoiceSettlementInTx(tx, ctx.companyId, subcontractInvoiceId);

      const { projectCostSyncService } = await import('../project-cost/project-cost-sync.service');
      await projectCostSyncService.reverseSubcontractInvoiceInTx(
        tx,
        ctx.companyId,
        subcontractInvoiceId
      );

      await completeContractingSettlementIdempotencyInTx(tx, claim.recordId, {
        cashTransactionId: reversal.id,
        reversalJournalEntryId: reversal.id,
      });

      return {
        certificateId: subcontractInvoiceId,
        originalJournalEntryId: invoice.journalEntryId,
        reversalJournalEntryId: reversal.id,
        status: 'REVERSED',
        replay,
      };
    });
  }
}

export const contractingCertificateReversalService = new ContractingCertificateReversalService();

/** Read-only audit for historical / inconsistent reversal state. */
export async function auditCertificateReversalIntegrity(companyId: string) {
  const issues: Array<{ kind: string; id: string; detail: string }> = [];

  const reversedClients = await prisma.clientInvoice.findMany({
    where: { companyId, status: 'REVERSED' },
    select: { id: true, invoiceNumber: true, journalEntryId: true, reversalJournalEntryId: true },
  });
  for (const row of reversedClients) {
    if (!row.reversalJournalEntryId) {
      issues.push({ kind: 'CLIENT_INVOICE', id: row.id, detail: 'REVERSED without reversalJournalEntryId' });
    }
    const active = await prisma.contractingCertificateAllocation.count({
      where: {
        companyId,
        clientInvoiceId: row.id,
        cashTransaction: { isPosted: true, isCancelled: false },
      },
    });
    if (active > 0) {
      issues.push({ kind: 'CLIENT_INVOICE', id: row.id, detail: 'REVERSED with active settlement' });
    }
  }

  const postedNoJe = await prisma.clientInvoice.findMany({
    where: { companyId, status: { in: ['FINANCE_POSTED', 'PAID'] }, journalEntryId: null },
    select: { id: true },
  });
  for (const row of postedNoJe) {
    issues.push({ kind: 'CLIENT_INVOICE', id: row.id, detail: 'Posted status without journalEntryId' });
  }

  return issues;
}
