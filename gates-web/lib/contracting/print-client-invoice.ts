import { toMoney } from '@/lib/subcontracts/money';
import type { ContractorInvoiceMock } from '@/lib/documentLayout/mockData';
import type { ClientContractDetail, ClientInvoice, OwnerBoqItem } from './types';

export function clientInvoiceToPreview(
  contract: ClientContractDetail,
  invoice: ClientInvoice,
  boqItems: OwnerBoqItem[]
): ContractorInvoiceMock {
  const boqById = new Map(boqItems.map((row) => [row.id, row]));
  const lines = (invoice.items ?? []).map((item) => {
    const boq = boqById.get(item.projectBOQItemId);
    const previousQty = toMoney(item.previousQuantity);
    const currentQty = toMoney(item.currentQuantity);
    const cumulativeQty = toMoney(item.cumulativeQuantity) || previousQty + currentQty;
    const unitPrice = toMoney(item.unitSellingPrice ?? boq?.unitSellingPrice);
    const currentAmount = toMoney(item.currentAmount) || currentQty * unitPrice;
    return {
      boqNo: boq?.itemCode ?? '—',
      description: boq?.descriptionAr ?? '—',
      unit: boq?.unit ?? '',
      contractQty: toMoney(boq?.contractQuantity),
      previousQty,
      currentQty,
      cumulativeQty,
      unitPrice,
      previousAmount: previousQty * unitPrice,
      currentAmount,
      cumulativeAmount: cumulativeQty * unitPrice,
    };
  });

  return {
    kind: 'CONTRACTOR_INVOICE',
    documentNo: invoice.invoiceNumber,
    extractSequence: invoice.sequenceNumber,
    documentDate: invoice.periodEndDate,
    periodStartDate: invoice.periodStartDate,
    periodEndDate: invoice.periodEndDate,
    projectName: contract.project?.projectName ?? '—',
    contractorName: contract.client?.arabicName ?? 'العميل المالك',
    contractNo: contract.contractNumber,
    siteLocation: contract.project?.projectCode ?? '',
    lines,
    previousExtractsTotal: toMoney(invoice.previousGrossWorks),
    currentExtractTotal: toMoney(invoice.grossCurrentWorks),
    cumulativeTotal: toMoney(invoice.cumulativeGrossWorks),
    advancePaymentPercent: toMoney(contract.advanceRecoveryRate) * 100,
    advanceRecoveryAmount: toMoney(invoice.advancePaymentRecovery),
    retentionPercent: toMoney(contract.retentionRate) * 100,
    retentionAmount: toMoney(invoice.retentionDeduction),
    taxWithholdingPercent: 0,
    taxWithholdingAmount: 0,
    socialInsurancePercent: toMoney(contract.engineeringStampsRate) * 100,
    socialInsuranceAmount: toMoney(invoice.engineeringStampsDeduction),
    materialScrapAmount: toMoney(invoice.materialsOnSiteCurrent) - toMoney(invoice.materialsOnSiteDeduction),
    hsePenaltiesAmount: 0,
    otherPenaltiesAmount: toMoney(invoice.otherClientPenalties),
    directExecutionAmount: 0,
    earlyPaymentPercent: 0,
    earlyPaymentAmount: 0,
    overheadPercent: 0,
    overheadAmount: 0,
    netPayable: toMoney(invoice.netPayableByClient),
    currency: 'EGP',
  };
}
