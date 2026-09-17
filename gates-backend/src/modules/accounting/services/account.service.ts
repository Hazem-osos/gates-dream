import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import {
  invalidateTenantCache,
  tenantCacheKeys,
} from '../../../shared/cache/tenant-metadata-cache';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  buildAccountHierarchyTree,
  findHierarchySubtree,
  type AccountHierarchyNode,
} from '../utils/build-account-hierarchy';
import {
  assertNotCashPostingParent,
  ensureBankFolderIsHeader,
  ensureCashMainPosting,
  ensureSafeForCashAccount,
} from './cash-safe-sync';
import { resolveCreateAccountKind, statementTypeFromAccountType } from '../utils/account-kind';
import {
  assertUniqueAccountName,
  normalizeAccountName,
} from '../utils/account-name-uniqueness';

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
  accountKind?: 'HEADER' | 'POSTING';
  /** Party cards may hang leaves under AR/AP control even if it has history. */
  allowParentWithMovements?: boolean;
}

function resolveAccountClassification(data: {
  accountNature?: 'DEBIT' | 'CREDIT';
  accountSide?: string | null;
  accountType?: string | null;
  statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
  requiresCostCenter?: boolean;
  costCenterRequired?: string | null;
}) {
  const accountNature: 'DEBIT' | 'CREDIT' =
    data.accountNature ?? (data.accountSide === 'دائن' ? 'CREDIT' : 'DEBIT');
  const accountSide = data.accountSide ?? (accountNature === 'CREDIT' ? 'دائن' : 'مدين');
  const statementType: 'BALANCE_SHEET' | 'INCOME_STATEMENT' =
    data.statementType ?? statementTypeFromAccountType(data.accountType) ?? 'BALANCE_SHEET';
  const costCenterRequired =
    data.costCenterRequired ?? (data.requiresCostCenter ? 'إجباري' : 'اختياري');
  const requiresCostCenter = costCenterRequired === 'إجباري';
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
  parentId?: string | null;
}

export class AccountService {
  /**
   * Suggest the next account code under a parent (e.g. parent `11` → `111`, `112`, …).
   */
  async suggestNextAccountCode(companyId: string, parentId?: string | null): Promise<string> {
    if (!parentId) {
      const roots = await prisma.account.findMany({
        where: { companyId, parentId: null },
        select: { code: true },
      });
      const nums = roots
        .map((r) => parseInt(r.code, 10))
        .filter((n) => !Number.isNaN(n));
      let next = nums.length ? Math.max(...nums) + 1 : 1;
      const used = new Set(roots.map((r) => r.code));
      while (used.has(String(next))) next += 1;
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
      where: { companyId, parentId },
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    if (siblings.length === 0) {
      return `${prefix}1`;
    }

    let maxSuffix = 0;
    const used = new Set(siblings.map((row) => row.code));
    for (const row of siblings) {
      if (!row.code.startsWith(prefix) || row.code.length <= prefix.length) continue;
      const suffix = row.code.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) continue;
      const n = parseInt(suffix, 10);
      if (!Number.isNaN(n)) {
        maxSuffix = Math.max(maxSuffix, n);
      }
    }

    let candidate = maxSuffix > 0 ? `${prefix}${maxSuffix + 1}` : `${prefix}1`;
    let guard = 0;
    while (used.has(candidate) && guard < 50) {
      const suffix = candidate.slice(prefix.length);
      const n = parseInt(suffix, 10);
      candidate = `${prefix}${Number.isNaN(n) ? maxSuffix + 1 + guard : n + 1}`;
      guard += 1;
    }
    return candidate;
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

  private async assertNoParentCycle(
    companyId: string,
    accountId: string,
    parentId: string | undefined | null
  ) {
    if (!parentId) return;
    if (parentId === accountId) {
      throw new AppError(400, 'لا يمكن أن يكون الحساب أباً لنفسه.');
    }

    let current: string | null = parentId;
    const seen = new Set<string>([accountId]);
    while (current) {
      if (seen.has(current)) {
        throw new AppError(
          400,
          'لا يمكن جعل الحساب فرعاً تحت أحد أبنائه. هذا يكسر شجرة الدليل.'
        );
      }
      seen.add(current);
      const row = await prisma.account.findFirst({
        where: { id: current, companyId, deletedAt: null },
        select: { parentId: true },
      });
      current = row?.parentId ?? null;
    }
  }

  /** A posting account with movements cannot become a parent. */
  private async assertParentCanReceiveChild(
    companyId: string,
    parentId: string | undefined | null
  ) {
    if (!parentId) return;

    let parent = await prisma.account.findFirst({
      where: { id: parentId, companyId, deletedAt: null },
      select: { id: true, code: true, arabicName: true, accountKind: true },
    });
    if (!parent) {
      throw new AppError(
        400,
        'الحساب الأب غير موجود. الحل: حدّث دليل الحسابات ثم اختر الحساب الأب من جديد.'
      );
    }

    await ensureBankFolderIsHeader(companyId);
    if (parent.code === '1112') {
      parent = { ...parent, accountKind: 'HEADER' as const };
    }

    await assertNotCashPostingParent(companyId, parentId, parent);

    if (parent.accountKind === 'POSTING') {
      throw new AppError(
        409,
        `لا يمكن إضافة فرعي تحت ${accountLabel(parent)} لأنه حساب حركة. حساب الحركة يُترحَّل عليه ولا يُفرَّع منه.`
      );
    }
  }

  private async collectSubtreeAccounts(
    companyId: string,
    rootId: string
  ): Promise<Array<{ id: string; code: string }>> {
    const all = await prisma.account.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, code: true, parentId: true },
    });
    const childrenOf = new Map<string, typeof all>();
    for (const row of all) {
      if (!row.parentId || row.parentId === row.id) continue;
      const bucket = childrenOf.get(row.parentId) ?? [];
      bucket.push(row);
      childrenOf.set(row.parentId, bucket);
    }
    const out: Array<{ id: string; code: string }> = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const row = all.find((account) => account.id === id);
      if (!row) return;
      out.push({ id: row.id, code: row.code });
      for (const child of childrenOf.get(id) ?? []) walk(child.id);
    };
    walk(rootId);
    return out;
  }

  private rewriteSubtreeCode(oldCode: string, oldPrefix: string, newPrefix: string): string {
    if (oldCode === oldPrefix) return newPrefix;
    if (oldPrefix && oldCode.startsWith(oldPrefix)) {
      return `${newPrefix}${oldCode.slice(oldPrefix.length)}`;
    }
    return `${newPrefix}${oldCode}`;
  }

  private async vacateDeletedAccountCodeInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    code: string
  ) {
    const leftovers = await tx.account.findMany({
      where: {
        companyId,
        code,
        OR: [{ deletedAt: { not: null } }, { isActive: false }],
      },
      select: { id: true, code: true },
    });
    for (const row of leftovers) {
      await tx.account.update({
        where: { id: row.id },
        data: {
          code: retiredAccountCode(row.code, row.id),
          isActive: false,
          deletedAt: new Date(),
        },
      });
    }
  }

  /**
   * Move an account under a new parent and rewrite hierarchical codes for
   * the whole subtree. Journal lines keep `accountId`, so operations show
   * the new code on the next read.
   */
  private async reparentAccountWithCodeCascade(
    companyId: string,
    accountId: string,
    oldRootCode: string,
    newRootCode: string,
    newParentId: string | null | undefined
  ) {
    const subtree = await this.collectSubtreeAccounts(companyId, accountId);
    if (subtree.length === 0) {
      throw new AppError(404, 'الحساب غير موجود. الحل: حدّث دليل الحسابات ثم أعد المحاولة.');
    }

    await prisma.$transaction(
      async (tx) => {
        for (const row of subtree) {
          const temp = `_rp_${row.id.replace(/-/g, '')}`;
          await this.vacateDeletedAccountCodeInTx(tx, companyId, temp);
          await tx.account.update({
            where: { id: row.id },
            data: {
              code: temp,
              ...(row.id === accountId ? { parentId: newParentId ?? null } : {}),
            },
          });
        }

        const others = await tx.account.findMany({
          where: {
            companyId,
            deletedAt: null,
            id: { notIn: subtree.map((row) => row.id) },
          },
          select: { code: true },
        });
        const used = new Set(others.map((row) => row.code));

        for (const row of subtree) {
          const next = this.rewriteSubtreeCode(row.code, oldRootCode, newRootCode);
          if (used.has(next)) {
            throw new AppError(
              409,
              `رقم الحساب «${next}» مستخدم على حساب آخر. الحل: غيّر الرقم أو اترك الترقيم التلقائي يقترح رقماً جديداً.`
            );
          }
          used.add(next);
          await this.vacateDeletedAccountCodeInTx(tx, companyId, next);
          await tx.account.update({
            where: { id: row.id },
            data: { code: next },
          });
          if (row.code !== next && row.code.length <= 20 && next.length <= 20) {
            await tx.glPostingViolation.updateMany({
              where: { companyId, accountCode: row.code },
              data: { accountCode: next },
            });
          }
        }
      },
      { timeout: 30_000 }
    );
  }

  async createAccount(companyId: string, data: CreateAccountData) {
    try {
      const accountKind = resolveCreateAccountKind({
        parentId: data.parentId,
        accountKind: data.accountKind,
      });
      if (data.allowParentWithMovements && data.parentId) {
        const parent = await prisma.account.findFirst({
          where: { id: data.parentId, companyId, deletedAt: null },
          select: { id: true, code: true, arabicName: true, accountKind: true },
        });
        if (!parent) {
          throw new AppError(400, 'الحساب الأب غير موجود. الحل: حدّث دليل الحسابات ثم اختر الحساب الأب من جديد.');
        }
        if (parent.accountKind === 'POSTING') {
          await prisma.account.update({
            where: { id: parent.id },
            data: { accountKind: 'HEADER' },
          });
        }
      } else {
        await this.assertParentCanReceiveChild(companyId, data.parentId);
      }

      let inheritNature: 'DEBIT' | 'CREDIT' | undefined;
      let inheritSide: string | undefined;
      let inheritStatement: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | undefined;
      if (data.parentId && !data.accountNature && !data.accountSide) {
        const parent = await prisma.account.findFirst({
          where: { id: data.parentId, companyId, deletedAt: null },
          select: { accountNature: true, accountSide: true, statementType: true },
        });
        inheritNature = parent?.accountNature ?? undefined;
        inheritSide = parent?.accountSide ?? undefined;
        inheritStatement = parent?.statementType ?? undefined;
      }

      const classified = resolveAccountClassification({
        ...data,
        accountNature: data.accountNature ?? inheritNature,
        accountSide: data.accountSide ?? inheritSide,
        accountType: data.accountType,
        statementType: data.statementType ?? inheritStatement,
      });
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

      await this.vacateDeletedAccountCode(companyId, code);
      await this.assertUniqueAccountCode(companyId, code);
      const arabicName = normalizeAccountName(data.arabicName);
      await assertUniqueAccountName(companyId, arabicName);

      let defaultCostCenterId = data.defaultCostCenterId ?? null;
      if (defaultCostCenterId) {
        const cc = await prisma.costCenter.findFirst({
          where: { id: defaultCostCenterId, companyId, isActive: true },
          select: { id: true, code: true, arabicName: true, costCenterKind: true },
        });
        if (!cc) {
          throw new AppError(
            400,
            'مركز التكلفة غير موجود. الحل: اختر مركزاً من الدليل أو اتركه فارغاً.'
          );
        }
        if (cc.costCenterKind === 'HEADER') {
          throw new AppError(
            400,
            `المركز ${cc.code} (${cc.arabicName}) رئيسي/رئيسي فرعي. اربط الحساب بمركز حركة.`
          );
        }
      }

      const account = await prisma.account.create({
        data: {
          companyId,
          code,
          arabicName,
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
          accountKind,
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
      await ensureSafeForCashAccount(companyId, {
        id: account.id,
        code: account.code,
        arabicName: account.arabicName,
        parentCode: account.parent?.code ?? null,
        accountKind: account.accountKind,
      });
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
          deletedAt: null,
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
        throw new AppError(404, 'الحساب غير موجود. الحل: حدّث دليل الحسابات ثم أعد المحاولة.');
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
      headerOnly?: boolean;
      statementType?: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
    }
  ) {
    try {
      await ensureBankFolderIsHeader(companyId);
      const page = options.page || 1;
      const limit = Math.min(options.limit || 50, 50_000);
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

      where.isActive = options.isActive !== undefined ? options.isActive : true;

      if (options.leafOnly) {
        where.accountKind = 'POSTING';
        where.children = { none: { deletedAt: null } };
      }
      if (options.headerOnly) {
        where.accountKind = 'HEADER';
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
        where: { id: accountId, companyId, deletedAt: null },
      });

      if (!existing) {
        throw new AppError(404, 'الحساب غير موجود. الحل: حدّث دليل الحسابات ثم أعد المحاولة.');
      }

      const parentChanging =
        data.parentId !== undefined && data.parentId !== existing.parentId;
      const nextArabicName =
        data.arabicName !== undefined
          ? normalizeAccountName(data.arabicName)
          : existing.arabicName;
      if (
        data.arabicName !== undefined &&
        nextArabicName !== normalizeAccountName(existing.arabicName)
      ) {
        await assertUniqueAccountName(companyId, nextArabicName, {
          exceptAccountId: accountId,
        });
      }
      if (parentChanging) {
        await this.assertNoParentCycle(companyId, accountId, data.parentId);
        await this.assertParentCanReceiveChild(companyId, data.parentId);

        const autoNumbering = await this.isCoaAutoNumbering(companyId);
        const requested = data.code?.trim() ?? '';
        const shouldSuggest = autoNumbering || !requested || requested === existing.code;
        const nextCode = shouldSuggest
          ? await this.suggestNextAccountCode(companyId, data.parentId)
          : requested;

        if (!shouldSuggest) {
          await this.assertUniqueAccountCode(companyId, nextCode, accountId);
        }

        await this.reparentAccountWithCodeCascade(
          companyId,
          accountId,
          existing.code,
          nextCode,
          data.parentId
        );
      }
      if (
        !parentChanging &&
        data.code !== undefined &&
        data.code.trim() &&
        data.code !== existing.code
      ) {
        await this.assertUniqueAccountCode(companyId, data.code.trim(), accountId);
        await this.vacateDeletedAccountCode(companyId, data.code.trim());
      }

      const updateData: any = {};

      if (data.code !== undefined && !parentChanging) updateData.code = data.code.trim();
      if (data.arabicName !== undefined) updateData.arabicName = nextArabicName;
      if (data.englishName !== undefined)
        updateData.englishName = data.englishName;
      if (data.accountType !== undefined)
        updateData.accountType = data.accountType;
      if (data.parentId !== undefined) updateData.parentId = data.parentId;
      if (data.accountNature !== undefined || (data.accountSide !== undefined && data.accountSide !== null)) {
        const classified = resolveAccountClassification({
          accountNature: data.accountNature,
          accountSide: data.accountSide,
        });
        updateData.accountSide = classified.accountSide;
        updateData.accountNature = classified.accountNature;
      }
      if (data.statementType !== undefined) {
        updateData.statementType = data.statementType;
      } else if (data.accountType !== undefined) {
        const derivedStatement = statementTypeFromAccountType(data.accountType);
        if (derivedStatement) updateData.statementType = derivedStatement;
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
      if (data.accountKind !== undefined) {
        if (data.accountKind === 'POSTING') {
          const childCount = await prisma.account.count({
            where: { parentId: accountId, companyId, deletedAt: null },
          });
          if (childCount > 0) {
            throw new AppError(
              409,
              'لا يمكن تحويل الحساب إلى حركة لأن تحته حسابات فرعية. احذف أو انقل الفرعي أولاً.'
            );
          }
        }
        updateData.accountKind = data.accountKind;
      }
      if (data.defaultCostCenterId !== undefined) {
        if (data.defaultCostCenterId) {
          const cc = await prisma.costCenter.findFirst({
            where: { id: data.defaultCostCenterId, companyId, isActive: true },
            select: { id: true, code: true, arabicName: true, costCenterKind: true },
          });
          if (!cc) {
            throw new AppError(
              400,
              'مركز التكلفة غير موجود. الحل: اختر مركزاً من الدليل أو اتركه فارغاً.'
            );
          }
          if (cc.costCenterKind === 'HEADER') {
            throw new AppError(
              400,
              `المركز ${cc.code} (${cc.arabicName}) رئيسي/رئيسي فرعي. اربط الحساب بمركز حركة.`
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

      await ensureSafeForCashAccount(companyId, {
        id: account.id,
        code: account.code,
        arabicName: account.arabicName,
        parentCode: account.parent?.code ?? null,
        accountKind: account.accountKind,
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
   * Delete account. Unused accounts are removed. Cancelled-only history stays visible as ملغي.
   */
  async deleteAccount(companyId: string, accountId: string): Promise<{ success: true; cancelled: boolean }> {
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

      const [liveLineCount, anyLineCount] = await Promise.all([
        prisma.journalEntryLine.count({
          where: {
            accountId,
            journalEntry: {
              companyId,
              isCancelled: false,
              deletedAt: null,
            },
          },
        }),
        prisma.journalEntryLine.count({
          where: {
            accountId,
            journalEntry: { companyId },
          },
        }),
      ]);

      const netBalance = balanceMap.get(accountId) ?? 0;

      if (liveLineCount > 0 || Math.abs(netBalance) > 0.0001) {
        throw new AppError(
          409,
          `لا يمكن حذف ${accountLabel(account)} لأن عليه حركات مالية. الحل: انقل الحركات من شاشة «نقل حركة حساب» أو ألغِ القيود أولاً ثم احذف.`
        );
      }

      if (anyLineCount > 0) {
        await prisma.account.update({
          where: { id: accountId },
          data: { isActive: false },
        });
        logger.info({ companyId, accountId }, 'Account cancelled in chart');
        await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
        return { success: true, cancelled: true };
      }

      await prisma.accountPeriodBalance.deleteMany({
        where: { companyId, accountId },
      });
      await prisma.safe.updateMany({
        where: { companyId, glAccountId: accountId },
        data: { glAccountId: null },
      });

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
          data: { isActive: false },
        });
        logger.info({ companyId, accountId }, 'Account cancelled because related rows remain');
        await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
        return { success: true, cancelled: true };
      }

      logger.info({ companyId, accountId }, 'Account deleted');
      await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
      return { success: true, cancelled: false };
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
      await ensureBankFolderIsHeader(companyId);
      await ensureCashMainPosting(companyId);
      const accounts = await prisma.account.findMany({
        where: {
          companyId,
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
          accountKind: true,
          isActive: true,
        },
        orderBy: [{ code: 'asc' }],
      });

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
