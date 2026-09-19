import { z } from 'zod';

export const createItemSchema = z.object({
  serial: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  mainAccountId: z.string().uuid().optional().nullable(),
  costCenterId: z.string().uuid().optional().nullable(),
  // Sales Invoice Enterprise Redesign: category-driven GL defaulting +
  // barcode + per-item tax profile defaults (consumed client-side by the
  // sales invoice line grid, still fully editable per line).
  categoryId: z.string().uuid().optional().nullable(),
  baseUnitId: z.string().uuid().optional().nullable(),
  barcode: z.string().optional().nullable(),
  salesAccountId: z.string().uuid().optional().nullable(),
  cogsAccountId: z.string().uuid().optional().nullable(),
  defaultTaxPercent: z.number().min(0).max(100).optional().nullable(),
  taxExemptionReason: z.string().optional().nullable(),
  specifications: z.string().optional(),
  itemType: z.enum(['normal', 'pack-sheet', 'pack-kilo', 'roll']).optional(),
  weight: z.number().nonnegative().optional().nullable(),
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
  upperLimit: z.number().nonnegative().optional().nullable(),
  orderLimit: z.number().nonnegative().optional().nullable(),
  orderLimitPercentage: z.number().nonnegative().optional().nullable(),
  lowerLimit: z.number().nonnegative().optional().nullable(),
  beginningBalance: z.number().nonnegative().optional().nullable(),
  beginningCostPrice: z.number().nonnegative().optional().nullable(),
  priceRetail: z.number().nonnegative().optional(),
  priceSemiWholesale: z.number().nonnegative().optional(),
  priceWholesale: z.number().nonnegative().optional(),
  priceProjects: z.number().nonnegative().optional(),
  isService: z.boolean().optional(),
  isAssembly: z.boolean().optional(),
  isTaxExempt: z.boolean().optional(),
  consumerPrice: z.number().nonnegative().optional(),
  retailPrice: z.number().nonnegative().optional(),
  representativePrice: z.number().nonnegative().optional(),
  exportPrice: z.number().nonnegative().optional(),
  priceMode: z.enum(['value', 'last_purchase_pct', 'cost_pct']).optional().nullable(),
  priceCurrency: z.string().max(20).optional().nullable(),
  extraAssemblyCost: z.number().nonnegative().optional().nullable(),
  extraAssemblyCostPct: z.number().nonnegative().optional().nullable(),
  purchaseCount: z.number().int().nonnegative().optional().nullable(),
  minPurchaseQty: z.number().nonnegative().optional().nullable(),
  assemblyComponents: z
    .array(
      z.object({
        itemId: z.string().uuid().optional().nullable(),
        itemName: z.string().optional().nullable(),
        unitId: z.string().uuid().optional().nullable(),
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
  defaultWarehouseId: z.string().uuid().optional().nullable(),
  priceSource: z.enum(['price_list', 'item_card']).optional().nullable(),
  lastPurchasePrice: z.number().nonnegative().optional().nullable(),
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

export const bomExplosionQuerySchema = z.object({
  quantity: z
    .string()
    .optional()
    .transform((val) => {
      const n = val ? Number(val) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    }),
  warehouseId: z.string().uuid().optional(),
  sourceWarehouseId: z.string().uuid().optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ItemQueryInput = z.infer<typeof itemQuerySchema>;