import type { MigrationContext } from '../migration-context';
import { companySettingService } from '../../platform/services/company-setting.service';
import { legacyTrim } from '../transforms/legacy-values';

function serializeValue(v: unknown): string | number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.toISOString();
  return legacyTrim(v);
}

/** Persist unmapped legacy columns as JSON under CompanySettingEntry (migration namespace). */
export async function preserveLegacySnapshot(
  ctx: MigrationContext,
  opts: {
    namespace: string;
    sourceKey: string;
    raw: Record<string, unknown>;
    mappedColumns: ReadonlySet<string>;
  }
): Promise<number> {
  const extras: Record<string, string | number> = {};
  for (const [key, v] of Object.entries(opts.raw)) {
    if (opts.mappedColumns.has(key)) continue;
    const ser = serializeValue(v);
    if (ser == null) continue;
    extras[key] = ser;
  }
  if (!Object.keys(extras).length) return 0;
  const settingKey = `migration.${opts.namespace}.${opts.sourceKey}`;
  if (ctx.dryRun) return Object.keys(extras).length;
  await companySettingService.setEntry(ctx.targetCompanyId, settingKey, JSON.stringify(extras));
  return Object.keys(extras).length;
}
