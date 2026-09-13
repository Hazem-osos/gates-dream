import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export class BranchPermissionsService {
  /**
   * Assign branch access to user
   */
  async assignBranchToUser(
    companyId: string,
    userId: string,
    branchId: string
  ) {
    try {
      // Verify company, user, and branch exist
      const [company, user, branch] = await Promise.all([
        prisma.company.findUnique({ where: { id: companyId } }),
        prisma.user.findFirst({ where: { id: userId, companyId } }),
        prisma.branch.findFirst({ where: { id: branchId, companyId } }),
      ]);

      if (!company) {
        throw new Error('Company not found');
      }

      if (!user) {
        throw new Error('User not found');
      }

      if (!branch) {
        throw new Error('Branch not found');
      }

      // Check if permission already exists
      const existing = await prisma.userBranchPermission.findUnique({
        where: {
          userId_branchId: {
            userId,
            branchId,
          },
        },
      });

      if (existing) {
        throw new Error('Branch permission already exists for this user');
      }

      const permission = await prisma.userBranchPermission.create({
        data: {
          userId,
          branchId,
          companyId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          branch: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, userId, branchId }, 'Branch permission assigned');
      return permission;
    } catch (error) {
      logger.error(
        { error, companyId, userId, branchId },
        'Error assigning branch permission'
      );
      throw error;
    }
  }

  /**
   * Remove branch access from user
   */
  async removeBranchFromUser(
    companyId: string,
    userId: string,
    branchId: string
  ) {
    try {
      // Verify permission exists
      const permission = await prisma.userBranchPermission.findFirst({
        where: {
          userId,
          branchId,
          companyId,
        },
      });

      if (!permission) {
        throw new Error('Branch permission not found');
      }

      await prisma.userBranchPermission.delete({
        where: {
          userId_branchId: {
            userId,
            branchId,
          },
        },
      });

      logger.info({ companyId, userId, branchId }, 'Branch permission removed');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, userId, branchId },
        'Error removing branch permission'
      );
      throw error;
    }
  }

  /**
   * Get branches accessible by user
   */
  async getUserBranches(companyId: string, userId: string) {
    try {
      // Verify user exists and belongs to company
      const user = await prisma.user.findFirst({
        where: { id: userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const permissions = await prisma.userBranchPermission.findMany({
        where: {
          userId,
          companyId,
        },
        include: {
          branch: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
              branchNumber: true,
            },
          },
        },
      });

      return {
        userId,
        branches: permissions.map((p) => p.branch),
        count: permissions.length,
      };
    } catch (error) {
      logger.error({ error, companyId, userId }, 'Error getting user branches');
      throw error;
    }
  }

  /**
   * Get users with access to branch
   */
  async getBranchUsers(companyId: string, branchId: string) {
    try {
      // Verify branch exists and belongs to company
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, companyId },
      });

      if (!branch) {
        throw new Error('Branch not found');
      }

      const permissions = await prisma.userBranchPermission.findMany({
        where: {
          branchId,
          companyId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return {
        branchId,
        users: permissions.map((p) => p.user),
        count: permissions.length,
      };
    } catch (error) {
      logger.error({ error, companyId, branchId }, 'Error getting branch users');
      throw error;
    }
  }

  /**
   * Check if user has access to branch
   */
  async checkUserBranchAccess(
    companyId: string,
    userId: string,
    branchId: string
  ): Promise<boolean> {
    try {
      const permission = await prisma.userBranchPermission.findFirst({
        where: {
          userId,
          branchId,
          companyId,
        },
      });

      return !!permission;
    } catch (error) {
      logger.error(
        { error, companyId, userId, branchId },
        'Error checking branch access'
      );
      return false;
    }
  }

  /**
   * Assign multiple branches to user
   */
  async assignBranchesToUser(
    companyId: string,
    userId: string,
    branchIds: string[]
  ) {
    try {
      // Verify user exists
      const user = await prisma.user.findFirst({
        where: { id: userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify all branches exist and belong to company
      const branches = await prisma.branch.findMany({
        where: {
          id: { in: branchIds },
          companyId,
        },
      });

      if (branches.length !== branchIds.length) {
        throw new Error('One or more branches not found');
      }

      // Use transaction to ensure atomicity
      const permissions = await prisma.$transaction(async (tx) => {
        // Remove existing permissions first (optional - could also keep existing)
        await tx.userBranchPermission.deleteMany({
          where: {
            userId,
            companyId,
          },
        });

        // Create new permissions
        const created = await Promise.all(
          branchIds.map((branchId) =>
            tx.userBranchPermission.create({
              data: {
                userId,
                branchId,
                companyId,
              },
              include: {
                branch: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
              },
            })
          )
        );

        return created;
      });

      logger.info(
        { companyId, userId, branchIds, count: permissions.length },
        'Branches assigned to user'
      );

      return {
        userId,
        branches: permissions.map((p) => p.branch),
        count: permissions.length,
      };
    } catch (error) {
      logger.error(
        { error, companyId, userId, branchIds },
        'Error assigning branches to user'
      );
      throw error;
    }
  }
}

export const branchPermissionsService = new BranchPermissionsService();

