/**
 * Opening balances exist in two legacy places. Importing both double-counts TB.
 *
 * Forensic (LegacyForensic company 0001): 1 BalanceAccounts header + 1 BG01 GL.
 * Policy: historical posted GL (including BG01) is the source of truth.
 */

export const OPENING_GL_TYPES = new Set(['BG01']);

export type OpeningImportPolicy = 'GL_ONLY' | 'BALANCE_ACCOUNTS_ONLY' | 'NONE';

export function resolveOpeningImportPolicy(params: {
  balanceAccountHeaderCount: number;
  openingGlHeaderCount: number;
}): OpeningImportPolicy {
  if (params.openingGlHeaderCount > 0) return 'GL_ONLY';
  if (params.balanceAccountHeaderCount > 0) return 'BALANCE_ACCOUNTS_ONLY';
  return 'NONE';
}

export function shouldImportBalanceAccounts(policy: OpeningImportPolicy): boolean {
  return policy === 'BALANCE_ACCOUNTS_ONLY';
}

export function isOpeningGlType(type: string): boolean {
  return OPENING_GL_TYPES.has(type.trim().toUpperCase());
}

export function openingDoubleCountReason(policy: OpeningImportPolicy): string {
  if (policy === 'GL_ONLY') {
    return 'BalanceAccountsH/D skipped — opening is already represented by posted GL type BG01 (or other opening GL). Importing both would double-count.';
  }
  if (policy === 'BALANCE_ACCOUNTS_ONLY') {
    return 'No opening-type GL found; BalanceAccounts may be imported later as a dedicated opening batch, not as a second GL pass.';
  }
  return 'No opening source detected.';
}
