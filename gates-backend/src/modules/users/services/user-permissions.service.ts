import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Permission } from '../../../shared/auth/types';
import { invalidateUserPermissionCache } from '../../../shared/cache/tenant-context.cache';

export interface UserPermissionData {
  userId: string;
  resource: string;
  action: Permission['action'];
  module?: string;
  branchId?: string;
  allow?: boolean;
}

export interface AssignPermissionsData {
  userId: string;
  module?: string;
  branchId?: string;
  permissions: {
    resource: string;
    action: Permission['action'];
    allow: boolean;
  }[];
}

export interface AdvancedPermissionData {
  userId: string;
  branchId?: string;
  allowAllTransfers?: boolean;
  disallowAllTransfers?: boolean;
  operations?: {
    cashReceipt?: { transfer?: boolean; untransfer?: boolean };
    cashPayment?: { transfer?: boolean; untransfer?: boolean };
    dailyEntries?: { transfer?: boolean; untransfer?: boolean };
    openingBalances?: { transfer?: boolean; untransfer?: boolean };
  };
}

export class UserPermissionsService {
  /**
   * Assign permission to user
   */
  async assignPermission(companyId: string, data: UserPermissionData) {
    try {
      // Verify user exists and belongs to company
      const user = await prisma.user.findFirst({
        where: { id: data.userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check if permission already exists
      const existing = await prisma.userPermission.findFirst({
        where: {
          userId: data.userId,
          resource: data.resource,
          action: data.action,
          module: data.module || null,
          branchId: data.branchId || null,
        },
      });

      if (existing) {
        // Update existing permission
        const permission = await prisma.userPermission.update({
          where: { id: existing.id },
          data: {
            allow: data.allow ?? true,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        });

        logger.info({ companyId, userId: data.userId, permissionId: permission.id }, 'Permission updated');
        invalidateUserPermissionCache(data.userId, companyId);
        return permission;
      } else {
        // Create new permission
        const permission = await prisma.userPermission.create({
          data: {
            userId: data.userId,
            companyId,
            resource: data.resource,
            action: data.action,
            module: data.module || null,
            branchId: data.branchId || null,
            allow: data.allow ?? true,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
        });

        logger.info({ companyId, userId: data.userId, permissionId: permission.id }, 'Permission assigned');
        invalidateUserPermissionCache(data.userId, companyId);
        return permission;
      }
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error assigning permission');
      throw error;
    }
  }

  /**
   * Assign multiple permissions to user
   */
  async assignPermissions(companyId: string, data: AssignPermissionsData) {
    try {
      // Verify user exists
      const user = await prisma.user.findFirst({
        where: { id: data.userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Use transaction to ensure atomicity
      const permissions = await prisma.$transaction(async (tx) => {
        const created = [];

        for (const perm of data.permissions) {
          // Check if permission already exists
          const existing = await tx.userPermission.findFirst({
            where: {
              userId: data.userId,
              resource: perm.resource,
              action: perm.action,
              module: data.module || null,
              branchId: data.branchId || null,
            },
          });

          if (existing) {
            // Update existing
            const updated = await tx.userPermission.update({
              where: { id: existing.id },
              data: { allow: perm.allow },
            });
            created.push(updated);
          } else {
            // Create new
            const newPerm = await tx.userPermission.create({
              data: {
                userId: data.userId,
                companyId,
                resource: perm.resource,
                action: perm.action,
                module: data.module || null,
                branchId: data.branchId || null,
                allow: perm.allow,
              },
            });
            created.push(newPerm);
          }
        }

        return created;
      });

      logger.info(
        { companyId, userId: data.userId, count: permissions.length },
        'Permissions assigned'
      );

      invalidateUserPermissionCache(data.userId, companyId);

      return {
        userId: data.userId,
        permissions,
        count: permissions.length,
      };
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error assigning permissions');
      throw error;
    }
  }

  /**
   * Remove permission from user
   */
  async removePermission(
    companyId: string,
    userId: string,
    permissionId: string
  ) {
    try {
      // Verify permission exists and belongs to user and company
      const permission = await prisma.userPermission.findFirst({
        where: {
          id: permissionId,
          userId,
          companyId,
        },
      });

      if (!permission) {
        throw new Error('Permission not found');
      }

      await prisma.userPermission.delete({
        where: { id: permissionId },
      });

      logger.info({ companyId, userId, permissionId }, 'Permission removed');
      invalidateUserPermissionCache(userId, companyId);
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, userId, permissionId }, 'Error removing permission');
      throw error;
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(
    companyId: string,
    userId: string,
    options?: {
      module?: string;
      branchId?: string;
      resource?: string;
    }
  ) {
    try {
      // Verify user exists
      const user = await prisma.user.findFirst({
        where: { id: userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const where: any = {
        userId,
        companyId,
      };

      if (options?.module) {
        where.module = options.module;
      }

      if (options?.branchId) {
        where.branchId = options.branchId;
      }

      if (options?.resource) {
        where.resource = options.resource;
      }

      const permissions = await prisma.userPermission.findMany({
        where,
        orderBy: [{ resource: 'asc' }, { action: 'asc' }],
      });

      return {
        userId,
        permissions,
        count: permissions.length,
      };
    } catch (error) {
      logger.error({ error, companyId, userId, options }, 'Error getting user permissions');
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async checkUserPermission(
    companyId: string,
    userId: string,
    resource: string,
    action: Permission['action'],
    options?: {
      module?: string;
      branchId?: string;
    }
  ): Promise<boolean> {
    try {
      const where: any = {
        userId,
        companyId,
        resource,
        action,
        allow: true,
      };

      if (options?.module) {
        where.module = options.module;
      }

      if (options?.branchId) {
        where.branchId = options.branchId;
      }

      // First try with module/branch specificity
      let permission = await prisma.userPermission.findFirst({
        where,
      });

      // If not found and we have module/branch, try without them (global permission)
      if (!permission && (options?.module || options?.branchId)) {
        permission = await prisma.userPermission.findFirst({
          where: {
            userId,
            companyId,
            resource,
            action,
            allow: true,
            module: null,
            branchId: null,
          },
        });
      }

      return !!permission;
    } catch (error) {
      logger.error(
        { error, companyId, userId, resource, action, options },
        'Error checking user permission'
      );
      return false;
    }
  }

  /**
   * Set advanced permissions (transfer/untransfer permissions)
   */
  async setAdvancedPermissions(companyId: string, data: AdvancedPermissionData) {
    try {
      // Verify user exists
      const user = await prisma.user.findFirst({
        where: { id: data.userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Store advanced permissions as JSON
      const advancedPermissions = {
        allowAllTransfers: data.allowAllTransfers ?? false,
        disallowAllTransfers: data.disallowAllTransfers ?? false,
        operations: data.operations || {},
      };

      // Update or create advanced permissions record
      // Note: Prisma doesn't support nullable unique constraints well, so we use empty string
      let advancedPerms;
      const existing = await prisma.userAdvancedPermission.findFirst({
        where: {
          userId: data.userId,
          companyId,
          branchId: data.branchId || null,
        },
      });

      if (existing) {
        advancedPerms = await prisma.userAdvancedPermission.update({
          where: { id: existing.id },
          data: {
            permissions: advancedPermissions as any,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });
      } else {
        advancedPerms = await prisma.userAdvancedPermission.create({
          data: {
            userId: data.userId,
            companyId,
            branchId: data.branchId || null,
            permissions: advancedPermissions as any,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        });
      }

      logger.info({ companyId, userId: data.userId }, 'Advanced permissions set');
      return advancedPerms;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error setting advanced permissions');
      throw error;
    }
  }

  /**
   * Get advanced permissions for user
   */
  async getAdvancedPermissions(
    companyId: string,
    userId: string,
    branchId?: string
  ) {
    try {
      // Verify user exists
      const user = await prisma.user.findFirst({
        where: { id: userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const advancedPerms = await prisma.userAdvancedPermission.findFirst({
        where: {
          userId,
          companyId,
          branchId: branchId || null,
        },
      });

      return advancedPerms || null;
    } catch (error) {
      logger.error({ error, companyId, userId, branchId }, 'Error getting advanced permissions');
      throw error;
    }
  }
}

export const userPermissionsService = new UserPermissionsService();

