import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface SerialNumberConfig {
  prefix: string;
  year?: boolean;
  padding?: number;
}

export class SerialNumberService {
  /**
   * Generate next serial number for a given document type
   * Format: PREFIX-YYYY-NNNNNN (e.g., INV-2025-000001)
   */
  async generateNext(
    companyId: string,
    documentType: string,
    config: SerialNumberConfig = { prefix: '', year: true, padding: 6 }
  ): Promise<string> {
    try {
      const year = config.year ? new Date().getFullYear() : null;
      const prefix = config.prefix || documentType.toUpperCase().substring(0, 3);
      
      // Get or create serial number record
      const sequence = await this.getNextSequence(companyId, documentType, year);
      const paddedSequence = sequence.toString().padStart(config.padding || 6, '0');
      
      if (year) {
        return `${prefix}-${year}-${paddedSequence}`;
      }
      
      return `${prefix}-${paddedSequence}`;
    } catch (error) {
      logger.error({ error, documentType, companyId }, 'Error generating serial number');
      throw error;
    }
  }

  /**
   * Get next sequence number for document type
   * Uses database-backed sequence tracking with atomic increment
   */
  private async getNextSequence(
    companyId: string,
    documentType: string,
    year: number | null
  ): Promise<number> {
    try {
      // Use transaction to ensure atomic increment
      const result = await prisma.$transaction(async (tx) => {
        // Find existing serial number record. `findFirst` (not `findUnique`
        // on the compound key) because MySQL/Prisma compound-unique lookups
        // can't take a `null` component — `year` is nullable for
        // non-year-scoped document types.
        const existing = await tx.serialNumber.findFirst({
          where: {
            companyId,
            documentType,
            year: year ?? null,
          },
        });

        if (existing) {
          // Increment sequence atomically
          const updated = await tx.serialNumber.update({
            where: { id: existing.id },
            data: {
              sequence: { increment: 1 },
              lastUsed: new Date(),
            },
          });
          return updated.sequence;
        } else {
          // Create new serial number record
          const created = await tx.serialNumber.create({
            data: {
              companyId,
              documentType,
              year: year || null,
              sequence: 1,
              lastUsed: new Date(),
            },
          });
          return created.sequence;
        }
      });

      return result;
    } catch (error) {
      logger.error(
        { error, companyId, documentType, year },
        'Error getting next sequence'
      );
      throw error;
    }
  }

  /**
   * Reset sequence for a document type (useful for year-end reset)
   */
  async resetSequence(
    companyId: string,
    documentType: string,
    year: number | null
  ): Promise<void> {
    try {
      await prisma.serialNumber.updateMany({
        where: {
          companyId,
          documentType,
          year: year || null,
        },
        data: {
          sequence: 0,
        },
      });

      logger.info({ companyId, documentType, year }, 'Serial number sequence reset');
    } catch (error) {
      logger.error(
        { error, companyId, documentType, year },
        'Error resetting sequence'
      );
      throw error;
    }
  }

  /**
   * Get current sequence number without incrementing
   */
  async getCurrentSequence(
    companyId: string,
    documentType: string,
    year: number | null
  ): Promise<number> {
    try {
      const serialNumber = await prisma.serialNumber.findFirst({
        where: {
          companyId,
          documentType,
          year: year ?? null,
        },
      });

      return serialNumber?.sequence || 0;
    } catch (error) {
      logger.error(
        { error, companyId, documentType, year },
        'Error getting current sequence'
      );
      throw error;
    }
  }
}

export const serialNumberService = new SerialNumberService();
