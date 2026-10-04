import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import {
  getInventorySystem,
  type InventorySystem,
} from './inventory-system';
import prisma from '../../../shared/database/prisma';
import { resolveStockGlAccounts } from '../services/stock-movement-gl.service';
import type { StockGlPostingContext } from '../services/stock-movement-gl.service';

export function isStockGlConfigurationError(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;
  if (error.statusCode !== 422) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('not configured') ||
    msg.includes('gl account') ||
    msg.includes('حساب') ||
    msg.includes('غير مضبوط') ||
    msg.includes('عرّف')
  );
}

export const STOCK_GL_SKIPPED_AR =
  'تم ترحيل المخزون. لم يُنشأ قيد محاسبي (نظام جرد دوري أو حسابات غير مكتملة). راجع إعدادات حسابات المخزون إن احتجت قيدًا.';

export const PERPETUAL_GL_CONTEXT_AR =
  'نظام الجرد المستمر: لا يمكن ترحيل حركة المخزون بدون سياق ترحيل محاسبي. أعد المحاولة من شاشة العملية أو راجع صلاحيات الترحيل.';

export const PERPETUAL_GL_ACCOUNTS_AR =
  'نظام الجرد المستمر: عرّف حساب المخزون وحساب الصرف/التسوية (والحساب المقابل لإذن الإضافة) في إعدادات الشركة، وربط حساب المخزن في بطاقة المخزن، ثم أعد الترحيل.';

/**
 * Periodic inventory: post stock even when GL accounts are missing (with warning).
 * Perpetual inventory: GL configuration errors abort the whole transaction.
 */
export async function runStockGlPostingOptional(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run();
    return false;
  } catch (error) {
    if (!isStockGlConfigurationError(error)) {
      throw error;
    }
    logger.warn(
      { message: error instanceof Error ? error.message : String(error) },
      'Stock GL posting skipped — configure inventory accounts in company settings'
    );
    return true;
  }
}

export async function runCompanyStockGlPosting(
  system: InventorySystem,
  run: () => Promise<unknown>
): Promise<boolean> {
  if (system === 'PERPETUAL') {
    try {
      await run();
    } catch (error) {
      if (isStockGlConfigurationError(error)) {
        throw new AppError(422, `${PERPETUAL_GL_ACCOUNTS_AR} (${error instanceof Error ? error.message : String(error)})`);
      }
      throw error;
    }
    return false;
  }
  return runStockGlPostingOptional(run);
}

/**
 * Preflight before store-document post: perpetual companies must have GL context
 * and resolvable inventory / counter accounts.
 */
export async function ensurePerpetualInventoryGlReady(
  companyId: string,
  glCtx: StockGlPostingContext | undefined,
  warehouseId?: string | null,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<InventorySystem> {
  const system = await getInventorySystem(companyId);
  if (system !== 'PERPETUAL') return system;
  if (!glCtx) {
    throw new AppError(422, PERPETUAL_GL_CONTEXT_AR);
  }
  try {
    await resolveStockGlAccounts(companyId, warehouseId, db);
  } catch (error) {
    if (isStockGlConfigurationError(error)) {
      throw new AppError(422, `${PERPETUAL_GL_ACCOUNTS_AR} (${error instanceof Error ? error.message : String(error)})`);
    }
    throw error;
  }
  return system;
}
