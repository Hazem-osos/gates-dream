import { z } from 'zod';

const emptyToNull = (val: unknown) => (val === '' || val === undefined ? null : val);

const uuidId = z.preprocess(emptyToNull, z.string().uuid().optional().nullable());

const optNum = z.preprocess((val) => {
  if (val === '' || val === null || val === undefined) return null;
  if (typeof val === 'number' && !Number.isFinite(val)) return null;
  return val;
}, z.number().nonnegative().optional().nullable());

export const createItemSchema = z.object({
  serial: z.string().optional(),
  arabicName: z.string().trim().min(1, 'اسم الصنف مطلوب'),
  englishName: z.string().optional(),
  mainAccountId: uuidId,
  costCenterId: uuidId,
  // Sales Invoice Enterprise Redesign: category-driven GL defaulting +
  // barcode + per-item tax profile defaults (consumed client-side by the
  // sales invoice line grid, still fully editable per line).
  categoryId: uuidId,
  baseUnitId: uuidId,
  barcode: z.string().optional().nullable(),
  salesAccountId: uuidId,
  cogsAccountId: uuidId,
  defaultTaxPercent: optNum,
  taxExemptionReason: z.string().optional().nullable(),
  specifications: z.string().optional(),
  itemType: z.enum(['normal', 'pack-sheet', 'pack-kilo', 'roll']).optional(),
  weight: optNum,
  manufacturerId: z.string().optional().nullable(),
  colorId: z.string().optional().nullable(),
  countryOfOrigin: z.string().optional().nullable(),
  quality: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  property1: z.string().optional().nullable(),
  property2: z.string().optional().nullable(),
  property3: z.string().optional().nullable(),
  property4: z.string().optional().nullable(),
  property5: z.string().optional().nullable(),
  useExpirationDate: z.boolean().optional(),
  inactiveItem: z.boolean().optional(),
  notSubjectToTerms: z.boolean().optional(),
  cannotBeReturned: z.boolean().optional(),
  noSellBelowCost: z.boolean().optional(),
  useSerialNumber: z.boolean().optional(),
  clothingItem: z.boolean().optional(),
  upperLimit: optNum,
  orderLimit: optNum,
  orderLimitPercentage: optNum,
  lowerLimit: optNum,
  beginningBalance: optNum,
  beginningCostPrice: optNum,
  priceRetail: optNum,
  priceSemiWholesale: optNum,
  priceWholesale: optNum,
  priceProjects: optNum,
  isService: z.boolean().optional(),
  isAssembly: z.boolean().optional(),
  isTaxExempt: z.boolean().optional(),
  consumerPrice: optNum,
  retailPrice: optNum,
  representativePrice: optNum,
  exportPrice: optNum,
  priceMode: z.preprocess(
    emptyToNull,
    z.enum(['value', 'last_purchase_pct', 'cost_pct']).optional().nullable()
  ),
  priceCurrency: z.string().max(20).optional().nullable(),
  extraAssemblyCost: optNum,
  extraAssemblyCostPct: optNum,
  purchaseCount: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return null;
    if (typeof val === 'number' && !Number.isFinite(val)) return null;
    return val;
  }, z.number().int().nonnegative().optional().nullable()),
  minPurchaseQty: optNum,
  assemblyComponents: z
    .array(
      z.object({
        itemId: uuidId,
        itemName: z.string().optional().nullable(),
        unitId: uuidId,
        unitName: z.string().optional().nullable(),
        conversionFactor: z.union([z.string(), z.number()]).optional().nullable(),
        quantity: z.union([z.string(), z.number()]).optional().nullable(),
        cost: z.union([z.string(), z.number()]).optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  preferredSuppliers: z
    .array(
      z.object({
        supplierName: z.string().optional().nullable(),
        price: z.union([z.string(), z.number()]).optional().nullable(),
        leadTimeDays: z.union([z.string(), z.number()]).optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  imageUrl: z.string().max(2_000_000).optional().nullable(),
  defaultWarehouseId: uuidId,
  priceSource: z.enum(['price_list', 'item_card']).optional().nullable(),
  lastPurchasePrice: optNum,
  etaProfile: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const updateItemSchema = createItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const itemQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  itemType: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === true || val === 'true'
    ),
  isAssembly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === true || val === 'true'
    ),
  warehouseId: z.string().uuid().optional(),
});

export const findItemByBarcodeQuerySchema = z.object({
  barcode: z.string().trim().min(1, 'barcode required'),
});

const priceOp = z.enum(['none', 'eq', 'gt', 'lt', 'between']).optional().default('none');

export const itemFinderQuerySchema = z.object({
  barcode: z.string().optional(),
  name: z.string().optional(),
  purchaseOp: priceOp,
  purchaseFrom: z.string().optional().transform((val) => (val ? Number(val) : undefined)),
  purchaseTo: z.string().optional().transform((val) => (val ? Number(val) : undefined)),
  saleOp: priceOp,
  saleFrom: z.string().optional().transform((val) => (val ? Number(val) : undefined)),
  saleTo: z.string().optional().transform((val) => (val ? Number(val) : undefined)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

export const assemblyPricingMethodSchema = z
  .enum(['AVERAGE_COST', 'LAST_PURCHASE', 'MANUAL'])
  .optional()
  .default('AVERAGE_COST');

export const bomExplosionQuerySchema = z.object({
  quantity: z.coerce.number().positive().optional().default(1),
  warehouseId: z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    z.string().uuid().optional()
  ),
  sourceWarehouseId: z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    z.string().uuid().optional()
  ),
  pricingMethod: assemblyPricingMethodSchema,
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ItemQueryInput = z.infer<typeof itemQuerySchema>;