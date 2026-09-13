import { toMoney } from '@/lib/subcontracts/money';
import type { SubcontractDetail, SubcontractInvoice } from '@/lib/subcontracts/types';
import type { UnitContract, UnitInstallment } from '@/lib/real-estate/types';
import type { ContractorInvoiceLine, ContractorInvoiceMock, RealEstateReceiptMock, TaxInvoiceMock } from './mockData';
import type { CompanyPrintProfile, InvoicePrintModel } from '@/lib/print/types';

const INSTALLMENT_TYPE_AR: Record<string, string> = {
  RESERVATION_DEPOSIT: 'عربون حجز',
  CONTRACTING_DOWNPAYMENT: 'دفعة تعاقد',
  REGULAR_INSTALLMENT: 'قسط دوري',
  DELIVERY_PAYMENT: 'دفعة استلام',
  MAINTENANCE_DEPOSIT: 'وديعة صيانة',
  ANNUAL_BALLOON: 'قسط سنوي / بالون',
};

export function subcontractInvoiceToPreview(
  subcontract: SubcontractDetail,
  invoice: SubcontractInvoice
): ContractorInvoiceMock {
  const lines: ContractorInvoiceLine[] = (invoice.items ?? []).map((item) => {
    const boq = subcontract.boqItems.find((row) => row.id === item.subcontractBOQItemId);
    const previousQty = toMoney(item.previousQuantity);
    const currentQty = toMoney(item.currentQuantity);
    const cumulativeQty = toMoney(item.totalCumulativeQuantity) || previousQty + currentQty;
    const unitPrice = toMoney(item.unitPrice ?? boq?.unitPrice);
    const currentAmount = toMoney(item.totalCurrentAmount) || currentQty * unitPrice;
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
    projectName: subcontract.project.projectName,
    contractorName: subcontract.subcontractor.nameAr,
    contractNo: subcontract.subcontractNumber,
    siteLocation: subcontract.project.projectCode,
    lines,
    previousExtractsTotal: toMoney(invoice.previousGrossAmount),
    currentExtractTotal: toMoney(invoice.grossCurrentAmount),
    cumulativeTotal: toMoney(invoice.grossCumulativeAmount),
    advancePaymentPercent: toMoney(subcontract.advancePaymentRecoveryRate) * 100,
    advanceRecoveryAmount: toMoney(invoice.advancePaymentDeduction),
    retentionPercent: toMoney(subcontract.retentionRate) * 100,
    retentionAmount: toMoney(invoice.retentionDeduction),
    taxWithholdingPercent: toMoney(subcontract.taxWithholdingRate) * 100,
    taxWithholdingAmount: toMoney(invoice.taxWithholdingDeduction),
    socialInsurancePercent: toMoney(subcontract.socialInsuranceRate) * 100,
    socialInsuranceAmount: toMoney(invoice.socialInsuranceDeduction),
    materialScrapAmount: toMoney(invoice.materialOveruseDeduction),
    hsePenaltiesAmount: 0,
    otherPenaltiesAmount: toMoney(invoice.sitePenaltiesDeduction),
    directExecutionAmount: toMoney(invoice.directExecutionDeduction),
    earlyPaymentPercent: toMoney(subcontract.earlyPaymentDiscountRate) * 100,
    earlyPaymentAmount: toMoney(invoice.earlyPaymentDiscountDeduction),
    overheadPercent: toMoney(subcontract.contractAdminOverheadRate) * 100,
    overheadAmount: 0,
    netPayable: toMoney(invoice.netPayableAmount),
    currency: 'EGP',
  };
}

export function realEstateReceiptToPreview(
  contract: UnitContract,
  installment: UnitInstallment,
  extras?: { amountPaidNow?: number; paymentMethod?: string; receiptNo?: string; documentDate?: string }
): RealEstateReceiptMock {
  const unit = contract.propertyUnit ?? contract.unit;
  const phase = contract.propertyUnit?.phase;
  const projectName =
    contract.propertyUnit?.phase?.project?.nameAr ||
    contract.unit?.building?.project?.projectName ||
    '—';
  const paidNow = extras?.amountPaidNow ?? toMoney(installment.paidAmount);
  const previouslyPaid = Math.max(0, toMoney(contract.totalSellingPrice) - toMoney(installment.balance) - paidNow);
  return {
    kind: 'REAL_ESTATE_RECEIPT',
    documentNo: extras?.receiptNo ?? `RCV-${installment.id.slice(0, 8)}`,
    documentDate: extras?.documentDate ?? new Date().toISOString().slice(0, 10),
    projectName,
    phaseName: phase?.nameAr ?? phase?.phaseCode ?? contract.unit?.building?.name ?? '—',
    buildingNo: contract.unit?.building?.buildingCode ?? '',
    unitNo: unit?.unitCode ?? contract.unit?.unitCode ?? '—',
    unitType: 'وحدة عقارية',
    unitArea: 0,
    buyerName: contract.customer.arabicName ?? contract.customer.code ?? '—',
    buyerNationalId: contract.customer.code ?? '',
    contractNo: contract.contractNumber,
    installmentNo: installment.installmentNumber,
    totalInstallments: contract.installments?.length ?? installment.installmentNumber,
    installmentType: INSTALLMENT_TYPE_AR[installment.installmentType] ?? installment.installmentType,
    installmentDueDate: installment.dueDate,
    installmentAmount: toMoney(installment.amount),
    previouslyPaid,
    amountPaidNow: paidNow,
    lateFeesAmount: toMoney(installment.accumulatedLateFee),
    totalUnitPrice: toMoney(contract.totalSellingPrice || contract.totalContractAmount),
    remainingBalance: toMoney(installment.balance),
    paymentMethod: extras?.paymentMethod ?? '—',
    receiptNo: extras?.receiptNo ?? extras?.documentDate ?? installment.id,
    currency: 'EGP',
  };
}

export type ContractorDebitNoteApi = {
  documentTypeAr?: string;
  documentNo?: string;
  subcontractNumber?: string;
  contractor?: { name?: string | null; taxId?: string | null; commercialRegister?: string | null };
  reference?: string | null;
  incidentDate?: string;
  description?: string;
  penaltyType?: string;
  amount?: string | number;
  currency?: string;
  source?: string;
};

/** Maps the sales/purchase invoice print model onto the Odoo-style TAX_INVOICE layout. */
export function invoicePrintModelToTaxPreview(
  invoice: InvoicePrintModel,
  company?: CompanyPrintProfile,
  opts?: { skipEmptyLines?: boolean }
): TaxInvoiceMock {
  const lines = (opts?.skipEmptyLines ? invoice.lines.filter((l) => l.quantity > 0) : invoice.lines).map((l) => ({
    description: [l.code, l.description].filter(Boolean).join(' — ') || '—',
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxPercent: l.vatRate,
    taxAmount: l.vatAmount,
    total: l.lineTotal,
  }));
  const buyerName = invoice.kind === 'PURCHASE' ? invoice.supplierName : invoice.customerName;
  return {
    kind: 'TAX_INVOICE',
    documentKind: 'TAX_INVOICE',
    documentNo: invoice.invoiceNumber,
    documentDate: invoice.date,
    sellerName: company?.nameAr ?? '—',
    sellerTaxId: company?.taxRegistrationNumber ?? '',
    sellerCommercialReg: company?.commercialRegister ?? '',
    buyerName: buyerName ?? '—',
    buyerTaxId: invoice.customerTaxId ?? '',
    buyerAddress: invoice.customerAddress ?? '',
    lines,
    subTotal: invoice.subtotal,
    totalDiscount: invoice.lines.reduce((s, l) => s + (l.discount || 0), 0),
    totalTax: invoice.totalVat,
    grandTotal: invoice.totalPayable,
    etaUuid: invoice.invoiceNumber,
    etaSubmissionDate: invoice.date,
    currency: invoice.currencyCode ?? 'EGP',
  };
}

export function debitNoteApiToPreview(
  note: ContractorDebitNoteApi,
  identity?: { companyNameAr?: string | null; taxId?: string | null; commercialReg?: string | null }
): TaxInvoiceMock {
  const amount = toMoney(note.amount);
  return {
    kind: 'TAX_INVOICE',
    documentKind: 'DEBIT_NOTE',
    documentNo: note.documentNo ?? `DBN-${note.subcontractNumber ?? 'NOTE'}`,
    documentDate: note.incidentDate ? String(note.incidentDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
    sellerName: identity?.companyNameAr ?? '—',
    sellerTaxId: identity?.taxId ?? '',
    sellerCommercialReg: identity?.commercialReg ?? '',
    buyerName: note.contractor?.name ?? '—',
    buyerTaxId: note.contractor?.taxId ?? '',
    buyerAddress: '',
    originalInvoiceNo: note.subcontractNumber ?? undefined,
    penaltyReason: note.description ?? note.penaltyType ?? note.source ?? 'إشعار خصم',
    lines: [
      {
        description: note.description ?? note.documentTypeAr ?? 'إشعار خصم',
        quantity: 1,
        unitPrice: amount,
        taxPercent: 0,
        taxAmount: 0,
        total: amount,
      },
    ],
    subTotal: amount,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: amount,
    etaUuid: note.reference ?? '',
    etaSubmissionDate: note.incidentDate ? String(note.incidentDate) : new Date().toISOString(),
    currency: note.currency ?? 'EGP',
  };
}
