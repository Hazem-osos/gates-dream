/**
 * Resolves the party a legacy document points at.
 *
 * Legacy documents do not carry a CustomerCode / SupplierCode column: invoices carry
 * `SupplierAccountCode` and cash lines carry `AccountNo` — the party's GL leaf. Some
 * sources store the party code there instead. This resolver accepts either: an exact party
 * code wins, otherwise the account code is matched against Customer/Supplier.AccountCode.
 * An account shared by several parties of the same side is ambiguous and resolves to none
 * (never a guess).
 */
import type { MigrationContext } from '../migration-context';
import { loadLegacyPartySnapshot } from './legacy-party-data.service';
import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';

export interface PartyRefResolver {
  customerId(ref: unknown): Promise<string | null>;
  supplierId(ref: unknown): Promise<string | null>;
  /**
   * The party a GL account belongs to — matched on account code only, and only when exactly
   * one customer or supplier (across both sides) owns that account. Used to tag journal lines.
   */
  partnerForAccount(accountCode: unknown): Promise<{ partnerId: string; partnerType: 'CUSTOMER' | 'SUPPLIER' } | null>;
}

function trim(v: unknown): string {
  return v == null ? '' : String(v).split(String.fromCharCode(0)).join('').trim();
}

/** account code → party code when exactly one party of that side uses it. */
function uniqueByAccount(rows: Array<{ code: string; accountCode: string }>): Map<string, string> {
  const seen = new Map<string, string | null>();
  for (const r of rows) {
    if (!r.accountCode) continue;
    seen.set(r.accountCode, seen.has(r.accountCode) ? null : r.code);
  }
  const out = new Map<string, string>();
  for (const [acc, code] of seen) if (code) out.set(acc, code);
  return out;
}

export async function buildPartyRefResolver(ctx: MigrationContext): Promise<PartyRefResolver> {
  const snapshot = await loadLegacyPartySnapshot(ctx.source, ctx.legacyCompanyCode);
  const customerCodes = new Set(snapshot.customers.map((c) => c.customerCode));
  const supplierCodes = new Set(snapshot.suppliers.map((s) => s.supplierCode));
  const customerByAccount = uniqueByAccount(
    snapshot.customers.map((c) => ({ code: c.customerCode, accountCode: c.accountCode }))
  );
  const supplierByAccount = uniqueByAccount(
    snapshot.suppliers.map((s) => ({ code: s.supplierCode, accountCode: s.accountCode }))
  );
  const cache = new Map<string, string | null>();

  async function lookup(side: 'Customer' | 'Supplier', ref: unknown): Promise<string | null> {
    const raw = trim(ref);
    if (!raw) return null;
    const cacheKey = `${side}|${raw}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;
    const codes = side === 'Customer' ? customerCodes : supplierCodes;
    const byAccount = side === 'Customer' ? customerByAccount : supplierByAccount;
    const partyCode = codes.has(raw) ? raw : byAccount.get(normalizeLegacyAccountCode(raw)) ?? null;
    let id: string | null = null;
    if (partyCode) {
      const map = await ctx.idMap.findMapping(
        ctx.migrationJobId,
        side,
        side === 'Customer'
          ? { companyCode: ctx.legacyCompanyCode, customerCode: partyCode }
          : { companyCode: ctx.legacyCompanyCode, supplierCode: partyCode }
      );
      id = map?.targetId ?? null;
    }
    cache.set(cacheKey, id);
    return id;
  }

  const owners = new Map<string, number>();
  for (const r of [...snapshot.customers, ...snapshot.suppliers]) {
    if (r.accountCode) owners.set(r.accountCode, (owners.get(r.accountCode) ?? 0) + 1);
  }
  const partnerCache = new Map<string, { partnerId: string; partnerType: 'CUSTOMER' | 'SUPPLIER' } | null>();

  return {
    customerId: (ref) => lookup('Customer', ref),
    supplierId: (ref) => lookup('Supplier', ref),
    async partnerForAccount(accountCode) {
      const code = normalizeLegacyAccountCode(trim(accountCode));
      if (!code || owners.get(code) !== 1) return null;
      if (partnerCache.has(code)) return partnerCache.get(code)!;
      const customerCode = customerByAccount.get(code);
      const supplierCode = supplierByAccount.get(code);
      let out: { partnerId: string; partnerType: 'CUSTOMER' | 'SUPPLIER' } | null = null;
      if (customerCode) {
        const id = await lookup('Customer', customerCode);
        if (id) out = { partnerId: id, partnerType: 'CUSTOMER' };
      } else if (supplierCode) {
        const id = await lookup('Supplier', supplierCode);
        if (id) out = { partnerId: id, partnerType: 'SUPPLIER' };
      }
      partnerCache.set(code, out);
      return out;
    },
  };
}
