import { z } from 'zod';

export const createPersonGroupSchema = z.object({
  legacyCode: z.string().min(1).max(30),
  arabicName: z.string().min(1),
  englishName: z.string().optional(),
});

export const updatePersonGroupSchema = createPersonGroupSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const personGroupQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
  search: z.string().optional(),
});

export const createPersonSchema = z.object({
  legacyCode: z.string().min(1).max(30),
  arabicName: z.string().min(1),
  englishName: z.string().optional(),
  personGroupId: z.string().uuid().optional().nullable(),
  mainAccountId: z.string().uuid().optional().nullable(),
  priceListId: z.string().uuid().optional().nullable(),
});

export const updatePersonSchema = createPersonSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const personQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
  search: z.string().optional(),
  personGroupId: z.string().uuid().optional(),
  isActive: z.string().optional().transform((v) => v === 'true'),
});

export const createPersonItemPriceSchema = z.object({
  personId: z.string().uuid(),
  itemId: z.string().uuid(),
  unitId: z.string().uuid().optional().nullable(),
  price: z.number(),
  discountPct: z.number().optional().nullable(),
  validFrom: z.coerce.date().optional().nullable(),
  validTo: z.coerce.date().optional().nullable(),
});

export const updatePersonItemPriceSchema = createPersonItemPriceSchema
  .omit({ personId: true, itemId: true })
  .partial();

export const createCustomerCategorySchema = z.object({
  code: z.string().max(30).optional(),
  legacyCode: z.string().max(30).optional(),
  arabicName: z.string().min(1),
  englishName: z.string().optional(),
}).transform((v) => ({
  legacyCode: (v.legacyCode || v.code || '').trim(),
  arabicName: v.arabicName,
  englishName: v.englishName,
}));

export const updateCustomerCategorySchema = z.object({
  code: z.string().min(1).max(30).optional(),
  legacyCode: z.string().min(1).max(30).optional(),
  arabicName: z.string().min(1).optional(),
  englishName: z.string().optional(),
  isActive: z.boolean().optional(),
}).transform((v) => ({
  ...(v.legacyCode || v.code ? { legacyCode: (v.legacyCode || v.code || '').trim() } : {}),
  ...(v.arabicName !== undefined ? { arabicName: v.arabicName } : {}),
  ...(v.englishName !== undefined ? { englishName: v.englishName } : {}),
  ...(v.isActive !== undefined ? { isActive: v.isActive } : {}),
}));

export const createSupplierCategorySchema = createCustomerCategorySchema;
export const updateSupplierCategorySchema = updateCustomerCategorySchema;

export const costPreviewSchema = z.object({
  branchId: z.string().uuid(),
  itemId: z.string().uuid(),
  invoiceDate: z.coerce.date(),
  itemCount: z.number(),
  itemPrice: z.number(),
  sourceNum: z.string().min(1),
  sourceYearId: z.string().min(1),
  sourceType: z.string().min(1),
  change: z.number().optional(),
  purchaseInvoicePayCount: z.number().int().optional(),
});

export const postMovementSchema = z.object({
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  itemId: z.string().uuid(),
  locationId: z.string().uuid().optional().nullable(),
  quantityDelta: z.number(),
  unitCost: z.number().optional(),
  movementType: z.string().min(1),
  sourceType: z.string().optional(),
  sourceNumber: z.string().optional(),
  sourceYearId: z.string().optional(),
  documentDate: z.coerce.date(),
  effectiveAt: z.coerce.date().optional(),
});
