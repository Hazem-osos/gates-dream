import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface SystemSettingData {
  key: string;
  value?: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
  category?: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateSystemSettingData {
  value?: string;
  type?: 'string' | 'number' | 'boolean' | 'json';
  category?: string;
  description?: string;
  isPublic?: boolean;
}

export class SystemSettingService {
  /**
   * Get system setting by key
   */
  async getSetting(key: string) {
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: { key },
      });

      if (!setting) {
        throw new Error('System setting not found');
      }

      // Parse value based on type
      let parsedValue: any = setting.value;
      if (setting.type === 'number' && setting.value) {
        parsedValue = Number(setting.value);
      } else if (setting.type === 'boolean' && setting.value) {
        parsedValue = setting.value === 'true';
      } else if (setting.type === 'json' && setting.value) {
        try {
          parsedValue = JSON.parse(setting.value);
        } catch {
          parsedValue = setting.value;
        }
      }

      return {
        ...setting,
        value: parsedValue,
      };
    } catch (error) {
      logger.error({ error, key }, 'Error getting system setting');
      throw error;
    }
  }

  /**
   * Get public system settings
   */
  async getPublicSettings() {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: { isPublic: true },
        select: {
          key: true,
          value: true,
          type: true,
          category: true,
        },
      });

      return settings.map((setting) => {
        let parsedValue: any = setting.value;
        if (setting.type === 'number' && setting.value) {
          parsedValue = Number(setting.value);
        } else if (setting.type === 'boolean' && setting.value) {
          parsedValue = setting.value === 'true';
        } else if (setting.type === 'json' && setting.value) {
          try {
            parsedValue = JSON.parse(setting.value);
          } catch {
            parsedValue = setting.value;
          }
        }

        return {
          key: setting.key,
          value: parsedValue,
          type: setting.type,
          category: setting.category,
        };
      });
    } catch (error) {
      logger.error({ error }, 'Error getting public system settings');
      throw error;
    }
  }

  /**
   * List system settings with filters
   */
  async listSettings(options: {
    page?: number;
    limit?: number;
    category?: string;
    isPublic?: boolean;
    search?: string;
  } = {}) {
    try {
      const page = options.page || 1;
      const limit = Math.min(options.limit || 50, 100);
      const skip = (page - 1) * limit;

      const where: any = {};

      if (options.category) {
        where.category = options.category;
      }

      if (options.isPublic !== undefined) {
        where.isPublic = options.isPublic;
      }

      if (options.search) {
        where.OR = [
          { key: { contains: options.search } },
          { description: { contains: options.search } },
        ];
      }

      const [settings, total] = await Promise.all([
        prisma.systemSetting.findMany({
          where,
          skip,
          take: limit,
          orderBy: { key: 'asc' },
        }),
        prisma.systemSetting.count({ where }),
      ]);

      return {
        settings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, options }, 'Error listing system settings');
      throw error;
    }
  }

  /**
   * Create system setting
   */
  async createSetting(data: SystemSettingData) {
    try {
      // Convert value to string based on type
      let stringValue: string | null = data.value || null;
      if (data.value !== undefined && data.value !== null) {
        if (data.type === 'json') {
          stringValue = JSON.stringify(data.value);
        } else if (data.type === 'boolean') {
          stringValue = String(data.value);
        } else if (data.type === 'number') {
          stringValue = String(data.value);
        } else {
          stringValue = String(data.value);
        }
      }

      const setting = await prisma.systemSetting.create({
        data: {
          key: data.key,
          value: stringValue,
          type: data.type || 'string',
          category: data.category,
          description: data.description,
          isPublic: data.isPublic || false,
        },
      });

      logger.info({ key: setting.key }, 'System setting created');
      return setting;
    } catch (error) {
      logger.error({ error, data }, 'Error creating system setting');
      throw error;
    }
  }

  /**
   * Update system setting
   */
  async updateSetting(key: string, data: UpdateSystemSettingData) {
    try {
      // Convert value to string based on type
      let stringValue: string | undefined = data.value;
      if (data.value !== undefined && data.value !== null) {
        const type = data.type || 'string';
        if (type === 'json') {
          stringValue = JSON.stringify(data.value);
        } else if (type === 'boolean') {
          stringValue = String(data.value);
        } else if (type === 'number') {
          stringValue = String(data.value);
        } else {
          stringValue = String(data.value);
        }
      }

      const updateData: any = {};
      if (stringValue !== undefined) updateData.value = stringValue;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

      const setting = await prisma.systemSetting.update({
        where: { key },
        data: updateData,
      });

      logger.info({ key: setting.key }, 'System setting updated');
      return setting;
    } catch (error) {
      logger.error({ error, key, data }, 'Error updating system setting');
      throw error;
    }
  }

  /**
   * Delete system setting
   */
  async deleteSetting(key: string) {
    try {
      await prisma.systemSetting.delete({
        where: { key },
      });

      logger.info({ key }, 'System setting deleted');
    } catch (error) {
      logger.error({ error, key }, 'Error deleting system setting');
      throw error;
    }
  }

  /**
   * Get settings by category
   */
  async getSettingsByCategory(category: string) {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: { category },
        orderBy: { key: 'asc' },
      });

      return settings.map((setting) => {
        let parsedValue: any = setting.value;
        if (setting.type === 'number' && setting.value) {
          parsedValue = Number(setting.value);
        } else if (setting.type === 'boolean' && setting.value) {
          parsedValue = setting.value === 'true';
        } else if (setting.type === 'json' && setting.value) {
          try {
            parsedValue = JSON.parse(setting.value);
          } catch {
            parsedValue = setting.value;
          }
        }

        return {
          ...setting,
          value: parsedValue,
        };
      });
    } catch (error) {
      logger.error({ error, category }, 'Error getting settings by category');
      throw error;
    }
  }
}

export const systemSettingService = new SystemSettingService();

