import { logger } from '../../../shared/logger';
import prisma from '../../../shared/database/prisma';

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
      let approved = 0;
      let failed = 0;

      if (options.approveAll) {
        // Approve all unapproved documents of the specified type
        if (options.documentType === 'journal-entry') {
          const result = await prisma.journalEntry.updateMany({
            where: {
              companyId: options.companyId,
              isApproved: false,
              isCancelled: false,
            },
            data: {
              isApproved: true,
            },
          });
          approved = result.count;
        } else if (options.documentType === 'invoice') {
          const result = await prisma.invoice.updateMany({
            where: {
              companyId: options.companyId,
              isApproved: false,
              isCancelled: false,
            },
            data: {
              isApproved: true,
            },
          });
          approved = result.count;
        }
      } else {
        // Approve specific documents
        for (const documentId of options.documentIds) {
          try {
            if (options.documentType === 'journal-entry' || !options.documentType) {
              const journalEntry = await prisma.journalEntry.findFirst({
                where: {
                  id: documentId,
                  companyId: options.companyId,
                },
              });

              if (journalEntry && !journalEntry.isApproved && !journalEntry.isCancelled) {
                await prisma.journalEntry.update({
                  where: { id: documentId },
                  data: { isApproved: true },
                });
                approved++;
              } else {
                failed++;
              }
            } else if (options.documentType === 'invoice') {
              const invoice = await prisma.invoice.findFirst({
                where: {
                  id: documentId,
                  companyId: options.companyId,
                },
              });

              if (invoice && !invoice.isApproved && !invoice.isCancelled) {
                await prisma.invoice.update({
                  where: { id: documentId },
                  data: { isApproved: true },
                });
                approved++;
              } else {
                failed++;
              }
            }
          } catch (error) {
            logger.warn({ error, documentId }, 'Failed to approve document');
            failed++;
          }
        }
      }

      logger.info({ approved, failed, companyId: options.companyId }, 'Documents approved');

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

