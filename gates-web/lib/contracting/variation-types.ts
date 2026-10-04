import type { PreliminaryCertificateStatus } from './preliminary-types';

export type ContractVariationOrderStatus = PreliminaryCertificateStatus;

export type ContractVariationChangeType = 'QUANTITY_CHANGE' | 'RATE_CHANGE' | 'NEW_ITEM' | 'OMIT';

export type ContractVariationOrderLine = {
  id: string;
  changeType: ContractVariationChangeType;
  projectBOQItemId?: string | null;
  subcontractBOQItemId?: string | null;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  originalQuantity: number;
  quantityDelta: number;
  effectiveQuantityAfter?: number | null;
  originalRate: number;
  approvedRate?: number | null;
  amountImpact: number;
  notes?: string | null;
  createdProjectBOQItemId?: string | null;
};

export type ContractVariationOrder = {
  id: string;
  orderNumber: string;
  sequenceNumber: number;
  orderDate: string;
  reason: string;
  status: ContractVariationOrderStatus;
  increaseValue: number;
  decreaseValue: number;
  netImpact: number;
  originalContractValueSnapshot: number;
  revisedContractValueSnapshot: number;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  lines: ContractVariationOrderLine[];
};

export const VO_STATUS_LABEL: Record<ContractVariationOrderStatus, string> = {
  DRAFT: 'مسودة',
  SUBMITTED: 'مرسل للمراجعة',
  UNDER_REVIEW: 'تحت المراجعة',
  APPROVED: 'معتمد',
  CONVERTED: 'تم التحويل',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغي',
};

export const CHANGE_TYPE_LABEL: Record<ContractVariationChangeType, string> = {
  QUANTITY_CHANGE: 'تعديل كمية',
  RATE_CHANGE: 'تعديل سعر',
  NEW_ITEM: 'بند جديد',
  OMIT: 'تخفيض / حذف نطاق',
};

export type ContractBoqScopeItem = {
  projectBOQItemId: string;
  itemCode: string;
  origin: 'BASE_CONTRACT' | 'VARIATION_ORDER';
  sourceVariationOrderNumber?: string | null;
  originalQuantity: number;
  approvedVariationQuantityDelta: number;
  effectiveQuantity: number;
  originalRate: number;
  effectiveRate: number;
  originalAmount: number;
  variationAmountImpact: number;
  revisedAmount: number;
};

export type ContractBoqScope = {
  clientContractId: string;
  originalContractValue: number;
  approvedVariationNetImpact: number;
  revisedContractValue: number;
  items: ContractBoqScopeItem[];
};
