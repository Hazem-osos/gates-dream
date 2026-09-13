import { logger } from '../../../shared/logger';
import prisma from '../../../shared/database/prisma';

export interface TranslationData {
  key: string;
  language1: string;
  language2: string;
  category?: string;
}

export interface ScreenTranslationData {
  screenName: string;
  language1: string;
  language2: string;
  translations: Record<string, string>;
}

export class TranslationService {
  /**
   * Create or update translation
   */
  async saveTranslation(companyId: string, data: TranslationData) {
    try {
      // Note: In production, you'd have a Translation model in the database
      // For now, we'll use SystemSetting to store translations
      const translationKey = `translation:${data.category || 'general'}:${data.key}`;
      
      const translation = {
        language1: data.language1,
        language2: data.language2,
        key: data.key,
        category: data.category,
      };

      await prisma.systemSetting.upsert({
        where: { key: translationKey },
        update: {
          value: JSON.stringify(translation),
          type: 'json',
          category: 'translation',
        },
        create: {
          key: translationKey,
          value: JSON.stringify(translation),
          type: 'json',
          category: 'translation',
          description: `Translation for ${data.key}`,
        },
      });

      logger.info({ companyId, key: data.key }, 'Translation saved');

      return translation;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error saving translation');
      throw error;
    }
  }

  /**
   * Get translation by key
   */
  async getTranslation(companyId: string, key: string, category?: string) {
    try {
      const translationKey = `translation:${category || 'general'}:${key}`;
      
      const setting = await prisma.systemSetting.findUnique({
        where: { key: translationKey },
      });

      if (!setting) {
        return null;
      }

      return JSON.parse(setting.value || '{}');
    } catch (error) {
      logger.error({ error, companyId, key }, 'Error getting translation');
      throw error;
    }
  }

  /**
   * List translations
   */
  async listTranslations(
    companyId: string,
    options: {
      language1?: string;
      language2?: string;
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        category: 'translation',
      };

      if (options.category) {
        where.key = { contains: `translation:${options.category}:` };
      } else {
        where.key = { startsWith: 'translation:' };
      }

      if (options.search) {
        where.OR = [
          { key: { contains: options.search } },
          { value: { contains: options.search } },
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

      const translations = settings.map(setting => {
        try {
          return JSON.parse(setting.value || '{}');
        } catch {
          return null;
        }
      }).filter(Boolean);

      return {
        translations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing translations');
      throw error;
    }
  }

  /**
   * Bulk save translations
   */
  async bulkSaveTranslations(companyId: string, translations: TranslationData[]) {
    try {
      const results = [];

      for (const translation of translations) {
        try {
          const result = await this.saveTranslation(companyId, translation);
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: translation,
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info({ companyId, successful, failed }, 'Bulk translations saved');

      return {
        successful,
        failed,
        results,
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error bulk saving translations');
      throw error;
    }
  }

  /**
   * Save screen translations
   */
  async saveScreenTranslations(companyId: string, data: ScreenTranslationData) {
    try {
      const screenKey = `translation:screen:${data.screenName}`;
      
      const screenTranslation = {
        screenName: data.screenName,
        language1: data.language1,
        language2: data.language2,
        translations: data.translations,
      };

      await prisma.systemSetting.upsert({
        where: { key: screenKey },
        update: {
          value: JSON.stringify(screenTranslation),
          type: 'json',
          category: 'translation:screen',
        },
        create: {
          key: screenKey,
          value: JSON.stringify(screenTranslation),
          type: 'json',
          category: 'translation:screen',
          description: `Screen translations for ${data.screenName}`,
        },
      });

      logger.info({ companyId, screenName: data.screenName }, 'Screen translations saved');

      return screenTranslation;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error saving screen translations');
      throw error;
    }
  }

  /**
   * Get screen translations
   */
  async getScreenTranslations(companyId: string, screenName: string) {
    try {
      const screenKey = `translation:screen:${screenName}`;
      
      const setting = await prisma.systemSetting.findUnique({
        where: { key: screenKey },
      });

      if (!setting) {
        return null;
      }

      return JSON.parse(setting.value || '{}');
    } catch (error) {
      logger.error({ error, companyId, screenName }, 'Error getting screen translations');
      throw error;
    }
  }

  /**
   * Export translations to Excel/CSV format
   */
  async exportTranslations(companyId: string, format: 'csv' | 'json' = 'json') {
    try {
      const settings = await prisma.systemSetting.findMany({
        where: {
          category: { in: ['translation', 'translation:screen'] },
        },
      });

      const translations = settings.map(setting => {
        try {
          return JSON.parse(setting.value || '{}');
        } catch {
          return null;
        }
      }).filter(Boolean);

      if (format === 'csv') {
        // Convert to CSV format
        const csvLines = ['Key,Language1,Language2,Category'];
        for (const translation of translations) {
          if (translation.key) {
            csvLines.push(
              `${translation.key},"${translation.language1 || ''}","${translation.language2 || ''}","${translation.category || 'general'}"`
            );
          }
        }
        return csvLines.join('\n');
      }

      return JSON.stringify(translations, null, 2);
    } catch (error) {
      logger.error({ error, companyId }, 'Error exporting translations');
      throw error;
    }
  }
}

export const translationService = new TranslationService();

