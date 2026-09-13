import { TENANT_ARG_KEYS, type SecurityContext } from './types';

/** LLM-emitted tenant keys are discarded. JWT context is the only company source. */
export function stripTenantArgs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripTenantArgs);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if ((TENANT_ARG_KEYS as readonly string[]).includes(key)) continue;
    out[key] = stripTenantArgs(nested);
  }
  return out;
}

export function defaultMonthRange(fromDate?: string, toDate?: string): { fromDate: Date; toDate: Date } {
  const now = new Date();
  const start = fromDate
    ? parseIsoDateStart(fromDate)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = toDate
    ? parseIsoDateEnd(toDate)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { fromDate: start, toDate: end };
}

export function parseIsoDateStart(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export function parseIsoDateEnd(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T23:59:59.999Z`);
}

export function parseIsoDate(iso: string | undefined, fallback = new Date()): Date {
  if (!iso) return fallback;
  return parseIsoDateStart(iso);
}

/**
 * Drop any tenant/user ids the model invented, then pin the JWT session.
 * Tool handlers must still read company/user from `context`, never from params.
 */
export function bindSessionTenant(
  rawParams: unknown,
  context: Pick<SecurityContext, 'companyId' | 'userId'>
): { sanitizedParams: unknown; session: { companyId: string; userId: string } } {
  return {
    sanitizedParams: stripTenantArgs(rawParams ?? {}),
    session: {
      companyId: context.companyId,
      userId: context.userId,
    },
  };
}
