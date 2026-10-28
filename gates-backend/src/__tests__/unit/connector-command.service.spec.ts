import { ConnectorCommandService } from '../../modules/migration-engine/legacy-source/connector-command.service';

describe('ConnectorCommandService', () => {
  it('complete rejects wrong device', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'c1',
      companyId: 'co',
      deviceId: 'dev-a',
      status: 'PENDING',
    });
    const update = jest.fn();
    const prisma = {
      migrationConnectorCommand: { findFirst, update, updateMany: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as import('@prisma/client').PrismaClient;

    const svc = new ConnectorCommandService(prisma);
    const ok = await svc.complete({
      commandId: 'c1',
      companyId: 'co',
      deviceId: 'dev-b',
      ok: true,
      result: {},
    });
    expect(ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
