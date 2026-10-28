import type { AccountingReconcileResult } from '../stages/accounting.stage';
import type { InventoryReconcileResult } from '../stages/inventory.stage';
import { reconcileAccounting } from '../stages/accounting.stage';
import { reconcileCoa } from '../stages/coa.stage';
import { reconcileInventory } from '../stages/inventory.stage';
import { reconcileParties } from '../stages/parties.stage';
import type { MigrationContext } from '../migration-context';
import { money, money2 } from '../accounting/journal-money';
import {
  reconcileChequeHistorical,
  reconcileCommercialDocuments,
  reconcileSettlementHistorical,
  type ChequeReconcileResult,
  type CommercialReconcileResult,
  type SettlementReconcileResult,
} from './migration-treasury-reconcile.service';
import { reconcileUnappliedCash } from './migration-unapplied-cash.service';
import { reconcileCompleteness, type CompletenessRow } from './migration-completeness.service';
import { reconcilePartyBalances, type PartyBalanceReconcileResult } from './migration-ledger-cache.service';

export type MigrationReconciliationBundle = {
  generatedAt: string;
  coa: Awaited<ReturnType<typeof reconcileCoa>>;
  parties: Awaited<ReturnType<typeof reconcileParties>>;
  accounting: AccountingReconcileResult;
  inventory: InventoryReconcileResult;
  settlement: SettlementReconcileResult;
  cheques: ChequeReconcileResult;
  commercial: CommercialReconcileResult;
  unappliedCash: Awaited<ReturnType<typeof reconcileUnappliedCash>>;
  /** Source rows vs rows this job carried, per entity — any `missing` blocks activation. */
  completeness: CompletenessRow[];
  /** Each migrated party's ledger balance vs the legacy GL balance of its account. */
  partyBalances: PartyBalanceReconcileResult;
  journalIntegrity: {
    targetJournalCount: number;
    countAtOperationalBaseline: number | null;
    deltaSinceOperationalBaseline: number | null;
  };
  summary: {
    trialBalanceDifference: string;
    quantityDifferenceCount: number;
    openBlockers: number;
    materialPass: boolean;
    blockingReasons: string[];
  };
};

export async function runReconciliationBundle(
  ctx: MigrationContext,
  openBlockers: number
): Promise<MigrationReconciliationBundle> {
  const job = await ctx.jobs.getJob(ctx.migrationJobId);
  const progress =
    job?.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
      ? (job.progress as Record<string, unknown>)
      : null;
  const startCount =
    typeof progress?.journalIntegrity === 'object' && progress?.journalIntegrity !== null
      ? Number((progress.journalIntegrity as Record<string, unknown>).operationalBaselineCount)
      : null;
  const targetJournalCount = await ctx.prisma.journalEntry.count({
    where: { companyId: ctx.targetCompanyId },
  });

  const [coa, parties, accounting, inventory, settlement, cheques, commercial, unappliedCash, completeness, partyBalances] =
    await Promise.all([
    reconcileCoa(ctx),
    reconcileParties(ctx),
    reconcileAccounting(ctx),
    reconcileInventory(ctx),
    reconcileSettlementHistorical(ctx),
    reconcileChequeHistorical(ctx),
    reconcileCommercialDocuments(ctx),
    reconcileUnappliedCash(ctx),
    reconcileCompleteness(ctx),
    reconcilePartyBalances(ctx),
  ]);

  const blockingReasons: string[] = [];
  if (openBlockers > 0) blockingReasons.push(`${openBlockers} open BLOCKER issue(s)`);
  if (money2(money(accounting.difference)) !== '0.00') {
    blockingReasons.push(`Trial balance difference ${accounting.difference}`);
  }
  if (partyBalances.mismatchCount > 0) {
    blockingReasons.push(`${partyBalances.mismatchCount} customer/supplier balance(s) differ from the legacy account balance`);
  }
  for (const row of completeness) {
    if (row.missing > 0) {
      blockingReasons.push(`${row.missing} of ${row.source} ${row.entity} not migrated`);
    }
  }
  if (inventory.missingItem > 0) {
    blockingReasons.push(`${inventory.missingItem} stock movement line(s) reference an item that was not migrated`);
  }
  if (inventory.missingWarehouse > 0) {
    blockingReasons.push(`${inventory.missingWarehouse} stock movement line(s) have no migrated warehouse`);
  }
  if ((inventory.unknownTypeLines ?? 0) > 0) {
    blockingReasons.push(
      `${inventory.unknownTypeLines} posted stock line(s) use an invoice type with no stock direction`
    );
  }
  if (inventory.quantityDifferenceCount > 0) {
    blockingReasons.push(`${inventory.quantityDifferenceCount} mapped qty difference(s)`);
  }
  const negativeValuation =
    inventory.valuationGaps?.filter((g) => g.reason?.includes('Negative') || g.quantity.startsWith('-')) ?? [];
  if (negativeValuation.length > 0) {
    blockingReasons.push(
      `${negativeValuation.length} valuation gap(s) on negative/on-hand rows (policy: no invented valuation)`
    );
  }
  if (settlement.duplicateAllocationGroups > 0) {
    blockingReasons.push(`${settlement.duplicateAllocationGroups} duplicate payment allocation group(s)`);
  }
  if (settlement.orphanAllocationCount > 0) {
    blockingReasons.push(`${settlement.orphanAllocationCount} orphaned payment allocation(s)`);
  }
  if (commercial.invoiceHeaderLineMismatchCount > 0) {
    blockingReasons.push(
      `${commercial.invoiceHeaderLineMismatchCount} invoice(s) where header net ≠ sum(lines)`
    );
  }
  if (settlement.invoicePaidMismatchCount > 0) {
    blockingReasons.push(
      `${settlement.invoicePaidMismatchCount} invoice(s) where legacy paidAmount ≠ sum(PaymentAllocation)`
    );
  }
  const deltaSinceOperationalBaseline =
    startCount != null && Number.isFinite(startCount) ? targetJournalCount - startCount : null;
  if (deltaSinceOperationalBaseline != null && deltaSinceOperationalBaseline !== 0) {
    blockingReasons.push(
      `Journal entry count changed by ${deltaSinceOperationalBaseline} during operational stages (historical import must not create GL)`
    );
  }

  const materialPass = blockingReasons.length === 0;

  return {
    generatedAt: new Date().toISOString(),
    coa,
    parties,
    accounting,
    inventory,
    settlement,
    cheques,
    commercial,
    unappliedCash,
    completeness,
    partyBalances,
    journalIntegrity: {
      targetJournalCount,
      countAtOperationalBaseline: startCount,
      deltaSinceOperationalBaseline,
    },
    summary: {
      trialBalanceDifference: accounting.difference,
      quantityDifferenceCount: inventory.quantityDifferenceCount,
      openBlockers,
      materialPass,
      blockingReasons,
    },
  };
}

export function reconciliationBundleToCsv(bundle: MigrationReconciliationBundle): string {
  const lines = [
    'section,key,value',
    `summary,trialBalanceDifference,${bundle.summary.trialBalanceDifference}`,
    `summary,quantityDifferenceCount,${bundle.summary.quantityDifferenceCount}`,
    `summary,materialPass,${bundle.summary.materialPass}`,
    `accounting,sourceDebit,${bundle.accounting.sourceDebit}`,
    `accounting,sourceCredit,${bundle.accounting.sourceCredit}`,
    `accounting,targetDebit,${bundle.accounting.targetDebit}`,
    `accounting,targetCredit,${bundle.accounting.targetCredit}`,
    `accounting,difference,${bundle.accounting.difference}`,
    `inventory,quantityDifferenceCount,${bundle.inventory.quantityDifferenceCount}`,
    `inventory,subledgerValue,${bundle.inventory.inventorySubledgerValue ?? ''}`,
    `settlement,allocationRows,${bundle.settlement.migratedInvoicesWithAllocations}`,
    `settlement,paidMismatchCount,${bundle.settlement.invoicePaidMismatchCount}`,
    `settlement,duplicateGroups,${bundle.settlement.duplicateAllocationGroups}`,
    `settlement,orphanAllocations,${bundle.settlement.orphanAllocationCount}`,
    `cheques,migrated,${bundle.cheques.migratedCheques}`,
    `cheques,missingJournalLink,${bundle.cheques.chequesMissingJournalLink}`,
  ];
  for (const row of bundle.completeness ?? []) {
    lines.push(`completeness,"${row.entity.replace(/"/g, '""')}",${row.migrated}/${row.source}`);
  }
  for (const reason of bundle.summary.blockingReasons) {
    lines.push(`blocking,reason,"${reason.replace(/"/g, '""')}"`);
  }
  return lines.join('\n');
}
