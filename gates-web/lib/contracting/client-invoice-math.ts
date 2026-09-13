import { toMoney } from '@/lib/subcontracts/money';
import type { ClientContractDetail, LiveClientBreakdown, OwnerBoqItem, SiteStockMaterial } from './types';
import { HISTORICAL_CLIENT_INVOICE_STATUSES } from './types';

export type DraftLine = {
  projectBOQItemId: string;
  currentQuantity: number;
};

function claimedAmount(row: SiteStockMaterial): number {
  const stored = toMoney(row.netClaimedAmount);
  if (stored > 0) return stored;
  return toMoney(row.deliveredQuantity) * toMoney(row.unitPrice) * toMoney(row.approvedPercentage);
}

export function previousQtyByBoq(contract: ClientContractDetail | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!contract) return map;
  for (const invoice of contract.invoices) {
    if (!(HISTORICAL_CLIENT_INVOICE_STATUSES as readonly string[]).includes(invoice.status)) continue;
    for (const item of invoice.items ?? []) {
      map.set(item.projectBOQItemId, (map.get(item.projectBOQItemId) ?? 0) + toMoney(item.currentQuantity));
    }
  }
  return map;
}

export function computeLiveClientBreakdown(params: {
  contract: ClientContractDetail;
  boqItems: OwnerBoqItem[];
  lines: DraftLine[];
  siteStock: SiteStockMaterial[];
  claimIds: string[];
  installIds: string[];
  otherClientPenalties: number;
}): LiveClientBreakdown {
  const { contract, boqItems, lines, siteStock, claimIds, installIds, otherClientPenalties } = params;
  const boqById = new Map(boqItems.map((row) => [row.id, row]));

  let grossCurrentWorks = 0;
  for (const line of lines) {
    const boq = boqById.get(line.projectBOQItemId);
    if (!boq) continue;
    grossCurrentWorks += Math.max(0, line.currentQuantity) * toMoney(boq.unitSellingPrice);
  }

  const claimSet = new Set(claimIds);
  const installSet = new Set(installIds);
  let materialsOnSiteCurrent = 0;
  let materialsOnSiteDeduction = 0;
  for (const row of siteStock) {
    if (row.status === 'REJECTED') continue;
    if (installSet.has(row.id)) {
      materialsOnSiteDeduction += claimedAmount(row);
      continue;
    }
    if (row.status === 'STORED_ON_SITE' && claimSet.has(row.id)) {
      materialsOnSiteCurrent += claimedAmount(row);
    }
  }

  const previouslyRecovered = contract.invoices
    .filter((invoice) => (HISTORICAL_CLIENT_INVOICE_STATUSES as readonly string[]).includes(invoice.status))
    .reduce((sum, invoice) => sum + toMoney(invoice.advancePaymentRecovery), 0);
  const remainingAdvance = Math.max(0, toMoney(contract.advancePaymentAmount) - previouslyRecovered);
  const advanceCap = grossCurrentWorks * toMoney(contract.advanceRecoveryRate);
  const advancePaymentRecovery =
    remainingAdvance > 0 && grossCurrentWorks > 0 ? Math.min(remainingAdvance, advanceCap) : 0;
  const retentionDeduction = grossCurrentWorks * toMoney(contract.retentionRate);
  const engineeringStampsDeduction = grossCurrentWorks * toMoney(contract.engineeringStampsRate);
  const penalties = Math.max(0, otherClientPenalties);
  const netMaterialsOnSite = materialsOnSiteCurrent - materialsOnSiteDeduction;
  const netPayableByClient =
    grossCurrentWorks +
    netMaterialsOnSite -
    advancePaymentRecovery -
    retentionDeduction -
    engineeringStampsDeduction -
    penalties;

  return {
    grossCurrentWorks,
    materialsOnSiteCurrent,
    materialsOnSiteDeduction,
    netMaterialsOnSite,
    advancePaymentRecovery,
    remainingAdvanceAfter: Math.max(0, remainingAdvance - advancePaymentRecovery),
    retentionDeduction,
    engineeringStampsDeduction,
    otherClientPenalties: penalties,
    netPayableByClient,
  };
}
