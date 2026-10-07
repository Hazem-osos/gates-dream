import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export type ResolveStoreDocumentBranchInput = {
  documentBranchId?: string | null;
  warehouseId?: string | null;
  warehouseIds?: string[];
  headerBranchId?: string | null;
};

/** Reject blank ids and the legacy mistake of storing companyId as branchId. */
export function normalizeBranchCandidate(
  id?: string | null,
  companyId?: string
): string | undefined {
  const trimmed = id?.trim();
  if (!trimmed) return undefined;
  if (companyId && trimmed === companyId) return undefined;
  return trimmed;
}

async function companyDefaultBranchId(companyId: string): Promise<string | null> {
  const row = await prisma.branch.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function warehouseBranchId(companyId: string, warehouseId: string): Promise<string | null> {
  const row = await prisma.warehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { branchId: true },
  });
  const id = row?.branchId?.trim();
  return id || null;
}

async function validateBranchId(companyId: string, candidate?: string | null): Promise<string | null> {
  const normalized = normalizeBranchCandidate(candidate, companyId);
  if (!normalized) return null;
  const branch = await prisma.branch.findFirst({
    where: { id: normalized, companyId, deletedAt: null },
    select: { id: true },
  });
  return branch?.id ?? null;
}

/**
 * Resolve a real branch for store documents: document row, request header,
 * warehouse default, then company default branch.
 */
export async function resolveStoreDocumentBranchId(
  companyId: string,
  input: ResolveStoreDocumentBranchInput
): Promise<string> {
  const fromDoc = await validateBranchId(companyId, input.documentBranchId);
  if (fromDoc) return fromDoc;

  const fromHeader = await validateBranchId(companyId, input.headerBranchId);
  if (fromHeader) return fromHeader;

  const warehouseIds = [
    ...(input.warehouseId ? [input.warehouseId] : []),
    ...(input.warehouseIds ?? []),
  ];
  for (const whId of warehouseIds) {
    const whBranch = await warehouseBranchId(companyId, whId);
    const resolved = await validateBranchId(companyId, whBranch ?? undefined);
    if (resolved) return resolved;
  }

  const defaultBranch = await companyDefaultBranchId(companyId);
  const fromDefault = await validateBranchId(companyId, defaultBranch ?? undefined);
  if (fromDefault) return fromDefault;

  throw new AppError(422, 'يجب اختيار الفرع قبل ترحيل المستند المخزني.');
}

export async function resolveStoreDocumentBranchIdOptional(
  companyId: string,
  input: ResolveStoreDocumentBranchInput
): Promise<string | null> {
  try {
    return await resolveStoreDocumentBranchId(companyId, input);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 422) return null;
    throw error;
  }
}
