import { logger } from '../logger';
import { getTenantContext } from './tenant-context';
import { TENANT_SCOPED_MODELS } from './tenant-scoped-models.generated';

/**
 * Item 37 (Phase 6, platform-wide): central tenant isolation via a Prisma
 * client extension.
 *
 * MySQL has no row-level security, so every one of the ~226 services in
 * this codebase is individually responsible for adding `companyId` to its
 * own `where`/`data`. That "per-query discipline" is exactly the fragile
 * pattern this item calls out: one missed filter on any of the 135
 * tenant-scoped models leaks or corrupts another company's data, silently,
 * with nothing in the type system or test suite to catch it.
 *
 * This extension does NOT replace those per-query filters (rewriting all
 * of them in one pass is out of scope and would be its own large source of
 * regressions). It adds a second, independent layer underneath them:
 *
 *   - Every read/update/delete/aggregate `where` on a tenant-scoped model
 *     is AND-ed with `{ companyId: <current request's companyId> }` — so
 *     even a query that forgot its own companyId filter (or somehow got
 *     the wrong one) can only ever see/touch rows in the caller's own
 *     company; the query fails closed (returns nothing) rather than
 *     leaking, exactly like a real row-level-security policy would.
 *   - Every `create`/`createMany` on a tenant-scoped model has
 *     `companyId` stamped onto the row if the caller didn't set one.
 *
 * The tenant `companyId` is threaded via `AsyncLocalStorage`
 * (`tenant-context.ts`), bound once per request by `setTenantContext`
 * (and by extension `graphqlMiddleware`, which chains the same
 * middleware). Code with no active tenant context — scripts, seeds, unit
 * tests that construct their own `PrismaClient`, admin/cross-tenant jobs
 * wrapped in `runWithoutTenantScoping` — passes through unscoped, exactly
 * as before this extension existed. This keeps the change additive and
 * safe: it can only ever narrow a query that already had an active
 * per-request tenant context, never break code paths that don't.
 */

// These take a flexible `*WhereInput` `where` — safe to AND-wrap wholesale,
// since there's no required top-level field.
const FILTER_WHERE_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'updateMany',
  'deleteMany',
  'aggregate',
  'count',
  'groupBy',
]);

// `findUnique` / `findUniqueOrThrow` / `update` / `delete` / `upsert` all
// take a `*WhereUniqueInput` `where`, which — unlike `*WhereInput` above —
// *requires* a unique identifying field (id, or a compound unique key)
// directly at the top level; nesting it inside an `AND` (as
// `scopeFilterWhere` does) trips Prisma's own client-side validation
// ("needs at least one of `id` or ... arguments") before the query even
// reaches the database. `companyId` is still a plain, non-unique field on
// every one of these generated types, so merging it in directly alongside
// the unique identifier is both valid and sufficient to enforce scoping.
const UNIQUE_WHERE_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert']);

function scopeFilterWhere(where: unknown, companyId: string): Record<string, unknown> {
  return { AND: [where ?? {}, { companyId }] };
}

function scopeUniqueWhere(where: unknown, companyId: string): Record<string, unknown> {
  const base = where && typeof where === 'object' ? (where as Record<string, unknown>) : {};
  return { ...base, companyId };
}

/**
 * SECURITY (Wave 1): this used to only stamp `companyId` when the key was absent
 * (`!('companyId' in data)`), so a caller-supplied `companyId` — e.g.
 * `company-copy.service.ts`'s `companyId: toCompanyId` from a URL param — passed straight
 * through untouched. That is what made the company-copy cross-tenant write exploitable:
 * the one enforcement layer meant to catch exactly this case deferred to the value it was
 * supposed to be checking. Now the current request's `companyId` always wins, regardless
 * of what the caller passed in.
 */
function stampCreateData(data: unknown, companyId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => stampCreateData(item, companyId));
  }
  if (data && typeof data === 'object') {
    return { ...data, companyId };
  }
  return data;
}

interface AllOperationsArgs {
  model?: string;
  operation: string;
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
}

// Deliberately untyped (`args`/`query` as loose `Record`/function shapes,
// no `Prisma.defineExtension`): the strongly-typed extension API resolves
// a very large generic (one arm per model x operation) that comfortably
// type-checks with plain `tsc`, but blows the default ts-jest/V8 heap when
// this file is pulled into a test's program (see Item 37 PR notes). This
// hook is intentionally model-agnostic — it never needs precise per-model
// argument types — so nothing is lost by keeping it untyped; the final
// `.$extends(...)` result is cast back to `PrismaClient` in `prisma.ts`
// regardless.
async function allOperationsHandler({ model, operation, args, query }: AllOperationsArgs) {
  if (!model || !TENANT_SCOPED_MODELS.has(model.charAt(0).toLowerCase() + model.slice(1))) {
    return query(args);
  }

  const ctx = getTenantContext();
  if (!ctx || ctx.bypass || !ctx.companyId) {
    return query(args);
  }

  const scopedArgs = { ...args };

  if (FILTER_WHERE_OPS.has(operation)) {
    scopedArgs.where = scopeFilterWhere(scopedArgs.where, ctx.companyId);
  } else if (UNIQUE_WHERE_OPS.has(operation)) {
    scopedArgs.where = scopeUniqueWhere(scopedArgs.where, ctx.companyId);
  }

  if (operation === 'upsert') {
    scopedArgs.create = stampCreateData(scopedArgs.create, ctx.companyId);
  }

  if (operation === 'create' || operation === 'createMany') {
    scopedArgs.data = stampCreateData(scopedArgs.data, ctx.companyId);
  }

  try {
    return await query(scopedArgs);
  } catch (error) {
    logger.debug({ model, operation, companyId: ctx.companyId, error }, 'Tenant-scoped Prisma operation failed');
    throw error;
  }
}

export const tenantScopingExtensionConfig = {
  name: 'tenant-scoping',
  query: {
    $allModels: {
      $allOperations: allOperationsHandler,
    },
  },
};
