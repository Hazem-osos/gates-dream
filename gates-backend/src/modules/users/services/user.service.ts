import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import bcrypt from 'bcryptjs';

export interface CreateUserData {
  companyId: string;
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserData {
  email?: string;
  username?: string;
  password?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  preferredLanguage?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export class UserService {
  /**
   * Create a new user
   */
  async createUser(data: CreateUserData) {
    try {
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: { id: data.companyId },
      });

      if (!company) {
        throw new Error('Company not found');
      }

      // Check if email already exists
      const existingEmail = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingEmail) {
        throw new Error('User with this email already exists');
      }

      // Check if username already exists
      const existingUsername = await prisma.user.findUnique({
        where: { username: data.username },
      });

      if (existingUsername) {
        throw new Error('User with this username already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 10);

      const user = await prisma.user.create({
        data: {
          companyId: data.companyId,
          email: data.email,
          username: data.username,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          isActive: true,
        },
        include: {
          company: {
            select: {
              id: true,
              arabicName: true,
            },
          },
        },
      });

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = user;

      logger.info({ companyId: data.companyId, userId: user.id }, 'User created');
      return userResponse;
    } catch (error) {
      logger.error(
        { errMsg: error instanceof Error ? error.message : String(error), data },
        'Error creating user'
      );
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(companyId: string, userId: string) {
    try {
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
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
              branchPermissions: true,
              groupMemberships: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = user;
      return userResponse;
    } catch (error) {
      logger.error({ error, companyId, userId }, 'Error getting user');
      throw error;
    }
  }

  /**
   * List users with pagination and filters
   */
  async listUsers(
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
          { email: { contains: options.search } },
          { username: { contains: options.search } },
          { firstName: { contains: options.search } },
          { lastName: { contains: options.search } },
        ];
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ createdAt: 'desc' }],
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            company: {
              select: {
                id: true,
                arabicName: true,
              },
            },
            _count: {
              select: {
                branchPermissions: true,
                groupMemberships: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing users');
      throw error;
    }
  }

  /** Active program users for the sales-invoice / POS seller picker. */
  async listSellers(companyId: string) {
    return prisma.user.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ firstName: 'asc' }, { username: 'asc' }],
      take: 500,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
  }

  /**
   * Update user
   */
  async updateUser(companyId: string, userId: string, data: UpdateUserData) {
    try {
      // Verify user exists and belongs to company
      const existing = await prisma.user.findFirst({
        where: { id: userId, companyId },
      });

      if (!existing) {
        throw new Error('User not found');
      }

      // Check if email is being changed and if it conflicts
      if (data.email && data.email !== existing.email) {
        const emailConflict = await prisma.user.findUnique({
          where: { email: data.email },
        });

        if (emailConflict) {
          throw new Error('User with this email already exists');
        }
      }

      // Check if username is being changed and if it conflicts
      if (data.username && data.username !== existing.username) {
        const usernameConflict = await prisma.user.findUnique({
          where: { username: data.username },
        });

        if (usernameConflict) {
          throw new Error('User with this username already exists');
        }
      }

      // Hash password if being updated
      let passwordHash = undefined;
      if (data.password) {
        passwordHash = await bcrypt.hash(data.password, 10);
      }

      const updateData: any = {
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        preferredLanguage: data.preferredLanguage,
        avatarUrl: data.avatarUrl,
        isActive: data.isActive,
      };

      if (passwordHash) {
        updateData.passwordHash = passwordHash;
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          company: {
            select: {
              id: true,
              arabicName: true,
            },
          },
        },
      });

      // Remove password hash from response
      const { passwordHash: _, ...userResponse } = user;

      logger.info({ companyId, userId }, 'User updated');
      return userResponse;
    } catch (error) {
      logger.error({ error, companyId, userId, data }, 'Error updating user');
      throw error;
    }
  }

  /**
   * Delete user (soft delete by setting isActive to false)
   */
  async deleteUser(companyId: string, userId: string) {
    try {
      const user = await prisma.user.findFirst({
        where: { id: userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Soft delete by setting isActive to false
      const deleted = await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      logger.info({ companyId, userId }, 'User deleted (soft delete)');
      return { id: deleted.id, isActive: deleted.isActive };
    } catch (error) {
      logger.error({ error, companyId, userId }, 'Error deleting user');
      throw error;
    }
  }

  /**
   * Restore user (set isActive to true)
   */
  async restoreUser(companyId: string, userId: string) {
    try {
      const user = await prisma.user.findFirst({
        where: { id: userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const restored = await prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
      });

      logger.info({ companyId, userId }, 'User restored');
      return { id: restored.id, isActive: restored.isActive };
    } catch (error) {
      logger.error({ error, companyId, userId }, 'Error restoring user');
      throw error;
    }
  }

  /**
   * Self-service profile update (no username/password via this path)
   */
  async updateSelfProfile(
    companyId: string,
    userId: string,
    data: {
      email?: string;
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      preferredLanguage?: 'ar' | 'en';
      avatarUrl?: string | null;
    }
  ) {
    return this.updateUser(companyId, userId, data);
  }

  /**
   * Change user password
   */
  async changePassword(
    companyId: string,
    userId: string,
    oldPassword: string,
    newPassword: string
  ) {
    try {
      const user = await prisma.user.findFirst({
        where: { id: userId, companyId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify old password
      const isOldPasswordValid = await bcrypt.compare(
        oldPassword,
        user.passwordHash
      );

      if (!isOldPasswordValid) {
        throw new Error('Old password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      logger.info({ companyId, userId }, 'User password changed');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, userId }, 'Error changing password');
      throw error;
    }
  }
}

export const userService = new UserService();
