/** Longest prefix first so `/accounting-settings` is not swallowed by `/accounting`. */
export const APP_TAB_MODULE_ROOTS = [
  '/accounting-settings',
  '/electronic-invoices',
  '/real-estate-investment',
  '/accounting',
  '/real-estate',
  '/inventory',
  '/purchases',
  '/extracts',
  '/subcontracts',
  '/contracting',
  '/importexport',
  '/manufacturing',
  '/sales',
  '/hr',
  '/pos',
] as const;

export function normalizeAppPath(path: string): string {
  const base = path.split('?')[0]?.split('#')[0] ?? path;
  if (base.length > 1 && base.endsWith('/')) return base.slice(0, -1);
  return base || '/';
}

export function moduleRootForPath(path: string): string | null {
  const normalized = normalizeAppPath(path);
  return (
    APP_TAB_MODULE_ROOTS.find(
      (root) => normalized === root || normalized.startsWith(`${root}/`)
    ) ?? null
  );
}

export function isSameAppModule(fromPath: string, toPath: string): boolean {
  const from = moduleRootForPath(fromPath);
  const to = moduleRootForPath(toPath);
  return Boolean(from && from === to);
}
