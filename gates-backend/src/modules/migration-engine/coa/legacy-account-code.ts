/** Normalize legacy account codes without stripping significant leading zeros. */
export function normalizeLegacyAccountCode(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).replace(/\u0000/g, '').trim();
  return s;
}

export function isNumericAccountCode(code: string): boolean {
  return code.length > 0 && /^\d+$/.test(code);
}

/** Longest master code that is a strict prefix of `code` (or equal). */
export function longestMasterPrefix(code: string, masterCodes: Iterable<string>): string | null {
  let best: string | null = null;
  for (const master of masterCodes) {
    if (code === master || code.startsWith(master)) {
      if (!best || master.length > best.length) best = master;
    }
  }
  return best;
}
