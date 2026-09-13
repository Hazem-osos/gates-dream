import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { companySettingService } from '../../platform/services/company-setting.service';
import { cashVoucherFamily } from './cash-transaction.service';
import type { CashVoucherFamily } from '../types/treasury.types';

export type CashPostingMode = 'AUTO' | 'MANUAL' | 'MULTI';

export type ApprovalRow = {
  userId: string;
  name: string;
  status: 'APPROVED' | 'PENDING';
  approvedAt: string | null;
};

const LEGACY_BP01_KEY = 'CashPaymentPostingMode';
const FAMILIES: CashVoucherFamily[] = ['BP01', 'BR01', 'KP01', 'KR01'];

function normalizeFamily(raw?: string | null): CashVoucherFamily | undefined {
  const value = raw?.trim().toUpperCase();
  return FAMILIES.includes(value as CashVoucherFamily) ? (value as CashVoucherFamily) : undefined;
}

export class CashDisbursementWorkflowService {
  async resolvePostingMode(
    companyId: string,
    family: CashVoucherFamily = 'BP01'
  ): Promise<CashPostingMode> {
    const perFamily = (
      await companySettingService.getEntry(companyId, `CashVoucherPostingMode_${family}`)
    )
      ?.trim()
      .toUpperCase();
    if (perFamily === 'AUTO' || perFamily === 'MANUAL' || perFamily === 'MULTI') return perFamily;

    if (family === 'BP01') {
      const legacy = (await companySettingService.getEntry(companyId, LEGACY_BP01_KEY))
        ?.trim()
        .toUpperCase();
      if (legacy === 'AUTO' || legacy === 'MANUAL' || legacy === 'MULTI') return legacy;
    }

    const autoPost = await companySettingService.getModuleEntry(companyId, 'AutoPost', family);
    if (autoPost && autoPost.trim().toUpperCase() === 'T') {
      return 'AUTO';
    }

    return 'MANUAL';
  }

  async seedApprovers(companyId: string): Promise<ApprovalRow[]> {
    const users = await prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true, firstName: true, lastName: true, username: true, email: true },
      take: 40,
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      userId: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.email,
      status: 'PENDING' as const,
      approvedAt: null,
    }));
  }

  parseState(raw: unknown): ApprovalRow[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((row): row is ApprovalRow => {
      return (
        row &&
        typeof row === 'object' &&
        typeof (row as ApprovalRow).userId === 'string' &&
        typeof (row as ApprovalRow).name === 'string'
      );
    });
  }

  async assertCanPost(companyId: string, cashTransactionId: string) {
    const row = await prisma.cashTransaction.findFirst({
      where: { id: cashTransactionId, companyId },
      select: {
        workflowStatus: true,
        approvalState: true,
        transactionKind: true,
        bankAccountId: true,
      },
    });
    if (!row) throw new AppError(404, 'Cash transaction not found');
    const family = cashVoucherFamily(row);
    const mode = await this.resolvePostingMode(companyId, family);
    if (mode !== 'MULTI') return;

    const approvers = this.parseState(row.approvalState);
    if (approvers.length === 0) {
      throw new AppError(422, 'الاعتماد المتعدد: لا يوجد مستخدمون مخولون بالاعتماد');
    }
    const pending = approvers.filter((a) => a.status !== 'APPROVED');
    if (pending.length > 0 || row.workflowStatus !== 'APPROVED') {
      throw new AppError(422, 'لا يمكن ترحيل السند قبل استيفاء كافة الاعتمادات');
    }
  }

  async approve(companyId: string, cashTransactionId: string, userId: string) {
    const row = await prisma.cashTransaction.findFirst({
      where: { id: cashTransactionId, companyId },
    });
    if (!row) throw new AppError(404, 'Cash transaction not found');
    if (row.isPosted) throw new AppError(422, 'السند مرحّل بالفعل');

    let approvers = this.parseState(row.approvalState);
    if (approvers.length === 0) {
      approvers = await this.seedApprovers(companyId);
    }
    const idx = approvers.findIndex((a) => a.userId === userId);
    if (idx < 0) {
      throw new AppError(403, 'لست مخولاً باعتماد هذا السند');
    }
    approvers[idx] = {
      ...approvers[idx],
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
    };
    const allApproved = approvers.every((a) => a.status === 'APPROVED');
    return prisma.cashTransaction.update({
      where: { id: cashTransactionId },
      data: {
        approvalState: approvers as object[],
        workflowStatus: allApproved ? 'APPROVED' : 'PENDING_APPROVAL',
      },
    });
  }

  async getApprovalReport(companyId: string, cashTransactionId: string) {
    const row = await prisma.cashTransaction.findFirst({
      where: { id: cashTransactionId, companyId },
      select: {
        id: true,
        voucherNumber: true,
        workflowStatus: true,
        approvalState: true,
        isPosted: true,
        transactionKind: true,
        bankAccountId: true,
      },
    });
    if (!row) throw new AppError(404, 'Cash transaction not found');
    const family = cashVoucherFamily(row);
    const mode = await this.resolvePostingMode(companyId, family);
    let approvers = this.parseState(row.approvalState);
    if (approvers.length === 0 && mode === 'MULTI') {
      approvers = await this.seedApprovers(companyId);
    }
    return {
      mode,
      family,
      workflowStatus: row.workflowStatus,
      isPosted: row.isPosted,
      voucherNumber: row.voucherNumber,
      approvers,
    };
  }
}

export const cashDisbursementWorkflowService = new CashDisbursementWorkflowService();
export { normalizeFamily };
