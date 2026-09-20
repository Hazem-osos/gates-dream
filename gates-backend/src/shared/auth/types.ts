/**
 * Authentication & Authorization Types
 */

import { Request } from 'express';

/**
 * JWT payload shape for both Keycloak RS256 tokens and development HS256 tokens.
 *
 * Standard claims (iss, aud, jti) are intentionally omitted here — they are  
 * validated by the library but not consumed by application code.
 */
export interface JwtPayload {
  /** Subject — User ID (UUID). Present in all token modes. */
  sub: string;
  email: string;
  username: string;

  // ── Standard JWT time claims (populated by jwt.verify) ──────────────────
  iat?: number; // issued-at (epoch seconds)
  exp?: number; // expiry   (epoch seconds)

  // ── Keycloak role claims ─────────────────────────────────────────────────
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [clientId: string]: {
      roles: string[];
    };
  };

  // ── Gates ERP tenant / company claims ───────────────────────────────────
  /** Primary company/tenant identifier — set for both dev-JWT and Keycloak tokens. */
  company_id?: string;
  /** Alias for company_id — kept for Keycloak claim compatibility. */
  tenant_id?: string;
  /** Active branch ID (optional; may not be set on login). */
  branch_id?: string;
  /** Flat role string — used by the development HS256 path. */
  role?: string;
}

/**
 * Extended Express Request that carries the authenticated user context.
 * Gates-ERP middleware writes these properties; controllers read them.
 */
export interface AuthRequest extends Request {
  file?: Express.Multer.File;
  user?: JwtPayload;
  /** Resolved company/tenant ID — canonical field for RLS queries. */
  companyId?: string;
  /** Alias for companyId — Keycloak tokens surface company as tenant_id. */
  tenantId?: string;
  /** Active branch ID parsed from the token or request context. */
  branchId?: string;
  /** Active fiscal year (UUID) from header or resolved for the operation. */
  fiscalYearId?: string;
  /** Set by `authenticateInternalAutomation` on `/internal/v1/automation/*`. */
  internalAutomation?: {
    source: 'platform-secret' | 'api-key';
    apiKey?: { tenantId?: string; permissions: string[] };
    scopedCompanyId?: string;
  };
}

// ── Permission / Role helper types ───────────────────────────────────────────

/**
 * The complete, storable set of permission actions — the single source of truth
 * shared by the `Permission` type, the Zod write schema
 * (`users/schemas/user-permissions.schema.ts`) and the definitions catalog.
 *
 * `permissionGrantedFromCache` matches `action` by exact string, so an action a
 * route authorizes against but the schema cannot store is a permanently
 * un-grantable guard (it can only ever pass via the role fallback). That is why
 * this list is exported and reused instead of being restated per layer.
 *
 * Legacy mapping: `HiddenScreen`'s five flags collapse onto the first four —
 * CanNavigate -> view, CanAdd + CanModify -> edit, CanDelete -> delete,
 * CanPrint -> print. `approve`/`post` are the web workflow additions, and
 * `override_tier_price` is a fine-grained pricing capability with no CRUD twin.
 * `create`/`update` used to exist here as edit synonyms; they were removed and
 * their route guards folded into `edit` (nothing could grant them).
 */
export const PERMISSION_ACTIONS = [
  'view',
  'edit',
  'delete',
  'approve',
  'post',
  'print',
  'override_tier_price',
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export interface Permission {
  resource: string;
  action: PermissionAction;
}

export interface Role {
  name: string;
  permissions: Permission[];
}
