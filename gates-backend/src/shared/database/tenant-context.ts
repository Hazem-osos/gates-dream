import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Item 37 (Phase 6, platform-wide): central tenant context for the Prisma
 * tenant-scoping extension (`tenant-scoping.extension.ts`).
 *
 * MySQL has no row-level security, so tenant isolation has always been
 * "application-level only" — every service is expected to remember to add
 * `companyId` to every `where` clause (see `tenant.middleware.ts`'s own
 * comments). That is exactly the "per-query discipline" the audit flags as
 * fragile: one forgotten filter in any of ~226 services leaks
 * cross-tenant data with no test or type system catching it.
 *
 * This module carries the current request's `companyId` through
 * `AsyncLocalStorage` so the Prisma extension can enforce it centrally,
 * as a defense-in-depth safety net *underneath* existing per-query filters
 * — not a replacement for them (removing 135 models' worth of explicit
 * `companyId` filters in one pass is out of scope and unnecessarily risky;
 * the extension protects the case where a filter is missing or wrong).
 */

export interface TenantContext {
  companyId: string;
  /** True inside `runWithoutTenantScoping` — the extension skips enforcement for the whole callback. */
  bypass?: boolean;
}

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Runs `fn` with `companyId` bound to the current async context.
 *
 * Deliberately `await`s `fn()` *inside* the `storage.run` callback rather
 * than just returning it: `AsyncLocalStorage.run(store, cb)` only tracks
 * continuations created while `cb` itself is executing. Prisma's
 * `prisma.model.method(...)` calls return a lazy `PrismaPromise` — the
 * actual query engine dispatch (which is what invokes the tenant-scoping
 * extension's `$allOperations` hook) doesn't happen until something
 * `await`s/`.then()`s it. If `fn` were a plain sync function that just
 * *returns* that promise without awaiting it, the eventual dispatch would
 * be a continuation of the *caller's* `await`, not of anything that ran
 * inside `run()` — so `getTenantContext()` would see `undefined` by the
 * time the extension hook actually runs. Awaiting here keeps the dispatch
 * inside `run()`'s tracked scope.
 */
export async function runWithTenantContext<T>(companyId: string, fn: () => T | Promise<T>): Promise<T> {
  return storage.run({ companyId }, async () => fn());
}

/** Current request's companyId, or `undefined` outside any request context (scripts, seeds, tests). */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Escape hatch for legitimate cross-tenant operations (platform admin
 * queries, onboarding/migration scripts, scheduled jobs that iterate all
 * companies). Explicit and named so it is greppable and reviewable, unlike
 * silently running outside any request context.
 *
 * See `runWithTenantContext` for why `fn()` is awaited *inside* `storage.run`.
 */
export async function runWithoutTenantScoping<T>(fn: () => T | Promise<T>): Promise<T> {
  const current = storage.getStore();
  return storage.run({ companyId: current?.companyId ?? '', bypass: true }, async () => fn());
}
