import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import {
  assertNoCompetingWave3OwnerFinancials,
  assertNoCompetingWave3SubFinancials,
  loadProjectStackPolicy,
  requireLegacyWave3ForSubcontractLink,
  requireLegacyWave3Stack,
  WAVE3_SUBCONTRACT_LINK_BLOCKED_MESSAGE,
  WAVE3_WRITE_BLOCKED_MESSAGE,
} from '../../modules/contracting/services/contracting-canonical-stack.service';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    contractingProject: { findFirst: jest.fn() },
    contractExtract: { findFirst: jest.fn() },
    clientExtract: { findFirst: jest.fn() },
    subcontractorExtract: { findFirst: jest.fn() },
  },
}));

const mocked = prisma as unknown as {
  contractingProject: { findFirst: jest.Mock };
  contractExtract: { findFirst: jest.Mock };
  clientExtract: { findFirst: jest.Mock };
  subcontractorExtract: { findFirst: jest.Mock };
};

describe('contracting canonical stack (P0-1)', () => {
  const companyId = 'co-1';
  const projectId = 'proj-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks Wave3 writes on ENTERPRISE projects', async () => {
    mocked.contractingProject.findFirst.mockResolvedValue({
      id: projectId,
      canonicalStack: 'ENTERPRISE',
    });
    await expect(requireLegacyWave3Stack(companyId, projectId)).rejects.toThrow(WAVE3_WRITE_BLOCKED_MESSAGE);
  });

  it('allows Wave3 writes on LEGACY_WAVE3 projects', async () => {
    mocked.contractingProject.findFirst.mockResolvedValue({
      id: projectId,
      canonicalStack: 'LEGACY_WAVE3',
    });
    await expect(requireLegacyWave3Stack(companyId, projectId)).resolves.toBeUndefined();
  });

  it('rejects cross-company project lookup', async () => {
    mocked.contractingProject.findFirst.mockResolvedValue(null);
    await expect(requireLegacyWave3Stack(companyId, projectId)).rejects.toBeInstanceOf(AppError);
  });

  it('blocks ProjectSubcontract link on ENTERPRISE', async () => {
    mocked.contractingProject.findFirst.mockResolvedValue({
      id: projectId,
      canonicalStack: 'ENTERPRISE',
    });
    await expect(requireLegacyWave3ForSubcontractLink(companyId, projectId)).rejects.toThrow(
      WAVE3_SUBCONTRACT_LINK_BLOCKED_MESSAGE
    );
  });

  it('blocks ClientInvoice post when Wave3 owner cert already posted on ENTERPRISE project', async () => {
    mocked.contractingProject.findFirst.mockResolvedValue({
      id: projectId,
      canonicalStack: 'ENTERPRISE',
    });
    mocked.contractExtract.findFirst.mockResolvedValue({ id: 'ce-1' });
    mocked.clientExtract.findFirst.mockResolvedValue(null);
    await expect(assertNoCompetingWave3OwnerFinancials(companyId, projectId)).rejects.toThrow(
      /Wave3/
    );
  });

  it('skips competing check on LEGACY_WAVE3 projects', async () => {
    mocked.contractingProject.findFirst.mockResolvedValue({
      id: projectId,
      canonicalStack: 'LEGACY_WAVE3',
    });
    await expect(assertNoCompetingWave3OwnerFinancials(companyId, projectId)).resolves.toBeUndefined();
    expect(mocked.contractExtract.findFirst).not.toHaveBeenCalled();
  });

  it('blocks SubcontractInvoice post when Wave3 sub cert posted on ENTERPRISE', async () => {
    mocked.contractingProject.findFirst.mockResolvedValue({
      id: projectId,
      canonicalStack: 'ENTERPRISE',
    });
    mocked.contractExtract.findFirst.mockResolvedValue(null);
    mocked.subcontractorExtract.findFirst.mockResolvedValue({ id: 'se-1' });
    await expect(assertNoCompetingWave3SubFinancials(companyId, projectId)).rejects.toThrow(/Wave3/);
  });

  it('loadProjectStackPolicy returns stack for tenant-scoped project', async () => {
    mocked.contractingProject.findFirst.mockResolvedValue({
      id: projectId,
      canonicalStack: 'ENTERPRISE',
    });
    const row = await loadProjectStackPolicy(companyId, projectId);
    expect(row.canonicalStack).toBe('ENTERPRISE');
    expect(mocked.contractingProject.findFirst).toHaveBeenCalledWith({
      where: { id: projectId, companyId },
      select: { id: true, canonicalStack: true },
    });
  });
});
