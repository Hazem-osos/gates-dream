import type { LegacySourceAdapter } from '../types';
import {
  buildLegacySourceProfile,
  inventoryQuantitySourceHint,
  type LegacySourceProfile,
} from '../source-profile';

export class ItemStoreAuthoritativeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItemStoreAuthoritativeError';
  }
}

/**
 * Records inventory evidence policy for this source (does not assume Agro2).
 * Blocks only the legacy Phase B ItemStore import path when engine is enabled.
 */
export async function resolveInventorySourcePolicy(
  adapter: LegacySourceAdapter,
  legacyCompanyCode: string
): Promise<{ profile: LegacySourceProfile; quantitySourceHint: string }> {
  const profile = await buildLegacySourceProfile(adapter, legacyCompanyCode);
  const quantitySourceHint = inventoryQuantitySourceHint(profile);
  return { profile, quantitySourceHint };
}

/** @deprecated use resolveInventorySourcePolicy — kept for analyze hook name */
export async function assertItemStoreNotAuthoritative(
  adapter: LegacySourceAdapter,
  legacyCompanyCode: string
) {
  const { profile, quantitySourceHint } = await resolveInventorySourcePolicy(adapter, legacyCompanyCode);
  return {
    itemStoreRows: profile.itemStoreRowCount,
    policy: quantitySourceHint,
  };
}

export function blockLegacyPhaseBItemStore(): void {
  throw new ItemStoreAuthoritativeError(
    'scripts/migration phase B (ItemStore) is disabled while MIGRATION_ENGINE_ENABLED=true. Use engine inventory stages.'
  );
}
