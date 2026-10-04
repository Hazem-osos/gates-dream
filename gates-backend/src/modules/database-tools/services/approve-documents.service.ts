import { logger } from '../../../shared/logger';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export interface ApproveDocumentsOptions {
  documentIds: string[];
  documentType?: string;
  approveAll?: boolean;
  companyId: string;
}

export class ApproveDocumentsService {
  /**
   * Approve documents (journal entries, invoices, etc.)
   */
  async approveDocuments(options: ApproveDocumentsOptions): Promise<{ approved: number; failed: number }> {
    try {
      const companyId = options.companyId?.trim();
      if (!companyId) {
        throw new AppError(400, 'Company ID is required');
      }

      let approved = 0;
      let failed = 0;

      if (options.approveAll) {
        if (options.documentType === 'journal-entry') {
          const result = await prisma.journalEntry.updateMany({
            where: {
              companyId,
              isApproved: false,
              isCancelled: false,
            },
            data: { isApproved: true },
          });
          approved = result.count;
        } else if (options.documentType === 'invoice') {
          const result = await prisma.invoice.updateMany({
            where: {
              companyId,
              isApproved: false,
              isCancelled: false,
            },
            data: { isApproved: true },
          });
          approved = result.count;
        } else {
          throw new AppError(422, 'documentType must be journal-entry or invoice when approveAll is true');
        }
      } else {
        const docType = options.documentType ?? 'journal-entry';
        for (const documentId of options.documentIds) {
          try {
            if (docType === 'journal-entry') {
              const result = await prisma.journalEntry.updateMany({
                where: {
                  id: documentId,
                  companyId,
                  isApproved: false,
                  isCancelled: false,
                },
                data: { isApproved: true },
              });
              if (result.count === 1) approved++;
              else failed++;
            } else if (docType === 'invoice') {
              const result = await prisma.invoice.updateMany({
                where: {
                  id: documentId,
                  companyId,
                  isApproved: false,
                  isCancelled: false,
                },
                data: { isApproved: true },
              });
              if (result.count === 1) approved++;
              else failed++;
            } else {
              failed++;
            }
          } catch (error) {
            logger.warn({ error, documentId }, 'Failed to approve document');
            failed++;
          }
        }
      }

      logger.info({ approved, failed, companyId }, 'Documents approved');

      return { approved, failed };
    } catch (error) {
      logger.error({ error, options }, 'Error approving documents');
      throw error;
    }
  }

  /**
   * Get list of unapproved documents
   */
  async getUnapprovedDocuments(companyId: string, documentType?: string) {
    try {
      if (documentType === 'journal-entry' || !documentType) {
        const journalEntries = await prisma.journalEntry.findMany({
          where: {
            companyId,
            isApproved: false,
            isCancelled: false,
          },
          select: {
            id: true,
            voucherNumber: true,
            date: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        return journalEntries;
      } else if (documentType === 'invoice') {
        const invoices = await prisma.invoice.findMany({
          where: {
            companyId,
            isApproved: false,
            isCancelled: false,
          },
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        });
        return invoices;
      }

      return [];
    } catch (error) {
      logger.error({ error, companyId }, 'Error getting unapproved documents');
      throw error;
    }
  }
}

export const approveDocumentsService = new ApproveDocumentsService();

