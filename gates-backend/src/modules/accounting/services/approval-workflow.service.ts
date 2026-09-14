import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { companySettingService } from '../../platform/services/company-setting.service';
import { partyCreditService } from './party-credit.service';
import {
  documentAuditService,
  type DocumentEntityType,
} from './document-audit.service';

export type WorkflowStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'POSTED';

export type ApprovalRequirement =
  | 'HIGH_VALUE'
  | 'CREDIT_LIMIT';

export type ApprovalEvaluation = {
  entityType: DocumentEntityType;
  entityId: string;
  workflowStatus: WorkflowStatus;
  requirements: ApprovalRequirement[];
  requiresApproval: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canPost: boolean;
  canReject: boolean;
  blockReason?: string;
};

const SETTING_HIGH_VALUE = 'ApprovalHighValueThreshold';
const SETTING_CREDIT_LIMIT = 'ApprovalEnforceCreditLimit';

export class ApprovalWorkflowService {
  async getHighValueThreshold(companyId: string): Promise<number | null> {
    const raw = await companySettingService.getEntry(companyId, SETTING_HIGH_VALUE);
    if (!raw || !raw.trim()) return null;
    const n = Number(raw.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async isCreditLimitApprovalEnabled(companyId: string): Promise<boolean> {
    return companySettingService.getFlag(companyId, SETTING_CREDIT_LIMIT, false);
  }

  private normalizeStatus(status: string | null | undefined, isPosted: boolean): WorkflowStatus {
    if (isPosted) return 'POSTED';
    const s = (status ?? 'DRAFT').toUpperCase() as WorkflowStatus;
    if (
      s === 'PENDING_APPROVAL' ||
      s === 'APPROVED' ||
      s === 'REJECTED' ||
      s === 'DRAFT'
    ) {
      return s;
    }
    return 'DRAFT';
  }

  async evaluateInvoice(companyId: string, invoiceId: string): Promise<ApprovalEvaluation> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        workflowStatus: true,
        isPosted: true,
        isCancelled: true,
        netAmount: true,
        invoiceKind: true,
        customerId: true,
        supplierId: true,
        createdBy: true,
      },
    });
    if (!invoice) throw new AppError(404, 'Invoice not found');

    const workflowStatus = this.normalizeStatus(invoice.workflowStatus, invoice.isPosted);
    const requirements: ApprovalRequirement[] = [];
    const threshold = await this.getHighValueThreshold(companyId);
    const net = Number(invoice.netAmount);

    if (threshold != null && net > threshold) requirements.push('HIGH_VALUE');

    if (
      invoice.customerId &&
      (invoice.invoiceKind === 'SALE' || invoice.invoiceKind === 'PURCHASE_RETURN') &&
      (await this.isCreditLimitApprovalEnabled(companyId))
    ) {
      const credit = await partyCreditService.checkCustomerCredit(
        companyId,
        invoice.customerId,
        net
      );
      if (!credit.allowed) requirements.push('CREDIT_LIMIT');
    }

    // L3 fix (Item 41): a purchase invoice that exceeds the supplier's
    // credit limit is rejected by the orchestrator at posting time (see
    // `invoice-posting-orchestrator.ts`), but without this it could never
    // be flagged here as `requiresApproval` — leaving no way to reach
    // APPROVED and no way to override the block, ever. Mirrors the
    // SALE/customer requirement above.
    if (
      invoice.supplierId &&
      invoice.invoiceKind === 'PURCHASE' &&
      (await this.isCreditLimitApprovalEnabled(companyId))
    ) {
      const credit = await partyCreditService.checkSupplierCredit(
        companyId,
        invoice.supplierId,
        net
      );
      if (!credit.allowed) requirements.push('CREDIT_LIMIT');
    }

    const requiresApproval = requirements.length > 0;
    return this.buildEvaluation(
      'INVOICE',
      invoice.id,
      workflowStatus,
      requiresApproval,
      invoice.isCancelled
    );
  }

  async evaluateJournal(companyId: string, journalEntryId: string): Promise<ApprovalEvaluation> {
    const entry = await prisma.journalEntry.findFirst({
      where: { id: journalEntryId, companyId },
      select: {
        id: true,
        workflowStatus: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (!entry) throw new AppError(404, 'Journal entry not found');

    const workflowStatus = this.normalizeStatus(entry.workflowStatus, entry.isPosted);
    return this.buildEvaluation(
      'JOURNAL_ENTRY',
      entry.id,
      workflowStatus,
      false,
      entry.isCancelled
    );
  }

  private buildEvaluation(
    entityType: DocumentEntityType,
    entityId: string,
    workflowStatus: WorkflowStatus,
    requiresApproval: boolean,
    isCancelled: boolean
  ): ApprovalEvaluation {
    if (isCancelled) {
      return {
        entityType,
        entityId,
        workflowStatus,
        requirements: [],
        requiresApproval,
        canSubmit: false,
        canApprove: false,
        canPost: false,
        canReject: false,
        blockReason: 'المستند ملغى',
      };
    }

    if (workflowStatus === 'POSTED') {
      return {
        entityType,
        entityId,
        workflowStatus,
        requirements: [],
        requiresApproval,
        canSubmit: false,
        canApprove: false,
        canPost: false,
        canReject: false,
      };
    }

    if (workflowStatus === 'REJECTED') {
      return {
        entityType,
        entityId,
        workflowStatus,
        requirements: [],
        requiresApproval,
        canSubmit: true,
        canApprove: false,
        canPost: false,
        canReject: false,
        blockReason: 'تم رفض المستند — أعد الإرسال للاعتماد بعد التعديل',
      };
    }

    if (workflowStatus === 'PENDING_APPROVAL') {
      return {
        entityType,
        entityId,
        workflowStatus,
        requirements: [],
        requiresApproval,
        canSubmit: false,
        canApprove: true,
        canPost: false,
        canReject: true,
        blockReason: 'بانتظار الاعتماد',
      };
    }

    if (workflowStatus === 'APPROVED') {
      return {
        entityType,
        entityId,
        workflowStatus,
        requirements: [],
        requiresApproval,
        canSubmit: false,
        canApprove: false,
        canPost: true,
        canReject: false,
      };
    }

    // DRAFT
    const needsSubmit = requiresApproval;
    return {
      entityType,
      entityId,
      workflowStatus,
      requirements: [],
      requiresApproval,
      canSubmit: needsSubmit,
      canApprove: false,
      canPost: !needsSubmit,
      canReject: false,
      blockReason: needsSubmit ? 'يتطلب اعتماداً قبل الترحيل' : undefined,
    };
  }

  async assertCanPostInvoice(companyId: string, invoiceId: string) {
    const ev = await this.evaluateInvoice(companyId, invoiceId);
    if (!ev.canPost) {
      throw new AppError(422, ev.blockReason ?? 'Invoice cannot be posted in current workflow state');
    }
  }

  async assertCanPostJournal(companyId: string, journalEntryId: string, _actorUserId?: string) {
    const ev = await this.evaluateJournal(companyId, journalEntryId);
    if (!ev.canPost) {
      throw new AppError(422, ev.blockReason ?? 'Journal entry cannot be posted in current workflow state');
    }
  }

  async submit(
    companyId: string,
    entityType: DocumentEntityType,
    entityId: string,
    userId: string
  ) {
    const ev =
      entityType === 'INVOICE'
        ? await this.evaluateInvoice(companyId, entityId)
        : await this.evaluateJournal(companyId, entityId);

    if (!ev.canSubmit) {
      throw new AppError(422, ev.blockReason ?? 'Cannot submit this document for approval');
    }
    if (!ev.requiresApproval) {
      throw new AppError(422, 'هذا المستند لا يحتاج مسار اعتماد — يمكن ترحيله مباشرة');
    }

    const now = new Date();
    if (entityType === 'INVOICE') {
      await prisma.invoice.update({
        where: { id: entityId },
        data: {
          workflowStatus: 'PENDING_APPROVAL',
          workflowSubmittedAt: now,
          workflowSubmittedBy: userId,
          workflowRejectedAt: null,
          workflowRejectedBy: null,
          workflowRejectionReason: null,
        },
      });
    } else if (entityType === 'JOURNAL_ENTRY') {
      await prisma.journalEntry.update({
        where: { id: entityId },
        data: {
          workflowStatus: 'PENDING_APPROVAL',
          workflowSubmittedAt: now,
          workflowSubmittedBy: userId,
          workflowRejectedAt: null,
          workflowRejectedBy: null,
          workflowRejectionReason: null,
        },
      });
    } else {
      throw new AppError(422, 'Stock movements use invoice/journal approval paths');
    }

    await documentAuditService.record({
      companyId,
      entityType,
      entityId,
      action: 'SUBMITTED',
      userId,
    });

    return this.evaluateEntity(companyId, entityType, entityId);
  }

  async approve(
    companyId: string,
    entityType: DocumentEntityType,
    entityId: string,
    approverUserId: string,
    note?: string
  ) {
    const ev = await this.evaluateEntity(companyId, entityType, entityId);
    if (!ev.canApprove) {
      throw new AppError(422, 'Document is not awaiting approval');
    }

    const now = new Date();
    const data = {
      workflowStatus: 'APPROVED',
      workflowApprovedAt: now,
      workflowApprovedBy: approverUserId,
      isApproved: true,
    };

    if (entityType === 'INVOICE') {
      await prisma.invoice.update({ where: { id: entityId }, data });
    } else {
      await prisma.journalEntry.update({ where: { id: entityId }, data });
    }

    await documentAuditService.record({
      companyId,
      entityType,
      entityId,
      action: 'APPROVED',
      userId: approverUserId,
      metadata: note ? { note } : undefined,
    });

    return this.evaluateEntity(companyId, entityType, entityId);
  }

  async reject(
    companyId: string,
    entityType: DocumentEntityType,
    entityId: string,
    approverUserId: string,
    reason: string
  ) {
    const ev = await this.evaluateEntity(companyId, entityType, entityId);
    if (!ev.canReject) {
      throw new AppError(422, 'Document is not awaiting approval');
    }

    const now = new Date();
    const data = {
      workflowStatus: 'REJECTED',
      workflowRejectedAt: now,
      workflowRejectedBy: approverUserId,
      workflowRejectionReason: reason,
      isApproved: false,
    };

    if (entityType === 'INVOICE') {
      await prisma.invoice.update({ where: { id: entityId }, data });
    } else {
      await prisma.journalEntry.update({ where: { id: entityId }, data });
    }

    await documentAuditService.record({
      companyId,
      entityType,
      entityId,
      action: 'REJECTED',
      userId: approverUserId,
      metadata: { reason },
    });

    return this.evaluateEntity(companyId, entityType, entityId);
  }

  async markPosted(companyId: string, entityType: DocumentEntityType, entityId: string, userId: string) {
    if (entityType === 'INVOICE') {
      await prisma.invoice.update({
        where: { id: entityId },
        data: { workflowStatus: 'POSTED' },
      });
    } else if (entityType === 'JOURNAL_ENTRY') {
      await prisma.journalEntry.update({
        where: { id: entityId },
        data: { workflowStatus: 'POSTED' },
      });
    }
    await documentAuditService.record({
      companyId,
      entityType,
      entityId,
      action: 'POSTED',
      userId,
    });
  }

  async markUnposted(companyId: string, entityType: DocumentEntityType, entityId: string, userId: string) {
    const status: WorkflowStatus = 'DRAFT';
    if (entityType === 'INVOICE') {
      await prisma.invoice.update({
        where: { id: entityId },
        data: { workflowStatus: status, isApproved: false },
      });
    } else if (entityType === 'JOURNAL_ENTRY') {
      await prisma.journalEntry.update({
        where: { id: entityId },
        data: { workflowStatus: status, isApproved: false },
      });
    }
    await documentAuditService.record({
      companyId,
      entityType,
      entityId,
      action: 'UNPOSTED',
      userId,
    });
  }

  evaluateEntity(companyId: string, entityType: DocumentEntityType, entityId: string) {
    if (entityType === 'INVOICE') return this.evaluateInvoice(companyId, entityId);
    if (entityType === 'JOURNAL_ENTRY') return this.evaluateJournal(companyId, entityId);
    throw new AppError(422, 'Unsupported entity type');
  }
}

export const approvalWorkflowService = new ApprovalWorkflowService();
