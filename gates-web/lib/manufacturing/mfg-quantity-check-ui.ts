import type { LoadedManufacturingProcess } from '@/lib/manufacturing/process-from-bom';
import { findMfgRawStockShortages } from '@/lib/manufacturing/mfg-raw-stock-shortages';
import { cn } from '@/lib/utils';

export async function hasMfgRawStockShortage(
  process: LoadedManufacturingProcess | null | undefined,
  defaultWarehouseId: string
): Promise<boolean> {
  if (!process?.raws?.length) return false;
  const wh = defaultWarehouseId || process.fromWarehouseId || '';
  if (!wh) return false;
  const shortages = await findMfgRawStockShortages(process.raws, wh);
  return shortages.length > 0;
}

/** أحمر + glow عند عجز الخامات؛ فارغ = زر ثانوي عادي (أبيض). */
export function mfgQuantityCheckButtonClass(insufficient: boolean, extra?: string) {
  return cn(
    extra,
    insufficient &&
      'border-red-400 bg-red-50 text-red-950 shadow-[0_0_14px_rgba(220,38,38,0.55)] ring-2 ring-red-300/70 hover:bg-red-100 hover:shadow-[0_0_18px_rgba(220,38,38,0.65)]'
  );
}

/** نص تنبيه العجز (للعرض فوق زر فحص الكميات). */
export const MFG_QUANTITY_SHORTAGE_HINT_AR =
  'يوجد عجز في الخامات — افتح فحص الكميات لمعرفة الأصناف الناقصة';
