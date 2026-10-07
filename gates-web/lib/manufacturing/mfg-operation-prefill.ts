export const MFG_OPERATION_PREFILL_KEY = 'gates-manufacturing-operation-prefill';

export type MfgOperationPrefill = {
  bomId: string;
  manufacturingWorkOrderId?: string;
  stage?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  costCenter?: string;
  numberOfModels: number;
  description?: string;
  operationShiftNumber?: string;
  autoLoad?: boolean;
};

export function stashMfgOperationPrefill(payload: MfgOperationPrefill) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(MFG_OPERATION_PREFILL_KEY, JSON.stringify(payload));
}

export function consumeMfgOperationPrefill(): MfgOperationPrefill | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(MFG_OPERATION_PREFILL_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(MFG_OPERATION_PREFILL_KEY);
  try {
    return JSON.parse(raw) as MfgOperationPrefill;
  } catch {
    return null;
  }
}
