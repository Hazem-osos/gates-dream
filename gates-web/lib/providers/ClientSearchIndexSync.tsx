'use client';

import { useEffect } from 'react';
import {
  useCustomersQuery,
  useItemsQuery,
  useSuppliersQuery,
} from '@/lib/hooks/useMasterDataQueries';
import { useClientEntitySearch } from '@/lib/hooks/useClientEntitySearch';

/**
 * Keeps Web Worker search indexes warm from React Query master-data caches.
 */
export function ClientSearchIndexSync() {
  const itemsQ = useItemsQuery(500);
  const customersQ = useCustomersQuery();
  const suppliersQ = useSuppliersQuery();

  const itemsSearch = useClientEntitySearch('items');
  const customersSearch = useClientEntitySearch('customers');
  const suppliersSearch = useClientEntitySearch('suppliers');

  useEffect(() => {
    const rows = itemsQ.data?.data ?? [];
    itemsSearch.syncIndex(
      rows.map((item) => ({
        id: item.id,
        fields: [
          item.code ?? '',
          item.serial ?? '',
          item.arabicName,
          item.englishName ?? '',
        ],
      }))
    );
  }, [itemsQ.data, itemsSearch]);

  useEffect(() => {
    const rows = customersQ.data?.data ?? [];
    customersSearch.syncIndex(
      rows.map((p) => ({
        id: p.id,
        fields: [p.code ?? '', p.arabicName, p.englishName ?? ''],
      }))
    );
  }, [customersQ.data, customersSearch]);

  useEffect(() => {
    const rows = suppliersQ.data?.data ?? [];
    suppliersSearch.syncIndex(
      rows.map((p) => ({
        id: p.id,
        fields: [p.code ?? '', p.arabicName, p.englishName ?? ''],
      }))
    );
  }, [suppliersQ.data, suppliersSearch]);

  return null;
}
