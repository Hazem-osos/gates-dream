/**
 * Regression test for a cross-tenant privilege-escalation bug in
 * `POST /api/v1/api-keys`: the route used to take `tenantId` from
 * `req.body.tenantId` before falling back to the authenticated session,
 * so any user with `api-key:edit` permission in their own company could
 * mint an API key scoped to an arbitrary OTHER company. That key's
 * `tenantId` is exactly what `apiKeyMayLookupCompany` trusts to authorize
 * `/internal/v1/automation/*` calls — so this let an ordinary tenant admin
 * silently read/act on a different tenant's automation rules and
 * purchase-request automation.
 *
 * Fix: `resolveApiKeyTenantId` always derives the tenant from the
 * authenticated session and rejects (rather than silently overrides) any
 * request body that names a different company.
 */
import { resolveApiKeyTenantId } from '../../shared/security/api-key-manager';

const COMPANY_A = 'd5b92313-74fc-4359-875a-7b9ee5918ac3';
const COMPANY_B = '00000000-0000-0000-0000-000000000002';

describe('resolveApiKeyTenantId', () => {
  it('scopes the new key to the session company when no body tenantId is sent', () => {
    expect(resolveApiKeyTenantId(COMPANY_A, undefined)).toEqual({ tenantId: COMPANY_A });
  });

  it('allows a body tenantId that matches the session company (no behavior change for legitimate callers)', () => {
    expect(resolveApiKeyTenantId(COMPANY_A, COMPANY_A)).toEqual({ tenantId: COMPANY_A });
  });

  it('rejects — never silently overrides — a body tenantId for a different company', () => {
    expect(resolveApiKeyTenantId(COMPANY_A, COMPANY_B)).toEqual({ error: 'tenant_mismatch' });
  });

  it('rejects when the caller has no resolvable session company at all', () => {
    expect(resolveApiKeyTenantId(undefined, undefined)).toEqual({ error: 'no_session_company' });
    expect(resolveApiKeyTenantId(undefined, COMPANY_B)).toEqual({ error: 'no_session_company' });
  });
});
