import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { LEGACY_ADVANCED_RIGHT_FAMILIES } from '../data/legacy-advanced-rights-families';

export type DocumentRightsMap = Record<string, boolean>;

interface StoredAdvancedPermissions {
  allowAllTransfers?: boolean;
  disallowAllTransfers?: boolean;
  operations?: unknown;
  documentRights?: DocumentRightsMap;
}

const KNOWN_KEYS = new Set<string>(
  LEGACY_ADVANCED_RIGHT_FAMILIES.flatMap((f) => [f.key, f.unpostKey].filter((k): k is string => !!k))
);

/**
 * Ports legacy `AdvancedRights` (per-user post/unpost per document family,
 * `MainProgram/untbranchvariables.pas Tbranch.set_variables` 124-405) onto
 * the existing `UserAdvancedPermission.permissions` JSON blob, alongside
 * the unrelated transfer/untransfer `operations` shape it already stores.
 * See `legacy-advanced-rights-families.ts` for the full key list and the
 * default-allow-when-unprovisioned rationale.
 */
export class AdvancedRightsService {
  async getDocumentRights(
    companyId: string,
    userId: string,
    branchId?: string | null
  ): Promise<DocumentRightsMap | null> {
    const row =
      (branchId
        ? await prisma.userAdvancedPermission.findFirst({
            where: { companyId, userId, branchId },
          })
        : null) ??
      (await prisma.userAdvancedPermission.findFirst({
        where: { companyId, userId, branchId: null },
      }));

    const stored = row?.permissions as StoredAdvancedPermissions | undefined;
    return stored?.documentRights ?? null;
  }

  async setDocumentRights(
    companyId: string,
    userId: string,
    branchId: string | null,
    rights: DocumentRightsMap
  ): Promise<DocumentRightsMap> {
    for (const key of Object.keys(rights)) {
      if (!KNOWN_KEYS.has(key)) {
        throw new AppError(400, `Unknown legacy document right key: ${key}`);
      }
    }

    const existing = await prisma.userAdvancedPermission.findFirst({
      where: { companyId, userId, branchId: branchId ?? null },
    });

    const existingStored = (existing?.permissions as StoredAdvancedPermissions | undefined) ?? {};
    const merged: StoredAdvancedPermissions = {
      ...existingStored,
      documentRights: { ...(existingStored.documentRights ?? {}), ...rights },
    };

    if (existing) {
      await prisma.userAdvancedPermission.update({
        where: { id: existing.id },
        data: { permissions: merged as any },
      });
    } else {
      await prisma.userAdvancedPermission.create({
        data: { companyId, userId, branchId: branchId ?? null, permissions: merged as any },
      });
    }

    return merged.documentRights!;
  }

  /**
   * `Admin` always passes (legacy bypass). Otherwise: no `documentRights`
   * provisioned for this user yet -> unrestricted (see file header). Once
   * provisioned, the flag must be explicitly `true`, matching legacy's
   * `<>'T' -> deny` rule for a real row.
   */
  async canPostFamily(
    companyId: string,
    userId: string,
    branchId: string | null | undefined,
    key: string,
    opts?: { isAdmin?: boolean }
  ): Promise<boolean> {
    if (opts?.isAdmin) return true;
    const rights = await this.getDocumentRights(companyId, userId, branchId);
    if (!rights) return true;
    return rights[key] === true;
  }

  async assertCanPostFamily(
    companyId: string,
    userId: string,
    branchId: string | null | undefined,
    key: string,
    opts?: { isAdmin?: boolean; actionLabel?: string }
  ): Promise<void> {
    const ok = await this.canPostFamily(companyId, userId, branchId, key, opts);
    if (!ok) {
      throw new AppError(
        403,
        `User is not permitted to ${opts?.actionLabel ?? key} (AdvancedRights)`
      );
    }
  }
}

export const advancedRightsService = new AdvancedRightsService();
