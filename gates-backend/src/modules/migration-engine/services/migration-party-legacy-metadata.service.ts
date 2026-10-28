import type { MigrationContext } from '../migration-context';
import { companySettingService } from '../../platform/services/company-setting.service';
import { legacyTrim } from '../transforms/legacy-values';

const CUSTOMER_MAPPED = new Set([
  'CompanyCode',
  'BranchCode',
  'CustomerCode',
  'CustomerNameA',
  'CustomerNameE',
  'AccountCode',
  'ParentAccountCode',
  'CurrencyCode',
  'CustomerCase',
  'CustomerType',
  'Phone1',
  'Phone2',
  'Mobile',
  'Fax',
  'Email',
  'Site',
  'Address',
  'Street',
  'City',
  'TradeNum',
  'Mozana',
  'PersonCode',
  'CustomerCategoryCode',
  'NationCode',
  'PriceCode',
  'DiscPercent',
  'PriceListCode',
  'CountryCode',
  'RegionCode',
  'Building',
]);

const SUPPLIER_MAPPED = new Set([
  'CompanyCode',
  'BranchCode',
  'SupplierCode',
  'SupplierNameA',
  'SupplierNameE',
  'AccountCode',
  'CurrencyCode',
  'SupplierCase',
  'Phone1',
  'Phone2',
  'Mobile',
  'Fax',
  'Email',
  'Site',
  'Address',
  'Street',
  'Mozana',
]);

export function customerMappedLegacyColumn(column: string): boolean {
  return CUSTOMER_MAPPED.has(column);
}

export function supplierMappedLegacyColumn(column: string): boolean {
  return SUPPLIER_MAPPED.has(column);
}

async function preserveRowExtras(
  ctx: MigrationContext,
  entity: 'Customer' | 'Supplier',
  code: string,
  raw: Record<string, unknown>,
  mapped: Set<string>
) {
  const extras: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (mapped.has(k) || v == null || v === '') continue;
    extras[k] = v instanceof Date ? v.toISOString() : legacyTrim(v);
  }
  if (!Object.keys(extras).length) return;
  const key = `migration.legacy${entity}.${code}`;
  if (ctx.dryRun) return;
  await companySettingService.setEntry(ctx.targetCompanyId, key, JSON.stringify(extras));
}

export async function preserveCustomerLegacyMetadata(
  ctx: MigrationContext,
  customerCode: string,
  raw: Record<string, unknown>
) {
  await preserveRowExtras(ctx, 'Customer', customerCode, raw, CUSTOMER_MAPPED);
}

export async function preserveSupplierLegacyMetadata(
  ctx: MigrationContext,
  supplierCode: string,
  raw: Record<string, unknown>
) {
  await preserveRowExtras(ctx, 'Supplier', supplierCode, raw, SUPPLIER_MAPPED);
}
