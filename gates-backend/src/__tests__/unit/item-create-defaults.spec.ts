import { Prisma } from '@prisma/client';
import { ensureDefaultPieceUnit } from '../../modules/inventory/services/ensure-default-unit';
import {
  UNGROUPED_ITEM_CATEGORY_CODE,
  UNGROUPED_ITEM_CATEGORY_NAME,
  ensureDefaultUngroupedCategory,
} from '../../modules/inventory/services/ensure-default-item-category';

function createCategoryClient(seed?: { id: string; code: string | null; arabicName: string; isActive: boolean }) {
  const rows = seed ? [seed] : [];
  return {
    itemCategory: {
      findFirst: async ({ where }: { where: { OR?: Array<Record<string, string>> } }) => {
        const clauses = where.OR ?? [];
        return (
          rows.find((row) =>
            clauses.some((clause) => clause.code === row.code || clause.arabicName === row.arabicName)
          ) ?? null
        );
      },
      create: async ({ data }: { data: { id?: string; code: string; arabicName: string; isActive: boolean } }) => {
        const created = { id: data.id ?? 'cat-1', ...data };
        rows.push(created);
        return created;
      },
      update: async ({ data }: { data: { isActive: boolean } }) => {
        rows[0] = { ...rows[0], ...data };
        return rows[0];
      },
    },
  };
}

function createUnitClient(seed?: { id: string; code: string | null; arabicName: string; isActive: boolean }) {
  const rows = seed ? [seed] : [];
  return {
    unit: {
      findFirst: async ({ where }: { where: { OR?: Array<Record<string, string>> } }) => {
        const clauses = where.OR ?? [];
        return (
          rows.find((row) => clauses.some((clause) => clause.code === row.code || clause.arabicName === row.arabicName)) ??
          null
        );
      },
      create: async ({ data }: { data: { id?: string; code: string; arabicName: string; isActive: boolean } }) => {
        const created = { id: data.id ?? 'unit-1', ...data };
        rows.push(created);
        return created;
      },
      update: async ({ data }: { data: { code?: string; isActive?: boolean } }) => {
        rows[0] = { ...rows[0], ...data };
        return rows[0];
      },
    },
  };
}

describe('item create defaults', () => {
  it('creates بدون مجموعة when the company has no catch-all category', async () => {
    const client = createCategoryClient();
    const category = await ensureDefaultUngroupedCategory(
      'company-1',
      client as unknown as Prisma.TransactionClient
    );
    expect(category.arabicName).toBe(UNGROUPED_ITEM_CATEGORY_NAME);
    expect(category.code).toBe(UNGROUPED_ITEM_CATEGORY_CODE);
  });

  it('reuses an existing بدون مجموعة category', async () => {
    const client = createCategoryClient({
      id: 'existing',
      code: 'UNG',
      arabicName: 'بدون مجموعة',
      isActive: true,
    });
    const category = await ensureDefaultUngroupedCategory(
      'company-1',
      client as unknown as Prisma.TransactionClient
    );
    expect(category.id).toBe('existing');
  });

  it('creates قطعة when the company has no piece unit', async () => {
    const client = createUnitClient();
    const unit = await ensureDefaultPieceUnit('company-1', client as unknown as Prisma.TransactionClient);
    expect(unit.arabicName).toBe('قطعة');
    expect(unit.code).toBe('PCS');
  });

  it('reuses an existing قطعة unit', async () => {
    const client = createUnitClient({
      id: 'pcs-1',
      code: 'PCS',
      arabicName: 'قطعة',
      isActive: true,
    });
    const unit = await ensureDefaultPieceUnit('company-1', client as unknown as Prisma.TransactionClient);
    expect(unit.id).toBe('pcs-1');
  });
});
