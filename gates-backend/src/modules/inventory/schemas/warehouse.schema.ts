import { z } from 'zod';

const optionalUuid = z.string().uuid().optional().nullable();

export const createWarehouseSchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  branchId: optionalUuid,
  storeType: z.enum(['MAIN', 'SUB']).optional().nullable(),
  warehouseKind: z.enum(['HEADER', 'POSTING']).optional(),
  parentWarehouseId: optionalUuid,
  inventoryAccountId: optionalUuid,
  costAccountId: optionalUuid,
  giftAccountId: optionalUuid,
  address: z.string().max(255).optional().nullable(),
  keeperName: z.string().max(191).optional().nullable(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const warehouseQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 50;
      return Number.isFinite(n) && n > 0 ? n : 50;
    }),
  search: z.string().optional(),
  branchId: z.string().uuid().optional().nullable(),
  isActive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === true || val === 'true'
    ),
  leafOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === true || val === 'true'
    ),
  headerOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === true || val === 'true'
    ),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type WarehouseQueryInput = z.infer<typeof warehouseQuerySchema>;
