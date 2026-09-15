import { Prisma, type SubcontractInvoice, type SubcontractInvoiceItem } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  InvoiceImmutableError,
  InvoiceStateError,
  SubcontractInvoiceNotFoundError,
  SubcontractNotFoundError,
} from '../errors/subcontract-domain.errors';
import type {
  CalculatedDraftInvoice,
  CreateOrUpdateDraftInvoiceDto,
  SubcontractInvoiceGlPayload,
} from '../types/subcontract-invoice.types';
import { IMMUTABLE_INVOICE_STATUSES } from '../types/subcontract-invoice.types';
import { enqueueSubcontractInvoiceWorkflowJob } from '../../automation/producers/domain-event.producer';
import type { SubcontractInvoiceWorkflowJobData } from '../../automation/types/automation-jobs.types';
import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';
import { subcontractAccountingService } from './subcontract-accounting.service';
import { subcontractInvoiceCalculationService } from './subcontract-invoice-calculation.service';

type PostedInvoice = SubcontractInvoice & { items: SubcontractInvoiceItem[] };

export class SubcontractInvoiceCommandService {
  async createOrUpdateDraftInvoice(
    companyId: string,
    subcontractId: string,
    dto: CreateOrUpdateDraftInvoiceDto
  ) {
    return prisma.$transaction(async (tx) => {
      const subcontract = await tx.subcontract.findFirst({
        where: { id: subcontractId, companyId },
      });
      if (!subcontract) throw new SubcontractNotFoundError(companyId, subcontractId);
      if (subcontract.status !== 'ACTIVE') {
        throw new AppError(409, 'Invoices can only be drafted against an ACTIVE subcontract');
      }

      let existing: SubcontractInvoice | null = null;
      if (dto.invoiceId) {
        existing = await this.requireInvoice(tx, companyId, dto.invoiceId, subcontractId);
        this.assertMutable(existing);
        if (existing.status !== 'DRAFT') {
          throw new InvoiceStateError(existing.id, existing.status, ['DRAFT']);
        }
      }

      const calculated = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(tx, {
        companyId,
        subcontractId,
        items: dto.items,
        applyEarlyPaymentDiscount: dto.applyEarlyPaymentDiscount,
        excludeInvoiceId: existing?.id,
      });

      const sequenceNumber =
        dto.sequenceNumber ??
        existing?.sequenceNumber ??
        (await this.nextSequenceNumber(tx, companyId, subcontractId));
      const invoiceNumber =
        dto.invoiceNumber ??
        existing?.invoiceNumber ??
        `${subcontract.subcontractNumber}-${String(sequenceNumber).padStart(5, '0')}`;

      const header = this.headerFromCalculation(calculated, {
        companyId,
        subcontractId,
        invoiceNumber,
        sequenceNumber,
        periodStartDate: dto.periodStartDate,
        periodEndDate: dto.periodEndDate,
        type: dto.type ?? 'INTERIM_RUNNING',
        notes: dto.notes ?? null,
        attachments: dto.attachments === undefined ? undefined : (dto.attachments as Prisma.InputJsonValue),
      });

      const invoice = existing
        ? await tx.subcontractInvoice.update({
            where: { id: existing.id },
            data: header,
          })
        : await tx.subcontractInvoice.create({ data: header });

      await tx.subcontractInvoiceItem.deleteMany({ where: { subcontractInvoiceId: invoice.id } });
      if (calculated.lines.length) {
        await tx.subcontractInvoiceItem.createMany({
          data: calculated.lines.map((line) => ({
            subcontractInvoiceId: invoice.id,
            subcontractBOQItemId: line.subcontractBOQItemId,
            previousQuantity: line.previousQuantity,
            currentQuantity: line.currentQuantity,
            totalCumulativeQuantity: line.totalCumulativeQuantity,
            completionPercentage: line.completionPercentage,
            unitPrice: line.unitPrice,
            totalCurrentAmount: line.totalCurrentAmount,
          })),
        });
      }

      return tx.subcontractInvoice.findFirstOrThrow({
        where: { id: invoice.id, companyId },
        include: { items: true },
      });
    });
  }

  async submitToSiteEngineer(companyId: string, invoiceId: string) {
    const invoice = await prisma.$transaction(async (tx) => {
      const current = await this.requireInvoice(tx, companyId, invoiceId);
      if (current.status !== 'DRAFT') {
        throw new InvoiceStateError(current.id, current.status, ['DRAFT']);
      }
      return tx.subcontractInvoice.update({
        where: { id: current.id },
        data: { status: 'SITE_SUBMITTED' },
        include: { items: true },
      });
    });
    await this.enqueueWorkflow(companyId, invoice, 'DRAFT', 'SITE_SUBMITTED');
    return invoice;
  }

  async approveByConsultant(companyId: string, invoiceId: string) {
    const invoice = await prisma.$transaction(async (tx) => {
      const current = await this.requireInvoice(tx, companyId, invoiceId);
      if (current.status !== 'SITE_SUBMITTED') {
        throw new InvoiceStateError(current.id, current.status, ['SITE_SUBMITTED']);
      }
      await this.attachPendingCharges(tx, companyId, current);
      return tx.subcontractInvoice.update({
        where: { id: current.id },
        data: { status: 'CONSULTANT_APPROVED' },
        include: { items: true },
      });
    });
    await this.enqueueWorkflow(companyId, invoice, 'SITE_SUBMITTED', 'CONSULTANT_APPROVED');
    return invoice;
  }

  async approveByTechOffice(companyId: string, invoiceId: string) {
    const invoice = await prisma.$transaction(async (tx) => {
      const current = await this.requireInvoice(tx, companyId, invoiceId);
      if (current.status !== 'CONSULTANT_APPROVED') {
        throw new InvoiceStateError(current.id, current.status, ['CONSULTANT_APPROVED']);
      }
      await this.attachPendingCharges(tx, companyId, current);
      return tx.subcontractInvoice.update({
        where: { id: current.id },
        data: { status: 'TECH_OFFICE_APPROVED' },
        include: { items: true },
      });
    });
    await this.enqueueWorkflow(companyId, invoice, 'CONSULTANT_APPROVED', 'TECH_OFFICE_APPROVED');
    return invoice;
  }

  async lockAndPostInvoice(
    companyId: string,
    invoiceId: string,
    postingCtx?: JournalPostingContext
  ): Promise<{ invoice: PostedInvoice; glPayload: SubcontractInvoiceGlPayload; journalEntryId?: string }> {
    const posted = await prisma.$transaction(async (tx) => {
      const invoice = await this.requireInvoice(tx, companyId, invoiceId);
      if (invoice.status !== 'TECH_OFFICE_APPROVED') {
        throw new InvoiceStateError(invoice.id, invoice.status, ['TECH_OFFICE_APPROVED']);
      }

      const calculated = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(tx, {
        companyId,
        subcontractId: invoice.subcontractId,
        items: invoice.items.map((item) => ({
          subcontractBOQItemId: item.subcontractBOQItemId,
          currentQuantity: item.currentQuantity,
        })),
        applyEarlyPaymentDiscount: invoice.earlyPaymentDiscountDeduction.gt(0),
        excludeInvoiceId: invoice.id,
      });

      await this.attachPendingCharges(tx, companyId, invoice);
      await this.markChargesApplied(tx, companyId, invoice);

      for (const line of calculated.lines) {
        await tx.subcontractBOQItem.update({
          where: { id: line.subcontractBOQItemId },
          data: { cumulativeExecutedQty: line.totalCumulativeQuantity },
        });
      }

      const posted = await tx.subcontractInvoice.update({
        where: { id: invoice.id },
        data: {
          ...this.amountsFromCalculation(calculated),
          status: 'FINANCE_POSTED',
        },
        include: { items: true },
      });

      let journalEntryId: string | undefined;
      if (postingCtx) {
        const je = await subcontractAccountingService.postInvoiceToGeneralLedgerInTx(
          tx,
          companyId,
          posted.id,
          postingCtx.userId,
          postingCtx
        );
        journalEntryId = je.id;
      }

      return {
        invoice: { ...posted, journalEntryId: journalEntryId ?? posted.journalEntryId },
        journalEntryId,
        glPayload: {
          sourceType: 'SUBCONTRACT_INVOICE' as const,
          companyId,
          invoiceId: posted.id,
          subcontractId: posted.subcontractId,
          invoiceNumber: posted.invoiceNumber,
          sequenceNumber: posted.sequenceNumber,
          type: posted.type,
          amounts: {
            grossCurrentAmount: posted.grossCurrentAmount,
            grossCumulativeAmount: posted.grossCumulativeAmount,
            previousGrossAmount: posted.previousGrossAmount,
            advancePaymentDeduction: posted.advancePaymentDeduction,
            retentionDeduction: posted.retentionDeduction,
            taxWithholdingDeduction: posted.taxWithholdingDeduction,
            socialInsuranceDeduction: posted.socialInsuranceDeduction,
            materialOveruseDeduction: posted.materialOveruseDeduction,
            sitePenaltiesDeduction: posted.sitePenaltiesDeduction,
            directExecutionDeduction: posted.directExecutionDeduction,
            earlyPaymentDiscountDeduction: posted.earlyPaymentDiscountDeduction,
            netPayableAmount: posted.netPayableAmount,
          },
        },
      };
    });

    await this.enqueueWorkflow(companyId, posted.invoice, 'TECH_OFFICE_APPROVED', 'FINANCE_POSTED');
    return posted;
  }

  private async enqueueWorkflow(
    companyId: string,
    invoice: Pick<SubcontractInvoice, 'id' | 'subcontractId' | 'invoiceNumber' | 'netPayableAmount'>,
    fromStatus: string,
    toStatus: SubcontractInvoiceWorkflowJobData['toStatus']
  ) {
    await enqueueSubcontractInvoiceWorkflowJob({
      companyId,
      invoiceId: invoice.id,
      subcontractId: invoice.subcontractId,
      invoiceNumber: invoice.invoiceNumber,
      fromStatus,
      toStatus,
      netPayableAmount: invoice.netPayableAmount.toString(),
      occurredAt: new Date().toISOString(),
    });
  }

  private async requireInvoice(
    tx: Prisma.TransactionClient,
    companyId: string,
    invoiceId: string,
    subcontractId?: string
  ) {
    const invoice = await tx.subcontractInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId,
        ...(subcontractId ? { subcontractId } : {}),
      },
      include: { items: true },
    });
    if (!invoice) throw new SubcontractInvoiceNotFoundError(companyId, invoiceId);
    return invoice;
  }

  private assertMutable(invoice: SubcontractInvoice) {
    if ((IMMUTABLE_INVOICE_STATUSES as readonly string[]).includes(invoice.status)) {
      throw new InvoiceImmutableError(invoice.id, invoice.status);
    }
  }

  private async nextSequenceNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    subcontractId: string
  ): Promise<number> {
    const last = await tx.subcontractInvoice.findFirst({
      where: { companyId, subcontractId },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
  }

  private async attachPendingCharges(
    tx: Prisma.TransactionClient,
    companyId: string,
    invoice: SubcontractInvoice
  ) {
    await tx.materialReconciliationLog.updateMany({
      where: {
        subcontractId: invoice.subcontractId,
        subcontractInvoiceId: null,
        status: 'PENDING_DEDUCTION',
        subcontract: { companyId },
      },
      data: { subcontractInvoiceId: invoice.id },
    });
    await tx.sitePenaltyAndSnag.updateMany({
      where: {
        subcontractId: invoice.subcontractId,
        subcontractInvoiceId: null,
        status: 'APPROVED_FOR_DEDUCTION',
        subcontract: { companyId },
      },
      data: { subcontractInvoiceId: invoice.id },
    });
    await tx.directExecutionCharge.updateMany({
      where: {
        subcontractId: invoice.subcontractId,
        subcontractInvoiceId: null,
        status: 'PENDING',
        subcontract: { companyId },
      },
      data: { subcontractInvoiceId: invoice.id },
    });
  }

  private async markChargesApplied(
    tx: Prisma.TransactionClient,
    companyId: string,
    invoice: SubcontractInvoice
  ) {
    await tx.materialReconciliationLog.updateMany({
      where: {
        subcontractInvoiceId: invoice.id,
        subcontract: { companyId },
        status: 'PENDING_DEDUCTION',
      },
      data: { status: 'DEDUCTED' },
    });
    await tx.sitePenaltyAndSnag.updateMany({
      where: {
        subcontractInvoiceId: invoice.id,
        subcontract: { companyId },
        status: { in: ['APPROVED_FOR_DEDUCTION'] },
      },
      data: { status: 'APPLIED_TO_INVOICE' },
    });
    await tx.directExecutionCharge.updateMany({
      where: {
        subcontractInvoiceId: invoice.id,
        subcontract: { companyId },
        status: 'PENDING',
      },
      data: { status: 'APPLIED' },
    });
  }

  private amountsFromCalculation(calculated: CalculatedDraftInvoice) {
    return {
      previousGrossAmount: calculated.previousGrossAmount,
      grossCurrentAmount: calculated.grossCurrentAmount,
      grossCumulativeAmount: calculated.grossCumulativeAmount,
      advancePaymentDeduction: calculated.deductions.advancePaymentDeduction,
      retentionDeduction: calculated.deductions.retentionDeduction,
      taxWithholdingDeduction: calculated.deductions.taxWithholdingDeduction,
      socialInsuranceDeduction: calculated.deductions.socialInsuranceDeduction,
      materialOveruseDeduction: calculated.deductions.materialOveruseDeduction,
      sitePenaltiesDeduction: calculated.deductions.sitePenaltiesDeduction,
      directExecutionDeduction: calculated.deductions.directExecutionDeduction,
      earlyPaymentDiscountDeduction: calculated.deductions.earlyPaymentDiscountDeduction,
      netPayableAmount: calculated.netPayableAmount,
    };
  }

  private headerFromCalculation(
    calculated: CalculatedDraftInvoice,
    extra: {
      companyId: string;
      subcontractId: string;
      invoiceNumber: string;
      sequenceNumber: number;
      periodStartDate: Date;
      periodEndDate: Date;
      type: SubcontractInvoice['type'];
      notes: string | null;
      attachments?: Prisma.InputJsonValue;
    }
  ) {
    return {
      ...extra,
      status: 'DRAFT' as const,
      ...this.amountsFromCalculation(calculated),
    };
  }
}

export const subcontractInvoiceCommandService = new SubcontractInvoiceCommandService();
