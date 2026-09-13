import { AuthRequest } from './types';

/**
 * JWT realm/client roles for the request, mirroring the extraction logic in
 * `authorize.middleware.ts`'s role-based fallback. Kept here so other call
 * sites (branch/document-family permission gates) don't duplicate it.
 */
export function getRequestRoles(req: AuthRequest): string[] {
  return req.user?.realm_access?.roles || req.user?.resource_access?.['gates-backend']?.roles || [];
}

/**
 * Legacy `Admin` bypasses every screen/menu, post/unpost, bank-box, and
 * branch restriction (`untbranchvariables.pas` `Tbranch.set_variables`,
 * `UntMain.pas` `ApplyMenuAccess`). The web equivalent is the `admin` JWT role.
 */
export function isAdminRequest(req: AuthRequest): boolean {
  return getRequestRoles(req).includes('admin');
}
