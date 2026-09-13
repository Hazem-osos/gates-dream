import prisma from '../../../shared/database/prisma';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { SYSTEM_GL_CODES } from '../../accounting/data/system-account-map';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const DEMO_ITEM_SERIAL = 'ITEM-01';
export const DEMO_ITEM_AR = 'صنف تجريبي';
export const DEMO_CUSTOMER_CODE = 'CUST-DEMO';

const EXTRA_UNITS: { code: string; arabicName: string; englishName: string }[] = [
  { code: 'KG', arabicName: 'كيلو', englishName: 'Kilogram' },
  { code: 'BOX', arabicName: 'كرتون', englishName: 'Box' },
  { code: 'LTR', arabicName: 'لتر', englishName: 'Liter' },
];

type SampleItemDef = {
  serial: string;
  arabicName: string;
  englishName: string;
  baseUnitCode: string;
  stockQty: number;
  /** Additional sell/purchase units (conversion to base) */
  altUnits?: { unitCode: string; conversionFactor: number }[];
};

const SAMPLE_ITEMS: SampleItemDef[] = [
  {
    serial: DEMO_ITEM_SERIAL,
    arabicName: DEMO_ITEM_AR,
    englishName: 'Demo Item',
    baseUnitCode: 'PCS',
    stockQty: 100,
  },
  {
    serial: 'ITEM-02',
    arabicName: 'أرز',
    englishName: 'Rice',
    baseUnitCode: 'KG',
    stockQty: 500,
  },
  {
    serial: 'ITEM-03',
    arabicName: 'زيت طعام',
    englishName: 'Cooking Oil',
    baseUnitCode: 'LTR',
    stockQty: 120,
  },
  {
    serial: 'ITEM-04',
    arabicName: 'مياه معدنية',
    englishName: 'Mineral Water',
    baseUnitCode: 'PCS',
    stockQty: 480,
    altUnits: [{ unitCode: 'BOX', conversionFactor: 24 }],
  },
  {
    serial: 'ITEM-05',
    arabicName: 'دقيق',
    englishName: 'Flour',
    baseUnitCode: 'KG',
    stockQty: 350,
  },
  {
    serial: 'ITEM-06',
    arabicName: 'سكر',
    englishName: 'Sugar',
    baseUnitCode: 'KG',
    stockQty: 280,
    altUnits: [{ unitCode: 'BOX', conversionFactor: 50 }],
  },
];

export type DemoCatalogResult = {
  itemId: string;
  unitId: string;
  warehouseId: string;
  customerId: string;
  created: { item: boolean; customer: boolean; stock: boolean };
  sampleItemsEnsured: number;
};

/**
 * Idempotent demo item + PCS unit link + warehouse qty + demo customer for invoicing.
 */
export class DemoCatalogService {
  private async ensureExtraUnits(
    companyId: string,
    client: Prisma.TransactionClient
  ): Promise<Map<string, string>> {
    const byCode = new Map<string, string>();
    for (const u of EXTRA_UNITS) {
      let row = await client.unit.findFirst({
        where: { companyId, code: u.code },
      });
      if (!row) {
        row = await client.unit.create({
          data: {
            companyId,
            code: u.code,
            arabicName: u.arabicName,
            englishName: u.englishName,
            isActive: true,
          },
        });
      }
      byCode.set(u.code, row.id);
    }
    const pcs = await client.unit.findFirst({
      where: { companyId, code: 'PCS' },
    });
    if (pcs) byCode.set('PCS', pcs.id);
    return byCode;
  }

  private async upsertSampleItem(
    companyId: string,
    client: Prisma.TransactionClient,
    def: SampleItemDef,
    unitIds: Map<string, string>,
    warehouseId: string,
    inventoryAccountId: string | null
  ): Promise<boolean> {
    const baseUnitId = unitIds.get(def.baseUnitCode);
    if (!baseUnitId) {
      throw new Error(`وحدة ${def.baseUnitCode} غير موجودة للشركة`);
    }

    let item = await client.item.findFirst({
      where: { companyId, serial: def.serial },
    });
    let created = false;
    if (!item) {
      item = await client.item.create({
        data: {
          companyId,
          serial: def.serial,
          arabicName: def.arabicName,
          englishName: def.englishName,
          mainAccountId: inventoryAccountId,
          itemType: 'normal',
          isActive: true,
        },
      });
      created = true;
    } else if (inventoryAccountId && !item.mainAccountId) {
      await client.item.update({
        where: { id: item.id },
        data: { mainAccountId: inventoryAccountId },
      });
    }

    const linkBase = await client.itemUnit.findUnique({
      where: { itemId_unitId: { itemId: item.id, unitId: baseUnitId } },
    });
    if (!linkBase) {
      await client.itemUnit.create({
        data: {
          itemId: item.id,
          unitId: baseUnitId,
          conversionFactor: 1,
          isBaseUnit: true,
        },
      });
    } else if (!linkBase.isBaseUnit) {
      await client.itemUnit.update({
        where: { id: linkBase.id },
        data: { isBaseUnit: true, conversionFactor: 1 },
      });
    }

    for (const alt of def.altUnits ?? []) {
      const altUnitId = unitIds.get(alt.unitCode);
      if (!altUnitId) continue;
      const existing = await client.itemUnit.findUnique({
        where: { itemId_unitId: { itemId: item.id, unitId: altUnitId } },
      });
      if (!existing) {
        await client.itemUnit.create({
          data: {
            itemId: item.id,
            unitId: altUnitId,
            conversionFactor: alt.conversionFactor,
            isBaseUnit: false,
          },
        });
      }
    }

    const qtyRow = await client.itemQuantity.findFirst({
      where: {
        itemId: item.id,
        warehouseId,
        locationId: null,
      },
    });
    if (!qtyRow) {
      await client.itemQuantity.create({
        data: {
          itemId: item.id,
          warehouseId,
          locationId: null,
          quantity: new Decimal(def.stockQty),
        },
      });
    } else if (Number(qtyRow.quantity) < 1) {
      await client.itemQuantity.update({
        where: { id: qtyRow.id },
        data: { quantity: new Decimal(def.stockQty) },
      });
    }

    return created;
  }

  async ensureDemoCatalog(
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<DemoCatalogResult> {
    const run = async (client: Prisma.TransactionClient) => {
      const unit = await client.unit.findFirst({
        where: { companyId, code: 'PCS' },
      });
      if (!unit) {
        throw new Error('وحدة PCS غير موجودة — شغّل تهيئة دليل الحسابات أولاً');
      }

      const unitIds = await this.ensureExtraUnits(companyId, client);
      unitIds.set('PCS', unit.id);

      const warehouse =
        (await client.warehouse.findFirst({
          where: { companyId, code: 'WH-01', isActive: true },
        })) ??
        (await client.warehouse.findFirst({
          where: { companyId, isActive: true },
          orderBy: { createdAt: 'asc' },
        }));
      if (!warehouse) {
        throw new Error('لا يوجد مخزن — أكمل التهيئة أولاً');
      }

      const inventoryAccount = await client.account.findFirst({
        where: { companyId, code: SYSTEM_GL_CODES.inventory, deletedAt: null },
      });

      let itemsCreated = 0;
      for (const def of SAMPLE_ITEMS) {
        if (
          await this.upsertSampleItem(
            companyId,
            client,
            def,
            unitIds,
            warehouse.id,
            inventoryAccount?.id ?? null
          )
        ) {
          itemsCreated += 1;
        }
      }

      const primaryItem = await client.item.findFirst({
        where: { companyId, serial: DEMO_ITEM_SERIAL },
      });
      if (!primaryItem) {
        throw new Error('فشل إنشاء الصنف التجريبي');
      }

      const arAccount = await client.account.findFirst({
        where: { companyId, code: SYSTEM_GL_CODES.ar, deletedAt: null },
      });

      let customer = await client.customer.findFirst({
        where: { companyId, code: DEMO_CUSTOMER_CODE },
      });
      let customerCreated = false;
      if (!customer) {
        customer = await client.customer.create({
          data: {
            companyId,
            code: DEMO_CUSTOMER_CODE,
            arabicName: 'عميل تجريبي',
            englishName: 'Demo Customer',
            mainAccountId: arAccount?.id ?? null,
            accountId: arAccount?.id ?? null,
            isActive: true,
          },
        });
        customerCreated = true;
      }

      return {
        itemId: primaryItem.id,
        unitId: unit.id,
        warehouseId: warehouse.id,
        customerId: customer.id,
        created: {
          item: itemsCreated > 0,
          customer: customerCreated,
          stock: itemsCreated > 0,
        },
        sampleItemsEnsured: SAMPLE_ITEMS.length,
      };
    };

    if (tx) {
      return run(tx);
    }

    return prisma.$transaction(run, { maxWait: 10_000, timeout: 30_000 });
  }
}

export const demoCatalogService = new DemoCatalogService();
