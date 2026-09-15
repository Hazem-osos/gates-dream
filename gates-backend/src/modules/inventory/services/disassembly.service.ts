// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { logger } from '../../../shared/logger';
import { stockMovementService } from './stock-movement.service';
import { itemCostService } from './item-cost.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import {
  stockMovementGlService,
  resolveStockGlAccounts,
  type StockGlPostingContext,
} from './stock-movement-gl.service';
import { roundTo4 } from '../../../shared/utils/decimal-round';

export interface DisassemblyComponentLine {
  componentItemId: string; // Component item ID (output)
  quantity: number; // Quantity of component produced per disassembled item
  unitPrice?: number; // Component unit price
  total?: number; // Component total value
}

export interface DisassemblyLine {
  disassembledItemId: string; // The disassembled item (input)
  disassembledQuantity: number; // Quantity of disassembled item consumed
  disassembledUnitPrice?: number; // Disassembled item unit price
  disassembledTotal?: number; // Disassembled item total value
  components: DisassemblyComponentLine[]; // Component items (outputs)
}

export interface CreateDisassemblyData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  hijriDate?: string | null;
  warehouseId: string;
  toWarehouseId?: string | null;
  costCenterId?: string | null;
  lines: DisassemblyLine[];
}

type DisassemblyExtras = {
  toWarehouseId?: string | null;
  costCenterId?: string | null;
  journalEntryId?: string;
};

function encodeDisassemblyExtras(extras: DisassemblyExtras): string | null {
  const payload: DisassemblyExtras = {};
  if (extras.toWarehouseId) payload.toWarehouseId = extras.toWarehouseId;
  if (extras.costCenterId) payload.costCenterId = extras.costCenterId;
  return Object.keys(payload).length ? JSON.stringify(payload) : null;
}

function parseDisassemblyExtras(record?: string | null): DisassemblyExtras {
  if (!record) return {};
  try {
    const parsed = JSON.parse(record) as DisassemblyExtras;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    /* posted documents may store a journal id in `record` */
  }
  return { journalEntryId: record };
}

export class DisassemblyService {
  /**
   * Calculate disassembly totals
   */
  private calculateTotals(
    components: DisassemblyComponentLine[],
    disassembledQuantity: number
  ): {
    totalValue: number;
    unitValue: number;
  } {
    const totalValue = components.reduce(
      (sum, comp) => sum + (comp.total || comp.quantity * (comp.unitPrice || 0)),
      0
    );
    const unitValue = disassembledQuantity > 0 ? totalValue / disassembledQuantity : 0;

    return { totalValue, unitValue };
  }

  /**
   * Create disassembly entry
   */
  async createDisassembly(companyId: string, data: CreateDisassemblyData) {
    try {
      // Validate warehouse belongs to company
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: data.warehouseId, companyId },
      });

      if (!warehouse) {
        throw new Error('Warehouse not found or does not belong to company');
      }

      // Collect all item IDs (components and disassembled items)
      const allItemIds = new Set<string>();
      data.lines.forEach((line) => {
        allItemIds.add(line.disassembledItemId);
        line.components.forEach((comp) => {
          allItemIds.add(comp.componentItemId);
        });
      });

      // Validate all items belong to company
      const items = await prisma.item.findMany({
        where: {
          id: { in: Array.from(allItemIds) },
          companyId,
        },
      });

      if (items.length !== allItemIds.size) {
        throw new Error('One or more items not found or do not belong to company');
      }

      const disassembly = await prisma.$transaction(async (tx) => {
        let totalAmount = 0;
        data.lines.forEach((line) => {
          const disassembledTotal =
            line.disassembledTotal ||
            line.disassembledQuantity * (line.disassembledUnitPrice || 0);
          totalAmount += disassembledTotal;
        });

        const record = await tx.disassembly.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            date: new Date(data.date),
            hijriDate: data.hijriDate || null,
            warehouseId: data.warehouseId,
            totalAmount,
            record: encodeDisassemblyExtras({
              toWarehouseId: data.toWarehouseId,
              costCenterId: data.costCenterId,
            }),
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        // Create disassembly lines and components
        const lines = [];
        for (const lineData of data.lines) {
          const { totalValue, unitValue } = this.calculateTotals(
            lineData.components,
            lineData.disassembledQuantity
          );
          const disassembledTotal =
            lineData.disassembledTotal ||
            lineData.disassembledQuantity * (lineData.disassembledUnitPrice || unitValue);

          const line = await tx.disassemblyLine.create({
            data: {
              disassemblyId: record.id,
              disassembledItemId: lineData.disassembledItemId,
              disassembledQuantity: lineData.disassembledQuantity,
              disassembledUnitPrice: lineData.disassembledUnitPrice || unitValue,
              disassembledTotal,
            },
          });

          // Create component lines
          const components = [];
          for (const compData of lineData.components) {
            const compTotal =
              compData.total ||
              compData.quantity * (compData.unitPrice || 0);
            const component = await tx.disassemblyComponent.create({
              data: {
                disassemblyLineId: line.id,
                componentItemId: compData.componentItemId,
                quantity: compData.quantity, // Quantity per disassembled item
                unitPrice: compData.unitPrice || 0,
                total: compTotal,
              },
            });
            components.push(component);
          }

          lines.push({
            ...line,
            components,
          });
        }

        return {
          ...record,
          lines,
        };
      });

      logger.info(
        {
          companyId,
          disassemblyId: disassembly.id,
          warehouseId: data.warehouseId,
          linesCount: data.lines.length,
        },
        'Disassembly created'
      );

      return disassembly;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating disassembly');
      throw error;
    }
  }

  /**
   * Get disassembly by ID
   */
  async getDisassemblyById(companyId: string, disassemblyId: string) {
    try {
      const disassembly = await prisma.disassembly.findFirst({
        where: {
          id: disassemblyId,
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
              disassembledItem: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                  englishName: true,
                },
              },
              components: {
                include: {
                  componentItem: {
                    select: {
                      id: true,
                      serial: true,
                      arabicName: true,
                      englishName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!disassembly) {
        throw new Error('Disassembly not found');
      }

      const extras = parseDisassemblyExtras(disassembly.record);
      return {
        ...disassembly,
        toWarehouseId: extras.toWarehouseId || disassembly.warehouseId,
        costCenterId: extras.costCenterId || null,
        journalEntryId: extras.journalEntryId || (disassembly.isPosted ? disassembly.record : null),
      };
    } catch (error) {
      logger.error({ error, companyId, disassemblyId }, 'Error getting disassembly');
      throw error;
    }
  }

  /**
   * List disassembly entries
   */
  async listDisassemblies(
    companyId: string,
    options?: {
      branchId?: string;
      warehouseId?: string;
      isPosted?: boolean;
      isApproved?: boolean;
      isCancelled?: boolean;
      fromDate?: string;
      toDate?: string;
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

      const [disassemblies, total] = await Promise.all([
        prisma.disassembly.findMany({
          where,
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            lines: {
              include: {
                disassembledItem: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
              },
              take: 3, // Limit lines in list view
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: options?.skip || 0,
          take: options?.take || 50,
        }),
        prisma.disassembly.count({ where }),
      ]);

      return {
        data: disassemblies,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing disassemblies');
      throw error;
    }
  }

  /**
   * Post disassembly (consume disassembled items and create component
   * items) — the mirror of assembly. The disassembled item is relieved at
   * its current average cost; that cost is then split across the output
   * components by their configured relative value (quantity × unitPrice),
   * and each component's average cost is rolled forward via a genuine
   * inbound-at-cost `applyMovingAverageInTx` call (production receipt).
   */
  async postDisassembly(
    companyId: string,
    disassemblyId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const disassembly = await prisma.disassembly.findFirst({
        where: {
          id: disassemblyId,
          companyId,
        },
        include: {
          lines: {
            include: {
              components: true,
            },
          },
        },
      });

      if (!disassembly) {
        throw new Error('Disassembly not found');
      }

      if (disassembly.isCancelled) {
        throw new Error('Cannot post cancelled disassembly');
      }

      if (disassembly.isPosted) {
        throw new Error('Disassembly is already posted');
      }

      const extras = parseDisassemblyExtras(disassembly.record);
      const destWarehouseId = extras.toWarehouseId || disassembly.warehouseId;
      const sourceType = 'DSM';
      const sourceNumber = disassembly.serial ?? disassembly.id.slice(0, 8);
      const sourceYearId = String(new Date(disassembly.date).getFullYear());

      const disassembledItemIds = [...new Set(disassembly.lines.map((l) => l.disassembledItemId))];
      const componentItemIds = [
        ...new Set(disassembly.lines.flatMap((l) => l.components.map((c) => c.componentItemId))),
      ];
      const allItemIds = [...new Set([...disassembledItemIds, ...componentItemIds])];

      const [unitCosts, items, glAccounts] = await Promise.all([
        itemCostService.getCostsAsOf(companyId, disassembledItemIds, disassembly.date),
        prisma.item.findMany({
          where: { id: { in: allItemIds }, companyId },
          select: { id: true, mainAccountId: true },
        }),
        glCtx ? resolveStockGlAccounts(companyId).catch(() => null) : Promise.resolve(null),
      ]);
      const itemAccountById = new Map(items.map((i) => [i.id, i.mainAccountId]));
      const defaultInventoryAccountId = glAccounts?.inventoryAccountId;

      const debitLines: { accountId: string; amount: number; description: string }[] = [];
      const creditLines: { accountId: string; amount: number; description: string }[] = [];

      await prisma.$transaction(async (tx) => {
        for (const line of disassembly.lines) {
          const disassembledUnitCost = unitCosts.get(line.disassembledItemId) ?? 0;
          const totalValue = roundTo4(disassembledUnitCost * Number(line.disassembledQuantity));

          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: disassembly.branchId ?? undefined,
            warehouseId: disassembly.warehouseId,
            itemId: line.disassembledItemId,
            quantityDelta: -Number(line.disassembledQuantity),
            unitCost: disassembledUnitCost,
            movementType: sourceType,
            sourceType,
            sourceNumber,
            sourceYearId,
            documentDate: disassembly.date,
          });

          if (glAccounts) {
            const acctId = itemAccountById.get(line.disassembledItemId) ?? defaultInventoryAccountId;
            if (acctId) {
              creditLines.push({
                accountId: acctId,
                amount: totalValue,
                description: `Disassembly — item ${line.disassembledItemId} relieved`,
              });
            }
          }

          // Allocate the relieved value across output components by their
          // configured relative value (quantity × unitPrice); fall back to
          // an equal split if no relative values were provided.
          const weights = line.components.map((c) => Number(c.quantity) * Number(c.unitPrice ?? 0));
          const totalWeight = weights.reduce((s, w) => s + w, 0);

          let allocated = 0;
          for (let i = 0; i < line.components.length; i++) {
            const component = line.components[i];
            const componentQty = Number(component.quantity);
            const isLast = i === line.components.length - 1;
            const share = isLast
              ? roundTo4(totalValue - allocated)
              : roundTo4(
                  totalWeight > 0
                    ? (totalValue * weights[i]) / totalWeight
                    : totalValue / line.components.length
                );
            allocated = roundTo4(allocated + share);
            const componentUnitCost = componentQty > 0 ? roundTo4(share / componentQty) : 0;

            await stockMovementService.postMovementInTx(tx, {
              companyId,
              branchId: disassembly.branchId ?? undefined,
              warehouseId: destWarehouseId,
              itemId: component.componentItemId,
              quantityDelta: componentQty,
              unitCost: componentUnitCost,
              movementType: sourceType,
              sourceType,
              sourceNumber,
              sourceYearId,
              documentDate: disassembly.date,
            });

            await itemCostService.applyMovingAverageInTx(tx, {
              companyId,
              branchId: disassembly.branchId ?? '',
              itemId: component.componentItemId,
              invoiceDate: disassembly.date,
              itemCount: componentQty,
              itemPrice: componentUnitCost,
              sourceNum: sourceNumber,
              sourceYearId,
              sourceType,
              change: 1,
            });

            if (glAccounts) {
              const acctId = itemAccountById.get(component.componentItemId) ?? defaultInventoryAccountId;
              if (acctId) {
                debitLines.push({
                  accountId: acctId,
                  amount: share,
                  description: `Disassembly — component ${component.componentItemId} received`,
                });
              }
            }
          }
        }

        let journalEntryId: string | undefined;
        if (glCtx && glAccounts) {
          const je = await stockMovementGlService.postInventoryTransformationGlInTx(
            tx,
            glCtx,
            disassembly,
            'DISASSEMBLY',
            debitLines,
            creditLines,
            'disassembly'
          );
          journalEntryId = je?.id;
        }

        await tx.disassembly.update({
          where: { id: disassemblyId },
          data: {
            isPosted: true,
            postedAt: new Date(),
            record: JSON.stringify({
              toWarehouseId: destWarehouseId,
              costCenterId: extras.costCenterId || null,
              journalEntryId: journalEntryId || undefined,
            }),
          },
        });
      });

      logger.info({ companyId, disassemblyId }, 'Disassembly posted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, disassemblyId }, 'Error posting disassembly');
      throw error;
    }
  }

  /**
   * Unpost disassembly (reverse quantity changes, component moving
   * averages, and the GL transformation entry via a dated contra reversal).
   */
  async unpostDisassembly(
    companyId: string,
    disassemblyId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const disassembly = await prisma.disassembly.findFirst({
        where: {
          id: disassemblyId,
          companyId,
        },
        include: {
          lines: {
            include: {
              components: true,
            },
          },
        },
      });

      if (!disassembly) {
        throw new Error('Disassembly not found');
      }

      if (!disassembly.isPosted) {
        throw new Error('Disassembly is not posted');
      }

      const extras = parseDisassemblyExtras(disassembly.record);
      const destWarehouseId = extras.toWarehouseId || disassembly.warehouseId;
      const sourceType = 'DSM';
      const sourceNumber = disassembly.serial ?? disassembly.id.slice(0, 8);
      const sourceYearId = String(new Date(disassembly.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        for (const line of disassembly.lines) {
          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: disassembly.branchId ?? undefined,
            warehouseId: disassembly.warehouseId,
            itemId: line.disassembledItemId,
            quantityDelta: Number(line.disassembledQuantity),
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            documentDate: disassembly.date,
          });

          for (const component of line.components) {
            const componentQty = Number(component.quantity);
            await stockMovementService.postMovementInTx(tx, {
              companyId,
              branchId: disassembly.branchId ?? undefined,
              warehouseId: destWarehouseId,
              itemId: component.componentItemId,
              quantityDelta: -componentQty,
              movementType: `${sourceType}-UNPOST`,
              sourceType: `${sourceType}-UNPOST`,
              sourceNumber,
              sourceYearId,
              documentDate: disassembly.date,
            });

            await itemCostService.removeCostHistoryBySourceInTx(tx, {
              companyId,
              itemId: component.componentItemId,
              sourceType,
              sourceNumber,
              sourceYearId,
            });
          }
        }

        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            sourceType,
            sourceNumber,
            sourceYearId,
            `Disassembly ${sourceNumber} unposted`
          );
        }

        await tx.disassembly.update({
          where: { id: disassemblyId },
          data: {
            isPosted: false,
            postedAt: null,
            record: encodeDisassemblyExtras({
              toWarehouseId: destWarehouseId,
              costCenterId: extras.costCenterId,
            }),
          },
        });
      });

      logger.info({ companyId, disassemblyId }, 'Disassembly unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, disassemblyId }, 'Error unposting disassembly');
      throw error;
    }
  }

  /**
   * Cancel disassembly
   */
  async cancelDisassembly(companyId: string, disassemblyId: string) {
    try {
      const disassembly = await prisma.disassembly.findFirst({
        where: {
          id: disassemblyId,
          companyId,
        },
      });

      if (!disassembly) {
        throw new Error('Disassembly not found');
      }

      if (disassembly.isCancelled) {
        throw new Error('Disassembly is already cancelled');
      }

      if (disassembly.isPosted) {
        throw new Error('Cannot cancel posted disassembly. Unpost it first.');
      }

      const updated = await prisma.$transaction(async (tx) => {
        await journalPostingService.cascadeSourceJournalInTx(
          tx,
          companyId,
          [],
          'cancel',
          undefined,
          {
            sourceId: disassembly.id,
            sourceType: 'DSM',
            sourceNumber: disassembly.serial ?? disassembly.id.slice(0, 8),
          }
        );
        return tx.disassembly.update({
          where: { id: disassemblyId },
          data: {
            isCancelled: true,
            cancelledAt: new Date(),
          },
        });
      });

      logger.info({ companyId, disassemblyId }, 'Disassembly cancelled');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, disassemblyId }, 'Error cancelling disassembly');
      throw error;
    }
  }

  /**
   * Restore cancelled disassembly
   */
  async restoreDisassembly(companyId: string, disassemblyId: string) {
    try {
      const disassembly = await prisma.disassembly.findFirst({
        where: {
          id: disassemblyId,
          companyId,
        },
      });

      if (!disassembly) {
        throw new Error('Disassembly not found');
      }

      if (!disassembly.isCancelled) {
        throw new Error('Disassembly is not cancelled');
      }

      const updated = await prisma.disassembly.update({
        where: { id: disassemblyId },
        data: {
          isCancelled: false,
          cancelledAt: null,
        },
      });

      logger.info({ companyId, disassemblyId }, 'Disassembly restored');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, disassemblyId }, 'Error restoring disassembly');
      throw error;
    }
  }

  async updateDisassembly(companyId: string, disassemblyId: string, data: CreateDisassemblyData) {
    const existing = await prisma.disassembly.findFirst({
      where: { id: disassemblyId, companyId },
    });
    if (!existing) throw new Error('Disassembly not found');
    if (existing.isPosted) throw new Error('Cannot edit a posted disassembly');
    if (existing.isCancelled) throw new Error('Cannot edit a cancelled disassembly');

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, companyId },
    });
    if (!warehouse) throw new Error('Warehouse not found or does not belong to company');

    let totalAmount = 0;
    data.lines.forEach((line) => {
      totalAmount +=
        line.disassembledTotal ||
        line.disassembledQuantity * (line.disassembledUnitPrice || 0);
    });

    return prisma.$transaction(async (tx) => {
      await tx.disassemblyComponent.deleteMany({
        where: { disassemblyLine: { disassemblyId } },
      });
      await tx.disassemblyLine.deleteMany({ where: { disassemblyId } });

      await tx.disassembly.update({
        where: { id: disassemblyId },
        data: {
          description: data.description || null,
          serial: data.serial || existing.serial,
          date: new Date(data.date),
          hijriDate: data.hijriDate || null,
          warehouseId: data.warehouseId,
          totalAmount,
          record: encodeDisassemblyExtras({
            toWarehouseId: data.toWarehouseId,
            costCenterId: data.costCenterId,
          }),
        },
      });

      for (const lineData of data.lines) {
        const { totalValue, unitValue } = this.calculateTotals(
          lineData.components,
          lineData.disassembledQuantity
        );
        const line = await tx.disassemblyLine.create({
          data: {
            disassemblyId,
            disassembledItemId: lineData.disassembledItemId,
            disassembledQuantity: lineData.disassembledQuantity,
            disassembledUnitPrice: lineData.disassembledUnitPrice || unitValue,
            disassembledTotal: lineData.disassembledTotal || totalValue,
          },
        });
        for (const compData of lineData.components) {
          await tx.disassemblyComponent.create({
            data: {
              disassemblyLineId: line.id,
              componentItemId: compData.componentItemId,
              quantity: compData.quantity,
              unitPrice: compData.unitPrice || 0,
              total: compData.total || compData.quantity * (compData.unitPrice || 0),
            },
          });
        }
      }

      return this.getDisassemblyById(companyId, disassemblyId);
    });
  }
}

export const disassemblyService = new DisassemblyService();

