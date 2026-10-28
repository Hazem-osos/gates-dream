import type { MigrationContext } from '../migration-context';
import type { MigrationStageName, StageRunReport } from '../types';
import {
  invoiceHeaderCursor,
  loadHistoricalInvoiceShellBatch,
  loadInvoiceDetailsForHeader,
  loadPostedInvoiceHeaderBatch,
  type InvoiceShellMode,
} from '../services/legacy-commercial-data.service';
import { resolveHistoricalJournalEntryId } from '../services/migration-journal-link.service';
import {
  decideHistoricalInvoiceImport,
  decideHistoricalInvoiceShellImport,
} from '../commercial/commercial-document-decision';
import {
  invoiceSourceKeyParts,
  transformHistoricalInvoiceHeader,
  transformHistoricalInvoiceLine,
} from '../transforms/commercial-document-transform';
import { legacyTrim } from '../transforms/legacy-values';
import { linkInvoiceReturnRelationships } from '../services/migration-invoice-relationships.service';
import { preserveLegacySnapshot } from '../services/migration-legacy-snapshot-preserve.service';
import { IMPORTER_PRESERVE_CONFIG } from '../services/migration-core-importer-preserve-config';
import { loadInvoiceNumberPlan, type InvoiceNumberPlan } from '../commercial/invoice-number-plan';
import { buildPartyRefResolver, type PartyRefResolver } from '../services/migration-party-ref.service';
import { mapLegacyInvoiceKind } from '../transforms/commercial-document-transform';
import type { LegacyInvoiceHeaderRow } from '../services/legacy-commercial-data.service';
import { loadLegacyItemUnits } from '../services/legacy-item-data.service';
import { itemUnitFactor, unitCompanyCode } from '../transforms/item-transform';
import { pickPricedUnitPair } from '../commercial/invoice-line-units';

/** (legacy item, legacy unit code) → target Unit id + conversion factor, from legacy ItemUnit. */
async function buildLegacyItemUnitResolver(ctx: MigrationContext) {
  const rows = await loadLegacyItemUnits(ctx.source, ctx.legacyCompanyCode);
  const byItemUnit = new Map<string, Record<string, unknown>>();
  for (const r of rows) byItemUnit.set(`${legacyTrim(r.ItemCode)}|${legacyTrim(r.UnitCode)}`, r);
  const cache = new Map<string, { unitId: string; factor: ReturnType<typeof itemUnitFactor>['factor'] } | null>();
  return {
    async resolve(itemCode: string, unitCode: string) {
      const k = `${itemCode}|${unitCode}`;
      if (cache.has(k)) return cache.get(k)!;
      const row = unitCode ? byItemUnit.get(k) : undefined;
      let out: { unitId: string; factor: ReturnType<typeof itemUnitFactor>['factor'] } | null = null;
      if (row) {
        const map = await ctx.idMap.findMapping(ctx.migrationJobId, 'ItemUnitDef', {
          companyCode: ctx.legacyCompanyCode,
          unitKey: unitCompanyCode(legacyTrim(row.UnitCode), legacyTrim(row.UnitNameA) || legacyTrim(row.UnitCode)),
        });
        const factor = itemUnitFactor(row);
        if (map?.targetId && factor.ok) out = { unitId: map.targetId, factor: factor.factor };
      }
      cache.set(k, out);
      return out;
    },
    /** Blank unit on the line: the item's single factor-1 unit, if there is exactly one. */
    async resolveBase(itemCode: string) {
      const base = rows.filter(
        (r) => legacyTrim(r.ItemCode) === itemCode && itemUnitFactor(r).ok && itemUnitFactor(r).factor.eq(1)
      );
      return base.length === 1 ? this.resolve(itemCode, legacyTrim(base[0].UnitCode)) : null;
    },
  };
}

/** Customer for sales-side documents, supplier for purchase-side — never both. */
async function resolveInvoiceParty(parties: PartyRefResolver, header: LegacyInvoiceHeaderRow) {
  const ref = header.SupplierAccountCode ?? header.CustomerCode ?? header.SupplierCode;
  const side = mapLegacyInvoiceKind(String(header.Type ?? ''))?.invoiceType;
  return {
    customerId: side === 'sales' ? await parties.customerId(ref) : null,
    supplierId: side === 'purchase' ? await parties.supplierId(ref) : null,
  };
}

/** The target row for this legacy invoice, matched on the full target unique key. */
async function findTargetInvoice(
  ctx: MigrationContext,
  data: { branchId: string | null; fiscalYearId: string | null; invoiceType: string; invoiceNumber: string }
) {
  return ctx.prisma.invoice.findFirst({
    where: {
      companyId: ctx.targetCompanyId,
      branchId: data.branchId,
      fiscalYearId: data.fiscalYearId,
      invoiceType: data.invoiceType,
      invoiceNumber: data.invoiceNumber,
    },
    select: { id: true },
  });
}

const STAGE: MigrationStageName = 'COMMERCIAL';
export const COMMERCIAL_STAGE_DEPS: MigrationStageName[] = ['FOUNDATION', 'COA', 'PARTIES', 'ITEMS', 'ACCOUNTING'];

export async function analyzeCommercial(ctx: MigrationContext) {
  const sample = await loadPostedInvoiceHeaderBatch(ctx.source, ctx.legacyCompanyCode, null, 500);
  let withGl = 0;
  let withoutGl = 0;
  for (const row of sample.rows) {
    if (legacyTrim(row.GLNum)) withGl += 1;
    else withoutGl += 1;
  }
  return {
    postedInvoiceSample: sample.rows.length,
    withGlNum: withGl,
    withoutGlNum: withoutGl,
    policy: 'Historical invoices import as POSTED shells linked to existing GLTrx journals — no repost.',
  };
}

type LegacyItemUnitResolver = Awaited<ReturnType<typeof buildLegacyItemUnitResolver>>;

/**
 * Writes every legacy line of one invoice (posted or shell). Returns the number of lines that
 * could not be carried (each recorded as a BLOCKER issue). Idempotent by line position.
 */
async function importInvoiceLines(
  ctx: MigrationContext,
  header: LegacyInvoiceHeaderRow,
  invoice: { id: string },
  units: LegacyItemUnitResolver
): Promise<number> {
  const details = await loadInvoiceDetailsForHeader(ctx.source, ctx.legacyCompanyCode, header);
  let position = 0;
  let linesMissing = 0;
  for (const line of details) {
    position += 1;
    await ctx.throwIfPaused({ stage: STAGE, entity: 'InvoiceTrxDetail' });
    const itemCode = legacyTrim(line.ItemCode);
    const itemMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Item', {
      companyCode: ctx.legacyCompanyCode,
      itemCode,
    });
    if (!itemMap) {
      linesMissing += 1;
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: 'BLOCKER',
        category: 'INVOICE_LINE_MISSING_ITEM',
        sourceEntity: 'InvoiceTrxDetail',
        sourceKey: `${invoiceHeaderCursor(header)}|${position}|${itemCode}`,
        description: `Item ${itemCode} not mapped — invoice line ${position} cannot be imported`,
      });
      continue;
    }
    // Legacy keeps the line in the entered unit (UnitCode1/Qty1) and the base unit
    // (UnitCode2/Qty2). The priced pair is the one whose quantity × Price gives TotalValue.
    const pair = pickPricedUnitPair(line);
    const lineUnit = pair.unitCode
      ? await units!.resolve(itemCode, pair.unitCode)
      : await units!.resolveBase(itemCode);
    const baseUnitCode = legacyTrim(line.UnitCode2) || legacyTrim(line.UnitCode1);
    const baseUnit = baseUnitCode ? await units!.resolve(itemCode, baseUnitCode) : lineUnit;
    const unitId = lineUnit?.unitId ?? null;
    if (!unitId) {
      linesMissing += 1;
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: 'BLOCKER',
        category: 'INVOICE_LINE_MISSING_UNIT',
        sourceEntity: 'InvoiceTrxDetail',
        sourceKey: `${invoiceHeaderCursor(header)}|${position}|${itemCode}`,
        description: `No unit for item ${itemCode} (${pair.unitCode || 'none'}) — invoice line ${position} cannot be imported`,
      });
      continue;
    }

    const storeCode = legacyTrim(line.StoreCode);
    const whMap = storeCode
      ? await ctx.idMap.findMapping(ctx.migrationJobId, 'Store', {
          companyCode: ctx.legacyCompanyCode,
          storeCode,
        })
      : null;
    const ccCode = legacyTrim(line.CCenter);
    const ccMap = ccCode
      ? await ctx.idMap.findMapping(ctx.migrationJobId, 'CostCenter', {
          companyCode: ctx.legacyCompanyCode,
          code: ccCode,
        })
      : null;
    const lineData = transformHistoricalInvoiceLine(line, {
      invoiceId: invoice.id,
      itemId: itemMap.targetId,
      unitId,
      baseUnitId: baseUnit?.unitId ?? unitId,
      conversionFactor:
        lineUnit && baseUnit ? lineUnit.factor.div(baseUnit.factor) : lineUnit?.factor,
      warehouseId: whMap?.targetId ?? null,
      costCenterId: ccMap?.targetId ?? null,
    });
    // Position in the deterministic source order — GridNum/Serial may be blank or repeat.
    lineData.lineOrder = position;
    lineData.quantity = pair.quantity;
    lineData.baseQuantity = pair.baseQuantity;
    const existingLine = await ctx.prisma.invoiceLine.findFirst({
      where: { invoiceId: invoice.id, lineOrder: lineData.lineOrder },
    });
    if (existingLine) {
      await ctx.prisma.invoiceLine.update({ where: { id: existingLine.id }, data: lineData });
    } else {
      await ctx.prisma.invoiceLine.create({ data: lineData });
    }
    const lineKey = `${invoiceHeaderCursor(header)}|${lineData.lineOrder}`;
    await preserveLegacySnapshot(ctx, {
      namespace: IMPORTER_PRESERVE_CONFIG.InvoiceTrxDetail.preserveNamespace,
      sourceKey: lineKey,
      raw: line as Record<string, unknown>,
      mappedColumns: IMPORTER_PRESERVE_CONFIG.InvoiceTrxDetail.mappedColumns,
    });
  }
  return linesMissing;
}

export async function runCommercialStage(ctx: MigrationContext): Promise<StageRunReport> {
  const batchSize = ctx.options.batchSize ?? 100;
  let cursor: string | null = null;
  let processed = 0;
  let written = 0;
  let skipped = 0;
  let blockers = 0;
  let warnings = 0;
  const requireJournalLink = process.env.MIGRATION_COMMERCIAL_REQUIRE_GL_LINK !== 'false';
  const invoiceNumberOf: InvoiceNumberPlan = await loadInvoiceNumberPlan(ctx.source, ctx.legacyCompanyCode);
  const parties = ctx.dryRun ? null : await buildPartyRefResolver(ctx);
  const units = ctx.dryRun ? null : await buildLegacyItemUnitResolver(ctx);

  for (;;) {
    await ctx.throwIfPaused({ stage: STAGE, entity: 'InvoiceTrxHeader' });
    const batch = await loadPostedInvoiceHeaderBatch(ctx.source, ctx.legacyCompanyCode, cursor, batchSize);
    if (!batch.rows.length) break;
    cursor = batch.nextCursor;

    for (const header of batch.rows) {
      processed += 1;
      try {
        const sourceKey = invoiceSourceKeyParts(header, ctx.legacyCompanyCode);
        const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'InvoiceTrxHeader', sourceKey);
        const journalEntryId = await resolveHistoricalJournalEntryId(
          ctx,
          legacyTrim(header.BranchCode),
          legacyTrim(header.YearID),
          header.GLNum
        );

        const decision = decideHistoricalInvoiceImport({
          type: String(header.Type ?? ''),
          glNum: legacyTrim(header.GLNum),
          journalEntryId,
          alreadyMapped: Boolean(existingMap),
          requireJournalLink,
        });

        if (decision.action === 'SKIP_ALREADY_MAPPED') {
          skipped += 1;
          continue;
        }
        if (decision.action === 'BLOCK') {
          blockers += 1;
          await ctx.issues.recordOnce({
            jobId: ctx.migrationJobId,
            stage: STAGE,
            severity: 'BLOCKER',
            category: decision.category,
            sourceEntity: 'InvoiceTrxHeader',
            sourceKey: invoiceHeaderCursor(header),
            description: decision.reason,
          });
          continue;
        }

        if (ctx.dryRun) {
          ctx.idMap.planMapping(ctx.migrationJobId, 'InvoiceTrxHeader', sourceKey);
          written += 1;
          continue;
        }

        const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
          companyCode: ctx.legacyCompanyCode,
          branchCode: legacyTrim(header.BranchCode),
        });
        const yearMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Year', {
          companyCode: ctx.legacyCompanyCode,
          yearCode: legacyTrim(header.YearID),
        });
        const party = await resolveInvoiceParty(parties!, header);
        const storeCode = legacyTrim(header.StoreCode);

        let originalInvoiceId: string | null = null;
        let originalInvoiceNumber: string | null = null;
        const retNum = legacyTrim(header.ReturnInvoiceNum);
        if (retNum) {
          originalInvoiceNumber = retNum;
          const retMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'InvoiceTrxHeader', {
            companyCode: ctx.legacyCompanyCode,
            branchCode: legacyTrim(header.BranchCode),
            yearId: legacyTrim(header.ReturnInvoiceYearID || header.YearID),
            type: legacyTrim(header.ReturnInvoiceType),
            invoiceNum: retNum,
          });
          originalInvoiceId = retMap?.targetId ?? null;
          if (!originalInvoiceId) {
            warnings += 1;
            await ctx.issues.recordOnce({
              jobId: ctx.migrationJobId,
              stage: STAGE,
              severity: 'WARNING',
              category: 'RETURN_LINK_PENDING',
              sourceEntity: 'InvoiceTrxHeader',
              sourceKey: invoiceHeaderCursor(header),
              description: `Return references ${legacyTrim(header.ReturnInvoiceType)} ${retNum} not imported yet — originalInvoiceId left null`,
            });
          }
        }

        const headerData = transformHistoricalInvoiceHeader(header, {
          companyId: ctx.targetCompanyId,
          branchId: branchMap?.targetId ?? null,
          fiscalYearId: yearMap?.targetId ?? null,
          customerId: party.customerId,
          supplierId: party.supplierId,
          warehouseId: storeCode
            ? (await ctx.idMap.findMapping(ctx.migrationJobId, 'Store', {
                companyCode: ctx.legacyCompanyCode,
                storeCode,
              }))?.targetId ?? null
            : null,
          costCenterId: legacyTrim(header.CCenter)
            ? (await ctx.idMap.findMapping(ctx.migrationJobId, 'CostCenter', {
                companyCode: ctx.legacyCompanyCode,
                code: legacyTrim(header.CCenter),
              }))?.targetId ?? null
            : null,
          journalEntryId,
          originalInvoiceId,
          originalInvoiceNumber,
        });
        headerData.invoiceNumber = invoiceNumberOf(header);

        const existing = await findTargetInvoice(ctx, headerData);

        const invoice = existing
          ? await ctx.prisma.invoice.update({ where: { id: existing.id }, data: headerData })
          : await ctx.prisma.invoice.create({ data: headerData });

        await preserveLegacySnapshot(ctx, {
          namespace: IMPORTER_PRESERVE_CONFIG.InvoiceTrxHeader.preserveNamespace,
          sourceKey: invoiceHeaderCursor(header),
          raw: header as Record<string, unknown>,
          mappedColumns: IMPORTER_PRESERVE_CONFIG.InvoiceTrxHeader.mappedColumns,
        });

        if ((await importInvoiceLines(ctx, header, invoice, units!)) > 0) warnings += 1;

        // Mapped only once all lines are written: a crash mid-invoice is resumed, not skipped.
        await ctx.idMap.recordMapping({
          jobId: ctx.migrationJobId,
          sourceEntity: 'InvoiceTrxHeader',
          sourceKeyParts: sourceKey,
          targetModel: 'Invoice',
          targetId: invoice.id,
          outcome: existing ? 'ALREADY_MAPPED' : 'CREATED_BY_MIGRATION',
          readOnly: true,
        });
        written += 1;
      } catch (err) {
        blockers += 1;
        await ctx.issues.record({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          severity: 'ERROR',
          category: 'INVOICE_IMPORT_ERROR',
          sourceEntity: 'InvoiceTrxHeader',
          sourceKey: invoiceHeaderCursor(header),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await ctx.checkpoints.save({
      jobId: ctx.migrationJobId,
      stage: STAGE,
      entity: 'InvoiceTrxHeader',
      cursorKey: cursor,
      processedCount: BigInt(processed),
      successCount: BigInt(written),
      warningCount: BigInt(warnings),
      errorCount: BigInt(blockers),
    });

    if (!batch.nextCursor) break;
  }

  const includeShells = process.env.MIGRATION_COMMERCIAL_SKIP_SHELLS !== 'true';
  if (includeShells) {
    for (const shellMode of ['DRAFT', 'CANCELLED'] as InvoiceShellMode[]) {
      let shellCursor: string | null = null;
      for (;;) {
        await ctx.throwIfPaused({ stage: STAGE, entity: `InvoiceTrxHeader_${shellMode}` });
        const shellBatch = await loadHistoricalInvoiceShellBatch(
          ctx.source,
          ctx.legacyCompanyCode,
          shellMode,
          shellCursor,
          batchSize
        );
        if (!shellBatch.rows.length) break;
        shellCursor = shellBatch.nextCursor;
        for (const header of shellBatch.rows) {
          processed += 1;
          try {
            const sourceKey = invoiceSourceKeyParts(header, ctx.legacyCompanyCode);
            const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'InvoiceTrxHeader', sourceKey);
            const decision = decideHistoricalInvoiceShellImport({
              type: String(header.Type ?? ''),
              mode: shellMode,
              alreadyMapped: Boolean(existingMap),
            });
            if (decision.action === 'SKIP_ALREADY_MAPPED') {
              skipped += 1;
              continue;
            }
            if (decision.action === 'BLOCK') {
              blockers += 1;
              continue;
            }
            if (ctx.dryRun) {
              ctx.idMap.planMapping(ctx.migrationJobId, 'InvoiceTrxHeader', sourceKey);
              written += 1;
              continue;
            }
            const branchMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Branch', {
              companyCode: ctx.legacyCompanyCode,
              branchCode: legacyTrim(header.BranchCode),
            });
            const yearMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Year', {
              companyCode: ctx.legacyCompanyCode,
              yearCode: legacyTrim(header.YearID),
            });
            const headerData = transformHistoricalInvoiceHeader(header, {
              companyId: ctx.targetCompanyId,
              branchId: branchMap?.targetId ?? null,
              fiscalYearId: yearMap?.targetId ?? null,
              ...(await resolveInvoiceParty(parties!, header)),
              warehouseId: legacyTrim(header.StoreCode)
                ? (await ctx.idMap.findMapping(ctx.migrationJobId, 'Store', {
                    companyCode: ctx.legacyCompanyCode,
                    storeCode: legacyTrim(header.StoreCode),
                  }))?.targetId ?? null
                : null,
              costCenterId: legacyTrim(header.CCenter)
                ? (await ctx.idMap.findMapping(ctx.migrationJobId, 'CostCenter', {
                    companyCode: ctx.legacyCompanyCode,
                    code: legacyTrim(header.CCenter),
                  }))?.targetId ?? null
                : null,
              historicalShell: shellMode,
              legacyStatus: legacyTrim(header.Status),
            });
            headerData.invoiceNumber = invoiceNumberOf(header);
            const existingShell = await findTargetInvoice(ctx, headerData);
            const invoice = existingShell
              ? await ctx.prisma.invoice.update({ where: { id: existingShell.id }, data: headerData })
              : await ctx.prisma.invoice.create({ data: headerData });
            await importInvoiceLines(ctx, header, invoice, units!);
            await ctx.idMap.recordMapping({
              jobId: ctx.migrationJobId,
              sourceEntity: 'InvoiceTrxHeader',
              sourceKeyParts: sourceKey,
              targetModel: 'Invoice',
              targetId: invoice.id,
              outcome: 'CREATED_BY_MIGRATION',
              readOnly: true,
            });
            written += 1;
          } catch (err) {
            blockers += 1;
            await ctx.issues.record({
              jobId: ctx.migrationJobId,
              stage: STAGE,
              severity: 'ERROR',
              category: 'INVOICE_SHELL_IMPORT_ERROR',
              sourceEntity: 'InvoiceTrxHeader',
              sourceKey: invoiceHeaderCursor(header),
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }
        if (!shellBatch.nextCursor) break;
      }
    }
  }

  const returnLinks = await linkInvoiceReturnRelationships(ctx);

  const openBlockers = await ctx.jobs.countOpenBlockers(ctx.migrationJobId);
  return {
    stage: STAGE,
    sourceCounts: { processed, skipped, blockers, warnings, returnLinksLinked: returnLinks.linked },
    transformed: processed,
    written,
    simulated: ctx.dryRun ? written : 0,
    warnings,
    errors: blockers,
    blockers: openBlockers,
  };
}
