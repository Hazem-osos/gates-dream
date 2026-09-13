import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { itemCostService } from './item-cost.service';

export class ItemQuickPeekService {
  async getQuickPeek(params: {
    companyId: string;
    itemId: string;
    customerId?: string;
    unitPriceHint?: number;
  }) {
    const item = await prisma.item.findFirst({
      where: { id: params.itemId, companyId: params.companyId },
      select: {
        id: true,
        arabicName: true,
        orderLimit: true,
        lowerLimit: true,
      },
    });
    if (!item) {
      throw new Error('Item not found');
    }

    const [quantities, cost, priceHistory, pendingPoLines] = await Promise.all([
      prisma.itemWarehouseBalance.findMany({
        where: {
          companyId: params.companyId,
          itemId: params.itemId,
          warehouse: { isActive: true },
        },
        select: {
          quantityOnHand: true,
          reservedQuantity: true,
          warehouse: {
            select: {
              id: true,
              arabicName: true,
              code: true,
              branch: { select: { arabicName: true } },
            },
          },
        },
      }),
      itemCostService.getCostAsOf(params.companyId, params.itemId, new Date()),
      params.customerId
        ? prisma.invoiceLine.findMany({
            where: {
              itemId: params.itemId,
              invoice: {
                companyId: params.companyId,
                isPosted: true,
                isCancelled: false,
                invoiceKind: 'SALE',
                customerId: params.customerId,
              },
            },
            orderBy: { invoice: { date: 'desc' } },
            take: 5,
            select: {
              price: true,
              quantity: true,
              discountPercent: true,
              discountAmount: true,
              invoice: {
                select: { date: true, invoiceNumber: true },
              },
            },
          })
        : Promise.resolve([]),
      prisma.purchaseOrderLine.findMany({
        where: {
          itemId: params.itemId,
          purchaseOrder: {
            companyId: params.companyId,
            isPosted: true,
            isCancelled: false,
            invoiceId: null,
          },
        },
        select: {
          quantity: true,
          purchaseOrder: { select: { orderNumber: true, date: true } },
        },
      }),
    ]);

    const warehouses = quantities.map((q) => ({
      warehouseId: q.warehouse.id,
      warehouseName: q.warehouse.arabicName,
      warehouseCode: q.warehouse.code,
      branchName: q.warehouse.branch?.arabicName ?? null,
      quantity: roundTo4(Number(q.quantityOnHand)),
      reservedQuantity: roundTo4(Number(q.reservedQuantity)),
      availableQuantity: roundTo4(Number(q.quantityOnHand) - Number(q.reservedQuantity)),
    }));

    const unitCost = roundTo4(cost);
    const sell = params.unitPriceHint ?? 0;
    const marginAmount = sell > 0 ? roundTo4(sell - unitCost) : 0;
    const marginPct = sell > 0 && unitCost > 0 ? roundTo4(((sell - unitCost) / sell) * 100) : null;

    let pendingPoQty = 0;
    const pendingOrders: Array<{ orderNumber: string | null; date: Date; openQty: number }> = [];
    for (const line of pendingPoLines) {
      const openQty = roundTo4(Number(line.quantity));
      if (openQty > 0) {
        pendingPoQty = roundTo4(pendingPoQty + openQty);
        pendingOrders.push({
          orderNumber: line.purchaseOrder.orderNumber,
          date: line.purchaseOrder.date,
          openQty,
        });
      }
    }

    return {
      itemId: item.id,
      itemName: item.arabicName,
      warehouses,
      customerPriceHistory: priceHistory.map((row) => ({
        date: row.invoice.date,
        invoiceNumber: row.invoice.invoiceNumber,
        unitPrice: roundTo4(Number(row.price)),
        quantity: roundTo4(Number(row.quantity)),
        discount: roundTo4(Number(row.discountAmount ?? row.discountPercent ?? 0)),
      })),
      cost: {
        unitCost,
        // C8 fix: item-cost.service.ts only ever computes a moving average
        // regardless of the stored setting, so the label must always say
        // so — showing "FIFO"/"LIFO" here for legacy rows would describe a
        // costing method the system never actually applied.
        costMethodLabel: 'متوسط مرجح',
      },
      margin: {
        sellingPrice: sell,
        marginAmount,
        marginPct,
      },
      reorder: {
        orderLimit: item.orderLimit != null ? Number(item.orderLimit) : null,
        lowerLimit: item.lowerLimit != null ? Number(item.lowerLimit) : null,
      },
      pendingPurchaseOrders: {
        totalOpenQty: pendingPoQty,
        lines: pendingOrders.slice(0, 10),
      },
    };
  }
}

export const itemQuickPeekService = new ItemQuickPeekService();
