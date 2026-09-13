import { z } from 'zod';

/** Legacy base document-type codes eligible for user-defined NewModule instances. */
export const NEW_MODULE_BASE_TYPES = [
  'BP', // Bank Payment
  'BR', // Bank Receipt
  'KP', // Cash Payment
  'KR', // Cash Receipt
  'RC', // Receive Check
  'PC', // Pay Check
  'TP', // Payment/Transfer Order
  'GL', // GL Journal Voucher
  'SI', // Sales Invoice
  'PI', // Purchase Invoice
  'SR', // Sales Return
  'PR', // Purchase Return
  'ST', // Store Transfer
  'SA', // Store Adjustment
  'SC', // Store Count/Check
] as const;

export const createNewModuleSchema = z.object({
  baseType: z.enum(NEW_MODULE_BASE_TYPES),
  nameAr: z.string().min(1),
  nameEn: z.string().optional(),
  menuNameAr: z.string().min(1),
  menuNameEn: z.string().optional(),
  priceListId: z.string().uuid().optional().nullable(),
  warehouseIds: z.array(z.string().uuid()).optional(),
});

export const updateNewModuleSchema = z.object({
  nameAr: z.string().min(1).optional(),
  nameEn: z.string().optional().nullable(),
  menuNameAr: z.string().min(1).optional(),
  menuNameEn: z.string().optional().nullable(),
  priceListId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  warehouseIds: z.array(z.string().uuid()).optional(),
});

export const otherModuleRightSchema = z.object({
  sanadModule: z.string().min(2).max(4),
  readModule: z.string().min(2).max(4),
});
