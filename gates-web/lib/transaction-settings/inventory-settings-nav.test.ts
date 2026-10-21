import { describe, expect, it } from 'vitest';
import {
  INVENTORY_DOCUMENT_SETTINGS_GROUPS,
  TRANSACTION_SETTINGS_CONTEXT,
} from './types';

describe('inventory document settings nav', () => {
  it('lists every inventory operations settings page exactly once', () => {
    const listed = INVENTORY_DOCUMENT_SETTINGS_GROUPS.flatMap((group) => group.types);
    const inventoryTypes = Object.values(TRANSACTION_SETTINGS_CONTEXT)
      .filter((ctx) => ctx.module === 'inventory')
      .map((ctx) => ctx.documentType);

    expect([...listed].sort()).toEqual([...inventoryTypes].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });
});
