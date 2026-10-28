import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import type { CategoryBody } from '../schemas/fixed-asset.schemas';
import { assertPostingAccounts } from './fixed-asset-refs';

const ACCOUNT_SELECT = { id: true, code: true, arabicName: true } as const;

export class FixedAssetCategoryService {
  async list(companyId: string) {
    const rows = await prisma.fixedAssetCategory.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
      include: { _count: { select: { assets: true, children: true } } },
      take: 1000,
    });
    const accountIds = new Set<string>();
    for (const row of rows) {
      for (const id of [
        row.assetAccountId,
        row.accumulatedDepreciationAccountId,
        row.depreciationExpenseAccountId,
        row.disposalGainAccountId,
        row.disposalLossAccountId,
      ]) {
        if (id) accountIds.add(id);
      }
    }
    const accounts = accountIds.size
      ? await prisma.account.findMany({
          where: { companyId, id: { in: [...accountIds] } },
          select: ACCOUNT_SELECT,
        })
      : [];
    const byId = new Map(accounts.map((a) => [a.id, a]));
    return rows.map((row) => ({
      ...row,
      assetAccount: row.assetAccountId ? byId.get(row.assetAccountId) ?? null : null,
      accumulatedDepreciationAccount: row.accumulatedDepreciationAccountId
        ? byId.get(row.accumulatedDepreciationAccountId) ?? null
        : null,
      depreciationExpenseAccount: row.depreciationExpenseAccountId
        ? byId.get(row.depreciationExpenseAccountId) ?? null
        : null,
      disposalGainAccount: row.disposalGainAccountId ? byId.get(row.disposalGainAccountId) ?? null : null,
      disposalLossAccount: row.disposalLossAccountId ? byId.get(row.disposalLossAccountId) ?? null : null,
    }));
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.fixedAssetCategory.findFirst({ where: { id, companyId } });
    if (!row) throw new AppError(404, 'فئة الأصول غير موجودة');
    return row;
  }

  private async validate(companyId: string, body: CategoryBody, selfId?: string) {
    await assertPostingAccounts(prisma, companyId, [
      body.assetAccountId,
      body.accumulatedDepreciationAccountId,
      body.depreciationExpenseAccountId,
      body.disposalGainAccountId,
      body.disposalLossAccountId,
    ]);
    if (body.parentId) {
      if (body.parentId === selfId) throw new AppError(422, 'لا يمكن أن تكون الفئة أبًا لنفسها');
      const parent = await prisma.fixedAssetCategory.findFirst({
        where: { id: body.parentId, companyId },
        select: { id: true, parentId: true },
      });
      if (!parent) throw new AppError(422, 'الفئة الأب غير موجودة');
      // Walk up to refuse a cycle (parent chain must not pass through this category).
      let cursor: string | null = parent.parentId;
      for (let depth = 0; cursor && depth < 50; depth++) {
        if (cursor === selfId) throw new AppError(422, 'هذا الاختيار يصنع حلقة في شجرة الفئات');
        const next: { parentId: string | null } | null = await prisma.fixedAssetCategory.findFirst({
          where: { id: cursor, companyId },
          select: { parentId: true },
        });
        cursor = next?.parentId ?? null;
      }
    }
  }

  private data(body: CategoryBody) {
    return {
      code: body.code,
      arabicName: body.arabicName,
      englishName: body.englishName ?? null,
      parentId: body.parentId ?? null,
      depreciationMethod: body.depreciationMethod,
      usefulLifeMonths: body.usefulLifeMonths ?? null,
      decliningRate:
        body.depreciationMethod === 'DECLINING_BALANCE' && body.decliningRate != null
          ? new Decimal(body.decliningRate)
          : null,
      salvagePercent: new Decimal(body.salvagePercent ?? 0),
      assetAccountId: body.assetAccountId,
      accumulatedDepreciationAccountId: body.accumulatedDepreciationAccountId,
      depreciationExpenseAccountId: body.depreciationExpenseAccountId,
      disposalGainAccountId: body.disposalGainAccountId ?? null,
      disposalLossAccountId: body.disposalLossAccountId ?? null,
      isActive: body.isActive,
    };
  }

  async create(companyId: string, body: CategoryBody) {
    await this.validate(companyId, body);
    return prisma.fixedAssetCategory.create({ data: { companyId, ...this.data(body) } });
  }

  /**
   * Category changes only affect assets created afterwards: every asset keeps
   * its own copy of the accounts and estimates, so posted history never moves.
   */
  async update(companyId: string, id: string, body: CategoryBody) {
    await this.getById(companyId, id);
    await this.validate(companyId, body, id);
    const { count } = await prisma.fixedAssetCategory.updateMany({
      where: { id, companyId },
      data: this.data(body),
    });
    if (count !== 1) throw new AppError(404, 'فئة الأصول غير موجودة');
    return this.getById(companyId, id);
  }

  async remove(companyId: string, id: string) {
    await this.getById(companyId, id);
    const [assets, children] = await Promise.all([
      prisma.fixedAsset.count({ where: { companyId, categoryId: id } }),
      prisma.fixedAssetCategory.count({ where: { companyId, parentId: id } }),
    ]);
    if (assets > 0) throw new AppError(409, 'لا يمكن حذف فئة عليها أصول');
    if (children > 0) throw new AppError(409, 'لا يمكن حذف فئة لها فئات فرعية');
    await prisma.fixedAssetCategory.deleteMany({ where: { id, companyId } });
    return { id };
  }
}

export const fixedAssetCategoryService = new FixedAssetCategoryService();
