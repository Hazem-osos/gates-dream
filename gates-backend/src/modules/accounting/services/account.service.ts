import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import {
  getTenantCached,
  invalidateTenantCache,
  tenantCacheKeys,
} from '../../../shared/cache/tenant-metadata-cache';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  buildAccountHierarchyTree,
  findHierarchySubtree,
  type AccountHierarchyNode,
} from '../utils/build-account-hierarchy';

export interface CreateAccountData {
  code: string;
  arabicName: string;
  englishName?: string;
  accountType?: string;
  parentId?: string;
  accountSide?: string;
  accountNature?: 'DEBIT' | 'CREDIT';
  statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
  costCenterRequired?: string;
  requiresCostCenter?: boolean;
  defaultCostCenterId?: string | null;
  warning?: string;
  budget?: number;
  currencyCode?: string;
  /** Party cards may hang leaves under AR/AP control even if it has history. */
  allowParentWithMovements?: boolean;
}

function resolveAccountClassification(data: {
  accountNature?: 'DEBIT' | 'CREDIT';
  accountSide?: string | null;
  statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
  requiresCostCenter?: boolean;
  costCenterRequired?: string | null;
}) {
  const accountNature: 'DEBIT' | 'CREDIT' =
    data.accountNature ?? (data.accountSide === 'دائن' ? 'CREDIT' : 'DEBIT');
  const accountSide = data.accountSide ?? (accountNature === 'CREDIT' ? 'دائن' : 'مدين');
  const statementType: 'BALANCE_SHEET' | 'INCOME_STATEMENT' =
    data.statementType ?? 'BALANCE_SHEET';
  const requiresCostCenter =
    data.requiresCostCenter ?? data.costCenterRequired === 'إجباري';
  const costCenterRequired =
    data.costCenterRequired ?? (requiresCostCenter ? 'إجباري' : 'اختياري');
  return { accountNature, accountSide, statementType, requiresCostCenter, costCenterRequired };
}

function accountLabel(account: { code: string; arabicName: string }): string {
  return `«${account.code} — ${account.arabicName}»`;
}

function retiredAccountCode(code: string, accountId: string): string {
  return `${code}__deleted__${accountId.replace(/-/g, '').slice(0, 8)}`;
}

export interface UpdateAccountData extends Partial<CreateAccountData> {
  isActive?: boolean;
}

export class AccountService {
  /**
   * Suggest the next account code under a parent (e.g. parent `11` → `111`, `112`, …).
   */
  async suggestNextAccountCode(companyId: string, parentId?: string | null): Promise<string> {
    if (!parentId) {
      const roots = await prisma.account.findMany({
        where: { companyId, parentId: null, deletedAt: null, isActive: true },
        select: { code: true },
      });
      const nums = roots
        .map((r) => parseInt(r.code, 10))
        .filter((n) => !Number.isNaN(n));
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      return String(next);
    }

    const parent = await prisma.account.findFirst({
      where: { id: parentId, companyId, deletedAt: null },
      select: { code: true },
    });
    if (!parent) {
      throw new AppError(404, 'Parent account not found');
    }

    const prefix = parent.code;
    const siblings = await prisma.account.findMany({
      where: { companyId, parentId, deletedAt: null },
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    if (siblings.length === 0) {
      return `${prefix}1`;
    }

    let maxSuffix = 0;
    for (const row of siblings) {
      if (!row.code.startsWith(prefix) || row.code.length <= prefix.length) continue;
      const suffix = row.code.slice(prefix.length);
      const n = parseInt(suffix, 10);
      if (!Number.isNaN(n)) {
        maxSuffix = Math.max(maxSuffix, n);
      }
    }

    if (maxSuffix > 0) {
      return `${prefix}${maxSuffix + 1}`;
    }

    return `${prefix}1`;
  }

  private async getPostedBalanceMap(companyId: string): Promise<Map<string, number>> {
    const grouped = await prisma.accountPeriodBalance.groupBy({
      by: ['accountId'],
      where: { companyId },
      _sum: { netBalance: true },
    });

    const map = new Map<string, number>();
    for (const row of grouped) {
      map.set(row.accountId, Number(row._sum.netBalance ?? 0));
    }
    return map;
  }

  /**
   * Create a new account
   */
  private async isCoaAutoNumbering(companyId: string): Promise<boolean> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { advancedSettings: true },
    });
    const advanced =
      settings?.advancedSettings && typeof settings.advancedSettings === 'object'
        ? (settings.advancedSettings as Record<string, unknown>)
        : {};
    return advanced.coaAutoNumbering !== false;
  }

  async reparentEquityUnderLiabilities(companyId: string): Promise<boolean> {
    const equity = await prisma.account.findFirst({
      where: {
        companyId,
        deletedAt: null,
        parentId: null,
        OR: [
          { code: '3' },
          { code: '3000' },
          { arabicName: { contains: 'حقوق الملكية' } },
        ],
      },
      select: { id: true },
    });
    if (!equity) return false;

    const liabilities = await prisma.account.findFirst({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ code: '2' }, { arabicName: 'الالتزامات' }],
        NOT: { id: equity.id },
      },
      select: { id: true },
    });
    if (!liabilities) return false;

    await prisma.account.update({
      where: { id: equity.id },
      data: { parentId: liabilities.id },
    });
    await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
    return true;
  }

  private async countAccountMovements(companyId: string, accountId: string): Promise<number> {
    return prisma.journalEntryLine.count({
      where: {
        accountId,
        journalEntry: {
          companyId,
          deletedAt: null,
          isCancelled: false,
        },
      },
    });
  }

  private async assertUniqueAccountCode(
    companyId: string,
    code: string,
    exceptAccountId?: string
  ) {
    const clash = await prisma.account.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
        ...(exceptAccountId ? { id: { not: exceptAccountId } } : {}),
      },
      select: { id: true, arabicName: true },
    });
    if (clash) {
      throw new AppError(
        409,
        `رقم الحساب «${code}» مستخدم على حساب آخر (${clash.arabicName}). الحل: غيّر الرقم أو اترك الترقيم التلقائي يقترح رقماً جديداً.`
      );
    }
  }

  /** Soft-deleted rows still occupy @@unique([companyId, code]). Free the number. */
  private async vacateDeletedAccountCode(companyId: string, code: string) {
    const leftovers = await prisma.account.findMany({
      where: {
        companyId,
        code,
        OR: [{ deletedAt: { not: null } }, { isActive: false }],
      },
      select: { id: true, code: true },
    });

    for (const row of leftovers) {
      await prisma.account.update({
        where: { id: row.id },
        data: {
          code: retiredAccountCode(row.code, row.id),
          isActive: false,
          deletedAt: new Date(),
        },
      });
    }
  }

  /** A posting account with movements cannot become a parent. */
  private async assertParentCanReceiveChild(
    companyId: string,
    parentId: string | undefined | null
  ) {
    if (!parentId) return;

    const parent = await prisma.account.findFirst({
      where: { id: parentId, companyId, deletedAt: null },
      select: { id: true, code: true, arabicName: true },
    });
    if (!parent) {
      throw new AppError(
        400,
        'الحساب الأب غير موجود. الحل: حدّث دليل الحسابات ثم اختر الحساب الأب من جديد.'
      );
    }

    const movementCount = await this.countAccountMovements(companyId, parentId);
    if (movementCount === 0) return;

    throw new AppError(
      409,
      `لا يمكن إضافة حساب فرعي تحت ${accountLabel(parent)} لأن عليه ${movementCount} قيد/حركة. الحساب الذي عليه حركة يبقى تحليلياً ولا يتحول إلى أب. الحل: انقل حركاته من شاشة «نقل حركة حساب» إلى حساب فرعي جديد، أو أنشئ الحساب تحت أب آخر ليس عليه قيود.`
    );
  }

  async createAccount(companyId: string, data: CreateAccountData) {
    try {
      if (!data.allowParentWithMovements) {
        await this.assertParentCanReceiveChild(companyId, data.parentId);
      }

      const classified = resolveAccountClassification(data);
      let code = data.code?.trim() ?? '';
      if (!code) {
        if (!(await this.isCoaAutoNumbering(companyId))) {
          throw new AppError(
            400,
            'رقم الحساب مطلوب. الحل: فعّل الترقيم التلقائي من إعدادات الشجرة أو أدخل الرقم يدوياً.'
          );
        }
        code = await this.suggestNextAccountCode(companyId, data.parentId);
      }

      await this.assertUniqueAccountCode(companyId, code);
      await this.vacateDeletedAccountCode(companyId, code);

      let defaultCostCenterId = data.defaultCostCenterId ?? null;
      if (defaultCostCenterId) {
        const cc = await prisma.costCenter.findFirst({
          where: { id: defaultCostCenterId, companyId, isActive: true },
          select: { id: true },
        });
        if (!cc) {
          throw new AppError(
            400,
            'مركز التكلفة غير موجود. الحل: اختر مركزاً من الدليل أو اتركه فارغاً.'
          );
        }
      }

      const account = await prisma.account.create({
        data: {
          companyId,
          code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          accountType: data.accountType,
          parentId: data.parentId,
          accountSide: classified.accountSide,
          accountNature: classified.accountNature,
          statementType: classified.statementType,
          costCenterRequired: classified.costCenterRequired,
          requiresCostCenter: classified.requiresCostCenter,
          defaultCostCenterId,
          warning: data.warning,
          budget: data.budget ? new Decimal(data.budget) : null,
          currencyCode: data.currencyCode,
        },
        include: {
          parent: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          children: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, accountId: account.id }, 'Account created');
      await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
      return account;
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ error, companyId, data }, 'Error creating account');
      }
      throw error;
    }
  }

  /**
   * Get account by ID
   */
  async getAccountById(companyId: string, accountId: string) {
    try {
      const account = await prisma.account.findFirst({
        where: {
          id: accountId,
          companyId,
        },
        include: {
          parent: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          children: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
        },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      return account;
    } catch (error) {
      logger.error({ error, companyId, accountId }, 'Error getting account');
      throw error;
    }
  }

  /**
   * List accounts with pagination and filters
   */
  async listAccounts(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      accountType?: string;
      parentId?: string;
      isActive?: boolean;
      leafOnly?: boolean;
      statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 50, 200);
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,
        deletedAt: null,
      };

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { code: { contains: options.search } },
        ];
      }

      if (options.accountType) {
        where.accountType = options.accountType;
      }

      if (options.statementType) {
        where.statementType = options.statementType;
      }

      if (options.parentId !== undefined) {
        where.parentId = options.parentId;
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.leafOnly) {
        where.children = { none: { deletedAt: null } };
      }

      const [accounts, total] = await Promise.all([
        prisma.account.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ code: 'asc' }],
          include: {
            parent: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            _count: { select: { children: { where: { deletedAt: null } } } },
          },
        }),
        prisma.account.count({ where }),
      ]);

      return {
        accounts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing accounts');
      throw error;
    }
  }

  /**
   * Update account
   */
  async updateAccount(
    companyId: string,
    accountId: string,
    data: UpdateAccountData
  ) {
    try {
      // Verify account exists and belongs to company
      const existing = await prisma.account.findFirst({
        where: { id: accountId, companyId },
      });

      if (!existing) {
        throw new AppError(404, 'الحساب غير موجود. الحل: حدّث دليل الحسابات ثم أعد المحاولة.');
      }

      if (data.parentId !== undefined && data.parentId !== existing.parentId) {
        await this.assertParentCanReceiveChild(companyId, data.parentId);
      }
      if (data.code !== undefined && data.code.trim() && data.code !== existing.code) {
        await this.assertUniqueAccountCode(companyId, data.code.trim(), accountId);
        await this.vacateDeletedAccountCode(companyId, data.code.trim());
      }

      const updateData: any = {};

      if (data.code !== undefined) updateData.code = data.code;
      if (data.arabicName !== undefined)
        updateData.arabicName = data.arabicName;
      if (data.englishName !== undefined)
        updateData.englishName = data.englishName;
      if (data.accountType !== undefined)
        updateData.accountType = data.accountType;
      if (data.parentId !== undefined) updateData.parentId = data.parentId;
      if (data.accountSide !== undefined || data.accountNature !== undefined) {
        const classified = resolveAccountClassification({
          accountNature: data.accountNature,
          accountSide: data.accountSide,
        });
        updateData.accountSide = classified.accountSide;
        updateData.accountNature = classified.accountNature;
      }
      if (data.statementType !== undefined) {
        updateData.statementType = data.statementType;
      }
      if (data.costCenterRequired !== undefined || data.requiresCostCenter !== undefined) {
        const classified = resolveAccountClassification({
          requiresCostCenter: data.requiresCostCenter,
          costCenterRequired: data.costCenterRequired,
        });
        updateData.costCenterRequired = classified.costCenterRequired;
        updateData.requiresCostCenter = classified.requiresCostCenter;
      }
      if (data.warning !== undefined) updateData.warning = data.warning;
      if (data.budget !== undefined)
        updateData.budget = data.budget ? new Decimal(data.budget) : null;
      if (data.currencyCode !== undefined)
        updateData.currencyCode = data.currencyCode;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.defaultCostCenterId !== undefined) {
        if (data.defaultCostCenterId) {
          const cc = await prisma.costCenter.findFirst({
            where: { id: data.defaultCostCenterId, companyId, isActive: true },
            select: { id: true },
          });
          if (!cc) {
          throw new AppError(
            400,
            'مركز التكلفة غير موجود. الحل: اختر مركزاً من الدليل أو اتركه فارغاً.'
          );
        }
        }
        updateData.defaultCostCenterId = data.defaultCostCenterId || null;
      }

      const account = await prisma.account.update({
        where: { id: accountId, companyId },
        data: updateData,
        include: {
          parent: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, accountId }, 'Account updated');
      await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
      return account;
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ error, companyId, accountId, data }, 'Error updating account');
      }
      throw error;
    }
  }

  /**
   * Delete account (soft delete)
   */
  async deleteAccount(companyId: string, accountId: string) {
    try {
      const account = await prisma.account.findFirst({
        where: { id: accountId, companyId, deletedAt: null },
      });

      if (!account) {
        throw new AppError(404, 'الحساب غير موجود. الحل: حدّث دليل الحسابات ثم أعد المحاولة.');
      }

      const balanceMap = await this.getPostedBalanceMap(companyId);

      const childrenCount = await prisma.account.count({
        where: { parentId: accountId, deletedAt: null },
      });

      if (childrenCount > 0) {
        throw new AppError(
          400,
          `لا يمكن حذف ${accountLabel(account)} لأن تحته حسابات فرعية. الحل: احذف أو انقل الحسابات الفرعية أولاً ثم احذف هذا الحساب.`
        );
      }

      const postedLineCount = await prisma.journalEntryLine.count({
        where: {
          accountId,
          journalEntry: {
            companyId,
            isPosted: true,
            isCancelled: false,
            deletedAt: null,
          },
        },
      });

      const netBalance = balanceMap.get(accountId) ?? 0;

      if (postedLineCount > 0 || Math.abs(netBalance) > 0.0001) {
        throw new AppError(
          409,
          `لا يمكن حذف ${accountLabel(account)} لأن عليه حركات مالية. الحل: انقل الحركات من شاشة «نقل حركة حساب» أو ألغِ القيود أولاً ثم احذف.`
        );
      }

      try {
        await prisma.account.delete({ where: { id: accountId } });
      } catch (error) {
        const blocked =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2003' || error.code === 'P2014');
        if (!blocked) {
          throw error;
        }
        await prisma.account.update({
          where: { id: accountId },
          data: {
            isActive: false,
            deletedAt: new Date(),
            code: retiredAccountCode(account.code, accountId),
          },
        });
      }

      logger.info({ companyId, accountId }, 'Account deleted');
      await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
      return { success: true };
    } catch (error) {
      if (!(error instanceof AppError)) {
        logger.error({ error, companyId, accountId }, 'Error deleting account');
      }
      throw error;
    }
  }

  /**
   * Full recursive chart-of-accounts tree for the tenant.
   */
  async getAccountHierarchy(
    companyId: string,
    parentId?: string
  ): Promise<AccountHierarchyNode[]> {
    try {
      await this.reparentEquityUnderLiabilities(companyId);
      const accounts = await getTenantCached(tenantCacheKeys.coaTree(companyId), () =>
        prisma.account.findMany({
          where: {
            companyId,
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
            code: true,
            arabicName: true,
            englishName: true,
            accountType: true,
            accountSide: true,
            parentId: true,
            defaultCostCenterId: true,
            costCenterRequired: true,
          },
          orderBy: [{ code: 'asc' }],
        })
      );

      const balanceMap = await this.getPostedBalanceMap(companyId);
      const tree = buildAccountHierarchyTree(accounts, balanceMap);
      if (parentId) {
        return findHierarchySubtree(tree, parentId) ?? [];
      }
      return tree;
    } catch (error) {
      logger.error({ error, companyId, parentId }, 'Error getting account hierarchy');
      throw error;
    }
  }
}

export const accountService = new AccountService();
