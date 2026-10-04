// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { stockMovementGlService, type StockGlPostingContext } from './stock-movement-gl.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { inventoryCostingService } from './inventory-costing.service';
import { itemCostService } from './item-cost.service';
import { assertWarehouseActive } from '../utils/inventory-system';
import { assertUpdateCount } from '../../../shared/concurrency/optimistic-lock';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { claimDocumentPost, claimDocumentUnpost } from '../utils/claim-document-post';
import { resolveStoreDocumentSerialInTx } from './store-document-numbering.service';
import {
  ensurePerpetualInventoryGlReady,
  runCompanyStockGlPosting,
} from '../utils/stock-gl-posting-guard';
import {
  attachDocumentFiscalYear,
  resolveStockMovementBranchId,
} from './stock-gl-posting-context';
import {
  fulfillReservationInTx,
  reverseReservationFulfillmentInTx,
} from './item-reservation.service';
import { sortForStockLocking } from '../utils/stock-lock-order.util';

export interface IssueLine {
  itemId: string;
  locationId?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
  itemReservationId?: string | null;
  reservationFulfillQuantity?: number | null;
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
  customerId?: string | null;
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
      if (data.customerId) {
        const customer = await prisma.customer.findFirst({
          where: { id: data.customerId, companyId },
          select: { id: true },
        });
        if (!customer) throw new Error('العميل غير موجود أو لا يتبع الشركة');
      }

      // Validate all items belong to company
      const itemIds = data.lines.map((line) => line.itemId);
      const items = await prisma.item.findMany({
        where: {
          id: { in: itemIds },
          companyId,
        },
      });

      if (items.length !== itemIds.length) {
        throw new Error('صنف أو أكثر غير موجود أو لا يتبع الشركة');
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
          throw new Error('موقع أو أكثر لا يتبع المخزن المختار');
        }
      }

      // Drafts save without stock. Posting enforces quantity.
      const issue = await prisma.$transaction(async (tx) => {
        // Calculate total amount
        const totalAmount = data.lines.reduce(
          (sum, line) => sum + (line.total || line.quantity * (line.unitPrice || 0)),
          0
        );

        const serial = await resolveStoreDocumentSerialInTx(tx, {
          companyId,
          branchId: data.branchId ?? null,
          fiscalYearId: null,
          kind: 'issue',
          clientSerial: data.serial,
        });

        // Create issue record
        const record = await tx.issue.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial,
            date: new Date(data.date),
            hijriDate: data.hijriDate || null,
            record: data.record || null,
            warehouseId: data.warehouseId,
            customerId: data.customerId || null,
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
              ...(lineData.itemReservationId
                ? {
                    itemReservationId: lineData.itemReservationId,
                    reservationFulfillQuantity:
                      lineData.reservationFulfillQuantity != null
                        ? lineData.reservationFulfillQuantity
                        : null,
                  }
                : {}),
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

  async updateIssue(companyId: string, issueId: string, data: CreateIssueData) {
    const existing = await prisma.issue.findFirst({ where: { id: issueId, companyId } });
    if (!existing) throw new Error('Issue not found');
    if (existing.isPosted) throw new Error('لا يمكن تعديل سند مرحّل. ألغِ الترحيل أولاً');
    if (existing.isCancelled) throw new Error('لا يمكن تعديل سند ملغى');
    await assertWarehouseActive(companyId, data.warehouseId);
    if (data.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: data.customerId, companyId },
        select: { id: true },
      });
      if (!customer) throw new Error('العميل غير موجود أو لا يتبع الشركة');
    }
    const itemIds = [...new Set(data.lines.map((line) => line.itemId).filter(Boolean))];
    const items = await prisma.item.findMany({ where: { id: { in: itemIds }, companyId } });
    if (items.length !== itemIds.length) throw new Error('أحد الأصناف غير موجود أو لا يتبع الشركة');
    const totalAmount = data.lines.reduce(
      (sum, line) => sum + (line.total || line.quantity * (line.unitPrice || 0)),
      0
    );
    await prisma.$transaction(async (tx) => {
      await tx.issueLine.deleteMany({ where: { issueId } });
      await tx.issue.update({
        where: { id: issueId },
        data: {
          branchId: data.branchId || existing.branchId,
          description: data.description || null,
          serial: data.serial || existing.serial,
          date: new Date(data.date),
          hijriDate: data.hijriDate || existing.hijriDate,
          record: data.record || existing.record,
          warehouseId: data.warehouseId,
          customerId: data.customerId || null,
          totalAmount,
        },
      });
      await tx.issueLine.createMany({
        data: data.lines.map((line) => ({
          issueId,
          itemId: line.itemId,
          itemReservationId: line.itemReservationId || null,
          reservationFulfillQuantity:
            line.reservationFulfillQuantity != null ? line.reservationFulfillQuantity : null,
          locationId: line.locationId || null,
          quantity: line.quantity,
          unitPrice: line.unitPrice || 0,
          total: line.total || line.quantity * (line.unitPrice || 0),
        })),
      });
    });
    return this.getIssueById(companyId, issueId);
  }

  async deleteIssue(companyId: string, issueId: string) {
    const existing = await prisma.issue.findFirst({ where: { id: issueId, companyId } });
    if (!existing) throw new Error('Issue not found');
    if (existing.isPosted) throw new Error('لا يمكن حذف سند مرحّل. ألغِ الترحيل أولاً');
    await prisma.issue.delete({ where: { id: issueId } });
    return { success: true };
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

      const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, issue.date);
      await assertWarehouseActive(companyId, issue.warehouseId);
      const postingCtx = attachDocumentFiscalYear(glCtx, fiscalYearId, issue.branchId);
      const inventorySystem = await ensurePerpetualInventoryGlReady(
        companyId,
        postingCtx,
        issue.warehouseId
      );

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
      const movementBranchId = resolveStockMovementBranchId(postingCtx, issue.branchId);

      let glSkipped = false;
      await prisma.$transaction(async (tx) => {
        await claimDocumentPost((args) => tx.issue.updateMany(args), issueId, companyId);
        if (!issue.branchId) {
          await tx.issue.update({
            where: { id: issueId },
            data: { branchId: movementBranchId },
          });
        }
        // Sort lines in canonical lock order to avoid deadlocks with concurrent
        // invoice/transfer posts that lock (warehouseId, itemId) in the same order.
        const sortedLines = sortForStockLocking(issue.lines, (l) => ({
          warehouseId: issue.warehouseId,
          itemId: l.itemId,
        }));
        for (const line of sortedLines) {
          const reservationId = line.itemReservationId as string | null | undefined;
          const fulfillQty = Number(line.reservationFulfillQuantity ?? 0);
          if (reservationId && fulfillQty > 0) {
            await fulfillReservationInTx(tx, companyId, {
              reservationId,
              warehouseId: issue.warehouseId,
              itemId: line.itemId,
              quantity: fulfillQty,
            });
          }
          await inventoryCostingService.applyOutboundMovement(tx, {
            companyId,
            branchId: movementBranchId,
            warehouseId: issue.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantity: Number(line.quantity),
            movementType: sourceType,
            sourceType,
            sourceNumber,
            sourceYearId,
            transactionDate: new Date(issue.date),
          });
        }

        if (postingCtx) {
          glSkipped = await runCompanyStockGlPosting(inventorySystem, () =>
            stockMovementGlService.postGoodsIssueGlInTx(tx, postingCtx, issue)
          );
        }

      });

      const { projectCostSyncService } = await import(
        '../../contracting/project-cost/project-cost-sync.service'
      );
      await projectCostSyncService.syncPostedIssueInTx(prisma, companyId, issueId);

      logger.info({ companyId, issueId, glSkipped }, 'Issue posted');

      return { success: true, glSkipped };
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

      const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, issue.date);
      const postingCtx = attachDocumentFiscalYear(glCtx, fiscalYearId, issue.branchId);

      const sourceType = 'GI';
      const sourceNumber = issue.serial ?? issue.id.slice(0, 8);
      const sourceYearId = String(new Date(issue.date).getFullYear());

      // Use transaction to reverse movements atomically
      await prisma.$transaction(async (tx) => {
        await claimDocumentUnpost((args) => tx.issue.updateMany(args), issueId, companyId);
        for (const line of issue.lines) {
          await inventoryCostingService.applyInboundMovement(tx, {
            companyId,
            branchId: issue.branchId ?? undefined,
            warehouseId: issue.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantity: Number(line.quantity),
            inheritCurrentCost: true,
            updateLastPurchasePrice: false,
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            transactionDate: new Date(issue.date),
          });
          const reservationId = line.itemReservationId as string | null | undefined;
          const fulfillQty = Number(line.reservationFulfillQuantity ?? 0);
          if (reservationId && fulfillQty > 0) {
            await reverseReservationFulfillmentInTx(tx, companyId, {
              reservationId,
              warehouseId: issue.warehouseId,
              itemId: line.itemId,
              quantity: fulfillQty,
            });
          }
        }

        if (postingCtx) {
          if (issue.journalEntryId) {
            await journalPostingService.reverseJournalEntryInTx(tx, postingCtx, issue.journalEntryId, {
              reason: `Issue ${sourceNumber} unposted`,
            });
            await journalPostingService.cascadeSourceJournalInTx(
              tx,
              companyId,
              [issue.journalEntryId],
              'unpost',
              postingCtx.userId
            );
          } else {
            await stockMovementGlService.reverseBySourceInTx(
              tx,
              postingCtx,
              sourceType,
              sourceNumber,
              sourceYearId,
              `Issue ${sourceNumber} unposted`,
              issue.id
            );
          }
        }

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

