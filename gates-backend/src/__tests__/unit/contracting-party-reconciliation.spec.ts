import { getSubcontractorPartyStatement } from '../../modules/contracting/reconciliation/contracting-party-statement.service';

describe('contracting party reconciliation (P0-3)', () => {
  it('rejects unknown subcontractor statement', async () => {
    await expect(
      getSubcontractorPartyStatement('00000000-0000-4000-8000-000000000001', 'missing-id')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
