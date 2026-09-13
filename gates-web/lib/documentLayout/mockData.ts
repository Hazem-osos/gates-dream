/**
 * Realistic mock payloads for live-preview document types.
 * Numbers mirror Module A (mostakhlas) and Module B (installment receipt)
 * so the configurator preview matches printed production documents.
 */

import type { PreviewMockKind } from './types';

export interface ContractorInvoiceLine {
  boqNo: string;
  description: string;
  unit: string;
  contractQty: number;
  previousQty: number;
  currentQty: number;
  cumulativeQty: number;
  unitPrice: number;
  previousAmount: number;
  currentAmount: number;
  cumulativeAmount: number;
}

export interface ContractorInvoiceMock {
  kind: 'CONTRACTOR_INVOICE';
  documentNo: string;
  extractSequence: number;
  documentDate: string;
  periodStartDate: string;
  periodEndDate: string;
  projectName: string;
  contractorName: string;
  contractNo: string;
  siteLocation: string;
  lines: ContractorInvoiceLine[];
  previousExtractsTotal: number;
  currentExtractTotal: number;
  cumulativeTotal: number;
  advancePaymentPercent: number;
  advanceRecoveryAmount: number;
  retentionPercent: number;
  retentionAmount: number;
  taxWithholdingPercent: number;
  taxWithholdingAmount: number;
  socialInsurancePercent: number;
  socialInsuranceAmount: number;
  materialScrapAmount: number;
  hsePenaltiesAmount: number;
  otherPenaltiesAmount: number;
  directExecutionAmount: number;
  earlyPaymentPercent: number;
  earlyPaymentAmount: number;
  overheadPercent: number;
  overheadAmount: number;
  netPayable: number;
  currency: string;
}

export interface RealEstateReceiptMock {
  kind: 'REAL_ESTATE_RECEIPT';
  documentNo: string;
  documentDate: string;
  projectName: string;
  phaseName: string;
  buildingNo: string;
  unitNo: string;
  unitType: string;
  unitArea: number;
  buyerName: string;
  buyerNationalId: string;
  contractNo: string;
  installmentNo: number;
  totalInstallments: number;
  installmentType: string;
  installmentDueDate: string;
  installmentAmount: number;
  previouslyPaid: number;
  amountPaidNow: number;
  lateFeesAmount: number;
  totalUnitPrice: number;
  remainingBalance: number;
  paymentMethod: string;
  receiptNo: string;
  currency: string;
}

export interface TaxInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}

export interface TaxInvoiceMock {
  kind: 'TAX_INVOICE';
  documentKind: 'TAX_INVOICE' | 'DEBIT_NOTE';
  documentNo: string;
  documentDate: string;
  sellerName: string;
  sellerTaxId: string;
  sellerCommercialReg: string;
  buyerName: string;
  buyerTaxId: string;
  buyerAddress: string;
  originalInvoiceNo?: string;
  penaltyReason?: string;
  lines: TaxInvoiceLine[];
  subTotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  etaUuid: string;
  etaSubmissionDate: string;
  currency: string;
}

export type PreviewMockData = ContractorInvoiceMock | RealEstateReceiptMock | TaxInvoiceMock;

function line(
  boqNo: string,
  description: string,
  unit: string,
  contractQty: number,
  previousQty: number,
  currentQty: number,
  unitPrice: number
): ContractorInvoiceLine {
  const cumulativeQty = previousQty + currentQty;
  return {
    boqNo,
    description,
    unit,
    contractQty,
    previousQty,
    currentQty,
    cumulativeQty,
    unitPrice,
    previousAmount: previousQty * unitPrice,
    currentAmount: currentQty * unitPrice,
    cumulativeAmount: cumulativeQty * unitPrice,
  };
}

export function buildContractorInvoiceMock(): ContractorInvoiceMock {
  const lines: ContractorInvoiceLine[] = [
    line('1.1', 'أعمال حفر وتسوية الموقع', 'م³', 1200, 1000, 200, 85),
    line('2.3', 'أعمال خرسانة عادية للقواعد', 'م³', 340, 200, 80, 1450),
    line('2.7', 'حديد تسليح (تزويد وتركيب)', 'طن', 65, 30, 10, 32000),
    line('4.2', 'مباني طوب طفلي 20سم', 'م²', 2800, 1100, 550, 210),
    line('6.1', 'أعمال لياسة داخلية وخارجية', 'م²', 5400, 0, 900, 95),
  ];
  const currentExtractTotal = lines.reduce((sum, row) => sum + row.currentAmount, 0);
  const previousExtractsTotal = lines.reduce((sum, row) => sum + row.previousAmount, 0);
  const cumulativeTotal = previousExtractsTotal + currentExtractTotal;
  const advancePaymentPercent = 10;
  const advanceRecoveryAmount = Math.round(currentExtractTotal * 0.1);
  const retentionPercent = 5;
  const retentionAmount = Math.round(currentExtractTotal * 0.05);
  const taxWithholdingPercent = 1;
  const taxWithholdingAmount = Math.round(currentExtractTotal * 0.01);
  const socialInsurancePercent = 1;
  const socialInsuranceAmount = Math.round(currentExtractTotal * 0.01);
  const materialScrapAmount = 3200;
  const hsePenaltiesAmount = 1500;
  const otherPenaltiesAmount = 3000;
  const directExecutionAmount = 8000;
  const earlyPaymentPercent = 0;
  const earlyPaymentAmount = 0;
  const overheadPercent = 2;
  const overheadAmount = 0;
  const netPayable =
    currentExtractTotal -
    advanceRecoveryAmount -
    retentionAmount -
    taxWithholdingAmount -
    socialInsuranceAmount -
    materialScrapAmount -
    hsePenaltiesAmount -
    otherPenaltiesAmount -
    directExecutionAmount -
    earlyPaymentAmount -
    overheadAmount;

  return {
    kind: 'CONTRACTOR_INVOICE',
    documentNo: 'EXT-2026-0007',
    extractSequence: 7,
    documentDate: '2026-08-24',
    periodStartDate: '2026-08-01',
    periodEndDate: '2026-08-31',
    projectName: 'مشروع أبراج النيل السكني — المرحلة الثانية',
    contractorName: 'شركة الفا للمقاولات العمومية',
    contractNo: 'CTR-2025-0143',
    siteLocation: 'القاهرة الجديدة — التجمع الخامس',
    lines,
    previousExtractsTotal,
    currentExtractTotal,
    cumulativeTotal,
    advancePaymentPercent,
    advanceRecoveryAmount,
    retentionPercent,
    retentionAmount,
    taxWithholdingPercent,
    taxWithholdingAmount,
    socialInsurancePercent,
    socialInsuranceAmount,
    materialScrapAmount,
    hsePenaltiesAmount,
    otherPenaltiesAmount,
    directExecutionAmount,
    earlyPaymentPercent,
    earlyPaymentAmount,
    overheadPercent,
    overheadAmount,
    netPayable,
    currency: 'EGP',
  };
}

export function buildRealEstateReceiptMock(): RealEstateReceiptMock {
  const installmentAmount = 185000;
  const previouslyPaid = 1665000;
  const amountPaidNow = installmentAmount;
  const lateFeesAmount = 0;
  const totalUnitPrice = 3700000;
  return {
    kind: 'REAL_ESTATE_RECEIPT',
    documentNo: 'RCV-2026-01245',
    documentDate: '2026-08-24',
    projectName: 'كمبوند لوتس فيو',
    phaseName: 'المرحلة الأولى',
    buildingNo: 'B12',
    unitNo: 'A-304',
    unitType: 'شقة سكنية — 3 غرف',
    unitArea: 165,
    buyerName: 'المهندس / أحمد كمال الدين محمود',
    buyerNationalId: '29005151234567',
    contractNo: 'RE-2025-3311',
    installmentNo: 10,
    totalInstallments: 20,
    installmentType: 'قسط دوري',
    installmentDueDate: '2026-08-20',
    installmentAmount,
    previouslyPaid,
    amountPaidNow,
    lateFeesAmount,
    totalUnitPrice,
    remainingBalance: totalUnitPrice - (previouslyPaid + amountPaidNow),
    paymentMethod: 'تحويل بنكي',
    receiptNo: 'REC-88213',
    currency: 'EGP',
  };
}

export function buildTaxInvoiceMock(documentKind: 'TAX_INVOICE' | 'DEBIT_NOTE' = 'TAX_INVOICE'): TaxInvoiceMock {
  if (documentKind === 'DEBIT_NOTE') {
    const amount = 15000;
    const taxAmount = Math.round(amount * 0.14);
    const lines: TaxInvoiceLine[] = [
      {
        description: 'غرامة سلامة مهنية (HSE) — مخالفة عدم ارتداء مهمات الوقاية',
        quantity: 1,
        unitPrice: amount,
        taxPercent: 14,
        taxAmount,
        total: amount + taxAmount,
      },
    ];
    return {
      kind: 'TAX_INVOICE',
      documentKind,
      documentNo: 'DBN-2026-00042',
      documentDate: '2026-08-24',
      sellerName: 'شركة جيتس للتطوير العقاري',
      sellerTaxId: '204-587-663',
      sellerCommercialReg: '58211',
      buyerName: 'شركة الفا للمقاولات العمومية',
      buyerTaxId: '301-224-119',
      buyerAddress: 'القاهرة الجديدة — التجمع الخامس',
      originalInvoiceNo: 'EXT-2026-0007',
      penaltyReason: 'خصم غرامة موقع مرتبطة بالمستخلص الجاري وفق محضر الاستشاري رقم CR-882',
      lines,
      subTotal: amount,
      totalDiscount: 0,
      totalTax: taxAmount,
      grandTotal: amount + taxAmount,
      etaUuid: 'A9C3E1B2-4D7F-41A8-8E2C-6B1D0F9A4471',
      etaSubmissionDate: '2026-08-24T11:05:00+02:00',
      currency: 'EGP',
    };
  }

  const lines: TaxInvoiceLine[] = [
    { description: 'خدمات استشارية هندسية — دفعة أغسطس', quantity: 1, unitPrice: 45000, taxPercent: 14, taxAmount: 6300, total: 51300 },
    { description: 'توريد مستلزمات مكتبية', quantity: 12, unitPrice: 350, taxPercent: 14, taxAmount: 588, total: 4788 },
    { description: 'رسوم صيانة دورية', quantity: 1, unitPrice: 8500, taxPercent: 14, taxAmount: 1190, total: 9690 },
  ];
  const subTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const totalTax = lines.reduce((s, l) => s + l.taxAmount, 0);
  const totalDiscount = 0;
  return {
    kind: 'TAX_INVOICE',
    documentKind,
    documentNo: 'TINV-2026-00812',
    documentDate: '2026-08-24',
    sellerName: 'شركة جيتس للحلول التقنية',
    sellerTaxId: '204-587-663',
    sellerCommercialReg: '58211',
    buyerName: 'مؤسسة النور للتجارة والتوزيع',
    buyerTaxId: '301-224-119',
    buyerAddress: 'الإسكندرية — طريق الحرية',
    lines,
    subTotal,
    totalDiscount,
    totalTax,
    grandTotal: subTotal - totalDiscount + totalTax,
    etaUuid: 'F1C2A9E4-7B3D-4E1A-9C6F-2D8A0B5E31A7',
    etaSubmissionDate: '2026-08-24T10:32:00+02:00',
    currency: 'EGP',
  };
}

export function buildPreviewMock(kind: PreviewMockKind): PreviewMockData {
  if (kind === 'CONTRACTOR_INVOICE') return buildContractorInvoiceMock();
  if (kind === 'REAL_ESTATE_RECEIPT') return buildRealEstateReceiptMock();
  if (kind === 'DEBIT_NOTE') return buildTaxInvoiceMock('DEBIT_NOTE');
  return buildTaxInvoiceMock('TAX_INVOICE');
}
