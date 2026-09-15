import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import type { DocumentLayoutConfigUpsertInput } from '../schemas/document-layout.schema';
import type { Prisma } from '@prisma/client';

/**
 * Print/layout customization defaults. Mirrored (deliberately, not imported —
 * frontend has no access to the Prisma package) by
 * `gates-web/lib/documentLayout/defaults.ts`. Keep both in sync when adding
 * a new field.
 */
export const DOCUMENT_LAYOUT_DEFAULTS = {
  name: 'تخطيط',
  isDefault: false,
  documentType: 'ALL' as const,
  layoutPreset: 'LIGHT' as const,
  tableStyle: 'LIGHT' as const,
  fontFamily: 'Cairo',
  primaryColor: '#1e293b',
  secondaryColor: '#64748b',
  textColor: '#0f172a',
  paperSize: 'A4' as const,
  marginSize: 'NORMAL_15MM' as const,
  logoUrl: null as string | null,
  logoPosition: 'LEFT' as const,
  logoWidth: 150,
  companyNameAr: null as string | null,
  companyNameEn: null as string | null,
  taxId: null as string | null,
  commercialReg: null as string | null,
  tagline: null as string | null,
  footerText: null as string | null,
  bankDetails: null as unknown,
  showQrCode: true,
  showStampAndSignatures: true,
  signatureLabels: ['مهندس الموقع', 'الاستشاري', 'المراجعة المالية', 'المدير العام'] as unknown,
  watermarkText: null as string | null,
  columnSettings: null as unknown,
};

export class DocumentLayoutService {
  /** All saved layout configs for a company, optionally filtered. */
  async list(companyId: string, filters: { documentType?: string; branchId?: string }) {
    const where: Prisma.DocumentLayoutConfigWhereInput = { companyId };
    if (filters.documentType) where.documentType = filters.documentType as never;
    if (filters.branchId) where.branchId = filters.branchId;

    return prisma.documentLayoutConfig.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getById(companyId: string, id: string) {
    const config = await prisma.documentLayoutConfig.findFirst({ where: { id, companyId } });
    if (!config) throw new AppError(404, 'Document layout config not found');
    return config;
  }

  /**
   * Resolves the effective config for a given document type, falling back
   * from the most specific row to the least specific, then to hardcoded
   * defaults: (branch, type) -> (company-wide, type) -> (branch, ALL) ->
   * (company-wide, ALL) -> defaults.
   */
  async resolveEffective(companyId: string, documentType: string, branchId?: string | null) {
    const candidates: Array<{ branchId: string | null; documentType: string }> = [];
    if (branchId) candidates.push({ branchId, documentType });
    candidates.push({ branchId: null, documentType });
    if (documentType !== 'ALL') {
      if (branchId) candidates.push({ branchId, documentType: 'ALL' });
      candidates.push({ branchId: null, documentType: 'ALL' });
    }

    for (const candidate of candidates) {
      const found = await prisma.documentLayoutConfig.findFirst({
        where: {
          companyId,
          branchId: candidate.branchId,
          documentType: candidate.documentType as never,
          isDefault: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (found) return found;
      const latest = await prisma.documentLayoutConfig.findFirst({
        where: {
          companyId,
          branchId: candidate.branchId,
          documentType: candidate.documentType as never,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (latest) return latest;
    }

    return { ...DOCUMENT_LAYOUT_DEFAULTS, id: null, companyId, branchId: branchId ?? null };
  }

  /** Create a new named shape, or update the existing id. Never overwrites another shape. */
  async upsert(companyId: string, data: DocumentLayoutConfigUpsertInput) {
    const branchId = data.branchId ?? null;
    const documentType = data.documentType ?? 'ALL';
    const name = data.name?.trim() || 'تخطيط';

    if (branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: branchId, companyId } });
      if (!branch) throw new AppError(404, 'Branch not found for this company');
    }

    const payload = {
      name,
      layoutPreset: data.layoutPreset,
      tableStyle: data.tableStyle,
      fontFamily: data.fontFamily,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      textColor: data.textColor,
      paperSize: data.paperSize,
      marginSize: data.marginSize,
      logoUrl: data.logoUrl ?? null,
      logoPosition: data.logoPosition,
      logoWidth: data.logoWidth,
      companyNameAr: data.companyNameAr ?? null,
      companyNameEn: data.companyNameEn ?? null,
      taxId: data.taxId ?? null,
      commercialReg: data.commercialReg ?? null,
      tagline: data.tagline ?? null,
      footerText: data.footerText ?? null,
      bankDetails: (data.bankDetails ?? undefined) as Prisma.InputJsonValue | undefined,
      showQrCode: data.showQrCode,
      showStampAndSignatures: data.showStampAndSignatures,
      signatureLabels: (data.signatureLabels ?? undefined) as Prisma.InputJsonValue | undefined,
      watermarkText: data.watermarkText ?? null,
      columnSettings: (data.columnSettings ?? undefined) as Prisma.InputJsonValue | undefined,
    };

    const siblingCount = await prisma.documentLayoutConfig.count({
      where: { companyId, documentType: documentType as never },
    });
    const makeDefault = data.isDefault === true || siblingCount === 0;

    if (data.id) {
      const existing = await prisma.documentLayoutConfig.findFirst({
        where: { id: data.id, companyId },
      });
      if (!existing) throw new AppError(404, 'Document layout config not found');
      if (makeDefault) {
        await prisma.documentLayoutConfig.updateMany({
          where: { companyId, documentType: documentType as never, NOT: { id: existing.id } },
          data: { isDefault: false },
        });
      }
      const config = await prisma.documentLayoutConfig.update({
        where: { id: existing.id },
        data: { ...payload, isDefault: makeDefault || existing.isDefault },
      });
      logger.info({ companyId, id: config.id, name }, 'Document layout config updated');
      return config;
    }

    if (makeDefault) {
      await prisma.documentLayoutConfig.updateMany({
        where: { companyId, documentType: documentType as never },
        data: { isDefault: false },
      });
    }

    const config = await prisma.documentLayoutConfig.create({
      data: {
        companyId,
        branchId,
        documentType: documentType as never,
        isDefault: makeDefault,
        ...payload,
      },
    });

    logger.info({ companyId, branchId, documentType, id: config.id, name }, 'Document layout config created');
    return config;
  }

  async remove(companyId: string, id: string) {
    const existing = await prisma.documentLayoutConfig.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError(404, 'Document layout config not found');

    await prisma.documentLayoutConfig.delete({ where: { id } });
    logger.info({ companyId, id }, 'Document layout config deleted');
    return { id };
  }
}

export const documentLayoutService = new DocumentLayoutService();
