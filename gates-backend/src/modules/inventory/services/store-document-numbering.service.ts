import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { documentSequenceService } from '../../platform/services/document-sequence.service';

export const STORE_DOCUMENT_KINDS = [
  'stocktaking',
  'transfer',
  'adjustment',
  'receipt',
  'issue',
  'other-adjustment',
  'assembly',
  'disassembly',
] as const;

export type StoreDocumentKind = (typeof STORE_DOCUMENT_KINDS)[number];

type StoreDocNumberingSpec = {
  docType: string;
  legacySuffix: string;
  loadExistingSerials: (tx: Prisma.TransactionClient, companyId: string) => Promise<(string | null)[]>;
  isSerialTaken: (tx: Prisma.TransactionClient, companyId: string, serial: string) => Promise<boolean>;
};

const SPECS: Record<StoreDocumentKind, StoreDocNumberingSpec> = {
  stocktaking: {
    docType: 'STORE-CHECK',
    legacySuffix: 'SC01',
    loadExistingSerials: async (tx, companyId) => {
      const rows = await tx.stocktaking.findMany({ where: { companyId }, select: { serial: true } });
      return rows.map((r) => r.serial);
    },
    isSerialTaken: async (tx, companyId, serial) => {
      const row = await tx.stocktaking.findFirst({
        where: { companyId, serial },
        select: { id: true },
      });
      return Boolean(row);
    },
  },
  transfer: {
    docType: 'STORE-TRANS',
    legacySuffix: 'ST01',
    loadExistingSerials: async (tx, companyId) => {
      const rows = await tx.transfer.findMany({ where: { companyId }, select: { serial: true } });
      return rows.map((r) => r.serial);
    },
    isSerialTaken: async (tx, companyId, serial) => {
      const row = await tx.transfer.findFirst({
        where: { companyId, serial },
        select: { id: true },
      });
      return Boolean(row);
    },
  },
  adjustment: {
    docType: 'STORE-DIST',
    legacySuffix: 'SD01',
    loadExistingSerials: async (tx, companyId) => {
      const rows = await tx.adjustment.findMany({ where: { companyId }, select: { serial: true } });
      return rows.map((r) => r.serial);
    },
    isSerialTaken: async (tx, companyId, serial) => {
      const row = await tx.adjustment.findFirst({
        where: { companyId, serial },
        select: { id: true },
      });
      return Boolean(row);
    },
  },
  receipt: {
    docType: 'STORE-RECEIPT',
    legacySuffix: 'GR01',
    loadExistingSerials: async (tx, companyId) => {
      const rows = await tx.receipt.findMany({ where: { companyId }, select: { serial: true } });
      return rows.map((r) => r.serial);
    },
    isSerialTaken: async (tx, companyId, serial) => {
      const row = await tx.receipt.findFirst({
        where: { companyId, serial },
        select: { id: true },
      });
      return Boolean(row);
    },
  },
  issue: {
    docType: 'STORE-ISSUE',
    legacySuffix: 'GI01',
    loadExistingSerials: async (tx, companyId) => {
      const rows = await tx.issue.findMany({ where: { companyId }, select: { serial: true } });
      return rows.map((r) => r.serial);
    },
    isSerialTaken: async (tx, companyId, serial) => {
      const row = await tx.issue.findFirst({
        where: { companyId, serial },
        select: { id: true },
      });
      return Boolean(row);
    },
  },
  'other-adjustment': {
    docType: 'STORE-ADJUST',
    legacySuffix: 'SA01',
    loadExistingSerials: async (tx, companyId) => {
      const rows = await tx.otherAdjustment.findMany({
        where: { companyId },
        select: { serial: true },
      });
      return rows.map((r) => r.serial);
    },
    isSerialTaken: async (tx, companyId, serial) => {
      const row = await tx.otherAdjustment.findFirst({
        where: { companyId, serial },
        select: { id: true },
      });
      return Boolean(row);
    },
  },
  assembly: {
    docType: 'STORE-COLL',
    legacySuffix: 'CL01',
    loadExistingSerials: async (tx, companyId) => {
      const rows = await tx.assembly.findMany({ where: { companyId }, select: { serial: true } });
      return rows.map((r) => r.serial);
    },
    isSerialTaken: async (tx, companyId, serial) => {
      const row = await tx.assembly.findFirst({
        where: { companyId, serial },
        select: { id: true },
      });
      return Boolean(row);
    },
  },
  disassembly: {
    docType: 'STORE-DISASSEMBLY',
    legacySuffix: 'DS01',
    loadExistingSerials: async (tx, companyId) => {
      const rows = await tx.disassembly.findMany({ where: { companyId }, select: { serial: true } });
      return rows.map((r) => r.serial);
    },
    isSerialTaken: async (tx, companyId, serial) => {
      const row = await tx.disassembly.findFirst({
        where: { companyId, serial },
        select: { id: true },
      });
      return Boolean(row);
    },
  },
};

export function parseStoreDocumentKind(raw: string): StoreDocumentKind | null {
  const normalized = raw.trim().toLowerCase();
  return (STORE_DOCUMENT_KINDS as readonly string[]).includes(normalized)
    ? (normalized as StoreDocumentKind)
    : null;
}

export async function peekStoreDocumentNextSerial(input: {
  companyId: string;
  branchId: string | null;
  fiscalYearId: string | null;
  kind: StoreDocumentKind;
}) {
  const spec = SPECS[input.kind];
  return documentSequenceService.peekNextForFamily({
    companyId: input.companyId,
    branchId: input.branchId,
    fiscalYearId: input.fiscalYearId,
    docType: spec.docType,
    legacySuffix: spec.legacySuffix,
    seedFromExisting: documentSequenceService.maxExistingNumber(async () =>
      spec.loadExistingSerials(prisma, input.companyId)
    ),
    isAvailable: async (candidate) => !(await spec.isSerialTaken(prisma, input.companyId, candidate)),
  });
}

export async function resolveStoreDocumentSerialInTx(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    branchId: string | null;
    fiscalYearId: string | null;
    kind: StoreDocumentKind;
    clientSerial?: string | null;
  }
): Promise<string> {
  const spec = SPECS[input.kind];
  const trimmed = input.clientSerial?.trim() || '';

  const allocated =
    trimmed ||
    (await documentSequenceService.nextNumberForFamilyInTx(tx, {
      companyId: input.companyId,
      branchId: input.branchId,
      fiscalYearId: input.fiscalYearId,
      docType: spec.docType,
      legacySuffix: spec.legacySuffix,
      seedFromExisting: documentSequenceService.maxExistingNumber(async () =>
        spec.loadExistingSerials(tx, input.companyId)
      ),
      isAvailable: async (candidate) => !(await spec.isSerialTaken(tx, input.companyId, candidate)),
    }));

  if (!allocated) {
    throw new AppError(422, 'رقم المسلسل مطلوب — الترقيم يدوي لهذا النوع من المستندات');
  }

  if (await spec.isSerialTaken(tx, input.companyId, allocated)) {
    throw new AppError(409, 'رقم المسلسل مستخدم مسبقاً');
  }

  return allocated;
}
