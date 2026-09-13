import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';

export type FrequentCustomerItem = {
  itemId: string;
  arabicName: string;
  code: string | null;
  serial: string | null;
  lastUnitPrice: number;
  purchaseCount: number;
};

export class CustomerInsightsService {
  async getFrequentItems(companyId: string, customerId: string): Promise<FrequentCustomerItem[]> {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new Error('Customer not found');

    const lines = await prisma.invoiceLine.findMany({
      where: {
        invoice: {
          companyId,
          customerId,
          isPosted: true,
          isCancelled: false,
          invoiceKind: 'SALE',
        },
      },
      orderBy: [{ invoice: { date: 'desc' } }, { lineOrder: 'desc' }],
      take: 400,
      select: {
        itemId: true,
        price: true,
        item: {
          select: { id: true, arabicName: true, serial: true },
        },
      },
    });

    const stats = new Map<
      string,
      { count: number; lastPrice: number; item: { id: string; arabicName: string; serial: string | null } }
    >();

    for (const line of lines) {
      if (!line.itemId || !line.item) continue;
      const existing = stats.get(line.itemId);
      const price = Number(line.price ?? 0);
      if (!existing) {
        stats.set(line.itemId, { count: 1, lastPrice: price, item: line.item });
      } else {
        existing.count += 1;
      }
    }

    return [...stats.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([itemId, s]) => ({
        itemId,
        arabicName: s.item.arabicName,
        code: s.item.serial,
        serial: s.item.serial,
        lastUnitPrice: roundTo4(s.lastPrice),
        purchaseCount: s.count,
      }));
  }
}

export const customerInsightsService = new CustomerInsightsService();
