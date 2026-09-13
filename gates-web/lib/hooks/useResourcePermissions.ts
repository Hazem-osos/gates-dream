'use client';

import { usePathname } from 'next/navigation';
import { useCurrentUserProfile } from './useCurrentUserProfile';
import { resourceFromPath } from '../auth/resource-from-path';

export type FgacAction = 'view' | 'edit' | 'delete' | 'post' | 'print' | 'approve' | 'override_tier_price';

export interface ResourcePermissions {
  resource: string | null;
  module?: string;
  isAdmin: boolean;
  isLoading: boolean;
  can: (action: FgacAction | 'export') => boolean;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
  canPost: boolean;
  canExport: boolean;
}

/**
 * Live FGAC evaluation for the current user against a screen resource.
 * `export` is the same grant as `print` (legacy CanPrint covers exports).
 * `add` maps to `edit` — the web model merged legacy CanAdd + CanModify.
 */
export function useResourcePermissions(opts?: {
  resource?: string;
  module?: string;
}): ResourcePermissions {
  const pathname = usePathname() ?? '';
  const inferred = resourceFromPath(pathname);
  const resource = opts?.resource ?? inferred?.resource ?? null;
  const resourceModule = opts?.module ?? inferred?.module;
  const { profile, isLoading } = useCurrentUserProfile();

  const isAdmin = profile?.roles?.includes('admin') ?? false;
  const grantAll = isAdmin || (profile?.permissions?.some((p) => p.resource === '*') ?? false);

  const can = (action: FgacAction | 'export'): boolean => {
    const resolved: FgacAction = action === 'export' ? 'print' : action;
    if (!resource) return true;
    if (!profile) return true;
    if (grantAll) return true;
    return (profile.permissions ?? []).some(
      (p) =>
        p.allow &&
        (p.resource === resource || p.resource === '*') &&
        p.action === resolved &&
        (!resourceModule || !p.module || p.module === resourceModule)
    );
  };

  return {
    resource,
    module: resourceModule,
    isAdmin,
    isLoading,
    can,
    canView: can('view'),
    canAdd: can('edit'),
    canEdit: can('edit'),
    canDelete: can('delete'),
    canPrint: can('print'),
    canPost: can('post'),
    canExport: can('print'),
  };
}
