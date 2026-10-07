import { authorizeAttendance } from '../../modules/hr/middleware/attendance-authorize.middleware';
import { AppError } from '../../shared/middleware/error-handler';

const getCachedUserPermissions = jest.fn();
jest.mock('../../shared/cache/tenant-context.cache', () => {
  const actual = jest.requireActual('../../shared/cache/tenant-context.cache');
  return {
    ...actual,
    getCachedUserPermissions: (...args: unknown[]) => getCachedUserPermissions(...args),
  };
});

function snap(actions: string[]) {
  return {
    grantAll: false,
    permissions: actions.map((action) => ({
      resource: 'attendance',
      action,
      allow: true,
      module: 'hr',
      branchId: null,
    })),
  };
}

async function run(cap: Parameters<typeof authorizeAttendance>[0], actions: string[]) {
  getCachedUserPermissions.mockResolvedValue(snap(actions));
  const next = jest.fn();
  const req = { user: { sub: 'u1' }, companyId: 'co1', tenantId: 'co1' };
  await authorizeAttendance(cap)(req as any, {} as any, next);
  return next;
}

describe('authorizeAttendance middleware', () => {
  it('view only passes view not manage', async () => {
    const next = await run('manage', ['view']);
    expect(next.mock.calls[0][0]).toBeInstanceOf(AppError);
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(403);
  });

  it('manage via legacy edit alias', async () => {
    const next = await run('manage', ['edit']);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('correct via edit alias', async () => {
    const next = await run('correct', ['edit']);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('approve capability', async () => {
    const denied = await run('approve', ['view']);
    expect(denied.mock.calls[0][0]).toBeInstanceOf(AppError);
    const ok = await run('approve', ['approve']);
    expect(ok).toHaveBeenCalled();
    expect(ok.mock.calls[0][0]).toBeUndefined();
  });

  it('lock via approve alias', async () => {
    const next = await run('lock', ['approve']);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('device_manage via edit', async () => {
    const next = await run('device_manage', ['edit']);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0]).toBeUndefined();
  });
});
