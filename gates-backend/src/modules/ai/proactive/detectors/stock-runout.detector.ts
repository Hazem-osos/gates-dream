import { InsightCategory, InsightSeverity } from '@prisma/client';
import { isoDate, money, type AnomalyDetector, type DetectorFinding } from '../detector.types';

export type StockItemSnapshot = {
  itemId: string;
  itemName: string;
  quantityOnHand: number;
  soldLast30Days: number;
};

export type StockRunoutPorts = {
  loadItems: (companyId: string, asOf: Date) => Promise<StockItemSnapshot[]>;
};

const WINDOW_DAYS = 30;
const COVER_DAYS = 7;

export function daysOfCover(quantityOnHand: number, soldLast30Days: number): number | null {
  const avgDailySales = money(soldLast30Days) / WINDOW_DAYS;
  if (avgDailySales <= 0) return null;
  return money(quantityOnHand) / avgDailySales;
}

export class StockRunoutDetector implements AnomalyDetector {
  readonly name = 'StockRunoutDetector';

  constructor(private readonly ports: StockRunoutPorts) {}

  async detect(ctx: { companyId: string; asOf: Date }): Promise<DetectorFinding[]> {
    const items = await this.ports.loadItems(ctx.companyId, ctx.asOf);
    const atRisk = items
      .map((item) => {
        const cover = daysOfCover(item.quantityOnHand, item.soldLast30Days);
        return cover == null
          ? null
          : {
              ...item,
              avgDailySales: money(item.soldLast30Days / WINDOW_DAYS),
              daysOfCover: money(cover),
            };
      })
      .filter((row): row is NonNullable<typeof row> => {
        if (!row) return false;
        return row.daysOfCover <= COVER_DAYS;
      })
      .sort((a, b) => a.daysOfCover - b.daysOfCover)
      .slice(0, 20);

    if (!atRisk.length) return [];

    const worst = atRisk[0];
    return [
      {
        category: InsightCategory.STOCK_RUNOUT,
        severity: InsightSeverity.WARNING,
        title: `نفاذ مخزون متوقع: ${atRisk.length} أصناف تغطي أقل من ${COVER_DAYS} أيام`,
        fallbackSummary: `الصنف «${worst.itemName}» يغطي حوالي ${worst.daysOfCover} يوم بمعدل بيع ${worst.avgDailySales} يومياً. يُوصى بإصدار أمر شراء قبل انقطاع التوريد.`,
        deterministicData: {
          asOf: isoDate(ctx.asOf),
          windowDays: WINDOW_DAYS,
          coverThresholdDays: COVER_DAYS,
          itemCount: atRisk.length,
          items: atRisk.map((row) => ({
            itemId: row.itemId,
            itemName: row.itemName,
            quantityOnHand: money(row.quantityOnHand),
            soldLast30Days: money(row.soldLast30Days),
            avgDailySales: row.avgDailySales,
            daysOfCover: row.daysOfCover,
          })),
        },
        actionLink: '/inventory/operations/purchase-order',
        fingerprint: 'STOCK_RUNOUT:7d',
      },
    ];
  }
}
