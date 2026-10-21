import { isParentItemCode } from '@/lib/contracting/boq-hierarchy';
import { toMoney } from './money';
import type { SubcontractBoqItem, SubcontractDetail } from './types';

export type ContractDeductionRow = {
  name: string;
  contractPercent: number;
  contractValue: number;
  onExtract: boolean;
  extractPercent: number;
  affectsContractValue: boolean;
  cumulative: boolean;
};

export function pricedBoqTotal(items: SubcontractBoqItem[]): number {
  const codes = items.map((row) => row.itemCode);
  return items.reduce((sum, row) => {
    if (isParentItemCode(row.itemCode, codes)) return sum;
    return sum + toMoney(row.totalPrice);
  }, 0);
}

export function advancePercentOfContract(subcontract: Pick<SubcontractDetail, 'advancePaymentTotal' | 'totalContractValue'>): number {
  const total = toMoney(subcontract.totalContractValue);
  if (!(total > 0)) return 0;
  return (toMoney(subcontract.advancePaymentTotal) / total) * 100;
}

/** Display mapping of stored subcontract rates to the old contract deduction grid. */
export function subcontractDeductionRows(
  subcontract: Pick<
    SubcontractDetail,
    | 'totalContractValue'
    | 'advancePaymentTotal'
    | 'advancePaymentRecoveryRate'
    | 'retentionRate'
    | 'taxWithholdingRate'
    | 'socialInsuranceRate'
    | 'earlyPaymentDiscountRate'
    | 'contractAdminOverheadRate'
  >
): ContractDeductionRow[] {
  const contractValue = toMoney(subcontract.totalContractValue);
  const advance = toMoney(subcontract.advancePaymentTotal);
  return [
    {
      name: 'دفعة مقدمة',
      contractPercent: advancePercentOfContract(subcontract),
      contractValue: advance,
      onExtract: true,
      extractPercent: toMoney(subcontract.advancePaymentRecoveryRate) * 100,
      affectsContractValue: false,
      cumulative: true,
    },
    {
      name: 'تأمين أعمال',
      contractPercent: 0,
      contractValue: 0,
      onExtract: true,
      extractPercent: toMoney(subcontract.retentionRate) * 100,
      affectsContractValue: false,
      cumulative: true,
    },
    {
      name: 'خصم المنبع — نموذج 41',
      contractPercent: 0,
      contractValue: 0,
      onExtract: true,
      extractPercent: toMoney(subcontract.taxWithholdingRate) * 100,
      affectsContractValue: false,
      cumulative: false,
    },
    {
      name: 'تأمينات اجتماعية',
      contractPercent: 0,
      contractValue: 0,
      onExtract: true,
      extractPercent: toMoney(subcontract.socialInsuranceRate) * 100,
      affectsContractValue: false,
      cumulative: false,
    },
    {
      name: 'خصم تعجيل الصرف',
      contractPercent: 0,
      contractValue: 0,
      onExtract: true,
      extractPercent: toMoney(subcontract.earlyPaymentDiscountRate) * 100,
      affectsContractValue: false,
      cumulative: false,
    },
    {
      name: 'أعباء إدارية للهوالك',
      contractPercent: toMoney(subcontract.contractAdminOverheadRate) * 100,
      contractValue: contractValue * toMoney(subcontract.contractAdminOverheadRate),
      onExtract: true,
      extractPercent: toMoney(subcontract.contractAdminOverheadRate) * 100,
      affectsContractValue: false,
      cumulative: false,
    },
  ].filter((row) => row.contractValue > 0 || row.extractPercent > 0 || row.contractPercent > 0);
}
