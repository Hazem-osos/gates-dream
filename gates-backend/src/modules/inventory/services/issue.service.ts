// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { stockMovementGlService, type StockGlPostingContext } from './stock-movement-gl.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { stockMovementService } from './stock-movement.service';
import { itemCostService } from './item-cost.service';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { assertWarehouseActive } from '../utils/inventory-system';
import { assertUpdateCount } from '../../../shared/concurrency/optimistic-lock';

export interface IssueLine {
  itemId: string;
  locationId?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
}

export interface CreateIssueData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  hijriDate?: string;
  record?: string;
  warehouseId: string;
  lines: IssueLine[];
}

export class IssueService {
  /**
   * Create issue entry
   */
  async createIssue(companyId: string, data: CreateIssueData) {
    try {
      // Validate warehouse belongs to company
      await assertWarehouseActive(companyId, data.warehouseId);

      // Validate all items belong to company
      const itemIds = data.lines.map((line) => line.itemId);
      const items = await prisma.item.findMany({
        where: {
          id: { in: itemIds },
          companyId,
        },
      });

      if (items.length !== itemIds.length) {
        throw new Error('One or more items not found or do not belong to company');
      }

      // Validate locations if provided
      const locationIds = data.lines
        .map((line) => line.locationId)
        .filter((id): id is string => !!id);

      if (locationIds.length > 0) {
        const locations = await prisma.location.findMany({
          where: {
            id: { in: locationIds },
            warehouseId: data.warehouseId,
          },
        });

        if (locations.length !== locationIds.length) {
          throw new Error('One or more locations not found or do not belong to warehouse');
        }
      }

      // Get current quantities to validate availability
      const itemQuantities = await prisma.itemQuantity.findMany({
        where: scopedItemQuantityWhere(companyId, {
          itemId: { in: itemIds },
          warehouseId: data.warehouseId,
        }),
      });

      // Use transaction to ensure atomicity
      const issue = await prisma.$transaction(async (tx) => {
        // Validate quantities are available
        for (const line of data.lines) {
          const existingQuantity = itemQuantities.find(
            (iq) =>
              iq.itemId === line.itemId &&
              iq.warehouseId === data.warehouseId &&
              (iq.locationId || null) === (line.locationId || null)
          );

          const availableQty = existingQuantity ? Number(existingQuantity.quantity) : 0;

          if (availableQty < line.quantity) {
            throw new Error(
              `Insufficient quantity for item ${line.itemId} in warehouse. Available: ${availableQty}, Required: ${line.quantity}`
            );
          }
        }

        // Calculate total amount
        const totalAmount = data.lines.reduce(
          (sum, line) => sum + (line.total || line.quantity * (line.unitPrice || 0)),
          0
        );

        // Create issue record
        const record = await tx.issue.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            date: new Date(data.date),
            hijriDate: data.hijriDate || null,
            record: data.record || null,
            warehouseId: data.warehouseId,
            totalAmount,
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        // Create issue lines
        const lines = [];
        for (const lineData of data.lines) {
          const unitPrice = lineData.unitPrice || 0;
          const total = lineData.total || lineData.quantity * unitPrice;

          const line = await tx.issueLine.create({
            data: {
              issueId: record.id,
              itemId: lineData.itemId,
              locationId: lineData.locationId || null,
              quantity: lineData.quantity,
              unitPrice,
              total,
            },
          });
          lines.push(line);
        }

        return {
          ...record,
          lines,
        };
      });

      logger.info(
        {
          companyId,
          issueId: issue.id,
          warehouseId: data.warehouseId,
          linesCount: data.lines.length,
        },
        'Issue created'
      );

      return issue;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating issue');
      throw error;
    }
  }

  /**
   * Get issue by ID
   */
  async getIssueById(companyId: string, issueId: string) {
    try {
      const issue = await prisma.issue.findFirst({
        where: {
          id: issueId,
          companyId,
        },
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  code: true,
                  serial: true,
                  arabicName: true,
                  englishName: true,
                },
              },
              location: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
            },
          },
        },
      });

      if (!issue) {
        throw new Error('Issue not found');
      }

      return issue;
    } catch (error) {
      logger.error({ error, companyId, issueId }, 'Error getting issue');
      throw error;
    }
  }

  /**
   * List issue entries
   */
  async listIssues(
    companyId: string,
    options?: {
      branchId?: string;
      warehouseId?: string;
      isPosted?: boolean;
      isApproved?: boolean;
      isCancelled?: boolean;
      fromDate?: string;
      toDate?: string;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    try {
      const where: any = {
        companyId,
      };

      if (options?.branchId) {
        where.branchId = options.branchId;
      }

      if (options?.warehouseId) {
        where.warehouseId = options.warehouseId;
      }

      if (options?.isPosted !== undefined) {
        where.isPosted = options.isPosted;
      }

      if (options?.isApproved !== undefined) {
        where.isApproved = options.isApproved;
      }

      if (options?.isCancelled !== undefined) {
        where.isCancelled = options.isCancelled;
      }

      if (options?.fromDate || options?.toDate) {
        where.date = {};
        if (options.fromDate) {
          where.date.gte = new Date(options.fromDate);
        }
        if (options.toDate) {
          where.date.lte = new Date(options.toDate);
        }
      }

      if (options?.search?.trim()) {
        const q = options.search.trim();
        where.OR = [
          { serial: { contains: q } },
          { description: { contains: q } },
        ];
      }

      const [issues, total] = await Promise.all([
        prisma.issue.findMany({
          where,
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
          orderBy: [{ serial: 'asc' }, { createdAt: 'asc' }],
          skip: options?.skip || 0,
          take: options?.take || 50,
        }),
        prisma.issue.count({ where }),
      ]);

      return {
        data: issues,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing issues');
      throw error;
    }
  }

  /**
   * Post issue (remove quantities from warehouse)
   */
  async postIssue(
    companyId: string,
    issueId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const issue = await prisma.issue.findFirst({
        where: {
          id: issueId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!issue) {
        throw new Error('Issue not found');
      }

      if (issue.isCancelled) {
        throw new Error('Cannot post cancelled issue');
      }

      if (issue.isPosted) {
        throw new Error('Issue is already posted');
      }

      await assertWarehouseActive(companyId, issue.warehouseId);

      // H1 fix: route the quantity mutation through stockMovementService
      // (row lock + InventoryMovement audit row + negative-stock guard)
      // instead of an unlocked read-modify-write on item_quantities.
      // sourceType matches stockMovementGlService.postGoodsIssueGlInTx's
      // GL source type ('GI') so the movement and its GL entry share one key.
      const sourceType = 'GI';
      const sourceNumber = issue.serial ?? issue.id.slice(0, 8);
      const sourceYearId = String(new Date(issue.date).getFullYear());
      const unitCosts = await itemCostService.getCostsAsOf(
        companyId,
        issue.lines.map((l) => l.itemId),
        issue.date
      );

      await prisma.$transaction(async (tx) => {
        for (const line of issue.lines) {
          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: issue.branchId ?? undefined,
            warehouseId: issue.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantityDelta: -Number(line.quantity),
            unitCost: unitCosts.get(line.itemId) ?? 0,
            movementType: sourceType,
            sourceType,
            sourceNumber,
            sourceYearId,
            documentDate: issue.date,
          });
        }

        if (glCtx) {
          await stockMovementGlService.postGoodsIssueGlInTx(tx, glCtx, issue);
        }

        // Mark issue as posted
        await tx.issue.update({
          where: { id: issueId },
          data: {
            isPosted: true,
            postedAt: new Date(),
          },
        });
      });

      logger.info({ companyId, issueId }, 'Issue posted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, issueId }, 'Error posting issue');
      throw error;
    }
  }

  /**
   * Unpost issue (reverse quantity removals)
   */
  async unpostIssue(companyId: string, issueId: string, glCtx?: StockGlPostingContext) {
    try {
      const issue = await prisma.issue.findFirst({
        where: {
          id: issueId,
          companyId,
        },
        include: {
          lines: true,
        },
      });

      if (!issue) {
        throw new Error('Issue not found');
      }

      if (!issue.isPosted) {
        throw new Error('Issue is not posted');
      }

      const sourceType = 'GI';
      const sourceNumber = issue.serial ?? issue.id.slice(0, 8);
      const sourceYearId = String(new Date(issue.date).getFullYear());

      // Use transaction to reverse movements atomically
      await prisma.$transaction(async (tx) => {
        for (const line of issue.lines) {
          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: issue.branchId ?? undefined,
            warehouseId: issue.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantityDelta: Number(line.quantity),
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            documentDate: issue.date,
          });
        }

        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            sourceType,
            sourceNumber,
            sourceYearId,
            `Issue ${sourceNumber} unposted`
          );
        }

        // Mark issue as unposted
        await tx.issue.update({
          where: { id: issueId },
          data: {
            isPosted: false,
            postedAt: null,
          },
        });
      });

      logger.info({ companyId, issueId }, 'Issue unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, issueId }, 'Error unposting issue');
      throw error;
    }
  }

  /**
   * Cancel issue
   */
  async cancelIssue(companyId: string, issueId: string) {
    try {
      const issue = await prisma.issue.findFirst({
        where: {
          id: issueId,
          companyId,
        },
      });

      if (!issue) {
        throw new Error('Issue not found');
      }

      if (issue.isCancelled) {
        throw new Error('Issue is already cancelled');
      }

      if (issue.isPosted) {
        throw new Error('Cannot cancel posted issue. Unpost it first.');
      }

      await prisma.$transaction(async (tx) => {
        await journalPostingService.cascadeSourceJournalInTx(
          tx,
          companyId,
          [issue.journalEntryId],
          'cancel',
          undefined,
          { sourceId: issue.id, sourceType: 'GI', sourceNumber: issue.serial ?? issue.id.slice(0, 8) }
        );
        const updateResult = await tx.issue.updateMany({
          where: { id: issueId, companyId, version: issue.version },
          data: {
            isCancelled: true,
            cancelledAt: new Date(),
            version: { increment: 1 },
          },
        });
        assertUpdateCount(updateResult.count);
      });

      logger.info({ companyId, issueId }, 'Issue cancelled');

      return prisma.issue.findFirstOrThrow({ where: { id: issueId, companyId } });
    } catch (error) {
      logger.error({ error, companyId, issueId }, 'Error cancelling issue');
      throw error;
    }
  }

  /**
   * Restore cancelled issue
   */
  async restoreIssue(companyId: string, issueId: string) {
    try {
      const issue = await prisma.issue.findFirst({
        where: {
          id: issueId,
          companyId,
        },
      });

      if (!issue) {
        throw new Error('Issue not found');
      }

      if (!issue.isCancelled) {
        throw new Error('Issue is not cancelled');
      }

      const updateResult = await prisma.issue.updateMany({
        where: { id: issueId, companyId, version: issue.version },
        data: {
          isCancelled: false,
          cancelledAt: null,
          version: { increment: 1 },
        },
      });
      assertUpdateCount(updateResult.count);

      logger.info({ companyId, issueId }, 'Issue restored');

      return prisma.issue.findFirstOrThrow({ where: { id: issueId, companyId } });
    } catch (error) {
      logger.error({ error, companyId, issueId }, 'Error restoring issue');
      throw error;
    }
  }
}

export const issueService = new IssueService();

