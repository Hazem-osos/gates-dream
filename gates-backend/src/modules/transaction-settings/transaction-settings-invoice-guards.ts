import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import type { TransactionSettingsDto } from './transaction-settings.service';

export async function assertAllowedLinePrices(params: {
  companyId: string;
  settings: TransactionSettingsDto;
  lines: Array<{ itemId: string; price: number }>;
}): Promise<void> {
  if (params.settings.allowItemPriceOverride) return;
  const items = await prisma.item.findMany({
    where: {
      companyId: params.companyId,
      id: { in: [...new Set(params.lines.map((l) => l.itemId))] },
    },
    select: {
      id: true,
      arabicName: true,
      consumerPrice: true,
      retailPrice: true,
      priceRetail: true,
    },
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const line of params.lines) {
    const item = byId.get(line.itemId);
    if (!item) continue;
    const catalog =
      Number(item.consumerPrice || 0) ||
      Number(item.retailPrice || 0) ||
      Number(item.priceRetail || 0);
    if (catalog > 0 && Math.abs(line.price - catalog) > 0.02) {
      throw new AppError(
        400,
        `لا يمكن تعديل سعر الصنف «${item.arabicName ?? line.itemId}» — غير مسموح في إعدادات الفاتورة`
      );
    }
  }
}
