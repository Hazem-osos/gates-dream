import type { QueryClient } from '@tanstack/react-query';

type CreatedCategory = {
  id: string;
  code?: string | null;
  arabicName?: string | null;
  englishName?: string | null;
  groupType?: string | null;
  parentCategoryId?: string | null;
  isActive?: boolean;
};

/** Puts a just-saved group into every open item-category list before the refetch lands. */
export function rememberCreatedItemCategory(queryClient: QueryClient, row: CreatedCategory) {
  if (!row.id) return;
  const cached = queryClient.getQueriesData({ queryKey: ['item-categories'] });
  for (const [queryKey, old] of cached) {
    if (!old || typeof old !== 'object' || !('data' in old) || !Array.isArray(old.data)) continue;
    if (old.data.some((item) => item && typeof item === 'object' && 'id' in item && item.id === row.id)) {
      continue;
    }
    queryClient.setQueryData(queryKey, {
      ...old,
      data: [
        ...old.data,
        {
          id: row.id,
          code: row.code ?? '',
          arabicName: row.arabicName ?? '',
          englishName: row.englishName ?? null,
          groupType: row.groupType ?? null,
          parentCategoryId: row.parentCategoryId ?? null,
          isActive: row.isActive !== false,
        },
      ],
    });
  }
}
