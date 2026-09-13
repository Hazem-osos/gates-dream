import prisma from '../../../shared/database/prisma';
import {
  getTenantCached,
  invalidateTenantCache,
  tenantCacheKeys,
} from '../../../shared/cache/tenant-metadata-cache';
import {
  DYNAMIC_DEFAULT_KEYS,
  LEGACY_SETTINGS_DEFAULTS,
} from '../data/legacy-settings-defaults';
import {
  BRANCH_SCOPED_SETTING_KEYS,
  MODULE_SUFFIXED_KEY_PATTERNS,
  inferModulePatternValueKind,
  modulePatternBaseName,
} from '../data/legacy-module-setting-patterns';

/** Legacy CompanySetting values use T/F strings. */
export function isLegacyTrue(value: string | null | undefined): boolean {
  if (value == null) return false;
  const v = value.trim().toLowerCase();
  return v === 't' || v === 'true' || v === '1' || v === 'yes';
}

export interface SettingScopeOptions {
  /** Branch-scoped override (legacy uses this for e.g. CustomersAccount). Omit/undefined for company-wide. */
  branchId?: string | null;
}

/**
 * Typed settings engine over the legacy `CompanySetting` EAV model
 * (`CompanySettingEntry`).
 *
 * Three key shapes, all sharing the same storage table:
 * - Plain company-scope keys (`GLPost`, `SerialGL`, `CustomersAccount`, …) —
 *   see `docs/parity/legacy-settings-catalog.json` for the full catalog
 *   extracted from `untcompanyvariables.pas`.
 * - Per-module composite keys — legacy concatenates a settings *base name*
 *   with the 4-char `NewModule` code (`baseType + moduleCode`, e.g. "SI01"):
 *   `SalesDaribaSI01`, `AutoPostBP01`, `PostTostoreSI02`, `NotCreateGLSR01`.
 * - Branch-scoped overrides — legacy additionally filters by `BranchCode`
 *   for a handful of keys (`CustomersAccount`); modeled here via the
 *   nullable `CompanySettingEntry.branchId` column (NULL = company-wide).
 */
export class CompanySettingService {
  /** Legacy-exact module-suffix key: baseName + baseType + moduleCode, e.g. "SalesDariba" + "SI01". */
  moduleKey(baseName: string, moduleCode: string): string {
    return `${baseName}${moduleCode}`;
  }

  async getEntry(
    companyId: string,
    name: string,
    opts?: SettingScopeOptions
  ): Promise<string | null> {
    const branchId = opts?.branchId ?? null;
    return getTenantCached(
      tenantCacheKeys.settingEntry(companyId, name, branchId),
      async () => {
        if (branchId) {
          const branchRow = await prisma.companySettingEntry.findFirst({
            where: { companyId, branchId, name },
            select: { value: true },
          });
          if (branchRow) return branchRow.value;
        }
        const row = await prisma.companySettingEntry.findFirst({
          where: { companyId, branchId: null, name },
          select: { value: true },
        });
        return row?.value ?? null;
      }
    );
  }

  async getFlag(
    companyId: string,
    name: string,
    defaultValue = false,
    opts?: SettingScopeOptions
  ): Promise<boolean> {
    const value = await this.getEntry(companyId, name, opts);
    if (value == null) return defaultValue;
    return isLegacyTrue(value);
  }

  /** Per-module composite-key read: baseName + moduleCode (e.g. "SI01"). */
  async getModuleEntry(
    companyId: string,
    baseName: string,
    moduleCode: string,
    opts?: SettingScopeOptions
  ): Promise<string | null> {
    return this.getEntry(companyId, this.moduleKey(baseName, moduleCode), opts);
  }

  /**
   * Legacy per-module boolean flags are resolved as "not equal to the
   * *off* literal" rather than "equal to the *on* literal" (see
   * `MainProgram/untRInovice.pas` `LoadSettings`, e.g.
   * `if Value<>'F' then AutoPost:='T' else AutoPost:='F'` — default TRUE
   * unless the row is explicitly 'F'). Some keys invert this
   * (`NotCreateGL`, `SampleInvoice`, … default FALSE unless explicitly
   * 'T'). `offLiteral` selects which literal makes the flag false.
   */
  async getModuleFlag(
    companyId: string,
    baseName: string,
    moduleCode: string,
    options: { offLiteral: 'F' | 'T' },
    opts?: SettingScopeOptions
  ): Promise<boolean> {
    const value = await this.getModuleEntry(companyId, baseName, moduleCode, opts);
    if (options.offLiteral === 'F') {
      return value !== 'F';
    }
    return value === 'T';
  }

  /** Legacy per-module two-value enum (e.g. SerialAutomatic 'A'/'M', SerialContanious 'C'/'P'). */
  async getModuleEnum<T extends string>(
    companyId: string,
    baseName: string,
    moduleCode: string,
    options: { defaultValue: T; otherValue: T },
    opts?: SettingScopeOptions
  ): Promise<T> {
    const value = await this.getModuleEntry(companyId, baseName, moduleCode, opts);
    return value === options.otherValue ? options.otherValue : options.defaultValue;
  }

  /** Legacy-exact default for absent company-scope rows (docs/parity/legacy-settings-catalog.json). */
  getLegacyDefault(name: string): string | null {
    return LEGACY_SETTINGS_DEFAULTS[name]?.defaultValue ?? null;
  }

  isDynamicDefaultKey(name: string): boolean {
    return (DYNAMIC_DEFAULT_KEYS as readonly string[]).includes(name);
  }

  /**
   * `getEntry` falling back to the legacy-exact default (from
   * `untcompanyvariables.pas`) instead of `null` when no row exists.
   * `CurrencyCode`'s legacy default is dynamic (the company's own base
   * currency) — resolve it via `getEntryOrCompanyDefault` in that case.
   */
  async getEntryOrLegacyDefault(
    companyId: string,
    name: string,
    opts?: SettingScopeOptions
  ): Promise<string | null> {
    const value = await this.getEntry(companyId, name, opts);
    if (value != null) return value;
    return this.getLegacyDefault(name);
  }

  async getFlagOrLegacyDefault(
    companyId: string,
    name: string,
    opts?: SettingScopeOptions
  ): Promise<boolean> {
    const value = await this.getEntryOrLegacyDefault(companyId, name, opts);
    return isLegacyTrue(value);
  }

  /**
   * `CurrencyCode`'s legacy default (`mydataset1.fieldbyname('CurrencyCode').asstring`
   * in untcompanyvariables.pas) is the company's own base currency, not a
   * static literal.
   */
  async getCurrencyCodeOrCompanyDefault(companyId: string): Promise<string | null> {
    const value = await this.getEntry(companyId, 'CurrencyCode');
    if (value != null && value !== '') return value;
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { defaultCurrency: true },
    });
    return settings?.defaultCurrency ?? null;
  }

  // ---- Write / admin API ----

  private async upsertEntry(
    companyId: string,
    name: string,
    value: string,
    branchId: string | null
  ) {
    const existing = await prisma.companySettingEntry.findFirst({
      where: { companyId, branchId, name },
    });
    if (existing) {
      return prisma.companySettingEntry.update({ where: { id: existing.id }, data: { value } });
    }
    return prisma.companySettingEntry.create({ data: { companyId, branchId, name, value } });
  }

  async setEntry(
    companyId: string,
    name: string,
    value: string,
    opts?: SettingScopeOptions
  ) {
    const row = await this.upsertEntry(companyId, name, value, opts?.branchId ?? null);
    await invalidateTenantCache(tenantCacheKeys.settings(companyId));
    return row;
  }

  async setFlag(
    companyId: string,
    name: string,
    value: boolean,
    opts?: SettingScopeOptions
  ) {
    return this.setEntry(companyId, name, value ? 'T' : 'F', opts);
  }

  async setModuleEntry(
    companyId: string,
    baseName: string,
    moduleCode: string,
    value: string,
    opts?: SettingScopeOptions
  ) {
    return this.setEntry(companyId, this.moduleKey(baseName, moduleCode), value, opts);
  }

  async deleteEntry(companyId: string, name: string, opts?: SettingScopeOptions) {
    const branchId = opts?.branchId ?? null;
    const existing = await prisma.companySettingEntry.findFirst({
      where: { companyId, branchId, name },
    });
    if (!existing) return;
    await prisma.companySettingEntry.delete({ where: { id: existing.id } });
    await invalidateTenantCache(tenantCacheKeys.settings(companyId));
  }

  /** List raw rows for an admin/settings UI. `prefix` filters by key prefix (e.g. module family). */
  async listEntries(
    companyId: string,
    opts?: SettingScopeOptions & { prefix?: string }
  ) {
    return prisma.companySettingEntry.findMany({
      where: {
        companyId,
        branchId: opts?.branchId === undefined ? undefined : opts.branchId,
        ...(opts?.prefix ? { name: { startsWith: opts.prefix } } : {}),
      },
      orderBy: [{ branchId: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Static catalog of the 81 company-scope keys, 73 module-suffixed patterns,
   * and the branch-scoped slots. Used by the admin UI; does not hit the DB.
   */
  getCatalog() {
    return {
      companyKeys: Object.values(LEGACY_SETTINGS_DEFAULTS)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((def) => ({
          key: def.key,
          valueKind: def.valueKind,
          defaultValue: def.defaultValue,
          branchScoped: (BRANCH_SCOPED_SETTING_KEYS as readonly string[]).includes(def.key),
          isDynamicDefault: this.isDynamicDefaultKey(def.key),
        })),
      moduleSuffixedKeyPatterns: [...MODULE_SUFFIXED_KEY_PATTERNS],
      branchScopedKeys: [...BRANCH_SCOPED_SETTING_KEYS],
    };
  }

  /**
   * Catalog plus stored values for the admin editor. `branchId` overlays
   * branch-scoped rows on top of the company-wide value (CustomersAccount).
   * `moduleCode` (e.g. SI02) expands every `{ModuleCode}` pattern.
   */
  async getCatalogAdmin(
    companyId: string,
    opts?: { branchId?: string | null; moduleCode?: string }
  ) {
    const companyWide = await this.listEntries(companyId, { branchId: null });
    const companyByName = new Map(companyWide.map((row) => [row.name, row.value]));
    let branchByName = new Map<string, string>();
    if (opts?.branchId) {
      const branchRows = await this.listEntries(companyId, { branchId: opts.branchId });
      branchByName = new Map(branchRows.map((row) => [row.name, row.value]));
    }

    const pickStored = (name: string) => {
      const branchValue = opts?.branchId ? branchByName.get(name) : undefined;
      const companyValue = companyByName.get(name);
      return {
        storedValue: (branchValue ?? companyValue) ?? null,
        isBranchOverride: branchValue != null,
      };
    };

    const catalog = this.getCatalog();
    const companyKeys = catalog.companyKeys.map((def) => {
      const { storedValue, isBranchOverride } = pickStored(def.key);
      return {
        ...def,
        storedValue,
        currentValue: storedValue ?? def.defaultValue,
        isOverride: storedValue != null,
        isBranchOverride,
      };
    });

    const moduleCode = opts?.moduleCode?.trim() || null;
    const moduleKeys = moduleCode
      ? MODULE_SUFFIXED_KEY_PATTERNS.map((pattern) => {
          const baseName = modulePatternBaseName(pattern);
          const key = this.moduleKey(baseName, moduleCode);
          const { storedValue, isBranchOverride } = pickStored(key);
          return {
            pattern,
            baseName,
            key,
            valueKind: inferModulePatternValueKind(baseName),
            storedValue,
            currentValue: storedValue,
            isOverride: storedValue != null,
            isBranchOverride,
          };
        })
      : [];

    return {
      companyKeys,
      moduleSuffixedKeyPatterns: catalog.moduleSuffixedKeyPatterns,
      branchScopedKeys: catalog.branchScopedKeys,
      moduleKeys,
      moduleCode,
      branchId: opts?.branchId ?? null,
    };
  }
}

export const companySettingService = new CompanySettingService();
