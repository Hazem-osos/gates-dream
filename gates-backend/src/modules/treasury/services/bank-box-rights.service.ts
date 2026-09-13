import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

/**
 * When no BankBoxRight rows exist for a user, access is allowed (legacy default).
 * Once any row exists for the user, posting requires an explicit canPost grant.
 */
export class BankBoxRightsService {
  /** List every safe/bank right row for a user (admin UI: `untBankBoxRights.pas`-style checklist). */
  async listForUser(companyId: string, userId: string) {
    return prisma.bankBoxRight.findMany({
      where: { companyId, userId },
      include: {
        safe: { select: { id: true, code: true, arabicName: true } },
        bankAccount: { select: { id: true, accountNumber: true, arabicName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Legacy `untBankBoxRights.pas saveBtnClick`: delete-all-then-reinsert for
   * `(CompanyCode, UserCode)`. `grants` should list every safe/bank the
   * admin UI shows (checked or not), so unchecking one deletes its row —
   * that keeps `assertCanPost`'s "no rows -> unrestricted" fallback honest
   * (a user who was never fully provisioned shouldn't look "provisioned but
   * denied everything").
   */
  async setForUser(
    companyId: string,
    userId: string,
    grants: Array<{ safeId?: string | null; bankAccountId?: string | null; canPost: boolean; canView?: boolean }>
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.bankBoxRight.deleteMany({ where: { companyId, userId } });
      const allowed = grants.filter((g) => g.canPost || g.canView !== false);
      if (allowed.length === 0) return [];
      return Promise.all(
        allowed.map((g) =>
          tx.bankBoxRight.create({
            data: {
              companyId,
              userId,
              safeId: g.safeId ?? null,
              bankAccountId: g.bankAccountId ?? null,
              canPost: g.canPost,
              canView: g.canView ?? true,
            },
          })
        )
      );
    });
  }

  async assertCanPost(params: {
    companyId: string;
    userId: string;
    safeId?: string | null;
    bankAccountId?: string | null;
  }): Promise<void> {
    const scoped = await prisma.bankBoxRight.count({
      where: { companyId: params.companyId, userId: params.userId },
    });
    if (scoped === 0) {
      return;
    }

    const or: Array<{ safeId?: string; bankAccountId?: string }> = [];
    if (params.safeId) or.push({ safeId: params.safeId });
    if (params.bankAccountId) or.push({ bankAccountId: params.bankAccountId });

    if (or.length === 0) {
      throw new AppError(403, 'Treasury posting requires a cash safe or bank account');
    }

    const grant = await prisma.bankBoxRight.findFirst({
      where: {
        companyId: params.companyId,
        userId: params.userId,
        canPost: true,
        OR: or,
      },
    });

    if (!grant) {
      throw new AppError(403, 'User is not allowed to post to this cash box or bank account');
    }
  }

  /**
   * `null` = unrestricted (admin or user has no BankBoxRight rows yet).
   * Otherwise only the granted safe IDs may be listed.
   */
  async listViewableSafeIds(
    companyId: string,
    userId: string
  ): Promise<string[] | null> {
    const scoped = await prisma.bankBoxRight.count({
      where: { companyId, userId },
    });
    if (scoped === 0) return null;

    const rows = await prisma.bankBoxRight.findMany({
      where: {
        companyId,
        userId,
        safeId: { not: null },
        OR: [{ canView: true }, { canPost: true }],
      },
      select: { safeId: true },
    });
    return rows.map((r) => r.safeId).filter((id): id is string => Boolean(id));
  }

  /**
   * `null` = unrestricted (admin or user has no BankBoxRight rows yet).
   * Otherwise only the granted bank account IDs may be listed.
   */
  async listViewableBankAccountIds(
    companyId: string,
    userId: string
  ): Promise<string[] | null> {
    const scoped = await prisma.bankBoxRight.count({
      where: { companyId, userId },
    });
    if (scoped === 0) return null;

    const rows = await prisma.bankBoxRight.findMany({
      where: {
        companyId,
        userId,
        bankAccountId: { not: null },
        OR: [{ canView: true }, { canPost: true }],
      },
      select: { bankAccountId: true },
    });
    return rows.map((r) => r.bankAccountId).filter((id): id is string => Boolean(id));
  }
}

export const bankBoxRightsService = new BankBoxRightsService();
