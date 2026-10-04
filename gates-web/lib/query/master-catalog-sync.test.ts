import { QueryClient } from '@tanstack/react-query';
import { test } from 'vitest';
import { catalogWriteFromResponse, rememberCatalogRow } from './master-catalog-sync';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

test('a saved item is inserted into the open catalog list', () => {
  const client = new QueryClient();
  const key = ['items', 'guide', { limit: 1000, isActive: true }] as const;
  client.setQueryData(key, {
    status: 'success',
    data: [{ id: 'old', arabicName: 'قديم', serial: '1', isActive: true }],
  });

  rememberCatalogRow(client, 'items', { id: 'new', arabicName: 'جديد', serial: '2' }, 'POST');

  const cached = client.getQueryData<{
    data: Array<{ id: string; code?: string; isActive?: boolean; arabicName?: string }>;
  }>(key);
  const created = cached?.data.find((row) => row.id === 'new');
  assert(created?.arabicName === 'جديد', 'new item is in the guide list');
  assert(created?.code === '2', 'serial is copied onto code');
  assert(created?.isActive === true, 'new item stays visible on the active list');
  assert(cached?.data.some((row) => row.id === 'old'), 'previous items stay');

  const write = catalogWriteFromResponse('/inventory/items', 'POST', {
    data: { id: 'abc', arabicName: 'صنف' },
  });
  assert(write.row?.id === 'abc', 'post body becomes the row');

  const deleted = catalogWriteFromResponse(
    '/inventory/items/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    'DELETE',
    {}
  );
  assert(
    deleted.method === 'DELETE' && deleted.row?.id === 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    'delete uses the url id'
  );
});
