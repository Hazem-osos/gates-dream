import { Response, NextFunction } from 'express';
import { AuthRequest, Permission } from '../auth/types';
import { AppError } from './error-handler';
import { logger } from '../logger';
import {
  getCachedUserPermissions,
  permissionGrantedFromCache,
} from '../cache/tenant-context.cache';

/**
 * Authorization Middleware
 * Checks if user has required permissions using Fine-Grained Access Control (FGAC)
 */

export interface AuthorizeOptions {
  resource: string;
  action: Permission['action'];
  module?: string; // Optional module filter
  branchId?: string; // Optional branch filter
  requireAll?: boolean; // If true, user must have ALL specified permissions
}

/**
 * Check if user has required permission using FGAC
 */
const hasPermission = async (
  userId: string,
  companyId: string,
  requiredResource: string,
  requiredAction: Permission['action'],
  options?: {
    module?: string;
    branchId?: string;
  }
): Promise<boolean> => {
  try {
    const cached = await getCachedUserPermissions(userId, companyId);
    return permissionGrantedFromCache(cached, requiredResource, requiredAction, {
      module: options?.module,
      branchId: options?.branchId,
    });
  } catch (error) {
    logger.error(
      { error, userId, companyId, requiredResource, requiredAction, options },
      'Error checking permission'
    );
    return false;
  }
};

/**
 * Fallback role-based permission check (for backward compatibility)
 */
const hasRolePermission = (
  userRoles: string[],
  requiredResource: string,
  requiredAction: Permission['action']
): boolean => {
  // Map roles to permissions (fallback)
  const rolePermissions: Record<string, Permission[]> = {
    admin: [
      { resource: '*', action: 'view' },
      { resource: '*', action: 'edit' },
      { resource: '*', action: 'delete' },
      { resource: '*', action: 'approve' },
      { resource: '*', action: 'post' },
    ],
    accountant: [
      { resource: 'invoice', action: 'view' },
      { resource: 'invoice', action: 'edit' },
      { resource: 'invoice', action: 'approve' },
      // M22 fix: was `journal_entry` (snake_case) — every actual route
      // (`journal-entry.routes.ts`) authorizes against `'journal-entry'`
      // (kebab-case), so this fallback silently never matched.
      { resource: 'journal-entry', action: 'view' },
      { resource: 'journal-entry', action: 'edit' },
      { resource: 'journal-entry', action: 'post' },
      { resource: 'treasury', action: 'view' },
      { resource: 'treasury', action: 'edit' },
      { resource: 'tax', action: 'view' },
      { resource: 'tax', action: 'edit' },
      { resource: 'pos', action: 'view' },
      { resource: 'pos', action: 'edit' },
      { resource: 'account', action: 'view' },
    ],
    hr_manager: [
      { resource: 'employee', action: 'view' },
      { resource: 'employee', action: 'edit' },
      { resource: 'employee', action: 'delete' },
      { resource: 'payroll', action: 'view' },
      { resource: 'payroll', action: 'edit' },
      { resource: 'payroll', action: 'approve' },
    ],
    inventory_viewer: [
      { resource: 'item', action: 'view' },
      { resource: 'invoice', action: 'view' },
    ],
    sales_user: [
      { resource: 'item', action: 'view' },
      { resource: 'invoice', action: 'view' },
      { resource: 'invoice', action: 'edit' },
    ],
  };

  // Check if user has admin role (has all permissions)
  if (userRoles.includes('admin')) {
    return true;
  }

  // Check each role for permission
  for (const role of userRoles) {
    const permissions = rolePermissions[role] || [];

    for (const permission of permissions) {
      // Check wildcard permission
      if (permission.resource === '*') {
        return true;
      }

      // Check exact match
      if (
        permission.resource === requiredResource &&
        permission.action === requiredAction
      ) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Authorization middleware factory with FGAC support
 */
export const authorize = (options: AuthorizeOptions) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        throw new AppError(401, 'Authentication required');
      }

      const userId = req.user.sub;
      const companyId = req.companyId || req.tenantId || req.user.company_id;

      if (!companyId) {
        throw new AppError(400, 'Company ID is required');
      }

      // Get user roles from token (for fallback)
      const userRoles =
        req.user.realm_access?.roles || req.user.resource_access?.['gates-backend']?.roles || [];

      // First, check FGAC permissions (user-specific permissions from database)
      const fgacAccess = await hasPermission(
        userId,
        companyId,
        options.resource,
        options.action,
        {
          module: options.module,
          branchId: options.branchId || req.branchId,
        }
      );

      if (fgacAccess) {
        logger.debug(
          {
            userId,
            resource: options.resource,
            action: options.action,
            method: 'FGAC',
          },
          'Authorization granted via FGAC'
        );
        return next();
      }

      // Fallback to role-based check if no FGAC permission found
      const roleAccess = hasRolePermission(
        userRoles,
        options.resource,
        options.action
      );

      if (roleAccess) {
        logger.debug(
          {
            userId,
            resource: options.resource,
            action: options.action,
            method: 'Role-based',
            roles: userRoles,
          },
          'Authorization granted via role'
        );
        return next();
      }

      // Access denied
      logger.warn(
        {
          userId,
          resource: options.resource,
          action: options.action,
          roles: userRoles,
          companyId,
        },
        'Authorization denied'
      );

      throw new AppError(403, 'Insufficient permissions');
    } catch (error) {
      next(error);
    }
  };
};
