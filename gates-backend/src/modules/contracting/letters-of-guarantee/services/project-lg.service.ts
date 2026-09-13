import type { Prisma, ProjectLgStatus } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { money, rate } from '../../utils/money-decimal';
import {
  ContractingProjectNotFoundError,
  LgBankAccountNotFoundError,
  LgInsufficientMarginError,
  LgInvalidStateError,
  ProjectLetterOfGuaranteeNotFoundError,
} from '../errors/lg-domain.errors';
import type {
  AmendLgAmountDto,
  ExtendLetterOfGuaranteeDto,
  IssueLetterOfGuaranteeDto,
  LiquidateLetterOfGuaranteeDto,
  ReleaseLetterOfGuaranteeDto,
} from '../types/project-lg.types';
import { ACTIVE_LG_STATUSES } from '../types/project-lg.types';
import { lgAccountingService } from './lg-accounting.service';

type Db = Prisma.TransactionClient;

const ACTIVE: ProjectLgStatus[] = [...ACTIVE_LG_STATUSES];

export class ProjectLgService {
  async listByProject(companyId: string, projectId: string) {
    await this.assertProject(prisma, companyId, projectId);

    const items = await prisma.projectLetterOfGuarantee.findMany({
      where: { companyId, projectId },
      include: { actionHistory: { orderBy: { actionDate: 'desc' } } },
      orderBy: [{ expiryDate: 'asc' }, { lgNumber: 'asc' }],
    });

    const counts = items.reduce(
      (acc, lg) => {
        acc[lg.status] = (acc[lg.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<ProjectLgStatus, number>
    );

    const active = items.filter((lg) => (ACTIVE as string[]).includes(lg.status));
    const closed = items.filter((lg) => !(ACTIVE as string[]).includes(lg.status));

    return {
      projectId,
      counts,
      tabs: {
        ALL: items,
        ACTIVE: active,
        CLOSED: closed,
        ACTIVE_ISSUED: items.filter((lg) => lg.status === 'ACTIVE_ISSUED'),
        EXTENDED: items.filter((lg) => lg.status === 'EXTENDED'),
        AMENDED_VALUE: items.filter((lg) => lg.status === 'AMENDED_VALUE'),
        RELEASED_RETURNED: items.filter((lg) => lg.status === 'RELEASED_RETURNED'),
        LIQUIDATED_CONFISCATED: items.filter((lg) => lg.status === 'LIQUIDATED_CONFISCATED'),
      },
    };
  }

  async issueLetterOfGuarantee(companyId: string, userId: string, dto: IssueLetterOfGuaranteeDto) {
    const originalAmount = money(dto.originalAmount);
    const cashMarginRate = rate(dto.cashMarginRate);
    const issuanceCommissionAmount = money(dto.issuanceCommissionAmount ?? 0);

    if (originalAmount.lte(0)) {
      throw new AppError(400, 'originalAmount must be greater than zero');
    }
    if (cashMarginRate.lt(0)) {
      throw new LgInsufficientMarginError({ cashMarginRate: cashMarginRate.toFixed(6) });
    }
    if (issuanceCommissionAmount.lt(0)) {
      throw new AppError(400, 'issuanceCommissionAmount cannot be negative');
    }
    if (dto.expiryDate <= dto.issuanceDate) {
      throw new AppError(400, 'expiryDate must be after issuanceDate');
    }

    const cashMarginAmount = money(originalAmount.mul(cashMarginRate));

    return prisma.$transaction(async (tx) => {
      await this.assertProject(tx, companyId, dto.projectId);
      await this.assertBankAccount(tx, companyId, dto.bankAccountId);
      const branchId = await this.resolveBranchId(tx, companyId, dto.branchId);

      const duplicate = await tx.projectLetterOfGuarantee.findFirst({
        where: { companyId, lgNumber: dto.lgNumber },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError(409, `Letter of guarantee number already exists: ${dto.lgNumber}`);
      }

      const created = await tx.projectLetterOfGuarantee.create({
        data: {
          companyId,
          projectId: dto.projectId,
          lgNumber: dto.lgNumber,
          bankAccountId: dto.bankAccountId,
          bankName: dto.bankName,
          beneficiaryName: dto.beneficiaryName,
          type: dto.type,
          issuanceDate: dto.issuanceDate,
          expiryDate: dto.expiryDate,
          originalAmount,
          currentAmount: originalAmount,
          cashMarginRate,
          cashMarginAmount,
          issuanceCommissionAmount,
          status: 'ACTIVE_ISSUED',
          renewalCount: 0,
        },
      });

      await tx.lgActionHistory.create({
        data: {
          companyId,
          letterOfGuaranteeId: created.id,
          actionType: 'ISSUANCE',
          actionDate: dto.issuanceDate,
          newExpiryDate: dto.expiryDate,
          newAmount: originalAmount,
          notes: null,
        },
      });

      const je = await lgAccountingService.postLgIssuance(
        companyId,
        created,
        branchId,
        tx,
        userId
      );

      return tx.projectLetterOfGuarantee.update({
        where: { id: created.id },
        data: { journalEntryId: je.id },
        include: { actionHistory: true },
      });
    });
  }

  async extendLetterOfGuarantee(
    companyId: string,
    lgId: string,
    userId: string,
    dto: ExtendLetterOfGuaranteeDto
  ) {
    return prisma.$transaction(async (tx) => {
      const lg = await this.requireLg(tx, companyId, lgId);
      this.assertActive(lg.id, lg.status);
      if (dto.newExpiryDate <= lg.expiryDate) {
        throw new AppError(400, 'newExpiryDate must be after the current expiry date');
      }

      const extensionCommission = money(dto.extensionCommission ?? 0);
      if (extensionCommission.lt(0)) {
        throw new AppError(400, 'extensionCommission cannot be negative');
      }

      const branchId = await this.resolveBranchId(tx, companyId, dto.branchId);
      const previousExpiryDate = lg.expiryDate;

      const updated = await tx.projectLetterOfGuarantee.update({
        where: { id: lg.id },
        data: {
          expiryDate: dto.newExpiryDate,
          status: 'EXTENDED',
          renewalCount: { increment: 1 },
        },
      });

      await tx.lgActionHistory.create({
        data: {
          companyId,
          letterOfGuaranteeId: lg.id,
          actionType: 'EXTENSION',
          actionDate: dto.newExpiryDate,
          previousExpiryDate,
          newExpiryDate: dto.newExpiryDate,
          bankReferenceNo: dto.bankReferenceNo ?? null,
          notes: dto.notes ?? null,
        },
      });

      if (extensionCommission.gt(0)) {
        await lgAccountingService.postLgExtensionCommission(
          companyId,
          updated,
          branchId,
          tx,
          userId,
          extensionCommission,
          dto.newExpiryDate
        );
      }

      return tx.projectLetterOfGuarantee.findFirstOrThrow({
        where: { id: lg.id, companyId },
        include: { actionHistory: true },
      });
    });
  }

  async amendLgAmount(companyId: string, lgId: string, userId: string, dto: AmendLgAmountDto) {
    return prisma.$transaction(async (tx) => {
      const lg = await this.requireLg(tx, companyId, lgId);
      this.assertActive(lg.id, lg.status);

      const newAmount = money(dto.newAmount);
      if (newAmount.lte(0)) {
        throw new AppError(400, 'newAmount must be greater than zero');
      }

      const currentAmount = money(lg.currentAmount);
      const amountDiff = money(newAmount.minus(currentAmount));
      if (amountDiff.eq(0)) {
        throw new AppError(400, 'newAmount must differ from currentAmount');
      }

      const marginDiff = money(amountDiff.mul(rate(lg.cashMarginRate)));
      const nextMargin = money(money(lg.cashMarginAmount).plus(marginDiff));
      if (nextMargin.lt(0)) {
        throw new LgInsufficientMarginError({
          currentMargin: money(lg.cashMarginAmount).toFixed(4),
          marginDiff: marginDiff.toFixed(4),
        });
      }

      const branchId = await this.resolveBranchId(tx, companyId, dto.branchId);
      const actionType = amountDiff.gt(0) ? 'VALUE_INCREASE' : 'VALUE_DECREASE';

      const updated = await tx.projectLetterOfGuarantee.update({
        where: { id: lg.id },
        data: {
          currentAmount: newAmount,
          cashMarginAmount: nextMargin,
          status: 'AMENDED_VALUE',
        },
      });

      await tx.lgActionHistory.create({
        data: {
          companyId,
          letterOfGuaranteeId: lg.id,
          actionType,
          actionDate: new Date(),
          previousAmount: currentAmount,
          newAmount,
          bankReferenceNo: dto.bankReferenceNo ?? null,
          notes: dto.notes ?? null,
        },
      });

      await lgAccountingService.postLgMarginAdjustment(
        companyId,
        updated,
        branchId,
        tx,
        userId,
        marginDiff,
        new Date()
      );

      return tx.projectLetterOfGuarantee.findFirstOrThrow({
        where: { id: lg.id, companyId },
        include: { actionHistory: true },
      });
    });
  }

  async releaseAndReturnLg(
    companyId: string,
    lgId: string,
    userId: string,
    dto: ReleaseLetterOfGuaranteeDto
  ) {
    return prisma.$transaction(async (tx) => {
      const lg = await this.requireLg(tx, companyId, lgId);
      this.assertActive(lg.id, lg.status);
      const branchId = await this.resolveBranchId(tx, companyId, dto.branchId);

      await tx.lgActionHistory.create({
        data: {
          companyId,
          letterOfGuaranteeId: lg.id,
          actionType: 'RELEASE_RETURN',
          actionDate: dto.releaseDate,
          previousAmount: lg.currentAmount,
          bankReferenceNo: dto.bankReferenceNo ?? null,
          notes: dto.notes ?? null,
        },
      });

      await lgAccountingService.postLgRelease(companyId, lg, branchId, tx, userId, dto.releaseDate);

      return tx.projectLetterOfGuarantee.update({
        where: { id: lg.id },
        data: { status: 'RELEASED_RETURNED' },
        include: { actionHistory: true },
      });
    });
  }

  async liquidateLg(companyId: string, lgId: string, userId: string, dto: LiquidateLetterOfGuaranteeDto) {
    return prisma.$transaction(async (tx) => {
      const lg = await this.requireLg(tx, companyId, lgId);
      this.assertActive(lg.id, lg.status);
      const branchId = await this.resolveBranchId(tx, companyId, dto.branchId);
      const notes = [dto.liquidationReason, dto.notes].filter(Boolean).join(' — ') || null;

      await tx.lgActionHistory.create({
        data: {
          companyId,
          letterOfGuaranteeId: lg.id,
          actionType: 'LIQUIDATION',
          actionDate: dto.liquidationDate,
          previousAmount: lg.currentAmount,
          notes,
        },
      });

      await lgAccountingService.postLgLiquidation(
        companyId,
        lg,
        branchId,
        tx,
        userId,
        dto.liquidationDate
      );

      return tx.projectLetterOfGuarantee.update({
        where: { id: lg.id },
        data: { status: 'LIQUIDATED_CONFISCATED' },
        include: { actionHistory: true },
      });
    });
  }

  private assertActive(lgId: string, status: ProjectLgStatus) {
    if (!(ACTIVE as string[]).includes(status)) {
      throw new LgInvalidStateError(lgId, status, [...ACTIVE_LG_STATUSES]);
    }
  }

  private async requireLg(tx: Db, companyId: string, lgId: string) {
    const lg = await tx.projectLetterOfGuarantee.findFirst({
      where: { id: lgId, companyId },
    });
    if (!lg) throw new ProjectLetterOfGuaranteeNotFoundError(companyId, lgId);
    return lg;
  }

  private async assertProject(
    tx: Prisma.TransactionClient | typeof prisma,
    companyId: string,
    projectId: string
  ) {
    const project = await tx.contractingProject.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);
  }

  private async assertBankAccount(tx: Db, companyId: string, bankAccountId: string) {
    const bank = await tx.bankAccount.findFirst({
      where: { id: bankAccountId, companyId, isActive: true },
      select: { id: true },
    });
    if (!bank) throw new LgBankAccountNotFoundError(companyId, bankAccountId);
  }

  private async resolveBranchId(tx: Db, companyId: string, branchId?: string) {
    if (branchId) {
      const branch = await tx.branch.findFirst({
        where: { id: branchId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!branch) throw new AppError(404, 'Branch not found for this company');
      return branch.id;
    }
    const fallback = await tx.branch.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!fallback) {
      throw new AppError(422, 'A branch is required to post letter-of-guarantee journal entries');
    }
    return fallback.id;
  }
}

export const projectLgService = new ProjectLgService();
