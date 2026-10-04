import { createServer, request as httpRequest } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import express from 'express';
import { authorize } from '../../shared/middleware/authorize.middleware';
import { permissionGrantedFromCache } from '../../shared/cache/tenant-context.cache';
import { getCachedUserPermissions } from '../../shared/cache/tenant-context.cache';
import { LEGACY_POS_RETIRED, legacyPosGone } from '../../modules/pos/routes/pos.routes';
import type { AuthRequest } from '../../shared/auth/types';

jest.mock('../../shared/cache/tenant-context.cache', () => {
  const actual = jest.requireActual('../../shared/cache/tenant-context.cache');
  return {
    ...actual,
    getCachedUserPermissions: jest.fn(),
  };
});

const routes = readFileSync(join(__dirname, '../../modules/pos/routes/pos.routes.ts'), 'utf8');
const service = readFileSync(join(__dirname, '../../modules/pos/services/pos.service.ts'), 'utf8');
const orderRoutes = readFileSync(join(__dirname, '../../modules/pos/routes/pos-order.routes.ts'), 'utf8');
const shiftRoutes = readFileSync(join(__dirname, '../../modules/pos/routes/pos-shift.routes.ts'), 'utf8');

const cashierPermissions = {
  grantAll: false,
  permissions: [
    { resource: 'pos', action: 'view' as const, allow: true, module: null, branchId: null },
    { resource: 'pos', action: 'edit' as const, allow: true, module: null, branchId: null },
    { resource: 'pos', action: 'post' as const, allow: true, module: null, branchId: null },
  ],
};

describe('POS Phase 4A legacy paths are closed', () => {
  it('returns 410 for the retired POS writes and the invoice-shaped sales list', async () => {
    const app = express();
    app.post('/sales', legacyPosGone);
    app.get('/sales', legacyPosGone);
    app.get('/sales/:id', legacyPosGone);
    app.post('/sales/:id/cancel', legacyPosGone);
    app.post('/sales/:id/print-receipt', legacyPosGone);
    app.post('/inventory/update-real-time', legacyPosGone);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const paths: Array<[string, string]> = [
      ['POST', '/sales'],
      ['GET', '/sales'],
      ['GET', '/sales/any-invoice'],
      ['POST', '/sales/any-invoice/cancel'],
      ['POST', '/sales/any-invoice/print-receipt'],
      ['POST', '/inventory/update-real-time'],
    ];

    try {
      for (const [method, path] of paths) {
        const status = await new Promise<number>((resolve, reject) => {
          const req = httpRequest(
            { hostname: '127.0.0.1', port, path, method },
            (res) => resolve(res.statusCode ?? 0)
          );
          req.on('error', reject);
          req.end();
        });
        expect(status).toBe(410);
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });

  it('does not call invoice or stock writers from the POS route', () => {
    expect(routes).toContain("router.post('/sales', legacyPosGone)");
    expect(routes).toContain("router.get('/sales', legacyPosGone)");
    expect(routes).toContain("router.post('/sales/:id/cancel', legacyPosGone)");
    expect(routes).toContain("router.post('/inventory/update-real-time', legacyPosGone)");
    expect(routes).toContain(LEGACY_POS_RETIRED);
    expect(routes).not.toContain('createPOSSale');
    expect(routes).not.toContain('cancelPOSSale');
    expect(routes).not.toContain('listPOSSales');
    expect(routes).not.toContain('updateInventoryRealTime');
    expect(routes).toContain('getDailyPOSReport');
    expect(service).not.toContain('invoiceService');
    expect(service).not.toContain('stockMovementService');
    expect(service).not.toContain('postMovementInTx');
    expect(service).toContain('getDailyPOSReport');
  });
});

describe('POS Phase 4A privileged actions', () => {
  const cached = getCachedUserPermissions as jest.Mock;

  beforeEach(() => {
    cached.mockReset();
  });

  it('does not let ordinary sell/post permission satisfy unpost or reopen', () => {
    expect(permissionGrantedFromCache(cashierPermissions, 'pos', 'post')).toBe(true);
    expect(permissionGrantedFromCache(cashierPermissions, 'pos', 'edit')).toBe(true);
    expect(permissionGrantedFromCache(cashierPermissions, 'pos', 'unpost')).toBe(false);
    expect(permissionGrantedFromCache(cashierPermissions, 'pos', 'reopen_shift')).toBe(false);
    expect(permissionGrantedFromCache(cashierPermissions, 'pos', 'discount')).toBe(false);
    expect(permissionGrantedFromCache(cashierPermissions, 'pos', 'reprint')).toBe(false);
  });

  it('returns 403 when a cashier unposts or reopens a shift', async () => {
    cached.mockResolvedValue(cashierPermissions);
    const req = {
      user: { sub: 'cashier-1', realm_access: { roles: ['sales'] } },
      companyId: 'company-1',
    } as AuthRequest;
    const next = jest.fn();

    await authorize({ resource: 'pos', action: 'unpost' })(req, {} as never, next);
    await authorize({ resource: 'pos', action: 'reopen_shift' })(req, {} as never, next);
    await authorize({ resource: 'pos', action: 'reprint' })(req, {} as never, next);

    expect(next).toHaveBeenCalledTimes(3);
    for (const call of next.mock.calls) {
      expect(call[0]).toEqual(expect.objectContaining({ statusCode: 403 }));
    }
    expect(orderRoutes).toContain("authorize({ resource: 'pos', action: 'reprint' })");
    expect(orderRoutes).toContain("authorize({ resource: 'pos', action: 'unpost' })");
    expect(shiftRoutes).toContain("authorize({ resource: 'pos', action: 'reopen_shift' })");
    expect(orderRoutes).not.toContain("action: 'post' },\n  async (req: AuthRequest, res: Response) => {\n    const ctx = buildPosPostingContext(req);\n    const data = await posOrderPostingService.unpostOrder");
  });

  it('allows an explicit unpost grant and still denies reopen', async () => {
    cached.mockResolvedValue({
      grantAll: false,
      permissions: [
        ...cashierPermissions.permissions,
        { resource: 'pos', action: 'unpost' as const, allow: true, module: null, branchId: null },
      ],
    });
    const req = {
      user: { sub: 'supervisor-1', realm_access: { roles: ['sales'] } },
      companyId: 'company-1',
    } as AuthRequest;
    const unpostNext = jest.fn();
    const reopenNext = jest.fn();

    await authorize({ resource: 'pos', action: 'unpost' })(req, {} as never, unpostNext);
    await authorize({ resource: 'pos', action: 'reopen_shift' })(req, {} as never, reopenNext);

    expect(unpostNext).toHaveBeenCalledWith();
    expect(reopenNext.mock.calls[0][0]).toEqual(expect.objectContaining({ statusCode: 403 }));
  });
});
