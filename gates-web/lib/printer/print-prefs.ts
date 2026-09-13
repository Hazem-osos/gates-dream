import type { ThermalRollWidth } from '@/lib/printer/types';

export type DefaultPrintKind = 'a4' | 'thermal';

export type SalesPrintPrefs = {
  kind: DefaultPrintKind;
  widthMm: ThermalRollWidth;
};

const KEY = 'gates:sales-invoice-print-prefs';

export const AUTO_PRINT_A4_EVENT = 'gates:auto-print-invoice';
export const AUTO_PRINT_THERMAL_EVENT = 'gates:auto-print-thermal';

export function readSalesPrintPrefs(): SalesPrintPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { kind: 'a4', widthMm: 80 };
    const parsed = JSON.parse(raw) as Partial<SalesPrintPrefs>;
    return {
      kind: parsed.kind === 'thermal' ? 'thermal' : 'a4',
      widthMm: parsed.widthMm === 58 ? 58 : 80,
    };
  } catch {
    return { kind: 'a4', widthMm: 80 };
  }
}

export function writeSalesPrintPrefs(next: Partial<SalesPrintPrefs>): SalesPrintPrefs {
  const merged = { ...readSalesPrintPrefs(), ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  return merged;
}

export function dispatchAutoPrintAfterSave(): void {
  if (typeof window === 'undefined') return;
  const prefs = readSalesPrintPrefs();
  window.dispatchEvent(
    new Event(prefs.kind === 'thermal' ? AUTO_PRINT_THERMAL_EVENT : AUTO_PRINT_A4_EVENT)
  );
}
