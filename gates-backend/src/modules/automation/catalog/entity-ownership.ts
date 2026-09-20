/**
 * Tenant-ownership checks for entity-typed condition/action-config values.
 * Every EntityKind maps to a real Prisma model with a `companyId` column.
 */
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { runWithoutTenantScoping } from '../../../shared/database/tenant-context';
import type { EntityKind } from './field-types';

type EntityDelegate = {
  findMany: (args: { where: unknown; select: unknown }) => Promise<Array<{ id: string }>>;
};

function delegateFor(entityKind: EntityKind): EntityDelegate {
  switch (entityKind) {
    case 'customer':
      return prisma.customer as unknown as EntityDelegate;
    case 'supplier':
      return prisma.supplier as unknown as EntityDelegate;
    case 'item':
      return prisma.item as unknown as EntityDelegate;
    case 'warehouse':
      return prisma.warehouse as unknown as EntityDelegate;
    case 'customerCategory':
      return prisma.customerCategory as unknown as EntityDelegate;
    case 'user':
      return prisma.user as unknown as EntityDelegate;
    default: {
      const exhaustive: never = entityKind;
      throw new Error(`Unknown entity kind: ${exhaustive as string}`);
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Throws 400 if any id is malformed or does not belong to `companyId`.
 * Uses `runWithoutTenantScoping` because this runs from S2S/session-derived
 * `companyId` context, mirroring the existing automation lookup pattern —
 * the explicit `companyId` in the where clause is the real isolation guard.
 */
export async function assertEntitiesBelongToCompany(
  companyId: string,
  entityKind: EntityKind,
  ids: string[],
  fieldLabel: string
): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;

  for (const id of uniqueIds) {
    if (!UUID_RE.test(id)) {
      throw new AppError(400, `"${fieldLabel}" must be a valid UUID (got "${id}")`);
    }
  }

  const delegate = delegateFor(entityKind);
  const rows = await runWithoutTenantScoping(() =>
    delegate.findMany({
      where: { id: { in: uniqueIds }, companyId },
      select: { id: true },
    })
  );
  if (rows.length !== uniqueIds.length) {
    throw new AppError(
      400,
      `One or more "${fieldLabel}" references do not exist or do not belong to this company`
    );
  }
}
