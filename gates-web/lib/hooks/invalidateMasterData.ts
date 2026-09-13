import type { QueryClient } from '@tanstack/react-query';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';

/** Invalidate TanStack queries used by master-data dropdowns after seed / onboarding. */
export function invalidateMasterDataQueries(
  invalidate: (key: readonly unknown[]) => void
) {
  invalidate(['accounts']);
  invalidate(['coa-tree']);
  invalidate(['warehouses']);
  invalidate(['units']);
  invalidate(['items']);
  invalidate(['customers']);
  invalidate(['suppliers']);
  invalidate(['cost-centers']);
  invalidate(['currencies']);
  invalidate(['company-branches']);
  invalidate(['company-current']);
  invalidate(['company-fiscal-years']);
  invalidate(['tax-rules']);
  invalidate(['gl-defaults']);
  invalidate(['accounting-settings']);
}

export function invalidateMasterDataClient(queryClient: QueryClient) {
  clearConditionalGetCache();
  const keys = [
    ['accounts'],
    ['coa-tree'],
    ['warehouses'],
    ['units'],
    ['items'],
    ['customers'],
    ['suppliers'],
    ['cost-centers'],
    ['currencies'],
    ['company-branches'],
    ['company-current'],
    ['company-fiscal-years'],
    ['tax-rules'],
    ['gl-defaults'],
    ['accounting-settings'],
  ] as const;
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
