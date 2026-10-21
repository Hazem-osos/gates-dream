/** Shared helpers for `{ form, lines }` page drafts. */

export type FormLinesDraft<TForm, TLine> = {
  form: TForm;
  lines: TLine[];
};

export function hasLineWithItem(lines: { itemId?: string | null }[]): boolean {
  return lines.some((line) => String(line.itemId ?? '').trim());
}

/** Blank, or still the transaction-settings default (auto-filled, not user intent). */
export function isUnsetOrDefaultWarehouse(
  value: string | null | undefined,
  defaultWarehouseId?: string | null,
): boolean {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  const fallback = String(defaultWarehouseId ?? '').trim();
  return Boolean(fallback) && raw === fallback;
}

export function isWarehouseDocHeaderEmpty(
  header: {
    warehouseId?: string | null;
    description?: string | null;
    serialNumber?: string | null;
  },
  defaultWarehouseId?: string | null,
): boolean {
  return (
    isUnsetOrDefaultWarehouse(header.warehouseId, defaultWarehouseId) &&
    !String(header.description ?? '').trim() &&
    !String(header.serialNumber ?? '').trim()
  );
}

export function isFormLinesDraftEmpty<
  TForm extends { warehouseId?: string | null; description?: string | null; serialNumber?: string | null },
  TLine extends { itemId?: string | null },
>(draft: FormLinesDraft<TForm, TLine>, defaultWarehouseId?: string | null): boolean {
  return isWarehouseDocHeaderEmpty(draft.form, defaultWarehouseId) && !hasLineWithItem(draft.lines);
}
