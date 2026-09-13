import { z } from 'zod';

export const clothingColorSchema = z.object({
  serial: z.string().optional().nullable(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional().nullable(),
  hex: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const clothingSizeSchema = z.object({
  serial: z.string().optional().nullable(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const clothingComboRowSchema = z.object({
  colorId: z.string().uuid(),
  sizeId: z.string().uuid(),
  barcode: z.string().optional().nullable(),
});

export const replaceClothingCombosSchema = z.object({
  combos: z.array(clothingComboRowSchema),
});

export type ClothingColorInput = z.infer<typeof clothingColorSchema>;
export type ClothingSizeInput = z.infer<typeof clothingSizeSchema>;
export type ReplaceClothingCombosInput = z.infer<typeof replaceClothingCombosSchema>;
