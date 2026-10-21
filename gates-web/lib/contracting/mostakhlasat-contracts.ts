import {
  executableRows,
  ownerBoqHierarchyHints,
  parentCodeFromItemCode,
  withItemCodeHierarchy,
} from './boq-hierarchy';
import { ELEMENT_TYPES } from './labels';
import { previewRateAnalysisLineTotal } from './rate-analysis-preview';
import type { BOQCostElementType, OwnerBoqItem } from './types';
import type { DraftLine } from './client-invoice-math';

export type LegacyExtractItemInput = {
  workItemId: string;
  itemName: string;
  itemNumber?: string;
  quantity: number;
  unit?: string | null;
  unitPrice?: number;
};

export type LegacyExtractPayload = {
  projectId: string;
  contractorId?: string;
  extractNumber?: string;
  extractDate: string;
  statementType?: 'partial' | 'final';
  statement?: string;
  extractType: 'contractor' | 'owner';
  items: LegacyExtractItemInput[];
};

/** Display totals for the legacy contractor statement screen. Percents are 0–100. */
export function legacyContractorStatementSummary(input: {
  currentWorks: number;
  previousWorks: number;
  advancePercent?: number | string | null;
  insurancePercent?: number | string | null;
  taxPercent?: number | string | null;
}): {
  executedWorks: number;
  previousWorks: number;
  currentWorks: number;
  advanceDeduction: number;
  insuranceDeduction: number;
  taxDeduction: number;
  netPayable: number;
} {
  const currentWorks = roundStatementMoney(input.currentWorks);
  const previousWorks = roundStatementMoney(input.previousWorks);
  const advanceDeduction = roundStatementMoney(currentWorks * percentRate(input.advancePercent));
  const insuranceDeduction = roundStatementMoney(currentWorks * percentRate(input.insurancePercent));
  const taxDeduction = roundStatementMoney(currentWorks * percentRate(input.taxPercent));
  return {
    executedWorks: roundStatementMoney(previousWorks + currentWorks),
    previousWorks,
    currentWorks,
    advanceDeduction,
    insuranceDeduction,
    taxDeduction,
    netPayable: roundStatementMoney(currentWorks - advanceDeduction - insuranceDeduction - taxDeduction),
  };
}

function percentRate(value: number | string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 100) / 100;
}

function roundStatementMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function resolveOwnerBoqCreatePayload(input: {
  parentCode: string;
  itemCode: string;
  descriptionAr: string;
  descriptionEn?: string;
  notes?: string;
  unit: string;
  contractQuantity: number;
  existingItems: Array<{ id: string; itemCode: string }>;
}):
  | {
      ok: true;
      itemCode: string;
      parentId?: string;
      notes?: string;
      descriptionAr: string;
      descriptionEn?: string;
      unit: string;
      contractQuantity: number;
    }
  | { ok: false; error: string } {
  const parentCode = input.parentCode.trim();
  const rawCode = input.itemCode.trim();
  if (!rawCode) return { ok: false, error: 'كود البند والوصف العربي مطلوبان' };
  if (!input.descriptionAr.trim()) return { ok: false, error: 'كود البند والوصف العربي مطلوبان' };

  const itemCode = parentCode ? `${parentCode}.${rawCode.replace(/^[.\-\/]+/, '')}` : rawCode;
  if (input.existingItems.some((row) => row.itemCode.trim() === itemCode)) {
    return { ok: false, error: 'كود البند مستخدم مسبقاً في هذه المقايسة.' };
  }

  const parentIdFromSelect = parentCode
    ? input.existingItems.find((row) => row.itemCode === parentCode)?.id
    : undefined;
  const dottedParent = parentCodeFromItemCode(itemCode);
  const parentIdFromCode = dottedParent
    ? input.existingItems.find((row) => row.itemCode === dottedParent)?.id
    : undefined;
  const parentId = parentIdFromSelect ?? parentIdFromCode;
  if (parentId && parentIdFromSelect === undefined && parentCode && !parentIdFromCode) {
    return { ok: false, error: 'البند الرئيسي المختار غير موجود في هذه المقايسة.' };
  }

  const notes = input.notes?.trim() || undefined;
  return {
    ok: true,
    itemCode,
    parentId,
    notes,
    descriptionAr: input.descriptionAr.trim(),
    descriptionEn: input.descriptionEn?.trim() || undefined,
    unit: input.unit,
    contractQuantity: input.contractQuantity,
  };
}

export function inferWorkItemParentId(
  itemNumber: string,
  siblings: Array<{ id: string; itemNumber: string }>
): string | undefined {
  const parentCode = parentCodeFromItemCode(itemNumber);
  if (!parentCode) return undefined;
  return siblings.find((row) => row.itemNumber === parentCode)?.id;
}

export function executableOwnerBoqItems(items: OwnerBoqItem[]): OwnerBoqItem[] {
  return executableRows(withItemCodeHierarchy(items, (item) => item.itemCode, ownerBoqHierarchyHints));
}

export function enterpriseDraftInvoiceItems(
  boqItems: OwnerBoqItem[],
  lines: DraftLine[]
): Array<{ projectBOQItemId: string; currentQuantity: number }> {
  const qtyById = new Map(lines.map((row) => [row.projectBOQItemId, row.currentQuantity]));
  return executableOwnerBoqItems(boqItems).map((item) => ({
    projectBOQItemId: item.id,
    currentQuantity: qtyById.get(item.id) ?? 0,
  }));
}

export function wave3ExtractSaveLines(
  drafts: Array<{ boqItemId: string; itemNumber: string; currentQuantity: number }>
): Array<{ boqItemId: string; currentQuantity: number }> {
  return executableRows(withItemCodeHierarchy(drafts, (row) => row.itemNumber)).map((row) => ({
    boqItemId: row.boqItemId,
    currentQuantity: row.currentQuantity,
  }));
}

export function buildLegacyExtractPayload(input: {
  projectId: string;
  contractorId?: string;
  extractNumber?: string;
  extractDate?: string;
  statementType?: 'partial' | 'final';
  statement?: string;
  items: LegacyExtractItemInput[];
}): LegacyExtractPayload {
  const payload: LegacyExtractPayload = {
    projectId: input.projectId,
    extractDate: input.extractDate ?? new Date().toISOString(),
    extractType: input.contractorId ? 'contractor' : 'owner',
    items: input.items,
  };
  if (input.contractorId) payload.contractorId = input.contractorId;
  const serial = input.extractNumber?.trim();
  if (serial) payload.extractNumber = serial;
  if (input.statementType) payload.statementType = input.statementType;
  const statement = input.statement?.trim();
  if (statement) payload.statement = statement;
  return payload;
}

export function buildLegacyExtractItemsFromWorkRows(
  rows: Array<{
    id: string;
    arabicName: string;
    itemNumber?: string;
    unit?: string | null;
    unitPrice?: number | string | null;
    __isExecutable?: boolean;
  }>,
  currentQty: Record<string, string | number>
): LegacyExtractItemInput[] {
  return rows
    .filter((row) => row.__isExecutable !== false)
    .map((row) => ({
      workItemId: row.id,
      itemName: row.arabicName,
      itemNumber: row.itemNumber,
      quantity: Number(currentQty[row.id] || 0),
      unit: row.unit,
      unitPrice: row.unitPrice != null ? Number(row.unitPrice) : undefined,
    }))
    .filter((row) => row.quantity > 0);
}

export function mapExtractContractError(error: unknown): { status: number | null; message: string } {
  const record = error as { code?: string; message?: string };
  const status = Number.parseInt(String(record?.code ?? ''), 10);
  const raw = record?.message?.trim() || (error instanceof Error ? error.message : 'تعذر العملية');
  if (status === 409) {
    return { status, message: /مستخدم|exists|already/i.test(raw) ? raw : `تعارض رقم المستند: ${raw}` };
  }
  if (status === 422) {
    if (/HEADER|header|رئيسي/i.test(raw)) {
      return { status, message: 'لا يمكن اعتماد بند رئيسي — اختر البنود التنفيذية فقط.' };
    }
    return { status, message: raw };
  }
  return { status: Number.isFinite(status) ? status : null, message: raw };
}

export function rateAnalysisSaveItems(
  lines: Array<{
    costElementType: BOQCostElementType;
    resourceCode?: string;
    descriptionAr?: string;
    unit?: string;
    consumptionQuotaPerUnit: number;
    unitCost: number;
    wasteFactorRate: number;
    notes?: string;
  }>
) {
  return lines
    .filter((line) => (ELEMENT_TYPES as readonly string[]).includes(line.costElementType))
    .filter((line) => line.consumptionQuotaPerUnit > 0 || line.unitCost > 0)
    .map((line) => ({
      costElementType: line.costElementType,
      resourceCode: line.resourceCode?.trim() || undefined,
      descriptionAr: line.descriptionAr?.trim() || undefined,
      unit: line.unit?.trim() || 'وحدة',
      consumptionQuotaPerUnit: line.consumptionQuotaPerUnit,
      unitCost: line.unitCost,
      wasteFactorRate: line.wasteFactorRate,
      notes: line.notes?.trim() || undefined,
      previewTotal: previewRateAnalysisLineTotal({
        consumptionQuotaPerUnit: line.consumptionQuotaPerUnit,
        wasteFactorRate: line.wasteFactorRate,
        unitCost: line.unitCost,
      }),
    }));
}

export function isOwnerBoqHeader(item: OwnerBoqItem | null | undefined): boolean {
  if (!item) return false;
  return item.hasChildren === true || item.isLeaf === false || item.isExecutable === false;
}
