import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import type { ContractingProjectStackPolicy } from '@prisma/client';

export const WAVE3_WRITE_BLOCKED_MESSAGE =
  'هذا المشروع يستخدم مسار المقاولات Enterprise. استخدم المكتب الفني ومستخلص المالك (ClientInvoice) أو عقود الباطن (SubcontractInvoice). مسار Wave3 (ProjectBoqItem / ContractExtract) متاح فقط لمشاريع LEGACY_WAVE3.';

export const WAVE3_SUBCONTRACT_LINK_BLOCKED_MESSAGE =
  'لا يمكن إضافة ProjectSubcontract (Wave3) على مشروع Enterprise. أنشئ عقد باطن من /subcontracts.';

export const COMPETING_WAVE3_OWNER_FINANCIAL_MESSAGE =
  'يوجد مستخلص مالك مرحّل على مسار Wave3 لهذا المشروع. لا يمكن ترحيل ClientInvoice Enterprise حتى تُغلق أو تُراجع المستندات القديمة.';

export const COMPETING_WAVE3_SUB_FINANCIAL_MESSAGE =
  'يوجد مستخلص باطن مرحّل على مسار Wave3 لهذا المشروع. لا يمكن ترحيل SubcontractInvoice Enterprise حتى تُغلق أو تُراجع المستندات القديمة.';

export async function loadProjectStackPolicy(
  companyId: string,
  projectId: string
): Promise<{ id: string; canonicalStack: ContractingProjectStackPolicy }> {
  const project = await prisma.contractingProject.findFirst({
    where: { id: projectId, companyId },
    select: { id: true, canonicalStack: true },
  });
  if (!project) throw new AppError(404, 'Contracting project not found');
  return project;
}

/** Blocks Wave3 document mutations on ENTERPRISE projects. */
export async function requireLegacyWave3Stack(companyId: string, projectId: string): Promise<void> {
  const project = await loadProjectStackPolicy(companyId, projectId);
  if (project.canonicalStack === 'ENTERPRISE') {
    throw new AppError(422, WAVE3_WRITE_BLOCKED_MESSAGE);
  }
}

/** Blocks deprecated ProjectSubcontract links on ENTERPRISE projects. */
export async function requireLegacyWave3ForSubcontractLink(
  companyId: string,
  projectId: string
): Promise<void> {
  const project = await loadProjectStackPolicy(companyId, projectId);
  if (project.canonicalStack === 'ENTERPRISE') {
    throw new AppError(422, WAVE3_SUBCONTRACT_LINK_BLOCKED_MESSAGE);
  }
}

/** Prevent duplicate owner revenue on ENTERPRISE stack when Wave3 certs were already posted. */
export async function assertNoCompetingWave3OwnerFinancials(
  companyId: string,
  projectId: string
): Promise<void> {
  const project = await loadProjectStackPolicy(companyId, projectId);
  if (project.canonicalStack !== 'ENTERPRISE') return;

  const [contractExtract, headerExtract] = await Promise.all([
    prisma.contractExtract.findFirst({
      where: {
        companyId,
        projectId,
        extractType: 'CLIENT',
        status: 'POSTED',
      },
      select: { id: true },
    }),
    prisma.clientExtract.findFirst({
      where: { companyId, projectId, status: 'POSTED' },
      select: { id: true },
    }),
  ]);

  if (contractExtract || headerExtract) {
    throw new AppError(422, COMPETING_WAVE3_OWNER_FINANCIAL_MESSAGE);
  }
}

/** Prevent duplicate subcontract cost on ENTERPRISE stack when Wave3 sub certs were posted. */
export async function assertNoCompetingWave3SubFinancials(
  companyId: string,
  projectId: string
): Promise<void> {
  const project = await loadProjectStackPolicy(companyId, projectId);
  if (project.canonicalStack !== 'ENTERPRISE') return;

  const [contractExtract, headerExtract] = await Promise.all([
    prisma.contractExtract.findFirst({
      where: {
        companyId,
        projectId,
        extractType: 'SUBCONTRACTOR',
        status: 'POSTED',
      },
      select: { id: true },
    }),
    prisma.subcontractorExtract.findFirst({
      where: { companyId, projectId, status: 'POSTED' },
      select: { id: true },
    }),
  ]);

  if (contractExtract || headerExtract) {
    throw new AppError(422, COMPETING_WAVE3_SUB_FINANCIAL_MESSAGE);
  }
}
