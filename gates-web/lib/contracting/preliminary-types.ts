export type PreliminaryCertificateStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'CONVERTED'
  | 'REJECTED'
  | 'CANCELLED';

export type OwnerPreliminaryLine = {
  id: string;
  projectBOQItemId: string;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  contractQuantitySnapshot: number;
  originalContractQuantity?: number;
  approvedVariationQuantityDelta?: number;
  previousCertifiedQuantity: number;
  requestedCurrentQuantity: number;
  approvedCurrentQuantity?: number | null;
  cumulativeApprovedQuantity: number;
  remainingQuantity: number;
  unitRateSnapshot: number;
  currentAmount: number;
  cumulativeAmount: number;
};

export type OwnerPreliminaryMeasurementLink = {
  id: string;
  executiveMeasurementSheetId: string;
  consumedQuantity: number;
};

export type OwnerPreliminaryCertificate = {
  id: string;
  certificateNumber: string;
  sequenceNumber: number;
  periodStartDate: string;
  periodEndDate: string;
  status: PreliminaryCertificateStatus;
  grossCurrentWorks: number;
  previousGrossWorks: number;
  cumulativeGrossWorks: number;
  materialsOnSiteCurrent: number;
  materialsOnSiteDeduction: number;
  advancePaymentRecovery: number;
  retentionDeduction: number;
  engineeringStampsDeduction: number;
  otherClientPenalties: number;
  netPayablePreview: number;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  convertedAt?: string | null;
  clientInvoiceId?: string | null;
  lines: OwnerPreliminaryLine[];
  measurements?: OwnerPreliminaryMeasurementLink[];
};

export type SubPreliminaryLine = {
  id: string;
  subcontractBOQItemId: string;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  contractQuantitySnapshot: number;
  previousCertifiedQuantity: number;
  requestedCurrentQuantity: number;
  approvedCurrentQuantity?: number | null;
  cumulativeApprovedQuantity: number;
  remainingQuantity: number;
  unitRateSnapshot: number;
  currentAmount: number;
  cumulativeAmount: number;
};

export type SubPreliminaryCertificate = {
  id: string;
  certificateNumber: string;
  sequenceNumber: number;
  periodStartDate: string;
  periodEndDate: string;
  status: PreliminaryCertificateStatus;
  grossCurrentAmount: number;
  previousGrossAmount: number;
  grossCumulativeAmount: number;
  advancePaymentDeduction: number;
  retentionDeduction: number;
  taxWithholdingDeduction: number;
  socialInsuranceDeduction: number;
  materialOveruseDeduction: number;
  sitePenaltiesDeduction: number;
  directExecutionDeduction: number;
  earlyPaymentDiscountDeduction: number;
  netPayablePreview: number;
  applyEarlyPaymentDiscount?: boolean;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  convertedAt?: string | null;
  subcontractInvoiceId?: string | null;
  lines: SubPreliminaryLine[];
};

export const PRELIMINARY_STATUS_LABEL: Record<PreliminaryCertificateStatus, string> = {
  DRAFT: 'مسودة',
  SUBMITTED: 'مرسل للمراجعة',
  UNDER_REVIEW: 'تحت المراجعة',
  APPROVED: 'معتمد',
  CONVERTED: 'تم التحويل',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغي',
};

export type ConvertPreliminaryResult = {
  clientInvoiceId?: string;
  subcontractInvoiceId?: string;
  replay: boolean;
};
