// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { logger } from '../../../shared/logger';
import { stockMovementService } from './stock-movement.service';
import { itemCostService } from './item-cost.service';
import { inventoryCostingService } from './inventory-costing.service';
import { COSTING_MOVEMENT } from './inventory-costing-math';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import {
  stockMovementGlService,
  resolveStockGlAccounts,
  pickLineInventoryAccount,
  type StockGlPostingContext,
} from './stock-movement-gl.service';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { assertWarehouseActive } from '../utils/inventory-system';
import {
  ensurePerpetualInventoryGlReady,
  runCompanyStockGlPosting,
} from '../utils/stock-gl-posting-guard';
import { sortForStockLocking } from '../utils/stock-lock-order.util';
import { AppError } from '../../../shared/middleware/error-handler';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { claimDocumentPost, claimDocumentUnpost } from '../utils/claim-document-post';
import { resolveStoreDocumentSerialInTx } from './store-document-numbering.service';

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
      await assertWarehouseActive(companyId, data.warehouseId);
      if (data.toWarehouseId && data.toWarehouseId !== data.warehouseId) {
        await assertWarehouseActive(companyId, data.toWarehouseId, { label: 'مخزن الإضافة' });
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
        throw new AppError(422, 'صنف أو أكثر غير موجود أو لا يخص الشركة');
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

        const serial = await resolveStoreDocumentSerialInTx(tx, {
          companyId,
          branchId: data.branchId ?? null,
          fiscalYearId: null,
          kind: 'assembly',
          clientSerial: data.serial,
        });

        const record = await tx.assembly.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial,
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
        throw new AppError(404, 'أمر التجميع غير موجود');
      }

      if (assembly.isCancelled) {
        throw new AppError(422, 'لا يمكن ترحيل أمر تجميع ملغي');
      }

      if (assembly.isPosted) {
        throw new AppError(422, 'أمر التجميع مرحّل بالفعل');
      }

      const extras = parseAssemblyExtras(assembly.record);
      const destWarehouseId = extras.toWarehouseId || assembly.warehouseId;
      await fiscalYearService.assertOpenForDate(companyId, assembly.date);
      await assertWarehouseActive(companyId, assembly.warehouseId);
      if (destWarehouseId !== assembly.warehouseId) {
        await assertWarehouseActive(companyId, destWarehouseId, { label: 'مخزن الإضافة' });
      }
      const sourceType = 'ASM';
      const sourceNumber = assembly.serial ?? assembly.id.slice(0, 8);
      const sourceYearId = String(new Date(assembly.date).getFullYear());

      const inventorySystem = await ensurePerpetualInventoryGlReady(
        companyId,
        glCtx,
        assembly.warehouseId
      );

      const componentItemIds = [
        ...new Set(assembly.lines.flatMap((l) => l.components.map((c) => c.componentItemId))),
      ];
      const assembledItemIds = [...new Set(assembly.lines.map((l) => l.assembledItemId))];
      const allItemIds = [...new Set([...componentItemIds, ...assembledItemIds])];

      const resolveGlAccountsPair = async () => {
        if (!glCtx) return null;
        if (inventorySystem === 'PERPETUAL') {
          const [source, dest] = await Promise.all([
            resolveStockGlAccounts(companyId, assembly.warehouseId),
            resolveStockGlAccounts(companyId, destWarehouseId),
          ]);
          return { source, dest };
        }
        const [source, dest] = await Promise.all([
          resolveStockGlAccounts(companyId, assembly.warehouseId).catch(() => null),
          resolveStockGlAccounts(companyId, destWarehouseId).catch(() => null),
        ]);
        return source && dest ? { source, dest } : null;
      };

      const [items, glAccounts] = await Promise.all([
        prisma.item.findMany({
          where: { id: { in: allItemIds }, companyId },
          select: { id: true, mainAccountId: true },
        }),
        resolveGlAccountsPair(),
      ]);
      const itemAccountById = new Map(items.map((i) => [i.id, i.mainAccountId]));
      const defaultInventoryAccountId = glAccounts?.source.inventoryAccountId;

      const debitLines: { accountId: string; amount: number; description: string }[] = [];
      const creditLines: { accountId: string; amount: number; description: string }[] = [];

      // Sort lines in canonical (warehouseId, assembledItemId) order and sort
      // each line's components by (warehouseId, componentItemId) so lock acquisition
      // is consistent with concurrent invoice/transfer posts.
      const sortedLines = sortForStockLocking(assembly.lines, (l) => ({
        warehouseId: destWarehouseId ?? assembly.warehouseId,
        itemId: l.assembledItemId,
      }));

      await prisma.$transaction(async (tx) => {
        await claimDocumentPost((args) => tx.assembly.updateMany(args), assemblyId, companyId);
        for (const line of sortedLines) {
          let lineComponentCost = 0;

          // Sort components in canonical order within this line to match invoice lock order
          const sortedComponents = sortForStockLocking([...line.components], (c) => ({
            warehouseId: assembly.warehouseId,
            itemId: c.componentItemId,
          }));

          for (const component of sortedComponents) {
            if (component.componentItemId === line.assembledItemId) {
              throw new AppError(422, 'لا يمكن أن يكون مكوّن التجميع هو نفس الصنف المُجمَّع');
            }
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
              const acctId =
                pickLineInventoryAccount(
                  glAccounts.source,
                  itemAccountById.get(component.componentItemId)
                ) ?? defaultInventoryAccountId;
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
          const extraItem = await tx.item.findFirst({
            where: { id: line.assembledItemId, companyId },
            select: { extraAssemblyCost: true, extraAssemblyCostPct: true },
          });
          const extraFixed = Number(extraItem?.extraAssemblyCost ?? 0) * Number(line.assembledQuantity);
          const extraPct = lineComponentCost * (Number(extraItem?.extraAssemblyCostPct ?? 0) / 100);
          const extraValue = roundTo4(extraFixed + extraPct);
          const inboundTotal = roundTo4(lineComponentCost + extraValue);
          const assembledUnitCost =
            line.assembledQuantity > 0 ? roundTo4(inboundTotal / line.assembledQuantity) : 0;

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
              assembledTotal: inboundTotal,
            },
          });

          if (glAccounts) {
            const acctId =
              pickLineInventoryAccount(
                glAccounts.dest,
                itemAccountById.get(line.assembledItemId)
              ) ?? defaultInventoryAccountId;
            if (acctId) {
              debitLines.push({
                accountId: acctId,
                amount: inboundTotal,
                description: `Assembly — finished item ${line.assembledItemId} received`,
              });
            }
            const extraAccountId = glAccounts.source.assemblyExtraCostAccountId || glAccounts.source.adjustmentAccountId;
            if (extraValue > 0 && extraAccountId) {
              creditLines.push({
                accountId: extraAccountId,
                amount: extraValue,
                description: 'تكلفة تجميع إضافية',
              });
            }
          }
        }

        let journalEntryId: string | undefined;
        if (glCtx && glAccounts) {
          await runCompanyStockGlPosting(inventorySystem, async () => {
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
          });
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
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : '';
      if (/insufficient|not enough|negative/i.test(msg)) {
        throw new AppError(422, 'الكمية غير كافية في المخزن لترحيل التجميع');
      }
      throw new AppError(422, msg || 'تعذر ترحيل أمر التجميع');
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
        throw new AppError(404, 'أمر التجميع غير موجود');
      }

      if (!assembly.isPosted) {
        throw new AppError(422, 'أمر التجميع غير مرحّل');
      }

      const extras = parseAssemblyExtras(assembly.record);
      const destWarehouseId = extras.toWarehouseId || assembly.warehouseId;
      await fiscalYearService.assertOpenForDate(companyId, assembly.date);
      const sourceType = 'ASM';
      const sourceNumber = assembly.serial ?? assembly.id.slice(0, 8);
      const sourceYearId = String(new Date(assembly.date).getFullYear());

      await prisma.$transaction(async (tx) => {
        await claimDocumentUnpost((args) => tx.assembly.updateMany(args), assemblyId, companyId);
        for (const line of assembly.lines) {
          for (const component of line.components) {
            const requiredQty = Number(component.quantity);
            await inventoryCostingService.applyInboundMovement(tx, {
              companyId,
              branchId: assembly.branchId ?? undefined,
              warehouseId: assembly.warehouseId,
              itemId: component.componentItemId,
              quantity: requiredQty,
              inheritCurrentCost: true,
              updateLastPurchasePrice: false,
              movementType: `${sourceType}-UNPOST`,
              sourceType: `${sourceType}-UNPOST`,
              sourceNumber,
              sourceYearId,
              transactionDate: new Date(assembly.date),
            });
          }

          await inventoryCostingService.applyOutboundMovement(tx, {
            companyId,
            branchId: assembly.branchId ?? undefined,
            warehouseId: destWarehouseId,
            itemId: line.assembledItemId,
            quantity: Number(line.assembledQuantity),
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            transactionDate: new Date(assembly.date),
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
      if (error instanceof AppError) throw error;
      const msg = error instanceof Error ? error.message : '';
      if (/insufficient|not enough|negative/i.test(msg)) {
        throw new AppError(422, 'تعذر فك الترحيل لأن كمية المنتج التام لم تعد متاحة في المخزن');
      }
      throw new AppError(422, msg || 'تعذر فك ترحيل أمر التجميع');
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

      const updated = await prisma.$transaction(async (tx) => {
        await journalPostingService.cascadeSourceJournalInTx(
          tx,
          companyId,
          [],
          'cancel',
          undefined,
          { sourceId: assembly.id, sourceType: 'ASM', sourceNumber: assembly.serial ?? assembly.id.slice(0, 8) }
        );
        return tx.assembly.update({
          where: { id: assemblyId },
          data: {
            isCancelled: true,
            cancelledAt: new Date(),
          },
        });
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

    await assertWarehouseActive(companyId, data.warehouseId);
    if (data.toWarehouseId && data.toWarehouseId !== data.warehouseId) {
      await assertWarehouseActive(companyId, data.toWarehouseId, { label: 'مخزن الإضافة' });
    }

    let totalAmount = 0;
    data.lines.forEach((line) => {
      const { totalCost } = this.calculateTotals(line.components, line.assembledQuantity);
      totalAmount += line.assembledTotal || totalCost;
    });

    await prisma.$transaction(async (tx) => {
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

    });
    return this.getAssemblyById(companyId, assemblyId);
  }
}

export const assemblyService = new AssemblyService();

