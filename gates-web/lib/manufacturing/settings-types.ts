import type { ManufacturingLinePricingPolicy } from './line-pricing';

export type ManufacturingAccountRef = {
  id: string;
  code: string;
  arabicName: string;
};

export type ManufacturingSettingsView = {
  linePricingPolicy: ManufacturingLinePricingPolicy;
  allowWorkWithoutBom: boolean;
  wipMaterialsAccountCode: string | null;
  wipLaborOverheadAccountCode: string | null;
  rawInventoryAccountCode: string | null;
  finishedGoodsAccountCode: string | null;
  overheadAbsorptionAccountCode: string | null;
  wipMaterialsAccount: ManufacturingAccountRef | null;
  wipLaborOverheadAccount: ManufacturingAccountRef | null;
  rawInventoryAccount: ManufacturingAccountRef | null;
  finishedGoodsAccount: ManufacturingAccountRef | null;
  overheadAbsorptionAccount: ManufacturingAccountRef | null;
};

export const MANUFACTURING_SETTINGS_ACCOUNT_FIELDS = [
  {
    idKey: 'wipMaterialsAccountId' as const,
    refKey: 'wipMaterialsAccount' as const,
    codeKey: 'wipMaterialsAccountCode' as const,
    label: 'حساب تحت التشغيل — خامات',
    hint: 'يُستخدم في قيد صرف خامات أمر التصنيع.',
  },
  {
    idKey: 'wipLaborOverheadAccountId' as const,
    refKey: 'wipLaborOverheadAccount' as const,
    codeKey: 'wipLaborOverheadAccountCode' as const,
    label: 'حساب تحت التشغيل — أجور ومصاريف',
    hint: 'يُستخدم في قيد الأجور والمصاريف الصناعية غير المباشرة.',
  },
  {
    idKey: 'rawInventoryAccountId' as const,
    refKey: 'rawInventoryAccount' as const,
    codeKey: 'rawInventoryAccountCode' as const,
    label: 'حساب مخزون الخامات',
    hint: 'الحساب المقابل عند صرف الخامات من المخزن.',
  },
  {
    idKey: 'finishedGoodsAccountId' as const,
    refKey: 'finishedGoodsAccount' as const,
    codeKey: 'finishedGoodsAccountCode' as const,
    label: 'حساب مخزون الإنتاج التام',
    hint: 'يُستخدم عند استلام المنتج التام في المخزن.',
  },
  {
    idKey: 'overheadAbsorptionAccountId' as const,
    refKey: 'overheadAbsorptionAccount' as const,
    codeKey: 'overheadAbsorptionAccountCode' as const,
    label: 'حساب امتصاص المصاريف الصناعية',
    hint: 'الحساب الدائن لمصاريف الأجور والتشغيل غير المباشرة.',
  },
];
