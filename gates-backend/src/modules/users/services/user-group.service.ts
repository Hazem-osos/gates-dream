import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateUserGroupData {
  companyId: string;
  code?: string;
  arabicName: string;
  password?: string; // Group password (optional)
  priceList?: string;
  hidePricesInInvoices?: boolean;
  allowChangePaymentValue?: boolean;
  posManager?: boolean;
  deactivate?: boolean;
  studentAffairs?: boolean;
  busManager?: boolean;
  studentAccounts?: boolean;
}

export interface UpdateUserGroupData extends Partial<CreateUserGroupData> {
  isActive?: boolean;
}

export class UserGroupService {
  /**
   * Create a new user group
   */
  async createUserGroup(data: CreateUserGroupData) {
    try {
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: { id: data.companyId },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // Check if code already exists for this company
      if (data.code) {
        const existing = await prisma.userGroup.findFirst({
          where: {
            code: data.code,
            companyId: data.companyId,
          },
        });

        if (existing) {
          throw new Error('User group with this code already exists for this company');
        }
      }

      const userGroup = await prisma.userGroup.create({
        data: {
          companyId: data.companyId,
          code: data.code,
          arabicName: data.arabicName,
          password: data.password,
          priceList: data.priceList,
          hidePricesInInvoices: data.hidePricesInInvoices ?? false,
          allowChangePaymentValue: data.allowChangePaymentValue ?? false,
          posManager: data.posManager ?? false,
          deactivate: data.deactivate ?? false,
          studentAffairs: data.studentAffairs ?? false,
          busManager: data.busManager ?? false,
          studentAccounts: data.studentAccounts ?? false,
          isActive: true,
        },
        include: {
          company: {
            select: {
              id: true,
              arabicName: true,
            },
          },
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

      logger.info({ companyId: data.companyId, groupId: userGroup.id }, 'User group created');
      return userGroup;
    } catch (error) {
      logger.error({ error, data }, 'Error creating user group');
      throw error;
    }
  }

  /**
   * Get user group by ID
   */
  async getUserGroupById(companyId: string, groupId: string) {
    try {
      const userGroup = await prisma.userGroup.findFirst({
        where: {
          id: groupId,
          companyId,
        },
        include: {
          company: {
            select: {
              id: true,
              arabicName: true,
            },
          },
          users: {
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
          },
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

      if (!userGroup) {
        throw new Error('User group not found');
      }

      return userGroup;
    } catch (error) {
      logger.error({ error, companyId, groupId }, 'Error getting user group');
      throw error;
    }
  }

  /**
   * List user groups with pagination and filters
   */
  async listUserGroups(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,
      };

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { code: { contains: options.search } },
        ];
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [userGroups, total] = await Promise.all([
        prisma.userGroup.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          include: {
            _count: {
              select: {
                users: true,
              },
            },
          },
        }),
        prisma.userGroup.count({ where }),
      ]);

      return {
        userGroups,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing user groups');
      throw error;
    }
  }

  /**
   * Update user group
   */
  async updateUserGroup(
    companyId: string,
    groupId: string,
    data: UpdateUserGroupData
  ) {
    try {
      // Verify user group exists and belongs to company
      const existing = await prisma.userGroup.findFirst({
        where: { id: groupId, companyId },
      });

      if (!existing) {
        throw new Error('User group not found');
      }

      // Check if code is being changed and if it conflicts
      if (data.code && data.code !== existing.code) {
        const codeConflict = await prisma.userGroup.findFirst({
          where: {
            code: data.code,
            companyId,
          },
        });

        if (codeConflict) {
          throw new Error('User group with this code already exists for this company');
        }
      }

      const userGroup = await prisma.userGroup.update({
        where: { id: groupId },
        data: {
          code: data.code,
          arabicName: data.arabicName,
          password: data.password,
          priceList: data.priceList,
          hidePricesInInvoices: data.hidePricesInInvoices,
          allowChangePaymentValue: data.allowChangePaymentValue,
          posManager: data.posManager,
          deactivate: data.deactivate,
          studentAffairs: data.studentAffairs,
          busManager: data.busManager,
          studentAccounts: data.studentAccounts,
          isActive: data.isActive,
        },
        include: {
          company: {
            select: {
              id: true,
              arabicName: true,
            },
          },
          _count: {
            select: {
              users: true,
            },
          },
        },
      });

      logger.info({ companyId, groupId }, 'User group updated');
      return userGroup;
    } catch (error) {
      logger.error({ error, companyId, groupId, data }, 'Error updating user group');
      throw error;
    }
  }

  /**
   * Delete user group (soft delete by setting isActive to false)
   */
  async deleteUserGroup(companyId: string, groupId: string) {
    try {
      const userGroup = await prisma.userGroup.findFirst({
        where: { id: groupId, companyId },
      });

      if (!userGroup) {
        throw new Error('User group not found');
      }

      // Check if group has users
      const userCount = await prisma.userGroupMember.count({
        where: { userGroupId: groupId },
      });

      if (userCount > 0) {
        throw new Error(
          `Cannot delete user group: ${userCount} user(s) are members of this group. Remove users first.`
        );
      }

      // Soft delete by setting isActive to false
      const deleted = await prisma.userGroup.update({
        where: { id: groupId },
        data: { isActive: false },
      });

      logger.info({ companyId, groupId }, 'User group deleted (soft delete)');
      return { id: deleted.id, isActive: deleted.isActive };
    } catch (error) {
      logger.error({ error, companyId, groupId }, 'Error deleting user group');
      throw error;
    }
  }

  /**
   * Restore user group (set isActive to true)
   */
  async restoreUserGroup(companyId: string, groupId: string) {
    try {
      const userGroup = await prisma.userGroup.findFirst({
        where: { id: groupId, companyId },
      });

      if (!userGroup) {
        throw new Error('User group not found');
      }

      const restored = await prisma.userGroup.update({
        where: { id: groupId },
        data: { isActive: true },
      });

      logger.info({ companyId, groupId }, 'User group restored');
      return { id: restored.id, isActive: restored.isActive };
    } catch (error) {
      logger.error({ error, companyId, groupId }, 'Error restoring user group');
      throw error;
    }
  }

  /**
   * Add user to group
   */
  async addUserToGroup(
    companyId: string,
    groupId: string,
    userId: string
  ) {
    try {
      // Verify group and user exist and belong to company
      const [group, user] = await Promise.all([
        prisma.userGroup.findFirst({
          where: { id: groupId, companyId },
        }),
        prisma.user.findFirst({
          where: { id: userId, companyId },
        }),
      ]);

      if (!group) {
        throw new Error('User group not found');
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is already in group
      const existing = await prisma.userGroupMember.findUnique({
        where: {
          userId_userGroupId: {
            userId,
            userGroupId: groupId,
          },
        },
      });

      if (existing) {
        throw new Error('User is already a member of this group');
      }

      const membership = await prisma.userGroupMember.create({
        data: {
          companyId,
          userId,
          userGroupId: groupId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          userGroup: {
            select: {
              id: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, groupId, userId }, 'User added to group');
      return membership;
    } catch (error) {
      logger.error({ error, companyId, groupId, userId }, 'Error adding user to group');
      throw error;
    }
  }

  /**
   * Remove user from group
   */
  async removeUserFromGroup(
    companyId: string,
    groupId: string,
    userId: string
  ) {
    try {
      // Verify membership exists and belongs to this company
      const membership = await prisma.userGroupMember.findUnique({
        where: {
          userId_userGroupId: {
            userId,
            userGroupId: groupId,
          },
        },
      });

      if (!membership || membership.companyId !== companyId) {
        throw new Error('Membership not found or does not belong to company');
      }

      await prisma.userGroupMember.delete({
        where: {
          userId_userGroupId: {
            userId,
            userGroupId: groupId,
          },
        },
      });

      logger.info({ companyId, groupId, userId }, 'User removed from group');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, groupId, userId }, 'Error removing user from group');
      throw error;
    }
  }

  /**
   * Get users in group
   */
  async getGroupUsers(companyId: string, groupId: string) {
    try {
      // Verify group exists and belongs to company
      const group = await prisma.userGroup.findFirst({
        where: { id: groupId, companyId },
      });

      if (!group) {
        throw new Error('User group not found');
      }

      const memberships = await prisma.userGroupMember.findMany({
        where: { userGroupId: groupId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
            },
          },
        },
      });

      return {
        groupId,
        groupName: group.arabicName,
        users: memberships.map((m) => m.user),
        count: memberships.length,
      };
    } catch (error) {
      logger.error({ error, companyId, groupId }, 'Error getting group users');
      throw error;
    }
  }
}

export const userGroupService = new UserGroupService();

