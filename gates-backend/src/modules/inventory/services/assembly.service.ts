// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { logger } from '../../../shared/logger';
import { stockMovementService } from './stock-movement.service';
import { itemCostService } from './item-cost.service';
import { inventoryCostingService } from './inventory-costing.service';
import { COSTING_MOVEMENT } from './inventory-costing-math';
import {
  stockMovementGlService,
  resolveStockGlAccounts,
  type StockGlPostingContext,
} from './stock-movement-gl.service';
import { roundTo4 } from '../../../shared/utils/decimal-round';

export interface AssemblyComponentLine {
  componentItemId: string; // Component item ID
  quantity: number; // Quantity of component needed
  unitPrice?: number; // Component unit price
  total?: number; // Component total cost
}

export interface AssemblyLine {
  assembledItemId: string; // The assembled item (output)
  assembledQuantity: number; // Quantity of assembled item produced
  assembledUnitPrice?: number; // Assembled item unit price
  assembledTotal?: number; // Assembled item total
  components: AssemblyComponentLine[]; // Component items (inputs)
}

export interface CreateAssemblyData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  hijriDate?: string | null;
  warehouseId: string;
  toWarehouseId?: string | null;
  costCenterId?: string | null;
  lines: AssemblyLine[];
}

type AssemblyExtras = {
  toWarehouseId?: string | null;
  costCenterId?: string | null;
  journalEntryId?: string;
};

function encodeAssemblyExtras(extras: AssemblyExtras): string | null {
  const payload: AssemblyExtras = {};
  if (extras.toWarehouseId) payload.toWarehouseId = extras.toWarehouseId;
  if (extras.costCenterId) payload.costCenterId = extras.costCenterId;
  return Object.keys(payload).length ? JSON.stringify(payload) : null;
}

function parseAssemblyExtras(record?: string | null): AssemblyExtras {
  if (!record) return {};
  try {
    const parsed = JSON.parse(record) as AssemblyExtras;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    /* posted documents store the journal id/number in `record` */
  }
  return { journalEntryId: record };
}

export class AssemblyService {
  /**
   * Calculate assembly totals
   */
  private calculateTotals(components: AssemblyComponentLine[], assembledQuantity: number): {
    totalCost: number;
    unitCost: number;
  } {
    const totalCost = components.reduce(
      (sum, comp) => sum + (comp.total || comp.quantity * (comp.unitPrice || 0)),
      0
    );
    const unitCost = assembledQuantity > 0 ? totalCost / assembledQuantity : 0;
    
    return { totalCost, unitCost };
  }

  /**
   * Create assembly entry
   */
  async createAssembly(companyId: string, data: CreateAssemblyData) {
    try {
      // Validate warehouse belongs to company
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: data.warehouseId, companyId },
      });

      if (!warehouse) {
        throw new Error('Warehouse not found or does not belong to company');
      }

      // Collect all item IDs (components and assembled items)
      const allItemIds = new Set<string>();
      data.lines.forEach((line) => {
        allItemIds.add(line.assembledItemId);
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

      // Drafts may be saved before stock is available — availability is
      // enforced at post time, not create time.
      const assembly = await prisma.$transaction(async (tx) => {
        let totalAmount = 0;
        data.lines.forEach((line) => {
          const { totalCost } = this.calculateTotals(line.components, line.assembledQuantity);
          const assembledTotal = line.assembledTotal || totalCost;
          totalAmount += assembledTotal;
        });

        const record = await tx.assembly.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            date: new Date(data.date),
            hijriDate: data.hijriDate || null,
            warehouseId: data.warehouseId,
            totalAmount,
            record: encodeAssemblyExtras({
              toWarehouseId: data.toWarehouseId,
              costCenterId: data.costCenterId,
            }),
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        // Create assembly lines and components
        const lines = [];
        for (const lineData of data.lines) {
          const { totalCost, unitCost } = this.calculateTotals(
            lineData.components,
            lineData.assembledQuantity
          );
          const assembledTotal =
            lineData.assembledTotal || lineData.assembledQuantity * unitCost;

          const line = await tx.assemblyLine.create({
            data: {
              assemblyId: record.id,
              assembledItemId: lineData.assembledItemId,
              assembledQuantity: lineData.assembledQuantity,
              assembledUnitPrice: lineData.assembledUnitPrice || unitCost,
              assembledTotal,
            },
          });

          // Create component lines
          const components = [];
          for (const compData of lineData.components) {
            const compTotal = compData.total || compData.quantity * (compData.unitPrice || 0);
            const component = await tx.assemblyComponent.create({
              data: {
                assemblyLineId: line.id,
                componentItemId: compData.componentItemId,
                quantity: compData.quantity,
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
          assemblyId: assembly.id,
          warehouseId: data.warehouseId,
          linesCount: data.lines.length,
        },
        'Assembly created'
      );

      return assembly;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating assembly');
      throw error;
    }
  }

  /**
   * Get assembly by ID
   */
  async getAssemblyById(companyId: string, assemblyId: string) {
    try {
      const assembly = await prisma.assembly.findFirst({
        where: {
          id: assemblyId,
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
              assembledItem: {
                select: {
                  id: true,
                  code: true,
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
                      code: true,
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

      if (!assembly) {
        throw new Error('Assembly not found');
      }

      const extras = parseAssemblyExtras(assembly.record);
      return {
        ...assembly,
        toWarehouseId: extras.toWarehouseId || assembly.warehouseId,
        costCenterId: extras.costCenterId || null,
        journalEntryId: extras.journalEntryId || (assembly.isPosted ? assembly.record : null),
      };
    } catch (error) {
      logger.error({ error, companyId, assemblyId }, 'Error getting assembly');
      throw error;
    }
  }

  /**
   * List assembly entries
   */
  async listAssemblies(
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

      const [assemblies, total] = await Promise.all([
        prisma.assembly.findMany({
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
                assembledItem: {
                  select: {
                    id: true,
                    code: true,
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
        prisma.assembly.count({ where }),
      ]);

      return {
        data: assemblies,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing assemblies');
      throw error;
    }
  }

  /**
   * Post assembly (consume components and create assembled items).
   *
   * H1 fix: quantity mutations go through `stockMovementService` (locks +
   * `InventoryMovement` audit rows + negative-stock guard).
   *
   * C3/C8-adjacent fix: this is a genuine production receipt — components
   * are relieved at their current average cost, and the assembled item's
   * average cost is rolled forward via `applyMovingAverageInTx` using the
   * true rolled-up BOM cost (not a client-supplied guess). When `glCtx` is
   * supplied, the value transfer between component/finished item control
   * accounts is posted to the GL.
   */
  async postAssembly(
    companyId: string,
    assemblyId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const assembly = await prisma.assembly.findFirst({
        where: {
          id: assemblyId,
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

      if (!assembly) {
        throw new Error('Assembly not found');
      }

      if (assembly.isCancelled) {
        throw new Error('Cannot post cancelled assembly');
      }

      if (assembly.isPosted) {
        throw new Error('Assembly is already posted');
      }

      const extras = parseAssemblyExtras(assembly.record);
      const destWarehouseId = extras.toWarehouseId || assembly.warehouseId;
      const sourceType = 'ASM';
      const sourceNumber = assembly.serial ?? assembly.id.slice(0, 8);
      const sourceYearId = String(new Date(assembly.date).getFullYear());

      const componentItemIds = [
        ...new Set(assembly.lines.flatMap((l) => l.components.map((c) => c.componentItemId))),
      ];
      const assembledItemIds = [...new Set(assembly.lines.map((l) => l.assembledItemId))];
      const allItemIds = [...new Set([...componentItemIds, ...assembledItemIds])];

      const [items, glAccounts] = await Promise.all([
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
        for (const line of assembly.lines) {
          let lineComponentCost = 0;

          for (const component of line.components) {
            const requiredQty = Number(component.quantity);
            const outbound = await inventoryCostingService.applyOutboundMovement(tx, {
              companyId,
              branchId: assembly.branchId ?? undefined,
              warehouseId: assembly.warehouseId,
              itemId: component.componentItemId,
              quantity: requiredQty,
              movementType: COSTING_MOVEMENT.ASSEMBLY_OUT,
              sourceType,
              sourceNumber,
              sourceYearId,
              sourceDocumentId: assembly.id,
              transactionDate: assembly.date,
            });
            lineComponentCost += outbound.totalValuation;

            if (glAccounts) {
              const acctId = itemAccountById.get(component.componentItemId) ?? defaultInventoryAccountId;
              if (acctId) {
                creditLines.push({
                  accountId: acctId,
                  amount: outbound.totalValuation,
                  description: `Assembly — component ${component.componentItemId} relieved`,
                });
              }
            }
          }

          lineComponentCost = roundTo4(lineComponentCost);
          const assembledUnitCost =
            line.assembledQuantity > 0 ? roundTo4(lineComponentCost / line.assembledQuantity) : 0;

          await inventoryCostingService.applyInboundMovement(tx, {
            companyId,
            branchId: assembly.branchId ?? undefined,
            warehouseId: destWarehouseId,
            itemId: line.assembledItemId,
            quantity: Number(line.assembledQuantity),
            unitCost: assembledUnitCost,
            movementType: COSTING_MOVEMENT.ASSEMBLY_IN,
            sourceType,
            sourceNumber,
            sourceYearId,
            sourceDocumentId: assembly.id,
            transactionDate: assembly.date,
            updateLastPurchasePrice: false,
          });

          await tx.assemblyLine.update({
            where: { id: line.id },
            data: {
              assembledUnitPrice: assembledUnitCost,
              assembledTotal: lineComponentCost,
            },
          });

          if (glAccounts) {
            const acctId = itemAccountById.get(line.assembledItemId) ?? defaultInventoryAccountId;
            if (acctId) {
              debitLines.push({
                accountId: acctId,
                amount: lineComponentCost,
                description: `Assembly — finished item ${line.assembledItemId} received`,
              });
            }
          }
        }

        let journalEntryId: string | undefined;
        if (glCtx && glAccounts) {
          const je = await stockMovementGlService.postInventoryTransformationGlInTx(
            tx,
            glCtx,
            assembly,
            'ASSEMBLY',
            debitLines,
            creditLines,
            'assembly'
          );
          journalEntryId = je?.id;
        }

        await tx.assembly.update({
          where: { id: assemblyId },
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

      logger.info({ companyId, assemblyId }, 'Assembly posted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, assemblyId }, 'Error posting assembly');
      throw error;
    }
  }

  /**
   * Unpost assembly (reverse quantity changes, the finished item's moving
   * average, and the GL transformation entry via a dated contra reversal).
   */
  async unpostAssembly(
    companyId: string,
    assemblyId: string,
    glCtx?: StockGlPostingContext
  ) {
    try {
      const assembly = await prisma.assembly.findFirst({
        where: {
          id: assemblyId,
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

      if (!assembly) {
        throw new Error('Assembly not found');
      }

      if (!assembly.isPosted) {
        throw new Error('Assembly is not posted');
      }

      const extras = parseAssemblyExtras(assembly.record);
      const destWarehouseId = extras.toWarehouseId || assembly.warehouseId;
      const sourceType = 'ASM';
      const sourceNumber = assembly.serial ?? assembly.id.slice(0, 8);
      const sourceYearId = String(new Date(assembly.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        for (const line of assembly.lines) {
          for (const component of line.components) {
            const requiredQty = Number(component.quantity);
            await stockMovementService.postMovementInTx(tx, {
              companyId,
              branchId: assembly.branchId ?? undefined,
              warehouseId: assembly.warehouseId,
              itemId: component.componentItemId,
              quantityDelta: requiredQty,
              movementType: `${sourceType}-UNPOST`,
              sourceType: `${sourceType}-UNPOST`,
              sourceNumber,
              sourceYearId,
              documentDate: assembly.date,
            });
          }

          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: assembly.branchId ?? undefined,
            warehouseId: destWarehouseId,
            itemId: line.assembledItemId,
            quantityDelta: -Number(line.assembledQuantity),
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            documentDate: assembly.date,
          });

          await itemCostService.removeCostHistoryBySourceInTx(tx, {
            companyId,
            itemId: line.assembledItemId,
            sourceType,
            sourceNumber,
            sourceYearId,
          });
        }

        if (glCtx) {
          await stockMovementGlService.reverseBySourceInTx(
            tx,
            glCtx,
            sourceType,
            sourceNumber,
            sourceYearId,
            `Assembly ${sourceNumber} unposted`
          );
        }

        await tx.assembly.update({
          where: { id: assemblyId },
          data: {
            isPosted: false,
            postedAt: null,
            record: encodeAssemblyExtras({
              toWarehouseId: destWarehouseId,
              costCenterId: extras.costCenterId,
            }),
          },
        });
      });

      logger.info({ companyId, assemblyId }, 'Assembly unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, assemblyId }, 'Error unposting assembly');
      throw error;
    }
  }

  /**
   * Cancel assembly
   */
  async cancelAssembly(companyId: string, assemblyId: string) {
    try {
      const assembly = await prisma.assembly.findFirst({
        where: {
          id: assemblyId,
          companyId,
        },
      });

      if (!assembly) {
        throw new Error('Assembly not found');
      }

      if (assembly.isCancelled) {
        throw new Error('Assembly is already cancelled');
      }

      if (assembly.isPosted) {
        throw new Error('Cannot cancel posted assembly. Unpost it first.');
      }

      const updated = await prisma.assembly.update({
        where: { id: assemblyId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
        },
      });

      logger.info({ companyId, assemblyId }, 'Assembly cancelled');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, assemblyId }, 'Error cancelling assembly');
      throw error;
    }
  }

  /**
   * Restore cancelled assembly
   */
  async restoreAssembly(companyId: string, assemblyId: string) {
    try {
      const assembly = await prisma.assembly.findFirst({
        where: {
          id: assemblyId,
          companyId,
        },
      });

      if (!assembly) {
        throw new Error('Assembly not found');
      }

      if (!assembly.isCancelled) {
        throw new Error('Assembly is not cancelled');
      }

      const updated = await prisma.assembly.update({
        where: { id: assemblyId },
        data: {
          isCancelled: false,
          cancelledAt: null,
        },
      });

      logger.info({ companyId, assemblyId }, 'Assembly restored');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, assemblyId }, 'Error restoring assembly');
      throw error;
    }
  }

  async updateAssembly(companyId: string, assemblyId: string, data: CreateAssemblyData) {
    const existing = await prisma.assembly.findFirst({
      where: { id: assemblyId, companyId },
      include: { lines: true },
    });
    if (!existing) throw new Error('Assembly not found');
    if (existing.isPosted) throw new Error('Cannot edit a posted assembly');
    if (existing.isCancelled) throw new Error('Cannot edit a cancelled assembly');

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, companyId },
    });
    if (!warehouse) throw new Error('Warehouse not found or does not belong to company');

    let totalAmount = 0;
    data.lines.forEach((line) => {
      const { totalCost } = this.calculateTotals(line.components, line.assembledQuantity);
      totalAmount += line.assembledTotal || totalCost;
    });

    return prisma.$transaction(async (tx) => {
      await tx.assemblyComponent.deleteMany({
        where: { assemblyLine: { assemblyId } },
      });
      await tx.assemblyLine.deleteMany({ where: { assemblyId } });

      await tx.assembly.update({
        where: { id: assemblyId },
        data: {
          description: data.description || null,
          serial: data.serial || existing.serial,
          date: new Date(data.date),
          hijriDate: data.hijriDate || null,
          warehouseId: data.warehouseId,
          totalAmount,
          record: encodeAssemblyExtras({
            toWarehouseId: data.toWarehouseId,
            costCenterId: data.costCenterId,
          }),
        },
      });

      for (const lineData of data.lines) {
        const { totalCost, unitCost } = this.calculateTotals(
          lineData.components,
          lineData.assembledQuantity
        );
        const line = await tx.assemblyLine.create({
          data: {
            assemblyId,
            assembledItemId: lineData.assembledItemId,
            assembledQuantity: lineData.assembledQuantity,
            assembledUnitPrice: lineData.assembledUnitPrice || unitCost,
            assembledTotal: lineData.assembledTotal || totalCost,
          },
        });
        for (const compData of lineData.components) {
          await tx.assemblyComponent.create({
            data: {
              assemblyLineId: line.id,
              componentItemId: compData.componentItemId,
              quantity: compData.quantity,
              unitPrice: compData.unitPrice || 0,
              total: compData.total || compData.quantity * (compData.unitPrice || 0),
            },
          });
        }
      }

      return this.getAssemblyById(companyId, assemblyId);
    });
  }
}

export const assemblyService = new AssemblyService();

