export const MFG_TRANSFER_PREFILL_KEY = 'gates-manufacturing-transfer-prefill';

export type MfgTransferPrefill = {
  description: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  lines: Array<{ itemId: string; quantity: number; itemName?: string }>;
  /** Where the user came from (for banner + return link). */
  returnHref?: string;
  returnLabel?: string;
  /** True when lines are shortage-only (not full BOM quantities). */
  shortageOnly?: boolean;
};

export function stashMfgTransferPrefill(payload: MfgTransferPrefill) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(MFG_TRANSFER_PREFILL_KEY, JSON.stringify(payload));
}

export function consumeMfgTransferPrefill(): MfgTransferPrefill | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(MFG_TRANSFER_PREFILL_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(MFG_TRANSFER_PREFILL_KEY);
  try {
    return JSON.parse(raw) as MfgTransferPrefill;
  } catch {
    return null;
  }
}
